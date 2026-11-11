"""
Sandbox untuk demo web: beberapa node ASLI dari project ini berjalan di satu mesin.

- Setiap node adalah satu proses Python (demo/node_runner.py) yang menjalankan server dan client
  WebSocket project ini, dengan port dan folder data sendiri.
- Aksi pengunjung dijalankan seperti wallet (__main__.py): proses terpisah di "lingkungan" node itu
  (demo/node_task.py), misalnya transaksi = TransactionController.CreateTransaction.
- State tiap node dibaca langsung dari file JSON-nya (BlockChainDB, ConnectionDB, WaitBox) dan
  public key dari NodeDB. Private key tidak pernah dikirim keluar.
- Latency antar node diemulasikan (NODE_LATENCY_FILE), karena antar-proses di satu mesin latency-nya
  hampir 0. Node mengukurnya sendiri lewat ping/pong seperti biasa.
"""
import asyncio
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNTIME = os.path.abspath(os.environ.get("DEMO_RUNTIME") or os.path.join(ROOT, "demo", "runtime"))
WEB_DIST = os.path.join(ROOT, "web", "dist")
# Proses orkestrator tidak boleh menyentuh wallet asli di Database/ project ini.
os.environ["NODE_DATA_DIR"] = os.path.join(RUNTIME, "_orchestrator")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import Config  # noqa: E402
from Middleware import JSONWorker, KeyGenerator  # noqa: E402
from Models.Blockchain import Blockchain  # noqa: E402
from Models.Interface import GENESIS_BLOCK  # noqa: E402

PYTHON = sys.executable
NODE_RUNNER = os.path.join(ROOT, "demo", "node_runner.py")
NODE_TASK = os.path.join(ROOT, "demo", "node_task.py")
LATENCY_FILE = os.path.join(RUNTIME, "latency.json")

LABELS = "ABCDEF"
MAX_NODES = len(LABELS)
INITIAL_NODES = min(MAX_NODES, max(2, int(os.environ.get("DEMO_INITIAL_NODES") or 4)))
BASE_PORT = int(os.environ.get("DEMO_NODE_PORT") or 8451)
RESET_MINUTES = float(os.environ.get("DEMO_RESET_MINUTES") or 30)
MAX_BLOCKS = int(os.environ.get("DEMO_MAX_BLOCKS") or 60)
AUTO_RESTART_SECONDS = 90
MESSAGE_LIMIT = 64
LATENCY_RANGE_MS = (6, 48)
TASK_TIMEOUT = 60
MAX_LISTENERS = 300

# Batas per IP: (kapasitas, detik per token)
LIMITS = {"tx": (5, 12), "action": (10, 6), "scenario": (3, 20), "reset": (1, 60)}

_TEXT = re.compile(r"[A-Za-z0-9 .,!?'\"()#@:;+\-_/=%&*]+")
# Pesan tampil untuk semua pengunjung: tolak tautan dan kata kasar yang umum.
_BLOCKED = re.compile(
    r"(://|www\.|\b(anjing|anjg|bangsat|kontol|memek|ngentot|jancok|goblok|tolol|babi|fuck\w*|shit|"
    r"bitch|cunt|dick|nigg\w*|faggot|porn\w*)\b)", re.IGNORECASE)

_VERIFIER = Blockchain.__new__(Blockchain)       # tanpa __init__: tidak membaca Database/ mana pun
_VERIFIER.BlockChainData = [dict(GENESIS_BLOCK)]


class SandboxError(Exception):
    def __init__(self, code, status=400, **info):
        super().__init__(code)
        self.code, self.status, self.info = code, status, info


def clean_text(text):
    if not isinstance(text, str):
        raise SandboxError("invalid_message")
    text = " ".join(text.split())
    if not text:
        raise SandboxError("empty_message")
    if len(text) > MESSAGE_LIMIT:
        raise SandboxError("message_too_long", limit=MESSAGE_LIMIT)
    if not _TEXT.fullmatch(text):
        raise SandboxError("invalid_characters")
    if _BLOCKED.search(text):
        raise SandboxError("blocked_message")
    return text


def now_ms():
    return int(time.time() * 1000)


# --------------------------------------------------------------------------- rate limit
class _Bucket:
    def __init__(self, capacity, seconds):
        self.capacity, self.seconds = capacity, seconds
        self.tokens, self.updated = float(capacity), time.monotonic()

    def _refill(self):
        current = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (current - self.updated) / self.seconds)
        self.updated = current

    def take(self):
        self._refill()
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True

    def status(self):
        self._refill()
        missing = 1 - self.tokens if self.tokens < 1 else 0
        return {"left": int(self.tokens), "max": self.capacity, "retryIn": round(missing * self.seconds, 1)}


class RateLimiter:
    def __init__(self):
        self.buckets = {}

    def _bucket(self, kind, key):
        bucket = self.buckets.get((kind, key))
        if bucket is None:
            bucket = self.buckets[(kind, key)] = _Bucket(*LIMITS[kind])
        return bucket

    def take(self, kind, key):
        bucket = self._bucket(kind, key)
        if not bucket.take():
            raise SandboxError("rate_limited", 429, kind=kind, retryIn=bucket.status()["retryIn"])

    def quota(self, key):
        return {kind: self._bucket(kind, key).status() for kind in LIMITS}

    def cleanup(self):
        stale = [k for k, b in self.buckets.items() if b.status()["left"] >= b.capacity]
        for key in stale:
            del self.buckets[key]


# --------------------------------------------------------------------------- satu node
class DemoNode:
    def __init__(self, label, port, seed):
        self.id = label
        self.port = port
        self.address = Config.FormatAddress("127.0.0.1", port)
        self.seed = seed or ""
        self.data_dir = os.path.join(RUNTIME, f"node-{label}")
        self.proc = None
        self.off_since = None          # dimatikan pengunjung -> dinyalakan lagi otomatis
        self.expected_stop = False
        self.tasks = 0                 # transaksi / heal yang sedang berjalan
        self.activity = None           # "mining" | "syncing"
        self.flash = (None, 0.0)       # aktivitas singkat dari log node (mis. sinkronisasi)
        self.public_key = ""

    def db(self, name):
        folder = "Buffer" if name == "WaitBox.json" else "Database"
        return os.path.join(self.data_dir, folder, name)

    @property
    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def env(self):
        env = dict(os.environ)
        env.update(NODE_PORT=str(self.port), NODE_HOST="127.0.0.1", NODE_BIND="127.0.0.1",
                   NODE_DATA_DIR=self.data_dir, NODE_PEERS=self.seed, NODE_LATENCY_FILE=LATENCY_FILE,
                   PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
        return env


def _kill(proc):
    if proc is None or proc.poll() is not None:
        return
    if os.name == "nt":   # venv di Windows memakai proses perantara: matikan seluruh pohon proses
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    else:
        proc.terminate()
    try:
        proc.wait(5)
    except subprocess.TimeoutExpired:
        proc.kill()


# --------------------------------------------------------------------------- log node -> event
_CATEGORY_RULES = (
    ("FORK", ("Block fork at", "wins a fork", "orphaned transaction")),
    ("TAMPER", ("INVALID at block", "was invalid at block", "REJECTED", "INVALID chain", "not valid JSON")),
    ("MINER", ("mined in", "Mining the block", "Transaction created")),
    ("SYNC", ("ynchroniz", "Local chain updated", "Local chain kept", "unreachable", "invalid response")),
    ("NETWORK", ("Connected to", "connected", "Connection to", "Broadcast block", "New peers learned",
                 "verified and added")),
)
_NOISE = ("Server Network Panel", "Client Network Panel", "Node address :", "Listening on :")
_PATTERNS = {
    "mined": re.compile(r"Block #(\d+) mined in ([\d.]+)s \(nonce=(\d+), proof_of_work=(\d+), hash=([0-9a-f]+)"),
    "broadcast": re.compile(r"Broadcast block #(\d+) \(([0-9a-f]+)\.\.\.\) to (\d+) peer"),
    "received": re.compile(r"Block #(\d+) from (\S+) verified and added"),
    "adopted": re.compile(r"Local chain updated from (\S+): now (\d+) block"),
    "remined": re.compile(r"re-mined as block #(\d+)"),
    "fork_kept": re.compile(r"Block fork at #(\d+) from (\S+)"),
    "ahead": re.compile(r"Block #(\d+) from (\S+) is ahead"),
    "repaired": re.compile(r"(?:Local chain INVALID at block #(\d+) \((.*?)\): (\d+) block"
                           r"|Local chain was invalid at block #(\d+): (\d+) block)"),
    "backtrack": re.compile(r"^- (\S+): (unreachable|invalid response|sent an INVALID chain)"),
    "outbound_up": re.compile(r"Connected to (\S+) \(latency ([\d.]+) ms"),
    "outbound_down": re.compile(r"Connection to (\S+) (lost|failed)"),
    "inbound_up": re.compile(r"\[\+\] (\S+) connected"),
    "inbound_down": re.compile(r"\[-\] (\S+) disconnected"),
    "sync_start": re.compile(r"Synchronizing with the nearest peer"),
}


def _classify(text):
    for category, needles in _CATEGORY_RULES:
        if any(needle in text for needle in needles):
            return category
    return "SYSTEM"


# --------------------------------------------------------------------------- sandbox
class Sandbox:
    def __init__(self):
        self.loop = None
        self.nodes = {}                      # id -> DemoNode (urut A, B, C, ...)
        self.latency = {}                    # "A|B" -> ms
        self.events = deque(maxlen=300)
        self.pending_events = []
        self.event_seq = 0
        self.listeners = set()
        self.limiter = RateLimiter()
        self.ready = False
        self.scenario = None
        self.started_at = now_ms()
        self.reset_at = 0
        self.last_reset_by_visitor = 0.0
        self.stats = self._fresh_stats()
        self.generation = 0                  # naik setiap reset: log proses lama diabaikan
        self.propagation = {}                # prefix hash -> (waktu mined, nomor blok)
        self._file_cache = {}
        self._verify_cache = {}
        self._snapshot_text = ""
        self._snapshot = None
        self._reset_lock = asyncio.Lock()
        self._task_slots = asyncio.Semaphore(4)
        self._background = set()
        self._loops = []

    # ------------------------------------------------------------------ siklus hidup
    async def start(self):
        self.loop = asyncio.get_running_loop()
        os.makedirs(RUNTIME, exist_ok=True)
        self._loops = [asyncio.create_task(self._snapshot_loop()),
                       asyncio.create_task(self._event_loop()),
                       asyncio.create_task(self._maintenance_loop())]
        self._spawn_background(self.reset(reason="startup"))

    async def shutdown(self):
        for task in self._loops:
            task.cancel()
        await asyncio.to_thread(self._stop_all)

    def _spawn_background(self, coroutine):
        task = asyncio.create_task(coroutine)
        self._background.add(task)
        task.add_done_callback(self._background.discard)
        task.add_done_callback(self._report_failure)
        return task

    def _report_failure(self, task):
        if not task.cancelled() and task.exception() is not None:
            error = task.exception()
            self.story("SYSTEM", "error", {"message": f"{error.__class__.__name__}: {error}"})

    def _stop_all(self):
        for node in self.nodes.values():
            node.expected_stop = True
            _kill(node.proc)

    @staticmethod
    def _fresh_stats():
        return {"mined": 0, "mineSeconds": 0.0, "reorgs": 0, "repairs": 0, "rejected": 0,
                "propagations": 0, "propagationMs": 0}

    async def reset(self, reason="visitor", by=None):
        async with self._reset_lock:
            self.ready = False
            self.scenario = None
            await asyncio.to_thread(self._stop_all)
            self.generation += 1
            self.nodes.clear()
            self.latency.clear()
            self.propagation.clear()
            self._file_cache.clear()
            self.stats = self._fresh_stats()
            await asyncio.to_thread(self._wipe_runtime)
            self.started_at = now_ms()
            self.reset_at = self.started_at + int(RESET_MINUTES * 60_000)
            self.story("SYSTEM", "reset", {"reason": reason}, by=by)
            previous = None
            for _ in range(INITIAL_NODES):
                node = self._create_node(seed=previous.address if previous else "")
                previous = node
                self._start_node(node)
            await self._wait_until(self._complete_graph, timeout=30)
            await self._warm_up()
            self.ready = True
            self.story("SYSTEM", "ready", {"nodes": len(self.nodes)})

    def _wipe_runtime(self):
        os.makedirs(RUNTIME, exist_ok=True)
        for name in os.listdir(RUNTIME):
            path = os.path.join(RUNTIME, name)
            if name.startswith("node-"):
                shutil.rmtree(path, ignore_errors=True)
            elif name.startswith("latency.json"):
                try:
                    os.remove(path)
                except OSError:
                    pass

    async def _warm_up(self):
        """Beberapa transaksi awal agar explorer tidak kosong (dijalankan seperti pengunjung biasa)."""
        ids = list(self.nodes)
        for index, text in enumerate(("hello from the first node", "graph theory final project",
                                      "every node is a vertex")):
            sender, receiver = self.nodes[ids[index % len(ids)]], self.nodes[ids[(index + 1) % len(ids)]]
            if not (sender.running and receiver.public_key):
                continue
            height = self._height(sender)
            await self._run_tx(sender, receiver, text)
            await self._wait_until(lambda h=height + 1: self._converged(h), timeout=10)

    # ------------------------------------------------------------------ node
    def _create_node(self, seed):
        label = next(label for label in LABELS if label not in self.nodes)
        node = DemoNode(label, BASE_PORT + LABELS.index(label), seed)
        self.nodes[label] = node
        self.nodes = dict(sorted(self.nodes.items()))
        for other in self.nodes.values():
            if other is not node:
                self.latency.setdefault(self._pair(node.id, other.id), random.randint(*LATENCY_RANGE_MS))
        self._write_latency_file()
        return node

    @staticmethod
    def _pair(a, b):
        return "|".join(sorted((a, b)))

    def _write_latency_file(self):
        table = {node.address: {other.address: self.latency[self._pair(node.id, other.id)]
                                for other in self.nodes.values() if other is not node}
                 for node in self.nodes.values()}
        os.makedirs(RUNTIME, exist_ok=True)
        JSONWorker.CreateDataJSON(LATENCY_FILE, table)

    def _start_node(self, node):
        node.expected_stop = False
        node.off_since = None
        node.proc = subprocess.Popen(
            [PYTHON, "-u", NODE_RUNNER], cwd=ROOT, env=node.env(), stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8",
            errors="replace", bufsize=1)
        threading.Thread(target=self._pump, args=(node.id, node.proc.stdout, "node", self.generation),
                         daemon=True).start()

    def _pump(self, node_id, stream, source, generation, sink=None):
        try:
            for line in stream:
                if sink is not None:
                    sink.append(line)
                self.loop.call_soon_threadsafe(self._on_line, node_id, line, source, generation)
        except (ValueError, OSError, RuntimeError):   # pipe ditutup / event loop sudah berhenti
            pass

    def _node(self, node_id, running=None):
        node = self.nodes.get(str(node_id or "").upper())
        if node is None:
            raise SandboxError("unknown_node", 404)
        if running is True and not node.running:
            raise SandboxError("node_offline", node=node.id)
        return node

    def _read_json(self, path, default):
        """Baca file JSON node tanpa lock (file selalu ditulis atomik), dengan cache per mtime."""
        try:
            stat = os.stat(path)
        except OSError:
            return default
        key = (stat.st_mtime_ns, stat.st_size)
        cached = self._file_cache.get(path)
        if cached and cached[0] == key:
            return cached[1]
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            return cached[1] if cached else default
        self._file_cache[path] = (key, data)
        return data

    def _chain(self, node):
        chain = self._read_json(node.db("BlockChainDB.json"), None)
        return chain if isinstance(chain, list) and chain else [dict(GENESIS_BLOCK)]

    def _height(self, node):
        tip = self._chain(node)[-1]
        number = tip.get("number_of_block") if isinstance(tip, dict) else 0
        return number if type(number) is int else 0

    def _tip(self, node):
        tip = self._chain(node)[-1]
        return tip.get("hash") if isinstance(tip, dict) else None

    def _peers(self, node):
        data = self._read_json(node.db("ConnectionDB.json"), {})
        peers = data.get("Nodes") if isinstance(data, dict) else None
        return peers if isinstance(peers, dict) else {}

    def _complete_graph(self):
        running = [node for node in self.nodes.values() if node.running]
        for node in running:
            peers = self._peers(node)
            for other in running:
                if other is not node and (peers.get(other.address) or {}).get("Status") != "Online":
                    return False
        return bool(running) and all(node.public_key for node in running)

    def _converged(self, height):
        running = [node for node in self.nodes.values() if node.running]
        tips = {self._tip(node) for node in running}
        return len(tips) == 1 and all(self._height(node) >= height for node in running)

    async def _wait_until(self, condition, timeout):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self._refresh_keys()
            if condition():
                return True
            await asyncio.sleep(0.3)
        return False

    def _refresh_keys(self):
        for node in self.nodes.values():
            if not node.public_key:
                data = self._read_json(node.db("NodeDB.json"), {})
                node.public_key = str(data.get("PublicKey") or "") if isinstance(data, dict) else ""

    # ------------------------------------------------------------------ proses sekali jalan
    async def _run_task(self, node, args, activity):
        node.tasks += 1
        node.activity = activity
        try:
            async with self._task_slots:
                return await asyncio.to_thread(self._task_blocking, node, args)
        finally:
            node.tasks -= 1
            if node.tasks == 0:
                node.activity = None

    def _task_blocking(self, node, args):
        lines = []
        proc = subprocess.Popen([PYTHON, "-u", NODE_TASK, *args], cwd=ROOT, env=node.env(),
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace", bufsize=1)
        reader = threading.Thread(target=self._pump, args=(node.id, proc.stdout, "task", self.generation, lines),
                                  daemon=True)
        reader.start()
        try:
            proc.wait(TASK_TIMEOUT)
        except subprocess.TimeoutExpired:
            _kill(proc)
        reader.join(2)
        return lines

    async def _run_tx(self, sender, receiver, text):
        lines = await self._run_task(sender, ["tx", receiver.public_key, text], "mining")
        for line in reversed(lines):      # baris terakhir = blok transaksi ini (sebelumnya bisa re-mining)
            match = _PATTERNS["mined"].search(line)
            if match:
                return {"node": sender.id, "number": int(match.group(1)), "pow": int(match.group(4)),
                        "hash": match.group(5)}
        return None

    # ------------------------------------------------------------------ event
    def _emit(self, event):
        self.event_seq += 1
        event["id"] = self.event_seq
        event.setdefault("t", now_ms())
        self.events.append(event)
        self.pending_events.append(event)

    def story(self, category, code, data=None, by=None):
        """Event naratif dari sandbox (diterjemahkan di web, EN/ID)."""
        self._emit({"node": None, "cat": category, "kind": "story", "code": code,
                    "data": data or {}, "by": by, "source": "sandbox"})

    def _address_to_id(self, address):
        for node in self.nodes.values():
            if node.address == address:
                return node.id
        return None

    def _on_line(self, node_id, line, source, generation):
        raw = line.rstrip()
        text = raw.strip()
        if generation != self.generation or not text or text.startswith(_NOISE):
            return
        node = self.nodes.get(node_id)
        data, kind = {}, None
        for name, pattern in _PATTERNS.items():
            match = pattern.search(text)
            if match:
                kind = name
                data = {"groups": list(match.groups())}
                break
        if kind == "mined":
            seconds = float(data["groups"][1])
            self.stats["mined"] += 1
            self.stats["mineSeconds"] += seconds
            self.propagation[data["groups"][4]] = (time.monotonic(), int(data["groups"][0]))
        elif kind == "remined":
            self.stats["reorgs"] += 1
        elif kind == "repaired":
            self.stats["repairs"] += 1
        elif "REJECTED" in text:
            self.stats["rejected"] += 1
        if node is not None and kind in ("sync_start", "ahead", "adopted"):
            node.flash = ("syncing", time.monotonic() + 1.5)
        peer = None
        for address in re.findall(r"\b127\.0\.0\.1:\d+\b", text):
            peer = peer or self._address_to_id(address)
            label = self._address_to_id(address)
            if label:
                text = text.replace(address, label)
        self._emit({"node": node_id, "cat": _classify(raw), "kind": kind, "data": data, "peer": peer,
                    "text": text, "raw": raw, "by": None, "source": source})

    async def _event_loop(self):
        while True:
            await asyncio.sleep(0.2)
            if self.pending_events:
                batch, self.pending_events = self.pending_events, []
                self._publish({"type": "events", "data": batch})

    def _publish(self, message):
        text = json.dumps(message, separators=(",", ":"))
        for queue in list(self.listeners):
            try:
                queue.put_nowait(text)
            except asyncio.QueueFull:
                self.listeners.discard(queue)

    def subscribe(self):
        if len(self.listeners) >= MAX_LISTENERS:
            raise SandboxError("too_many_viewers", 503)
        queue = asyncio.Queue(maxsize=200)
        self.listeners.add(queue)
        return queue

    def unsubscribe(self, queue):
        self.listeners.discard(queue)

    # ------------------------------------------------------------------ snapshot
    def _block_errors(self, block, previous):
        key = hashlib.sha256(json.dumps([block, previous.get("hash") if isinstance(previous, dict) else None,
                                         previous.get("number_of_block") if isinstance(previous, dict) else None],
                                        sort_keys=True, default=str).encode()).hexdigest()
        errors = self._verify_cache.get(key)
        if errors is None:
            if len(self._verify_cache) > 5000:
                self._verify_cache.clear()
            errors = self._verify_cache[key] = tuple(_VERIFIER.verify_block(block, previous).errors())
        return errors

    def _describe_chain(self, node, blocks, owners):
        chain = self._chain(node)
        rows, first_invalid = [], None
        for index, block in enumerate(chain):
            block = block if isinstance(block, dict) else {}
            if index == 0:
                errors = () if block == GENESIS_BLOCK else ("InvalidFormat",)
            elif first_invalid is not None:
                errors = None
            else:
                errors = self._block_errors(block, chain[index - 1])
            if errors and first_invalid is None:
                first_invalid = index
            digest = hashlib.sha1(json.dumps(block, sort_keys=True, default=str).encode()).hexdigest()[:16]
            if digest not in blocks:
                transaction = KeyGenerator.ParseTransaction(block.get("message"))
                blocks[digest] = {
                    "number_of_block": block.get("number_of_block"),
                    "hash": str(block.get("hash"))[:64], "prev_hash": str(block.get("prev_hash"))[:64],
                    "message": str(block.get("message"))[:300], "nonce": block.get("nonce"),
                    "proof_of_work": block.get("proof_of_work"), "timeStamp": str(block.get("timeStamp"))[:40],
                    "signature": str(block.get("signature"))[:160],
                    "from": owners.get(transaction[0]) if transaction else None,
                    "to": owners.get(transaction[1]) if transaction else None,
                    "text": transaction[2][:120] if transaction else None}
            rows.append({"d": digest, "s": "untrusted" if errors is None else ("invalid" if errors else "valid"),
                         "e": list(errors or [])})
        return rows, first_invalid

    def snapshot(self):
        self._refresh_keys()
        owners = {node.public_key: node.id for node in self.nodes.values() if node.public_key}
        blocks, nodes = {}, []
        clock = time.monotonic()
        for node in self.nodes.values():
            rows, first_invalid = self._describe_chain(node, blocks, owners)
            peers = {}
            for address, info in self._peers(node).items():
                peer_id = self._address_to_id(address)
                if peer_id and isinstance(info, dict):
                    latency = info.get("Latency")
                    peers[peer_id] = {
                        "status": info.get("Status") if info.get("Status") in ("Online", "Offline") else "Unknown",
                        "inbound": bool(info.get("Inbound")),
                        "latencyMs": round(latency * 1000, 1) if isinstance(latency, (int, float)) else None}
            waitbox = self._read_json(node.db("WaitBox.json"), {})
            queue = waitbox.get("Queue") if isinstance(waitbox, dict) else None
            flash, until = node.flash
            activity = node.activity or (flash if until > clock else None)
            nodes.append({
                "id": node.id, "address": node.address, "port": node.port, "running": node.running,
                "publicKey": node.public_key, "seed": self._address_to_id(node.seed), "chain": rows,
                "invalidAt": first_invalid, "peers": peers, "queue": len(queue) if isinstance(queue, list) else 0,
                "activity": activity if node.running else None,
                "autoRestartAt": (now_ms() + int((AUTO_RESTART_SECONDS - (time.time() - node.off_since)) * 1000))
                if node.off_since else None})
        mined = self.stats.get("mined") or 0
        propagations = self.stats.get("propagations") or 0
        return {
            "nodes": nodes, "blocks": blocks,
            "latency": {pair: ms for pair, ms in self.latency.items()},
            "meta": {"ready": self.ready, "scenario": self.scenario, "maxNodes": MAX_NODES,
                     "difficulty": Config.DIFFICULTY, "messageLimit": MESSAGE_LIMIT,
                     "startedAt": self.started_at, "resetAt": self.reset_at, "maxBlocks": MAX_BLOCKS,
                     "stats": {"mined": mined,
                               "avgMineSeconds": round(self.stats["mineSeconds"] / mined, 3) if mined else None,
                               "reorgs": self.stats.get("reorgs", 0), "repairs": self.stats.get("repairs", 0),
                               "rejected": self.stats.get("rejected", 0), "propagations": propagations,
                               "avgPropagationMs": round(self.stats["propagationMs"] / propagations)
                               if propagations else None}}}

    def _track_propagation(self):
        """Waktu sejak blok di-mining sampai SEMUA node yang hidup menyimpannya (diukur sungguhan)."""
        if not self.propagation:
            return
        running = [node for node in self.nodes.values() if node.running]
        hashes = [{str(block.get("hash")) for block in self._chain(node) if isinstance(block, dict)}
                  for node in running]
        clock = time.monotonic()
        for prefix, (started, _) in list(self.propagation.items()):
            if all(any(item.startswith(prefix) for item in chain) for chain in hashes):
                self.stats["propagations"] += 1
                self.stats["propagationMs"] += int((clock - started) * 1000)
                del self.propagation[prefix]
            elif clock - started > 30:
                del self.propagation[prefix]

    async def _snapshot_loop(self):
        while True:
            await asyncio.sleep(0.4)
            try:
                self._track_propagation()
                snapshot = self.snapshot()
            except Exception as err:       # jangan biarkan loop mati karena satu file aneh
                print("snapshot error:", err)
                continue
            text = json.dumps(snapshot, separators=(",", ":"), sort_keys=True)
            if text != self._snapshot_text:
                self._snapshot_text, self._snapshot = text, snapshot
                self._publish({"type": "snapshot", "data": snapshot})

    def current_snapshot(self):
        return self._snapshot or self.snapshot()

    def recent_events(self):
        return list(self.events)

    # ------------------------------------------------------------------ perawatan otomatis
    async def _maintenance_loop(self):
        while True:
            await asyncio.sleep(1)
            if not self.ready:
                continue
            try:
                await self._maintain()
            except Exception as err:
                print("maintenance error:", err)

    async def _maintain(self):
        clock = time.time()
        if now_ms() >= self.reset_at or any(len(self._chain(node)) > MAX_BLOCKS for node in self.nodes.values()):
            await self.reset(reason="scheduled")
            return
        for node in self.nodes.values():
            if node.off_since and clock - node.off_since >= AUTO_RESTART_SECONDS:
                self._start_node(node)
                self.story("NETWORK", "auto_restart", {"node": node.id})
            elif node.proc is not None and not node.running and not node.expected_stop and not node.off_since:
                self.story("SYSTEM", "node_crashed", {"node": node.id, "code": node.proc.returncode})
                self._start_node(node)
        self.limiter.cleanup()

    # ------------------------------------------------------------------ aksi pengunjung
    def quota(self, ip):
        return self.limiter.quota(ip)

    def _require_ready(self):
        if not self.ready:
            raise SandboxError("not_ready", 503)

    async def tx(self, ip, by, sender_id, receiver_id, text):
        self._require_ready()
        sender = self._node(sender_id, running=True)
        receiver = self._node(receiver_id)
        if sender is receiver:
            raise SandboxError("same_node")
        if not receiver.public_key:
            raise SandboxError("not_ready", 503)
        if sender.tasks >= 2:
            raise SandboxError("node_busy", 409, node=sender.id)
        text = clean_text(text)
        self.limiter.take("tx", ip)
        self.story("MINER", "tx", {"from": sender.id, "to": receiver.id, "text": text}, by=by)
        self._spawn_background(self._run_tx(sender, receiver, text))

    async def power(self, ip, by, node_id, on):
        self._require_ready()
        node = self._node(node_id)
        if bool(on) == node.running:
            return
        if not on and sum(1 for item in self.nodes.values() if item.running) <= 1:
            raise SandboxError("last_node")
        self.limiter.take("action", ip)
        await self._set_power(node, on, by)

    async def _set_power(self, node, on, by=None, story=True):
        if on:
            self._start_node(node)
        else:
            node.expected_stop = True
            await asyncio.to_thread(_kill, node.proc)
            node.off_since = time.time()
        if story:
            self.story("NETWORK", "power_on" if on else "power_off", {"node": node.id}, by=by)

    async def tamper(self, ip, by, node_id, number, text):
        self._require_ready()
        node = self._node(node_id)
        if type(number) is not int or number < 1:
            raise SandboxError("block_not_found")
        text = clean_text(text)
        self.limiter.take("action", ip)
        await asyncio.to_thread(self._tamper_file, node, number, text)
        self.story("TAMPER", "tamper", {"node": node.id, "block": number, "text": text}, by=by)

    def _tamper_file(self, node, number, text):
        """Seperti penyerang yang mengedit BlockChainDB.json langsung: hanya isi pesan yang diubah,
        hash, nonce, dan signature dibiarkan. Validasi node yang harus mendeteksinya."""
        found = []

        def update(chain):
            for block in chain if isinstance(chain, list) else []:
                if isinstance(block, dict) and block.get("number_of_block") == number:
                    transaction = KeyGenerator.ParseTransaction(block.get("message"))
                    block["message"] = (f"From {transaction[0]} to {transaction[1]}, {text}"
                                        if transaction else text)
                    found.append(block)
                    return

        JSONWorker.UpdateDataJSON(node.db("BlockChainDB.json"), update, [dict(GENESIS_BLOCK)])
        if not found:
            raise SandboxError("block_not_found")

    def nearest_order(self, node):
        """Urutan sinkronisasi node ini (sama dengan BlockChainSync._nearest_neighbours):
        peer Online dahulu, lalu latency terkecil."""
        rows = []
        for address, info in self._peers(node).items():
            peer_id = self._address_to_id(address)
            if not peer_id or not isinstance(info, dict):
                continue
            latency = info.get("Latency")
            known = isinstance(latency, (int, float)) and not isinstance(latency, bool)
            rows.append(((info.get("Status") != "Online", latency if known else float("inf")),
                         {"node": peer_id, "status": info.get("Status") or "Unknown",
                          "latencyMs": round(latency * 1000, 1) if known else None}))
        return [row for _, row in sorted(rows, key=lambda item: item[0])]

    async def heal(self, ip, by, node_id):
        self._require_ready()
        node = self._node(node_id, running=True)
        if node.tasks >= 2:
            raise SandboxError("node_busy", 409, node=node.id)
        self.limiter.take("action", ip)
        self.story("SYNC", "heal", {"node": node.id, "order": self.nearest_order(node)}, by=by)
        self._spawn_background(self._run_task(node, ["heal"], "syncing"))

    async def add_node(self, ip, by):
        self._require_ready()
        if len(self.nodes) >= MAX_NODES:
            raise SandboxError("max_nodes", limit=MAX_NODES)
        running = [node for node in self.nodes.values() if node.running]
        if not running:
            raise SandboxError("no_running_nodes")
        self.limiter.take("action", ip)
        seed = random.choice(running)
        node = self._create_node(seed=seed.address)
        self._start_node(node)
        self.story("NETWORK", "node_added", {"node": node.id, "seed": seed.id}, by=by)

    async def reset_by_visitor(self, ip, by):
        self._require_ready()
        if time.monotonic() - self.last_reset_by_visitor < 45:
            raise SandboxError("cooldown", 429, retryIn=round(45 - (time.monotonic() - self.last_reset_by_visitor)))
        self.limiter.take("reset", ip)
        self.last_reset_by_visitor = time.monotonic()
        self._spawn_background(self.reset(reason="visitor", by=by))

    # ------------------------------------------------------------------ skenario
    async def run_scenario(self, ip, by, name):
        self._require_ready()
        scenarios = {"fork": self._scenario_fork, "tamper": self._scenario_tamper,
                     "offline": self._scenario_offline}
        if name not in scenarios:
            raise SandboxError("unknown_scenario", 404)
        if self.scenario:
            raise SandboxError("scenario_running", 409, scenario=self.scenario)
        running = [node for node in self.nodes.values() if node.running and node.public_key]
        if len(running) < (3 if name == "offline" else 2):
            raise SandboxError("need_nodes", need=3 if name == "offline" else 2)
        self.limiter.take("scenario", ip)
        self.scenario = name
        self._spawn_background(self._scenario_wrapper(scenarios[name], running, by))

    async def _scenario_wrapper(self, scenario, running, by):
        try:
            await scenario(running, by)
        finally:
            self.scenario = None

    async def _scenario_fork(self, running, by):
        first, second = random.sample(running, 2)
        self.story("FORK", "fork_start", {"a": first.id, "b": second.id}, by=by)
        results = await asyncio.gather(self._run_tx(first, second, f"fork test by {first.id}"),
                                       self._run_tx(second, first, f"fork test by {second.id}"))
        a, b = results
        if not a or not b:
            self.story("SYSTEM", "scenario_failed", {"scenario": "fork"}, by=by)
            return
        if a["number"] != b["number"]:
            self.story("FORK", "fork_none", {"a": a, "b": b}, by=by)
            return
        if a["pow"] != b["pow"]:
            winner = a if a["pow"] > b["pow"] else b
        else:
            winner = a if a["hash"] < b["hash"] else b
        loser = b if winner is a else a
        self.story("FORK", "fork_result", {"height": a["number"], "winner": winner, "loser": loser}, by=by)
        if await self._wait_until(lambda: self._converged(a["number"] + 1), timeout=20):
            height = max(self._height(node) for node in running if node.running)
            self.story("FORK", "converged", {"height": height}, by=by)

    async def _scenario_tamper(self, running, by):
        candidates = [node for node in running if self._height(node) >= 1]
        if not candidates:
            sender, receiver = running[0], running[1]
            await self._run_tx(sender, receiver, "a block worth protecting")
            await self._wait_until(lambda: self._converged(1), timeout=10)
            candidates = [node for node in running if node.running and self._height(node) >= 1]
        if not candidates:
            self.story("SYSTEM", "scenario_failed", {"scenario": "tamper"}, by=by)
            return
        target = random.choice(candidates)
        height = self._height(target)
        number = random.randint(max(1, height - 3), height)
        await asyncio.to_thread(self._tamper_file, target, number, "TAMPERED: pay 1000 to Mallory")
        self.story("TAMPER", "tamper", {"node": target.id, "block": number,
                                        "text": "TAMPERED: pay 1000 to Mallory"}, by=by)
        await asyncio.sleep(5)
        if not target.running:
            return
        self.story("SYNC", "heal", {"node": target.id, "order": self.nearest_order(target)}, by=by)
        await self._run_task(target, ["heal"], "syncing")
        self.story("SYNC", "healed", {"node": target.id, "height": self._height(target)}, by=by)

    async def _scenario_offline(self, running, by):
        offline = running[-1]
        sender, receiver = running[0], running[1]
        await self._set_power(offline, False, story=False)
        self.story("NETWORK", "offline_start", {"node": offline.id}, by=by)
        await asyncio.sleep(2)
        result = await self._run_tx(sender, receiver, f"sent while {offline.id} is offline")
        await asyncio.sleep(2.5)
        await self._set_power(offline, True, story=False)
        self.story("NETWORK", "offline_back", {"node": offline.id}, by=by)
        target = result["number"] if result else self._height(sender)
        if await self._wait_until(lambda: self._height(offline) >= target and self._converged(target), timeout=25):
            self.story("SYNC", "caught_up", {"node": offline.id, "height": self._height(offline)}, by=by)
