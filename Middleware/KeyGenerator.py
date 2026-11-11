import hashlib
import re

from ecdsa import SECP256k1, SigningKey, VerifyingKey

# Format message transaksi: "From <public key pengirim> to <ID penerima>, <isi pesan>"
_TRANSACTION = re.compile(r"From (\S+) to (\S+), (.*)", re.DOTALL)


def ParseTransaction(msg):
    """Return (pengirim, penerima, isi) atau None jika format message tidak sesuai."""
    match = _TRANSACTION.fullmatch(msg) if isinstance(msg, str) else None
    return match.groups() if match else None


def ParseSender(msg):
    transaction = ParseTransaction(msg)
    if transaction is None:
        raise ValueError("invalid transaction message format")
    return transaction[0]


def load_private_key_from_hex(hex_string):
    return SigningKey.from_string(bytes.fromhex(hex_string), curve=SECP256k1)


def load_public_key_from_hex(hex_string):
    # menerima public key compressed (33 byte) maupun uncompressed
    return VerifyingKey.from_string(bytes.fromhex(hex_string), curve=SECP256k1)


def generate_key_pair():
    private_key = SigningKey.generate(curve=SECP256k1)
    return private_key, private_key.get_verifying_key()


def private_key_to_hex(private_key):
    return private_key.to_string().hex()


def public_key_to_hex(public_key):
    return public_key.to_string("compressed").hex()


def public_key_from_private_hex(private_key_hex):
    return public_key_to_hex(load_private_key_from_hex(private_key_hex).get_verifying_key())


def sign_message(private_key_hex, message):
    """Tanda tangan ECDSA secp256k1 (SHA-256). Return signature dalam bentuk hex."""
    private_key = load_private_key_from_hex(private_key_hex)
    return private_key.sign_deterministic(message.encode("utf-8"), hashfunc=hashlib.sha256).hex()


def verify_signature(public_key_hex, message, signature_hex):
    """True jika signature dibuat oleh pemilik public key tersebut untuk message ini."""
    try:
        public_key = load_public_key_from_hex(public_key_hex)
        return public_key.verify(bytes.fromhex(signature_hex), message.encode("utf-8"),
                                 hashfunc=hashlib.sha256)
    except Exception:  # signature salah/rusak, public key tidak valid, tipe data salah, dll.
        return False
