"""
Satu node demo = satu proses yang menjalankan server dan client WebSocket project ini
(isi __websocketserver__.py dan __websocketclient__.py, digabung dalam satu proses agar hemat memori).
Konfigurasi node diambil dari environment variable (lihat Config.py), diatur oleh demo/sandbox.py.
"""
import asyncio
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace", line_buffering=True)

from Network import WSClientHandler, WSServerHandler  # noqa: E402


async def main():
    server = asyncio.create_task(WSServerHandler.main())
    await asyncio.sleep(0.2)          # server siap dulu, baru client mulai menghubungi peer
    await asyncio.gather(server, WSClientHandler.main())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
