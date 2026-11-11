"""3 processes mine & enqueue into the SAME data dir at once. Usage: python test_concurrency.py <root> <data_dir>"""
import os
import shutil
import subprocess
import sys

ROOT, DATA = sys.argv[1], sys.argv[2]
shutil.rmtree(DATA, ignore_errors=True)
env = dict(os.environ, NODE_DATA_DIR=DATA, NODE_PORT="8398", NODE_HOST="127.0.0.1", NODE_PEERS="",
           PYTHONDONTWRITEBYTECODE="1")
WORKER = r'''
import contextlib, io, sys
sys.path.insert(0, sys.argv[1])
from Controller import NodeController
from Database import Repositories as DB
from Models.Blockchain import Blockchain
from Models.Interface import Block
with contextlib.redirect_stdout(io.StringIO()):
    data, created = NodeController.InitNode()
    for i in range(4):
        block = Blockchain().mine_block(Block(message=f"From {data['PublicKey']} to W{sys.argv[2]}, tx {i}"))
        DB.EnqueueBroadcast(block.to_dict())
print("worker", sys.argv[2], "created wallet" if created else "reused wallet", data["PublicKey"][:10])
'''
procs = [subprocess.Popen([sys.executable, "-c", WORKER, ROOT, str(i)], env=env) for i in range(3)]
codes = [p.wait(timeout=300) for p in procs]

os.environ.update(env)
sys.path.insert(0, ROOT)
import Config  # noqa: E402
from Database import Repositories as DB  # noqa: E402
from Middleware import JSONWorker  # noqa: E402
from Models.Blockchain import Blockchain  # noqa: E402

chain = DB.GetBlockChainData()
queue = JSONWorker.GetDataJSON(Config.WAITBOX)["Queue"]
keys = {b["message"].split()[1] for b in chain[1:]}
print("exit codes:", codes, "| blocks:", len(chain) - 1, "| valid:", Blockchain().verify_chain(),
      "| queued:", len(queue), "| distinct wallets:", len(keys))
ok = codes == [0, 0, 0] and len(chain) == 13 and Blockchain().verify_chain() and len(queue) == 12 and len(keys) == 1
print(("PASS" if ok else "FAIL") + " 3 processes x 4 blocks written concurrently: no lost block, no broken link, one shared wallet")
sys.exit(0 if ok else 1)
