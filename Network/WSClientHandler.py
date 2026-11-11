import asyncio
import json

import websockets

import Config
from Controller import BlockReceiverController, NodeController
from Database import Repositories as DB
from Middleware import BlockChainSync
from Network import Protocol

ACTIVE = {}              # alamat peer -> task koneksi keluar
SELF_ADDRESSES = set()   # alamat yang ternyata menunjuk ke node ini sendiri


def _still_peer(address):
    try:
        return address in DB.GetPeers() and address not in SELF_ADDRESSES
    except Exception:
        return True


def _local_tip():
    tip = DB.GetBlockChainData()[-1]
    height = tip.get("number_of_block") if isinstance(tip, dict) else 0
    return (height if type(height) is int else 0), (tip.get("hash") if isinstance(tip, dict) else "")


async def _handle_message(raw, address):
    try:
        message = json.loads(raw)
    except ValueError:
        return
    if not isinstance(message, dict):
        return
    if message.get("type") == "block":
        await asyncio.to_thread(BlockReceiverController.Control, message.get("block"), address)
    elif message.get("type") == "peers":
        learned = await asyncio.to_thread(DB.AddPeers, message.get("peers"))
        if learned:
            print(f"  New peers learned from {address}: {', '.join(learned)}")


async def _session(address, host, port, state):
    """Satu sesi koneksi: handshake, sinkronisasi bila perlu, lalu terima blok sampai putus.
    Return True jika ternyata yang dihubungi adalah node ini sendiri."""
    async with websockets.connect(f"ws://{host}:{port}", open_timeout=5, close_timeout=2,
                                  ping_interval=20, ping_timeout=20) as websocket:
        await websocket.send(json.dumps(Protocol.hello_message()))
        welcome = json.loads(await asyncio.wait_for(websocket.recv(), timeout=10))
        if not isinstance(welcome, dict) or welcome.get("type") != "welcome":
            raise ValueError("unexpected handshake reply")
        if welcome.get("self") or welcome.get("public_key") == DB.GetUserData("PublicKey"):
            return True
        latency = await Protocol.measure_latency(websocket, address)
        DB.UpdatePeer(address, create=False, Status="Online", Latency=latency,
                      PublicKey=str(welcome.get("public_key") or ""))
        state["online"], state["delay"] = True, 2
        print(f"Connected to {address} (latency {latency * 1000:.1f} ms, height {welcome.get('height')})")
        learned = DB.AddPeers(welcome.get("peers"))
        if learned:
            print(f"  New peers learned from {address}: {', '.join(learned)}")
        height, tip = welcome.get("height"), welcome.get("tip")
        local_height, local_hash = _local_tip()
        if type(height) is int and (height > local_height or (height == local_height and tip != local_hash)):
            print(f"  {address} has a longer / different chain, synchronizing ...")
            await asyncio.to_thread(BlockChainSync.SynchronizeFrom, address)
        async for raw in websocket:
            await _handle_message(raw, address)
    return False


async def ClientHandler(address):
    """Koneksi keluar dari node ini ke server peer `address` = satu edge berarah di graf.
    Jika gagal / putus, otomatis dicoba lagi dengan jeda yang makin lama (maks. 15 detik)."""
    parsed = Config.ParseAddress(address)
    if parsed is None:
        return
    state = {"online": None, "delay": 2}
    while _still_peer(address):
        try:
            if await _session(address, *parsed, state):
                print(f"{address} is this node itself, removed from the peer list")
                SELF_ADDRESSES.add(address)
                DB.RemovePeer(address)
                return
            reason = "closed by peer"
        except asyncio.CancelledError:
            raise
        except Exception as err:
            reason = err.__class__.__name__
        if state["online"] is not False:
            print(f"Connection to {address} {'lost' if state['online'] else 'failed'} ({reason})")
            DB.UpdatePeer(address, create=False, Status="Offline")
            state["online"] = False
        await asyncio.sleep(state["delay"])
        state["delay"] = min(state["delay"] * 2, 15)


async def MonitorConnections():
    """Hubungkan node ini ke SEMUA peer yang dikenal secara bersamaan (complete graph & level
    ordering, paper bagian 2-3). Peer baru di ConnectionDB ikut dihubungkan setiap 2 detik."""
    print("Client Network Panel :")
    print(f"Node address : {Config.NODE_ADDRESS}")
    while True:
        try:
            peers = set(DB.GetPeers())
        except Exception as err:
            print("Cannot read the peer list:", err)
            peers = set(ACTIVE)
        for address in list(ACTIVE):
            if address not in peers:
                ACTIVE.pop(address).cancel()      # peer dihapus lewat menu wallet
        for address in peers:
            if address in SELF_ADDRESSES or DB.IsSelfAddress(address):
                continue
            task = ACTIVE.get(address)
            if task is None or task.done():
                ACTIVE[address] = asyncio.create_task(ClientHandler(address))
        await asyncio.sleep(2)


async def main():
    NodeController.InitNode()
    await MonitorConnections()
