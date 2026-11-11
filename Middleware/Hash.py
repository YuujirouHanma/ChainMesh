import hashlib
import itertools

HASH_BITS = 256


def hash(currentBlock, prevHash, signature, nonce, timeStamp):
    """sha256(message + prev_hash + signature + nonce + timeStamp), sama seperti rumus di README."""
    payLoad = str(currentBlock) + str(prevHash) + str(signature) + str(nonce) + str(timeStamp)
    return hashlib.sha256(payLoad.encode("utf-8")).hexdigest()


def meets_difficulty(hash_hex, difficulty):
    """True jika `difficulty` bit pertama hash (sebagai bilangan biner 256 bit) semuanya 0.
    Versi lama mengubah tiap KARAKTER hex ke kode ASCII-nya, sehingga syarat "00" selalu
    lolos asalkan karakter pertama hash berupa angka (peluang 62,5%)."""
    if not isinstance(hash_hex, str) or len(hash_hex) != 64:
        return False
    try:
        return int(hash_hex, 16) >> (HASH_BITS - difficulty) == 0
    except ValueError:
        return False


def mine(currentBlock, prevHash, signature, timeStamp, difficulty):
    """Proof of Work: coba nonce = 1, 2, 3, ... sampai hash memenuhi difficulty.
    Return (nonce, hash_hex, proof_of_work), dengan proof_of_work = jumlah percobaan yang gagal."""
    # bagian awal payload selalu sama, cukup di-hash sekali lalu disalin (jauh lebih cepat)
    prefix = hashlib.sha256((str(currentBlock) + str(prevHash) + str(signature)).encode("utf-8"))
    suffix = str(timeStamp).encode("utf-8")
    shift = HASH_BITS - difficulty
    for nonce in itertools.count(1):
        candidate = prefix.copy()
        candidate.update(str(nonce).encode("ascii") + suffix)
        digest = candidate.digest()
        if int.from_bytes(digest, "big") >> shift == 0:
            return nonce, digest.hex(), nonce - 1
