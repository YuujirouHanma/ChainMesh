"""End-to-end test with 3 real nodes on 127.0.0.1. Usage: python test_network.py <root> <scratch_base_dir>"""
import json
import os
import shutil
import subprocess
import sys
import time

ROOT, BASE = sys.argv[1], sys.argv[2]
PY = sys.executable
shutil.rmtree(BASE, ignore_errors=True)
os.makedirs(BASE)
PORTS = {1: 8341, 2: 8342, 3: 8343}
SEEDS = {1: "", 2: "127.0.0.1:8341", 3: "127.0.0.1:8342"}     # chain topology: 3 -> 2 -> 1
SCRIPTS = {"server": "__websocketserver__.py", "client": "__websocketclient__.py"}
procs, results = {}, []


def env_for(n):
    return dict(os.environ, NODE_DATA_DIR=os.path.join(BASE, f"n{n}"), NODE_PORT=str(PORTS[n]),
                NODE_HOST="127.0.0.1", NODE_BIND="127.0.0.1", NODE_PEERS=SEEDS[n],
                PYTHONDONTWRITEBYTECODE="1", PYTHONUNBUFFERED="1")


def start(n, kinds=("server", "client")):
    for kind in kinds:
        log = open(os.path.join(BASE, f"n{n}-{kind}.log"), "a", encoding="utf-8")
        procs[(n, kind)] = subprocess.Popen([PY, os.path.join(ROOT, SCRIPTS[kind])], env=env_for(n),
                                            stdout=log, stderr=subprocess.STDOUT, cwd=BASE)


def stop(n, kinds=("server", "client")):
    for kind in kinds:
        proc = procs.pop((n, kind), None)
        if proc:
            proc.terminate()
            proc.wait(10)


def read_json(n, rel):
    for _ in range(50):
        try:
            with open(os.path.join(BASE, f"n{n}", rel), encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            time.sleep(0.05)
    return None


def chain(n):
    return read_json(n, "Database/BlockChainDB.json") or []


def peers(n):
    return (read_json(n, "Database/ConnectionDB.json") or {}).get("Nodes", {})


def messages(n):
    return [b["message"].split(", ", 1)[-1] for b in chain(n)[1:]]


def same_chains(*ns):
    hashes = [[b["hash"] for b in chain(n)] for n in ns]
    return all(h == hashes[0] for h in hashes)


def wait_until(cond, timeout):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if cond():
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def check(name, cond):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name, flush=True)


HELPER = r'''
import contextlib, io, sys
sys.path.insert(0, sys.argv[1])
mode, out = sys.argv[2], io.StringIO()
with contextlib.redirect_stdout(out):
    from Controller import NodeController
    NodeController.InitNode()
    if mode == "tx":                      # the real TransactionController, without the keyboard
        from View import TransactionView
        TransactionView.Main = lambda: (sys.argv[3], sys.argv[4])
        from Controller import TransactionController
        TransactionController.Control()
    elif mode == "nosync":                # mine on the local tip without synchronizing first
        from Database import Repositories as DB
        from Models.Blockchain import Blockchain
        from Models.Interface import Block
        block = Blockchain().mine_block(Block(message=f"From {DB.GetUserData('PublicKey')} to {sys.argv[3]}, {sys.argv[4]}"))
        DB.EnqueueBroadcast(block.to_dict())
    elif mode == "tamper":
        from Database import Repositories as DB
        c = DB.GetBlockChainData(); c[1]["message"] += " (EDITED)"; DB.CreateBlockChainData(c)
    elif mode == "verify":
        from Middleware import BlockChainSync
        BlockChainSync.VerifySyncBlockChain()
    elif mode == "valid":
        from Models.Blockchain import Blockchain
        print("VALID" if Blockchain().verify_chain() else "INVALID")
print(out.getvalue())
'''


def helper(n, *args):
    run = subprocess.run([PY, "-c", HELPER, ROOT, *args], env=env_for(n), capture_output=True, text=True,
                         timeout=120, cwd=BASE)
    if run.returncode != 0:
        print(run.stdout, run.stderr)
    return run.stdout


def valid(n):
    out = helper(n, "valid")
    return "VALID" in out and "INVALID" not in out


def indent(text):
    return "     " + text.strip().replace("\n", "\n     ")


try:
    for n in PORTS:
        start(n)

    # 1. peer discovery -> complete graph
    def full_mesh():
        return all(len(peers(n)) == 2 and all(p.get("Status") == "Online" and p.get("Inbound")
                                              for p in peers(n).values()) for n in PORTS)
    check("discovery: node1 & node3 never met, yet all 3 nodes are connected both ways (complete graph)",
          wait_until(full_mesh, 45))
    for n in PORTS:
        print(f"     node{n} peers:", {a: (p.get('Status'), 'in' if p.get('Inbound') else '-', p.get('Latency'))
                                        for a, p in peers(n).items()})

    # 2-3. transactions propagate
    helper(3, "tx", "RECV1", "tx-one from node3")
    check("transaction mined on node3 reaches node1 and node2", wait_until(lambda: len(chain(1)) == 2 and same_chains(1, 2, 3), 20))
    helper(1, "tx", "RECV2", "tx-two from node1")
    check("transaction mined on node1 reaches all nodes", wait_until(lambda: len(chain(3)) == 3 and same_chains(1, 2, 3), 20))

    # 4. deterministic fork: node2 offline, node1 and node2 both mine block #3 on the same parent
    stop(2)
    wait_until(lambda: peers(1).get("127.0.0.1:8342", {}).get("Status") == "Offline", 20)
    helper(1, "nosync", "F1", "fork-block-node1")
    wait_until(lambda: len(chain(3)) == 4 and same_chains(1, 3), 20)
    helper(2, "nosync", "F2", "fork-block-node2")
    a, b = chain(1)[-1], chain(2)[-1]
    a_wins = (a["proof_of_work"], b["hash"]) > (b["proof_of_work"], a["hash"])
    print(f"     fork at #{a['number_of_block']} (same prev_hash: {a['prev_hash'] == b['prev_hash']}): "
          f"node1 PoW={a['proof_of_work']}, node2 PoW={b['proof_of_work']} -> expected winner: {'node1' if a_wins else 'node2'}")
    start(2)
    both = {"fork-block-node1", "fork-block-node2"}
    check("fork resolved: identical chains on all nodes, containing BOTH transactions",
          wait_until(lambda: same_chains(1, 2, 3) and both <= set(messages(1)), 45))
    order = messages(1)
    expected_first = "fork-block-node1" if a_wins else "fork-block-node2"
    check("fork winner = block with the larger proof_of_work; the loser was re-mined on top",
          order.index(expected_first) == 2 and chain(1)[3]["hash"] == (a if a_wins else b)["hash"])
    print(f"     chain now: {order}")

    # 5. tampering on node3 is detected and repaired from peers
    helper(3, "tamper")
    check("edited block on node3 makes its chain INVALID", not valid(3))
    print(indent(helper(3, "verify")))
    check("node3 dropped the bad blocks and restored the chain from the nearest peer",
          wait_until(lambda: same_chains(1, 2, 3) and valid(3), 20))

    # 6. node1 offline -> misses blocks -> catches up when it returns
    stop(1)
    helper(2, "tx", "RECV3", "while-node1-offline-1")
    helper(2, "tx", "RECV4", "while-node1-offline-2")
    check("node3 keeps receiving blocks while node1 is offline",
          wait_until(lambda: same_chains(2, 3) and "while-node1-offline-2" in messages(3), 20))
    start(1)
    check("node1 catches up automatically after coming back online", wait_until(lambda: same_chains(1, 2, 3), 30))

    # 7. the real interactive wallet (__main__.py) on node3, driven through stdin
    check("after node1's restart the complete graph is restored", wait_until(full_mesh, 45))
    node1_key = read_json(1, "Database/NodeDB.json")["PublicKey"]
    keys = ["abc", "1", node1_key, "hello via wallet menu", "y", "2", "3", "4", "", "1", "someone", "cancel me", "n",
            "0", "q", "y"]
    wallet = subprocess.run([PY, os.path.join(ROOT, "__main__.py")], input="\n".join(keys) + "\n", env=env_for(3),
                            capture_output=True, text=True, timeout=120, cwd=BASE)
    out = wallet.stdout
    with open(os.path.join(BASE, "wallet-cli.log"), "w", encoding="utf-8") as f:
        f.write(out + wallet.stderr)
    for name, ok in {
        "seed shown once at the first start": "SEED =" in out.split("--- Menu ---")[0],
        "invalid menu input does not exit the program": "Error : Invalid Menu Command" in out and out.count("--- Menu ---") == 8,
        "create transaction mines a block": "mined in" in out and "Transaction created" in out,
        "transaction history lists the transaction": "OUT" in out and "hello via wallet menu" in out,
        "local blockchain table shows a VALID chain": "chain VALID" in out,
        "network view shows the graph degree": "Degree of this node: out = 2, in = 2" in out,
        "cancelled transaction is handled cleanly": "Transaction Canceled" in out and "unpack" not in out,
        "menu 0 shows the wallet info again": out.count("SEED =") == 2,
        "clean exit (exit code 0, no traceback)": "Goodbye" in out and wallet.returncode == 0 and "Traceback" not in out + wallet.stderr,
    }.items():
        check(f"wallet CLI: {name}", ok)
    check("transaction created in the wallet CLI reaches node1 and node2",
          wait_until(lambda: same_chains(1, 2, 3) and "hello via wallet menu" in messages(1), 20))

    for n in PORTS:
        check(f"final chain of node{n} is valid ({len(chain(n)) - 1} blocks)", valid(n))
    errors = [f for f in os.listdir(BASE) if f.endswith(".log")
              and "Traceback" in open(os.path.join(BASE, f), encoding="utf-8", errors="replace").read()]
    check(f"no traceback in any server/client log {errors if errors else ''}", not errors)
finally:
    for n, kind in list(procs):
        stop(n, (kind,))

print(f"\n{sum(results)}/{len(results)} network checks passed")
if not all(results):
    for name in sorted(os.listdir(BASE)):
        if name.endswith(".log"):
            lines = open(os.path.join(BASE, name), encoding="utf-8", errors="replace").readlines()
            print(f"===== {name} (last 30 lines)\n" + "".join(lines[-30:]))
sys.exit(0 if all(results) else 1)
