from Database import Repositories as DB
from Models.Blockchain import Blockchain
from Models.Interface import Block
from Network import WSBlockChainSync


def _nearest_neighbours(online_only=False):
    """Urutan peer untuk sinkronisasi (algoritma Nearest Neighbor, paper bagian 6):
    peer Online dahulu, lalu bobot edge (latency) terkecil. Peer Offline/Unknown paling akhir."""
    peers = [(address, info) for address, info in DB.GetPeers().items()
             if isinstance(info, dict) and not DB.IsSelfAddress(address)]
    if online_only:
        peers = [item for item in peers if item[1].get("Status") == "Online"]

    def weight(item):
        latency = item[1].get("Latency")
        known = isinstance(latency, (int, float)) and not isinstance(latency, bool)
        return item[1].get("Status") != "Online", latency if known else float("inf")

    return [address for address, _ in sorted(peers, key=weight)]


def FetchChain(address):
    """Minta blockchain + data jaringan ke satu peer. Return None jika gagal."""
    try:
        data = WSBlockChainSync.SynchronizeHandler(address)
    except Exception as err:
        print(f"  - {address}: unreachable ({err.__class__.__name__})")
        return None
    if not isinstance(data, dict) or not isinstance(data.get("BlockChainData"), list):
        print(f"  - {address}: invalid response")
        return None
    return data


def _merge_network(data, source):
    """Peer yang Online menurut node lain ikut dicatat (graf jaringan menjadi complete graph)."""
    network = data.get("NetworkData")
    nodes = network.get("Nodes") if isinstance(network, dict) else None
    if not isinstance(nodes, dict):
        return
    online = [address for address, info in nodes.items()
              if isinstance(info, dict) and info.get("Status") == "Online"]
    learned = DB.AddPeers(online)
    if learned:
        print(f"  New peers learned from {source}: {', '.join(learned)}")


def AdoptChain(chain, source="", verified=False):
    replaced, orphans = Blockchain().replace_chain(chain, verified)
    if replaced:
        print(f"  Local chain updated from {source}: now {len(chain) - 1} block(s)")
        for message in orphans:
            # transaksi milik node ini yang kalah fork di-mining ulang di atas chain baru
            mined = Blockchain().mine_block(Block(message=message))
            DB.EnqueueBroadcast(mined.to_dict())
            print(f"  Our orphaned transaction was re-mined as block #{mined.number_of_block}")
    return replaced


def SynchronizeFrom(address):
    """Sinkronisasi langsung dari satu peer (misalnya pengirim blok yang lebih maju)."""
    data = FetchChain(address)
    if data is None:
        return False
    _merge_network(data, address)
    if not Blockchain().verify_chain(data["BlockChainData"]):
        print(f"  - {address}: sent an INVALID chain, ignored")
        return False
    return AdoptChain(data["BlockChainData"], address, verified=True)


def SynchronizeBlockChain(online_only=False):
    """Nearest Neighbor + backtracking (paper bagian 6 & 7.2): minta chain ke peer terdekat;
    jika offline atau chain-nya tidak valid, mundur ke peer terdekat berikutnya.
    Berhenti di peer pertama yang memberi chain valid (diadopsi jika lebih baik)."""
    peers = _nearest_neighbours(online_only)
    if not peers:
        kind = "online peers" if online_only else "peers"
        print(f"Synchronization skipped: no {kind} known yet (add one in menu 4)")
        return False
    print("Synchronizing with the nearest peer ...")
    for address in peers:
        data = FetchChain(address)
        if data is None:
            continue                                   # offline -> backtrack
        _merge_network(data, address)
        chain = data["BlockChainData"]
        if not Blockchain().verify_chain(chain):
            print(f"  - {address}: sent an INVALID chain, trying the next nearest peer")
            continue                                   # chain tidak valid -> backtrack
        if AdoptChain(chain, address, verified=True):
            return True
        local_blocks = len(Blockchain().BlockChainData) - 1
        print(f"  Local chain kept ({local_blocks} block(s)); {address} has {len(chain) - 1} block(s)")
        return False
    print("Synchronization failed: no peer returned a valid chain")
    return False


def VerifySyncBlockChain(online_only=False):
    """1) Verifikasi chain lokal; blok rusak (dan setelahnya) dibuang.
       2) Sinkronisasi dengan peer terdekat."""
    removed, status = Blockchain().repair_chain()
    if status is not None:
        print(f"Local chain INVALID at block #{status.BlockNumber} ({', '.join(status.errors())}): "
              f"{removed} block(s) removed, restoring from peers ...")
        online_only = False
    return SynchronizeBlockChain(online_only)
