#!/usr/bin/env python3
"""Authenticated database events -> the queue of an EXISTING Codex daemon.

No database polling, model API keys, shell interpolation, or commercial actions.
The host needs its own persistent, authenticated Codex + Supabase MCP setup.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import os
from pathlib import Path
import sqlite3
import sys
from uuid import UUID


def uuid_string(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("uuid_required")
    result = str(UUID(value))
    if result != value.lower():
        raise ValueError("canonical_uuid_required")
    return result


def validate_event(body: object, workspace: str, board: str) -> dict:
    expected = {"version", "event_id", "workspace_id", "message_id", "board_id"}
    if (not isinstance(body, dict) or set(body) != expected
            or type(body["version"]) is not int or body["version"] != 1):
        raise ValueError("invalid_event")
    message = uuid_string(body["message_id"])
    if (uuid_string(body["workspace_id"]) != workspace
            or uuid_string(body["board_id"]) != board
            or body["event_id"] != "codex:" + message):
        raise ValueError("wrong_scope")
    return body


class Journal:
    """Commit a reservation BEFORE contacting Codex. Never reset uncertainty."""

    def __init__(self, filename: str):
        path = Path(filename)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(filename)
        os.chmod(filename, 0o600)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS notifications(
            event_id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
            state TEXT NOT NULL, submission_id TEXT, error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
        self.db.execute("""UPDATE notifications SET state='uncertain',
            error='process_restarted_during_dispatch',updated_at=CURRENT_TIMESTAMP
            WHERE state='reserved'""")
        self.db.commit()

    def reserve(self, event: dict) -> tuple[bool, str]:
        with self.db:
            cursor = self.db.execute("""INSERT OR IGNORE INTO notifications
                (event_id,message_id,state) VALUES(?,?,'reserved')""",
                (event["event_id"], event["message_id"]))
        state = self.db.execute("SELECT state FROM notifications WHERE event_id=?",
                                (event["event_id"],)).fetchone()[0]
        return cursor.rowcount == 1, state

    def set_state(self, event_id: str, state: str, submission: str | None = None,
                  error: str | None = None):
        with self.db:
            self.db.execute("""UPDATE notifications SET state=?,submission_id=?,error=?,
                updated_at=CURRENT_TIMESTAMP WHERE event_id=?""",
                (state, submission, error, event_id))

    def close(self):
        self.db.close()

    def queued_ids(self) -> set[str]:
        return {row[0] for row in self.db.execute(
            "SELECT submission_id FROM notifications WHERE state='queued' AND submission_id IS NOT NULL")}


class AppServer:
    """JSON-RPC over the daemon's supported stdio proxy; never start another server."""

    def __init__(self, thread_id: str, repo: str, binary: str = "codex"):
        self.thread_id, self.repo, self.binary = thread_id, str(Path(repo).resolve()), binary
        self.proc = None
        self.waiters: dict[int, asyncio.Future] = {}
        self.next_id = 0
        self.ready = False
        self.lock = asyncio.Lock()
        self.pump_task = None
        self.pump_requested = False
        self.pending_ids: set[str] = set()

    async def begin(self):
        self.proc = await asyncio.create_subprocess_exec(
            self.binary, "app-server", "proxy", stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        asyncio.create_task(self._read())
        await self.request("initialize", {
            "clientInfo": {"name": "tratto-crm-events", "version": "1.0.0"},
            "capabilities": {"experimentalApi": True}})
        self.proc.stdin.write(b'{"method":"initialized"}\n')
        await self.proc.stdin.drain()

    async def connect(self):
        await self.begin()
        info = await self.request("thread/read", {"threadId": self.thread_id,
                                                  "includeTurns": False})
        if str(Path(info["thread"]["cwd"]).resolve()) != self.repo:
            raise RuntimeError("thread_repository_mismatch")
        # Attach to live status notifications without hydrating the conversation.
        await self.request("thread/resume", {"threadId": self.thread_id,
                                             "excludeTurns": True})
        self.ready = True
        # After a service restart, start already-confirmed queue entries if idle.
        await self.pump()

    async def request(self, method: str, params: dict) -> dict:
        self.next_id += 1
        key = self.next_id
        future = asyncio.get_running_loop().create_future()
        self.waiters[key] = future
        self.proc.stdin.write((json.dumps({"id": key, "method": method,
                                          "params": params}) + "\n").encode())
        await self.proc.stdin.drain()
        try:
            return await asyncio.wait_for(future, 30)
        finally:
            self.waiters.pop(key, None)

    async def _read(self):
        try:
            while line := await self.proc.stdout.readline():
                payload = json.loads(line)
                if "id" in payload and payload["id"] in self.waiters:
                    future = self.waiters[payload["id"]]
                    if future.done():
                        continue
                    if "error" in payload:
                        # Do not log raw daemon errors, account data, or conversation text.
                        future.set_exception(RuntimeError("app_server_rpc_error"))
                    else:
                        future.set_result(payload.get("result", {}))
                elif payload.get("method") in {"turn/completed", "thread/status/changed"}:
                    params = payload.get("params", {})
                    if params.get("threadId") == self.thread_id and self.ready:
                        self.schedule_pump()
        finally:
            self.ready = False
            for future in list(self.waiters.values()):
                if not future.done():
                    future.set_exception(RuntimeError("app_server_disconnected"))

    async def enqueue(self, event: dict, instructions: str) -> str:
        if not self.ready:
            raise RuntimeError("app_server_not_ready")
        prompt = instructions + "\n\nEvento autenticado (sólo identificadores):\n" + json.dumps(event)
        result = await self.request("thread/queue/add", {
            "threadId": self.thread_id,
            "clientUserMessageId": event["message_id"],
            "input": [{"type": "text", "text": prompt, "text_elements": []}]})
        # A queued item is not a read receipt and is not evidence of a reply.
        submission = result["queuedSubmission"]["id"]
        self.pending_ids.add(submission)
        self.schedule_pump()
        return submission

    def schedule_pump(self):
        self.pump_requested = True
        if not self.pump_task or self.pump_task.done():
            self.pump_task = asyncio.create_task(self._pump_events())

    async def _pump_events(self):
        # An idle event arriving DURING a status request must not be lost.
        while self.pump_requested:
            self.pump_requested = False
            await self.pump()

    async def pump(self):
        async with self.lock:
            if not self.ready or not self.pending_ids:
                return
            try:
                info = await self.request("thread/read", {"threadId": self.thread_id,
                                                          "includeTurns": False})
                status = info["thread"].get("status", {})
                if status.get("type") != "idle":
                    return  # Never steer, cancel, or interrupt the current turn.
                queued, cursor = [], None
                while True:
                    params = {"threadId": self.thread_id}
                    if cursor:
                        params["cursor"] = cursor
                    page = await self.request("thread/queue/list", params)
                    queued.extend(page["data"])
                    cursor = page.get("nextCursor")
                    if not cursor:
                        break
                self.pending_ids.intersection_update(item["id"] for item in queued)
                own = next((item for item in queued if item["id"] in self.pending_ids), None)
                if own:
                    await self.request("thread/queue/start", {
                        "threadId": self.thread_id, "queuedSubmissionId": own["id"]})
                    self.pending_ids.discard(own["id"])
            except (RuntimeError, asyncio.TimeoutError, KeyError):
                # A concurrent turn may have started. Retain the queue and expose failure.
                # No timer: the next live status event can try starting an existing entry.
                return

    async def close(self):
        self.ready = False
        if self.proc and self.proc.returncode is None:
            self.proc.terminate()
            await self.proc.wait()


class Receiver:
    def __init__(self, token: bytes, workspace: str, board: str, journal: Journal,
                 app_server, instructions: str):
        if len(token) < 32:
            raise ValueError("webhook_token_too_short")
        self.token, self.workspace, self.board = token, uuid_string(workspace), uuid_string(board)
        self.journal, self.app_server, self.instructions = journal, app_server, instructions

    async def event(self, authorization: str, body: object) -> tuple[int, dict]:
        supplied = authorization.removeprefix("Bearer ").encode()
        if not authorization.startswith("Bearer ") or not hmac.compare_digest(supplied, self.token):
            return 401, {"error": "unauthorized"}
        try:
            event = validate_event(body, self.workspace, self.board)
        except (ValueError, TypeError, KeyError):
            return 400, {"error": "invalid_event"}
        if not self.app_server.ready:
            return 503, {"error": "codex_not_ready"}
        reserved, state = self.journal.reserve(event)
        if not reserved:
            return (200, {"state": "queued", "duplicate": True}) if state == "queued" else (
                409, {"state": state, "error": "verify_previous_attempt_before_retry"})
        try:
            submission = await self.app_server.enqueue(event, self.instructions)
        except Exception:
            self.journal.set_state(event["event_id"], "uncertain", error="verify_codex_queue")
            return 503, {"state": "uncertain", "error": "verify_codex_queue"}
        self.journal.set_state(event["event_id"], "queued", submission=submission)
        return 202, {"state": "queued", "read_confirmed": False}

    async def http(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        status, result = 400, {"error": "bad_request"}
        try:
            header = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 5)
            if len(header) > 8192:
                raise ValueError("header_size")
            lines = header.decode("ascii").split("\r\n")
            method, path, version = lines[0].split(" ")
            headers = {}
            for line in lines[1:]:
                if line:
                    key, value = line.split(":", 1)
                    key = key.lower()
                    if key in headers:
                        raise ValueError("duplicate_header")
                    headers[key] = value.strip()
            if method == "GET" and path == "/healthz":
                status = 200 if self.app_server.ready else 503
                result = {"codex_ready": self.app_server.ready,
                          "mode": "events_only", "crm_read_verified": False}
            elif method == "POST" and path == "/events/claude":
                size = int(headers.get("content-length", "-1"))
                if not 0 < size <= 4096 or "transfer-encoding" in headers:
                    status, result = 413, {"error": "invalid_body_size"}
                elif headers.get("content-type", "").split(";", 1)[0] != "application/json":
                    status, result = 415, {"error": "json_required"}
                else:
                    body = json.loads(await asyncio.wait_for(reader.readexactly(size), 5))
                    status, result = await self.event(headers.get("authorization", ""), body)
            else:
                status, result = 404, {"error": "not_found"}
        except (ValueError, UnicodeError, asyncio.TimeoutError, asyncio.IncompleteReadError,
                asyncio.LimitOverrunError):
            pass
        data = json.dumps(result).encode()
        writer.write(f"HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\n"
                     f"Content-Length: {len(data)}\r\nConnection: close\r\n\r\n".encode() + data)
        await writer.drain()
        writer.close()
        await writer.wait_closed()


async def main():
    if os.environ.get("TRATTO_NOTIFY_ENABLED") != "true":
        raise RuntimeError("activation_requires_permanent_host_and_real_verification")
    workspace = uuid_string(os.environ["TRATTO_WORKSPACE_ID"])
    board = uuid_string(os.environ["TRATTO_BOARD_ID"])
    thread = uuid_string(os.environ["TRATTO_CODEX_THREAD_ID"])
    if thread == os.environ.get("CODEX_THREAD_ID"):
        raise RuntimeError("use_dedicated_coordination_thread_not_current_chat")
    token = Path(os.environ["TRATTO_CHAT_TOKEN_FILE"]).read_bytes().strip()
    journal = Journal(os.environ["TRATTO_NOTIFY_DB"])
    app = AppServer(thread, os.environ["TRATTO_REPO"], os.environ.get("TRATTO_CODEX_BIN", "codex"))
    app.pending_ids = journal.queued_ids()
    try:
        await app.connect()
        instructions = Path(__file__).with_name("instructions.md").read_text()
        receiver = Receiver(token, workspace, board, journal, app, instructions)
        server = await asyncio.start_server(receiver.http, "127.0.0.1",
                                             int(os.environ.get("TRATTO_NOTIFY_PORT", "8765")),
                                             limit=8192)
        print(json.dumps({"state": "listening", "mode": "events_only"}), flush=True)
        async with server:
            await server.serve_forever()
    finally:
        await app.close()
        journal.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (RuntimeError, KeyError, OSError, ValueError):
        print("No iniciado: verificar configuración/daemon. Sin secretos ni mensajes en logs.",
              file=sys.stderr)
        sys.exit(1)
