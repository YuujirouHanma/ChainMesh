import datetime
import os
import socket

import Config
from Middleware import JSONWorker
from Models.Interface import GENESIS_BLOCK

DEFAULT_NODE = {"NodeAddress": "", "PrivateKey": "", "PublicKey": "", "SeedShown": False}
DEFAULT_NETWORK = {"Nodes": {}}
DEFAULT_WAITBOX = {"Queue": []}


def _now():
    return str(datetime.datetime.now())


def InitStorage():
    """Buat folder & file data default jika belum ada. Aman dipanggil berkali-kali."""
    for path, default in ((Config.NODE_DB, DEFAULT_NODE),
                          (Config.BLOCKCHAIN_DB, [GENESIS_BLOCK]),
                          (Config.CONNECTION_DB, DEFAULT_NETWORK),
                          (Config.WAITBOX, DEFAULT_WAITBOX)):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with JSONWorker.FileLock(path):
            if not os.path.exists(path):
                JSONWorker.CreateDataJSON(path, default)
    # WaitBox versi lama ({"Draft": ...}) diganti menjadi antrian ({"Queue": [...]})
    with JSONWorker.FileLock(Config.WAITBOX):
        waitbox = JSONWorker.GetDataJSON(Config.WAITBOX, DEFAULT_WAITBOX)
        if not isinstance(waitbox, dict) or not isinstance(waitbox.get("Queue"), list):
            JSONWorker.CreateDataJSON(Config.WAITBOX, {"Queue": []})


# ------------------------------------------------------------------ wallet / node
def GetUserData(param=''):
    data = JSONWorker.GetDataJSON(Config.NODE_DB, DEFAULT_NODE)
    if param == '':
        return data
    return data.get(param)


def UpdateUserData(update):
    return JSONWorker.UpdateDataJSON(Config.NODE_DB, update, DEFAULT_NODE)


def SetUserData(**fields):
    return UpdateUserData(lambda data: data.update(fields))


# ------------------------------------------------------------------ blockchain
def GetBlockChainData():
    try:
        chain = JSONWorker.GetDataJSON(Config.BLOCKCHAIN_DB, [GENESIS_BLOCK])
    except ValueError as err:   # file bukan JSON yang valid (misalnya rusak karena diedit manual)
        print(f"WARNING: {Config.BLOCKCHAIN_DB} is not valid JSON ({err}); using an empty chain")
        return [dict(GENESIS_BLOCK)]
    if not isinstance(chain, list) or not chain:
        print(f"WARNING: {Config.BLOCKCHAIN_DB} is not a list of blocks; using an empty chain")
        return [dict(GENESIS_BLOCK)]
    return chain


def CreateBlockChainData(param):
    JSONWorker.CreateDataJSON(Config.BLOCKCHAIN_DB, param)
    return param[-1]


def ChainLock():
    """Kunci blockchain lokal selama baca-ubah-tulis (mining, menerima blok, sinkronisasi)."""
    return JSONWorker.FileLock(Config.BLOCKCHAIN_DB)


# ------------------------------------------------------------------ jaringan (vertex graf)
_local_hosts = None


def _get_local_hosts():
    global _local_hosts
    if _local_hosts is None:
        hosts = {"127.0.0.1", "localhost", "0.0.0.0", Config.NODE_HOST}
        try:
            hosts.update(socket.gethostbyname_ex(socket.gethostname())[2])
        except OSError:
            pass
        _local_hosts = hosts
    return _local_hosts


def NormalizeAddress(address):
    parsed = Config.ParseAddress(address)
    return Config.FormatAddress(*parsed) if parsed else None


def IsSelfAddress(address):
    """True jika alamat menunjuk ke node ini sendiri (IP laptop ini + port node ini)."""
    parsed = Config.ParseAddress(address)
    return bool(parsed) and parsed[1] == Config.NODE_PORT and parsed[0] in _get_local_hosts()


def GetNetworkData():
    data = JSONWorker.GetDataJSON(Config.CONNECTION_DB, DEFAULT_NETWORK)
    if not isinstance(data, dict) or not isinstance(data.get("Nodes"), dict):
        return {"Nodes": {}}
    return data


def GetPeers():
    return GetNetworkData()["Nodes"]


def _new_peer(address):
    host, port = Config.ParseAddress(address)
    return {"IP": host, "Port": port, "PublicKey": "", "LastChanged": _now(),
            "Latency": None, "Status": "Unknown", "Inbound": False}


def UpdatePeer(address, create=True, **fields):
    """Ubah data satu peer. create=False: abaikan jika peer sudah dihapus dari daftar."""
    address = NormalizeAddress(address)
    if address is None or IsSelfAddress(address):
        return None

    def _update(data):
        nodes = data.setdefault("Nodes", {})
        if address not in nodes and not create:
            return
        peer = nodes.get(address) or _new_peer(address)
        peer.update(fields)
        peer["LastChanged"] = _now()
        nodes[address] = peer

    JSONWorker.UpdateDataJSON(Config.CONNECTION_DB, _update, DEFAULT_NETWORK)
    return address


def AddPeers(addresses):
    """Tambahkan peer yang belum dikenal. Return daftar peer yang benar-benar baru."""
    if not isinstance(addresses, list) or not addresses:
        return []
    added = []

    def _add(data):
        nodes = data.setdefault("Nodes", {})
        for item in addresses:
            address = NormalizeAddress(item)
            if address and address not in nodes and not IsSelfAddress(address):
                nodes[address] = _new_peer(address)
                added.append(address)

    JSONWorker.UpdateDataJSON(Config.CONNECTION_DB, _add, DEFAULT_NETWORK)
    return added


def RemovePeer(address):
    address = NormalizeAddress(address)
    removed = []

    def _remove(data):
        if data.setdefault("Nodes", {}).pop(address, None) is not None:
            removed.append(address)

    JSONWorker.UpdateDataJSON(Config.CONNECTION_DB, _remove, DEFAULT_NETWORK)
    return bool(removed)


def ResetInbound():
    def _reset(data):
        for peer in data.setdefault("Nodes", {}).values():
            if isinstance(peer, dict):
                peer["Inbound"] = False

    JSONWorker.UpdateDataJSON(Config.CONNECTION_DB, _reset, DEFAULT_NETWORK)


# ------------------------------------------------------------------ antrian broadcast (Buffer/WaitBox.json)
def EnqueueBroadcast(block):
    def _push(data):
        if not isinstance(data.get("Queue"), list):
            data["Queue"] = []
        data["Queue"].append(block)

    JSONWorker.UpdateDataJSON(Config.WAITBOX, _push, DEFAULT_WAITBOX)


def DequeueBroadcast():
    """Ambil (dan kosongkan) semua blok yang menunggu untuk di-broadcast."""
    data = JSONWorker.GetDataJSON(Config.WAITBOX, DEFAULT_WAITBOX)
    if not isinstance(data, dict) or not data.get("Queue"):
        return []
    taken = []

    def _pop(current):
        taken.extend(current.get("Queue") or [])
        return {"Queue": []}

    JSONWorker.UpdateDataJSON(Config.WAITBOX, _pop, DEFAULT_WAITBOX)
    return taken
