import Config
from Database import Repositories as DB
from Middleware import BIPMemonicGenerator as MemonicGen, KeyGenerator as KeyGen
from View import HomeView


def InitNode():
    """Siapkan file data dan identitas node (pasangan kunci ECDSA secp256k1).
    Dipanggil oleh ketiga proses (wallet, server, client); yang pertama jalan membuat kuncinya."""
    DB.InitStorage()
    DB.AddPeers(Config.SEED_PEERS)          # peer awal dari opsi --peer / NODE_PEERS
    created = []

    def _ensure(data):
        private_key = data.get("PrivateKey") or ""
        try:
            public_key = KeyGen.public_key_from_private_hex(private_key) if private_key else ""
        except Exception:
            print("WARNING: the stored private key is invalid, generating a new wallet")
            public_key = ""
        if not public_key:
            print("Generating Credential Keys ... ")
            new_private_key, new_public_key = KeyGen.generate_key_pair()
            private_key = KeyGen.private_key_to_hex(new_private_key)
            public_key = KeyGen.public_key_to_hex(new_public_key)
            data["SeedShown"] = False
            created.append(True)
        data["PrivateKey"], data["PublicKey"] = private_key, public_key
        data["NodeAddress"] = Config.NODE_ADDRESS

    data = DB.UpdateUserData(_ensure)
    return data, bool(created)


def Control():
    """Tampilan awal wallet. Seed hanya ditampilkan otomatis sekali (saat wallet baru dibuat)."""
    data, _ = InitNode()
    show_seed = not data.get("SeedShown")
    seed = MemonicGen.CreateMemonicPhrase(data["PrivateKey"]) if show_seed else None
    HomeView.Main(seed, data["PublicKey"], Config.NODE_ADDRESS)
    if show_seed:
        DB.SetUserData(SeedShown=True)


def ShowWallet():
    data = DB.GetUserData()
    HomeView.Main(MemonicGen.CreateMemonicPhrase(data["PrivateKey"]), data["PublicKey"], Config.NODE_ADDRESS)


def RestoreWallet():
    phrase = HomeView.AskSeed()
    if not phrase:
        print("Restore canceled")
        return
    try:
        private_key = MemonicGen.RestorePrivateKey(phrase)
        public_key = KeyGen.public_key_from_private_hex(private_key)
    except Exception as err:
        print("X) Invalid seed:", err)
        return
    if public_key == DB.GetUserData("PublicKey"):
        print("That seed belongs to the wallet that is already active.")
        return
    if not HomeView.Confirm(f"Replace the current wallet with public key {public_key}?"):
        print("Restore canceled")
        return
    DB.SetUserData(PrivateKey=private_key, PublicKey=public_key, SeedShown=True)
    print("Wallet restored. Restart the server and client windows so that peers see the new identity.")
