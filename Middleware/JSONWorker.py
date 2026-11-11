"""Baca/tulis file JSON yang aman dipakai bersamaan oleh 3 proses (wallet, server, client)."""
import contextlib
import copy
import json
import os
import threading
import time

if os.name == "nt":
    import msvcrt
else:
    import fcntl

_RETRY_DELAY = 0.02
_RETRIES = 100          # 100 x 0,02 detik = maksimal 2 detik menunggu


class _LockState:
    def __init__(self):
        self.rlock = threading.RLock()   # antar-thread dalam satu proses (boleh bersarang)
        self.depth = 0
        self.handle = None               # lock file OS (antar-proses)


_lock_states = {}
_lock_states_guard = threading.Lock()


def _acquire_os_lock(lock_path, timeout):
    handle = open(lock_path, "a+b")
    deadline = time.monotonic() + timeout
    while True:
        try:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return handle
        except OSError:
            if time.monotonic() >= deadline:
                handle.close()
                raise TimeoutError(f"timeout waiting for lock {lock_path}")
            time.sleep(_RETRY_DELAY)


def _release_os_lock(handle):
    try:
        if os.name == "nt":
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        handle.close()


@contextlib.contextmanager
def FileLock(JSONFile, timeout=30):
    """Kunci eksklusif untuk satu file JSON. Lock dilepas otomatis oleh OS jika proses mati."""
    lock_path = os.path.abspath(JSONFile) + ".lock"
    with _lock_states_guard:
        state = _lock_states.setdefault(lock_path, _LockState())
    if not state.rlock.acquire(timeout=timeout):
        raise TimeoutError(f"timeout waiting for lock {lock_path}")
    try:
        if state.depth == 0:
            os.makedirs(os.path.dirname(lock_path), exist_ok=True)
            state.handle = _acquire_os_lock(lock_path, timeout)
        state.depth += 1
        try:
            yield
        finally:
            state.depth -= 1
            if state.depth == 0:
                _release_os_lock(state.handle)
                state.handle = None
    finally:
        state.rlock.release()


def GetDataJSON(JSONFile, default=None):
    error = None
    for _ in range(_RETRIES):
        try:
            with open(JSONFile, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            if default is None:
                raise
            return copy.deepcopy(default)
        except (PermissionError, json.JSONDecodeError) as err:
            # Windows: file sedang diganti oleh proses lain -> coba lagi sebentar
            error = err
            time.sleep(_RETRY_DELAY)
    raise error


def CreateDataJSON(JSONFile, Data):
    """Tulis atomik: tulis ke file sementara lalu os.replace(), sehingga proses lain
    tidak pernah membaca file yang baru setengah ditulis."""
    os.makedirs(os.path.dirname(os.path.abspath(JSONFile)), exist_ok=True)
    temp_file = f"{JSONFile}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(Data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    for _ in range(_RETRIES):
        try:
            os.replace(temp_file, JSONFile)
            return Data
        except PermissionError:
            time.sleep(_RETRY_DELAY)
    os.remove(temp_file)
    raise PermissionError(f"cannot write {JSONFile}")


def UpdateDataJSON(JSONFile, update, default=None):
    """Baca -> ubah -> tulis di dalam lock, agar perubahan dari proses lain tidak tertimpa.
    `update(data)` boleh mengubah data langsung (return None) atau mengembalikan data baru."""
    with FileLock(JSONFile):
        data = GetDataJSON(JSONFile, default)
        result = update(data)
        return CreateDataJSON(JSONFile, data if result is None else result)
