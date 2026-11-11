import asyncio
import json
import sys
from urllib.parse import urlparse

import websockets

import Config
from Controller import NodeController
from Database import Repositories as DB
from Models.Blockchain import Blockchain
from Network import Protocol

CONNECTIONS = set()          # koneksi peer yang sudah handshake = tujuan broadcast


async def Broadcast_messages():
    """Ambil blok dari antrian Buffer/WaitBox.json lalu kirim ke SEMUA peer sekaligus
    (broadcast level-order, paper bagian 4). Cukup satu loop untuk seluruh server.
    Setiap ~2 detik daftar peer yang hidup juga dicek; jika berubah, dikirim ke semua peer
    (peer exchange) sehingga node yang belum saling kenal ikut terhubung -> complete graph."""
    last_peers, tick = None, 0
    while True:
        await asyncio.sleep(0.5)
        if not CONNECTIONS:
            continue                  # belum ada peer: blok tetap menunggu di antrian
        try:
            blocks = DB.DequeueBroadcast()
            tick += 1
            peers = Protocol.alive_peers() if tick % 4 == 0 else last_peers
        except Exception as err:
            print("Broadcast queue error:", err)
            continue
        for block in blocks:
            websockets.broadcast(CONNECTIONS, json.dumps({"type": "block", "block": block}))
            print(f"Broadcast block #{block.get('number_of_block')} ({str(block.get('hash'))[:12]}...) "
                  f"to {len(CONNECTIONS)} peer(s)")
        if peers != last_peers:
            websockets.broadcast(CONNECTIONS, json.dumps({"type": "peers", "peers": peers}))
            last_peers = peers


async def Register(websocket):
    """Handshake dengan client peer, ukur latency, lalu catat peer di ConnectionDB.
    Return alamat peer, atau None jika handshake gagal / ternyata node ini sendiri."""
    try:
        hello = json.loads(await asyncio.wait_for(websocket.recv(), timeout=10))
        if not isinstance(hello, dict) or hello.get("type") != "hello":
            return None
        welcome = Protocol.welcome_message()
        if hello.get("public_key") and hello.get("public_key") == welcome["public_key"]:
            await websocket.send(json.dumps({"type": "welcome", "self": True}))
            return None
        await websocket.send(json.dumps(welcome))
        port = hello.get("port")
        if type(port) is not int or not 0 < port < 65536:
            port = Config.DEFAULT_PORT
        # host diambil dari alamat koneksi TCP (pasti benar), port dari pesan hello
        peer = DB.NormalizeAddress(Config.FormatAddress(websocket.remote_address[0], port))
        latency = await Protocol.measure_latency(websocket, peer)
    except (asyncio.TimeoutError, websockets.ConnectionClosed, ValueError, TypeError):
        return None
    if peer is None:
        return None
    DB.UpdatePeer(peer, Latency=latency, PublicKey=str(hello.get("public_key") or ""), Inbound=True)
    print(f"[+] {peer} connected (latency {latency * 1000:.1f} ms)")
    return peer


async def Handler(websocket):
    peer = await Register(websocket)
    if peer is None:
        return
    CONNECTIONS.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        CONNECTIONS.discard(websocket)
        DB.UpdatePeer(peer, create=False, Inbound=False)
        print(f"[-] {peer} disconnected")


async def HandlerGetBlockChain(websocket):
    """Path /get-blockchaindata. Sesuai paper bagian 7.1, chain lokal diverifikasi dulu dan
    blok yang rusak dibuang, sehingga node ini tidak pernah mengirim chain yang tidak valid."""
    removed, status = await asyncio.to_thread(lambda: Blockchain().repair_chain())
    if status is not None:
        print(f"Local chain was invalid at block #{status.BlockNumber}: {removed} block(s) removed")
    await websocket.send(json.dumps({
        "WalletAuthor": DB.GetUserData("PublicKey"),
        "NetworkData": DB.GetNetworkData(),
        "BlockChainData": DB.GetBlockChainData()}))


async def route(websocket):
    if urlparse(websocket.path).path == "/get-blockchaindata":
        await HandlerGetBlockChain(websocket)
    else:
        await Handler(websocket)


async def main():
    NodeController.InitNode()
    DB.ResetInbound()
    print("Server Network Panel :")
    print(f"Node address : {Config.NODE_ADDRESS}")
    print(f"Listening on : ws://{Config.BIND_HOST}:{Config.NODE_PORT}")
    try:
        async with websockets.serve(route, Config.BIND_HOST, Config.NODE_PORT,
                                    ping_interval=20, ping_timeout=20):
            await Broadcast_messages()
    except OSError as err:
        print(f"Cannot start the server on port {Config.NODE_PORT}: {err}")
        print("Is another node already using this port? Choose another one, e.g. --port 8334")
        sys.exit(1)
