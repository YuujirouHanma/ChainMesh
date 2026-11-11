import json

from websockets.sync.client import connect

import Config


def SynchronizeHandler(address, timeout=Config.SYNC_TIMEOUT):
    """Ambil blockchain + data jaringan dari node lain lewat path /get-blockchaindata."""
    host, port = Config.ParseAddress(address)
    with connect(f"ws://{host}:{port}/get-blockchaindata", open_timeout=timeout,
                 close_timeout=1, max_size=None) as websocket:
        return json.loads(websocket.recv(timeout=timeout))
