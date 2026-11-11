import Config
from Database import Repositories as DB
from View import NetworkView


def _looks_like_public_key(text):
    return len(text) in (66, 130) and all(char in "0123456789abcdefABCDEF" for char in text)


def Control():
    """Lihat graf jaringan (peer, status edge, latency) serta tambah / hapus peer."""
    while True:
        NetworkView.ShowPeers(DB.GetPeers(), Config.NODE_ADDRESS)
        command = NetworkView.AskCommand()
        if not command:
            return
        if _looks_like_public_key(command.lstrip("-")):
            print("That looks like a PUBLIC KEY. Use it as the Receiver ID in menu 1 (Create Transaction); "
                  "menu 4 expects an IP address, e.g. 127.0.0.1:8341")
            continue
        if command.startswith("-"):
            address = DB.NormalizeAddress(command[1:])
            print(f"Peer {address} removed" if address and DB.RemovePeer(address) else "Peer not found")
            continue
        address = DB.NormalizeAddress(command)
        if address is None:
            print("Invalid address. Use IP or IP:PORT, e.g. 192.168.1.5 or 127.0.0.1:8334")
        elif DB.IsSelfAddress(address):
            print("That address is this node itself")
        elif DB.AddPeers([address]):
            print(f"Peer {address} added. The client window will connect to it within a few seconds.")
        else:
            print(f"Peer {address} is already known")
