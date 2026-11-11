from mnemonic import Mnemonic

_mnemonic = Mnemonic("english")


def CreateMemonicPhrase(private_key_hex):
    """Ubah private key (32 byte) menjadi 24 kata BIP-39.
    Versi lama memakai sha256(private key) sehingga seed tidak bisa dipakai memulihkan
    wallet. Seed ini bisa dikembalikan ke private key yang sama lewat RestorePrivateKey()."""
    return _mnemonic.to_mnemonic(bytes.fromhex(private_key_hex))


def RestorePrivateKey(phrase):
    """24 kata seed -> private key (hex). ValueError jika seed tidak valid."""
    words = " ".join(str(phrase).lower().split())
    if len(words.split()) != 24 or not _mnemonic.check(words):
        raise ValueError("the seed must be 24 valid BIP-39 words")
    return bytes(_mnemonic.to_entropy(words)).hex()
