"""
Konfigurasi node.

Nilai default sudah cocok untuk 1 node per laptop (port 8333, data di folder project).
Untuk menjalankan beberapa node di SATU laptop (misalnya saat demo), ubah lewat
environment variable atau opsi __executer__.py (--port, --host, --data-dir, --peer):

  NODE_PORT      port WebSocket server node ini            (default 8333)
  NODE_HOST      IP node ini yang diumumkan ke peer         (default: IP LAN, dideteksi otomatis)
  NODE_BIND      alamat bind server                         (default 0.0.0.0 = semua interface)
  NODE_DATA_DIR  folder berisi Database/ dan Buffer/        (default: folder project)
  NODE_PEERS     peer awal, dipisah koma                    (contoh: 192.168.1.5,192.168.1.6:8334)
  NODE_LATENCY_FILE  (opsional, khusus demo di satu mesin) file JSON berisi latency buatan per edge,
                 {"<alamat node ini>": {"<alamat peer>": <milidetik>, ...}, ...}. Jeda ini ditambahkan
                 saat mengukur latency, karena antar-proses di satu mesin latency-nya hampir 0.
"""
import os
import socket

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_PORT = 8333

# Proof of Work: hash (dibaca sebagai bilangan biner 256 bit) harus diawali DIFFICULTY bit nol.
# 16 bit = rata-rata 2^16 = 65.536 percobaan nonce (di bawah 1 detik di laptop biasa).
DIFFICULTY = 16

# Batas waktu (detik) saat meminta blockchain ke peer.
SYNC_TIMEOUT = 3


def FormatAddress(host, port):
    """Alamat node: cukup IP jika memakai port default (8333), selain itu "IP:port"."""
    return host if int(port) == DEFAULT_PORT else f"{host}:{int(port)}"


_HOST_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")


def _valid_host(host):
    """IP atau nama host yang wajar: tiap bagian (dipisah titik) 1-63 karakter huruf/angka/'-'.
    Mencegah teks lain (misalnya public key 66 karakter) dianggap sebagai alamat peer."""
    return len(host) <= 253 and all(
        0 < len(label) <= 63 and set(label) <= _HOST_CHARS and label[0] != "-" and label[-1] != "-"
        for label in host.split("."))


def ParseAddress(address):
    """'192.168.1.5' -> ('192.168.1.5', 8333), '127.0.0.1:8334' -> ('127.0.0.1', 8334).
    Return None jika alamat tidak valid."""
    if not isinstance(address, str):
        return None
    text = address.strip()
    if text.lower().startswith("ws://"):
        text = text[5:]
    text = text.strip("/")
    host, separator, port = text.rpartition(":")
    if not separator:
        host, port = text, str(DEFAULT_PORT)
    if not host or not port.isdigit() or not 0 < int(port) < 65536:
        return None
    if not _valid_host(host):
        return None
    return host, int(port)


def _detect_lan_ip():
    """IP LAN laptop ini. Trik UDP: tidak ada paket yang dikirim, OS hanya ditanya interface
    mana yang dipakai untuk keluar jaringan. Lebih akurat daripada gethostbyname(hostname)
    yang bisa memilih adapter virtual (WSL, Hyper-V, VirtualBox, VPN)."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"
    finally:
        probe.close()


def _resolve_dir(path):
    return path if os.path.isabs(path) else os.path.join(ROOT_DIR, path)


NODE_PORT = int(os.environ.get("NODE_PORT") or DEFAULT_PORT)
NODE_HOST = os.environ.get("NODE_HOST") or _detect_lan_ip()
BIND_HOST = os.environ.get("NODE_BIND") or "0.0.0.0"
NODE_ADDRESS = FormatAddress(NODE_HOST, NODE_PORT)
SEED_PEERS = [peer.strip() for peer in os.environ.get("NODE_PEERS", "").split(",") if peer.strip()]
LATENCY_FILE = os.environ.get("NODE_LATENCY_FILE") or ""

DATA_DIR = _resolve_dir(os.environ.get("NODE_DATA_DIR") or ROOT_DIR)
NODE_DB = os.path.join(DATA_DIR, "Database", "NodeDB.json")
BLOCKCHAIN_DB = os.path.join(DATA_DIR, "Database", "BlockChainDB.json")
CONNECTION_DB = os.path.join(DATA_DIR, "Database", "ConnectionDB.json")
WAITBOX = os.path.join(DATA_DIR, "Buffer", "WaitBox.json")
