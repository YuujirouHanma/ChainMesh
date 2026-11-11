"""
Protokol pesan antar node (JSON lewat WebSocket, port default 8333).

  Koneksi peer (satu edge pada graf jaringan):
    client -> server  {"type": "hello", "port": 8333, "public_key": "...", "height": 5, "tip": "<hash>"}
    server -> client  {"type": "welcome", "public_key": "...", "height": 7, "tip": "<hash>",
                       "peers": ["192.168.1.6", "127.0.0.1:8334"]}
                      {"type": "welcome", "self": true}      <- yang terhubung ternyata node itu sendiri
    server -> client  {"type": "block", "block": {...}}      <- blok baru (broadcast)
    server -> client  {"type": "peers", "peers": [...]}      <- daftar peer berubah (peer exchange),
                                                                agar semua node saling kenal (complete graph)

  Sinkronisasi (path /get-blockchaindata, sekali request):
    server -> client  {"WalletAuthor": "...", "NetworkData": {...}, "BlockChainData": [...]}
"""
import asyncio
import json
import time

import Config
from Database import Repositories as DB


def _tip():
    tip = DB.GetBlockChainData()[-1]
    height = tip.get("number_of_block") if isinstance(tip, dict) else 0
    return (height if type(height) is int else 0), (tip.get("hash", "") if isinstance(tip, dict) else "")


def hello_message():
    height, tip = _tip()
    return {"type": "hello", "port": Config.NODE_PORT, "address": Config.NODE_ADDRESS,
            "public_key": DB.GetUserData("PublicKey") or "", "height": height, "tip": tip}


def alive_peers():
    """Peer yang terbukti hidup: server-nya bisa kita hubungi (Online) atau ia terhubung ke kita."""
    return sorted(address for address, info in DB.GetPeers().items()
                  if isinstance(info, dict) and (info.get("Status") == "Online" or info.get("Inbound")))


def welcome_message():
    height, tip = _tip()
    return {"type": "welcome", "address": Config.NODE_ADDRESS, "public_key": DB.GetUserData("PublicKey") or "",
            "height": height, "tip": tip, "peers": alive_peers()}


def emulated_delay(peer):
    """Jeda buatan (detik) ke `peer` dari NODE_LATENCY_FILE (demo di satu mesin); 0 jika tidak dipakai."""
    if not Config.LATENCY_FILE or not peer:
        return 0
    try:
        with open(Config.LATENCY_FILE, encoding="utf-8") as f:
            milliseconds = json.load(f).get(Config.NODE_ADDRESS, {}).get(peer, 0)
        return max(0.0, float(milliseconds)) / 1000
    except (OSError, ValueError, TypeError, AttributeError):
        return 0


async def _pause(seconds):
    """asyncio.sleep yang tetap presisi di Windows (resolusi timer di sana sekitar 15 ms)."""
    deadline = time.perf_counter() + seconds
    while (remaining := deadline - time.perf_counter()) > 0:
        await asyncio.sleep(remaining - 0.016 if remaining > 0.02 else 0)


async def measure_latency(websocket, peer=None, timeout=5):
    """Bobot edge = latency (round-trip ping/pong), dalam detik."""
    started = time.perf_counter()
    pong_waiter = await websocket.ping()
    await asyncio.wait_for(pong_waiter, timeout)
    delay = emulated_delay(peer)
    if delay:
        await _pause(delay)
    return round(time.perf_counter() - started, 6)
