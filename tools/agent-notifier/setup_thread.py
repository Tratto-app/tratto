#!/usr/bin/env python3
"""Create a dedicated Codex thread on the configured daemon. No model turn."""
import asyncio
import json
from pathlib import Path
import sys

from receiver import AppServer


async def main():
    if len(sys.argv) != 2:
        raise RuntimeError('usage: setup_thread.py /absolute/repository/path')
    repo = str(Path(sys.argv[1]).resolve())
    app = AppServer('', repo)
    try:
        await app.begin()
        result = await app.request('thread/start', {
            'cwd': repo, 'approvalPolicy': 'never', 'sandbox': 'read-only',
            'developerInstructions': Path(__file__).with_name('instructions.md').read_text()})
        print(json.dumps({'coordination_thread_id': result['thread']['id'],
                          'model_turn_started': False}))
    finally:
        await app.close()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (RuntimeError, OSError, KeyError):
        print('No se creó la sesión: comprobar daemon y autenticación del servidor.', file=sys.stderr)
        sys.exit(1)
