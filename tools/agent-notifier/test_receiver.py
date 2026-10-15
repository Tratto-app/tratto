import asyncio
import json
from pathlib import Path
import tempfile
import unittest

from receiver import AppServer, Journal, Receiver, validate_event

WS = '00000000-0000-4000-a000-000000000001'
BOARD = '00000000-0000-4000-b000-000000000001'
MSG = '00000000-0000-4000-c000-000000000001'
TOKEN = b'local-test-only-not-a-real-credential'


def event():
    return dict(version=1, event_id='codex:' + MSG, workspace_id=WS,
                message_id=MSG, board_id=BOARD)


class FakeCodex:
    ready = True

    def __init__(self):
        self.calls = []
        self.fail = False

    async def enqueue(self, value, instructions):
        self.calls.append(value)
        await asyncio.sleep(0)
        if self.fail:
            raise TimeoutError('uncertain acknowledgement')
        return 'submission-1'


class ReceiverTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / 'events.sqlite')
        self.journal = Journal(self.path)
        self.codex = FakeCodex()
        self.receiver = Receiver(TOKEN, WS, BOARD, self.journal, self.codex,
                                 'Sólo coordinación CRM; no proveedores.')
        self.authorization = 'Bearer ' + TOKEN.decode()

    async def asyncTearDown(self):
        self.journal.close()
        self.tmp.cleanup()

    async def test_auth_and_scope_do_not_queue(self):
        status, _ = await self.receiver.event('Bearer incorrect', event())
        self.assertEqual(status, 401)
        wrong = event() | {'workspace_id': '00000000-0000-4000-a000-000000000002'}
        self.assertEqual((await self.receiver.event(self.authorization, wrong))[0], 400)
        wrong = event() | {'texto': 'No admitir contenido arbitrario en el webhook'}
        self.assertEqual((await self.receiver.event(self.authorization, wrong))[0], 400)
        self.assertEqual(self.codex.calls, [])

    async def test_duplicate_and_concurrent_delivery_queue_once(self):
        a, b = await asyncio.gather(*[
            self.receiver.event(self.authorization, event()) for _ in range(2)])
        self.assertIn(202, [a[0], b[0]])
        self.assertEqual(len(self.codex.calls), 1)
        status, body = await self.receiver.event(self.authorization, event())
        self.assertEqual(status, 200)
        self.assertTrue(body['duplicate'])
        self.assertEqual(len(self.codex.calls), 1)

    async def test_uncertain_result_is_persistent_and_never_retried(self):
        self.codex.fail = True
        self.assertEqual((await self.receiver.event(self.authorization, event()))[0], 503)
        self.codex.fail = False
        self.journal.close()
        self.journal = Journal(self.path)
        self.receiver.journal = self.journal
        status, body = await self.receiver.event(self.authorization, event())
        self.assertEqual(status, 409)
        self.assertEqual(body['state'], 'uncertain')
        self.assertEqual(len(self.codex.calls), 1)

    async def test_restart_during_dispatch_does_not_reset_reservation(self):
        self.journal.reserve(event())
        self.journal.close()
        self.journal = Journal(self.path)
        self.receiver.journal = self.journal
        status, body = await self.receiver.event(self.authorization, event())
        self.assertEqual((status, body['state']), (409, 'uncertain'))
        self.assertEqual(self.codex.calls, [])

    async def test_disconnected_codex_does_not_reserve_or_claim_success(self):
        self.codex.ready = False
        self.assertEqual((await self.receiver.event(self.authorization, event()))[0], 503)
        self.codex.ready = True
        status, body = await self.receiver.event(self.authorization, event())
        self.assertEqual(status, 202)
        self.assertFalse(body['read_confirmed'])

    async def test_http_roundtrip_is_an_event_not_a_read_receipt(self):
        server = await asyncio.start_server(self.receiver.http, '127.0.0.1', 0)
        port = server.sockets[0].getsockname()[1]
        try:
            reader, writer = await asyncio.open_connection('127.0.0.1', port)
            body = json.dumps(event()).encode()
            writer.write((f'POST /events/claude HTTP/1.1\r\nAuthorization: {self.authorization}\r\n'
                          f'Content-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode() + body)
            await writer.drain()
            reply = await reader.read()
            writer.close()
            await writer.wait_closed()
            self.assertIn(b'HTTP/1.1 202', reply)
            self.assertIn(b'"read_confirmed": false', reply)
            self.assertNotIn(TOKEN, reply)
        finally:
            server.close()
            await server.wait_closed()


class QueueTests(unittest.IsolatedAsyncioTestCase):
    async def test_idle_event_during_a_pump_is_not_lost(self):
        app = AppServer(MSG, '/tmp')
        calls = []

        async def pump():
            calls.append('event')
            if len(calls) == 1:
                app.schedule_pump()
            await asyncio.sleep(0)
        app.pump = pump
        app.schedule_pump()
        await app.pump_task
        self.assertEqual(calls, ['event', 'event'])

    async def test_busy_thread_is_not_interrupted(self):
        app = AppServer(MSG, '/tmp')
        app.ready = True
        app.pending_ids = {'ours'}
        calls = []

        async def request(method, params):
            calls.append(method)
            return {'thread': {'status': {'type': 'active'}}}
        app.request = request
        await app.pump()
        self.assertEqual(calls, ['thread/read'])
        self.assertEqual(app.pending_ids, {'ours'})

    async def test_queue_pagination_only_starts_own_entry(self):
        app = AppServer(MSG, '/tmp')
        app.ready = True
        app.pending_ids = {'ours'}
        calls = []

        async def request(method, params):
            calls.append((method, params))
            if method == 'thread/read':
                return {'thread': {'status': {'type': 'idle'}}}
            if method == 'thread/queue/list':
                return ({'data': [{'id': 'others'}], 'nextCursor': 'second'} if 'cursor' not in params
                        else {'data': [{'id': 'ours'}], 'nextCursor': None})
            return {}
        app.request = request
        await app.pump()
        starts = [p for m, p in calls if m == 'thread/queue/start']
        self.assertEqual(starts, [{'threadId': MSG, 'queuedSubmissionId': 'ours'}])
        self.assertEqual(app.pending_ids, set())

    async def test_does_not_start_an_unrelated_queued_task(self):
        app = AppServer(MSG, '/tmp')
        app.ready = True
        app.pending_ids = {'already_consumed'}
        calls = []

        async def request(method, params):
            calls.append(method)
            return ({'thread': {'status': {'type': 'idle'}}} if method == 'thread/read'
                    else {'data': [{'id': 'unrelated'}], 'nextCursor': None})
        app.request = request
        await app.pump()
        self.assertNotIn('thread/queue/start', calls)


if __name__ == '__main__':
    unittest.main()
