"""Unit tests. Usage: python test_unit.py <project_root> <scratch_data_dir>"""
import contextlib
import copy
import io
import os
import shutil
import sys

ROOT, DATA = sys.argv[1], sys.argv[2]
shutil.rmtree(DATA, ignore_errors=True)
os.environ.update(NODE_DATA_DIR=DATA, NODE_PORT="8399", NODE_HOST="127.0.0.1", NODE_BIND="127.0.0.1", NODE_PEERS="")
sys.path.insert(0, ROOT)

import Config  # noqa: E402
from Controller import NodeController  # noqa: E402
from Database import Repositories as DB  # noqa: E402
from Middleware import BIPMemonicGenerator, Hash, JSONWorker, KeyGenerator  # noqa: E402
from Models.Blockchain import Blockchain, block_wins  # noqa: E402
from Models.Interface import Block  # noqa: E402

results = []


def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond or detail == "" else f"   -> {detail}"))


def quiet(fn, *args, **kwargs):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args, **kwargs)


def make_block(priv, pub, number, prev_hash, text, ts):
    message = f"From {pub} to R, {text}"
    signature = KeyGenerator.sign_message(priv, message + ts)
    nonce, block_hash, pow_ = Hash.mine(message, prev_hash, signature, ts, Config.DIFFICULTY)
    return {"hash": block_hash, "prev_hash": prev_hash, "message": message, "nonce": nonce,
            "proof_of_work": pow_, "number_of_block": number, "timeStamp": ts, "signature": signature}


# 1. storage & identity ---------------------------------------------------------------
data, created = quiet(NodeController.InitNode)
check("InitStorage creates the 4 data files",
      all(os.path.exists(p) for p in (Config.NODE_DB, Config.BLOCKCHAIN_DB, Config.CONNECTION_DB, Config.WAITBOX)))
check("a new wallet is generated on first init", created and data["PrivateKey"] and data["PublicKey"])
data2, created2 = quiet(NodeController.InitNode)
check("wallet is stable on later inits", not created2 and data2["PrivateKey"] == data["PrivateKey"])
priv, me = data["PrivateKey"], data["PublicKey"]
seed = BIPMemonicGenerator.CreateMemonicPhrase(priv)
check("seed = 24 words and restores the SAME private key",
      len(seed.split()) == 24 and BIPMemonicGenerator.RestorePrivateKey(seed) == priv)
try:
    BIPMemonicGenerator.RestorePrivateKey("abandon " * 23 + "zoo")
    rejected = False
except ValueError:
    rejected = True
check("invalid seed is rejected", rejected)

# 2. mining -----------------------------------------------------------------------------
for i in range(1, 4):
    quiet(Blockchain().mine_block, Block(message=f"From {me} to RECV{i}, pesan {i}"))
chain = DB.GetBlockChainData()
check("block numbers are 0,1,2,3 (first block after genesis is #1)",
      [b["number_of_block"] for b in chain] == [0, 1, 2, 3])
check("PoW: every hash starts with 16 zero bits", all(b["hash"].startswith("0000") for b in chain[1:]))
check("proof_of_work == nonce - 1", all(b["proof_of_work"] == b["nonce"] - 1 for b in chain[1:]))
check("stored hash == recomputed hash (timeStamp no longer overwritten)",
      all(Blockchain.calculate_hash(b) == b["hash"] for b in chain[1:]))
check("signature valid over message + timeStamp",
      all(KeyGenerator.verify_signature(me, b["message"] + b["timeStamp"], b["signature"]) for b in chain[1:]))
check("verify_chain(valid chain) is True", Blockchain().verify_chain())


# 3. tampering detection ----------------------------------------------------------------
def first_invalid(change):
    c = copy.deepcopy(chain)
    change(c)
    return Blockchain().find_invalid_block(c)


r = first_invalid(lambda c: c[2].update(message=c[2]["message"].replace("pesan 2", "pesan 999")))
check("edited message -> invalid at #2 (hash + signature)",
      r and r[0] == 2 and {"InvalidBlockHash", "InvalidSignature"} <= set(r[1].errors()), r and r[1].errors())


def edit_and_remine(c):
    b = c[2]
    b["message"] = b["message"].replace("pesan 2", "pesan 999")
    b["nonce"], b["hash"], b["proof_of_work"] = Hash.mine(b["message"], b["prev_hash"], b["signature"],
                                                           b["timeStamp"], Config.DIFFICULTY)


r = first_invalid(edit_and_remine)
check("edited + re-mined -> still invalid at #2 (signature)",
      r and r[0] == 2 and r[1].errors() == ["InvalidSignature"], r and r[1].errors())
r = first_invalid(lambda c: c.insert(2, copy.deepcopy(c[1])))
check("duplicated block -> invalid at #2", r and r[0] == 2, r and r[1].errors())
r = first_invalid(lambda c: c[0].update(message="hacked"))
check("edited genesis -> invalid at 0", r and r[0] == 0)
r = first_invalid(lambda c: c[3].update(number_of_block="3"))
check("wrong data type -> InvalidFormat", r and r[0] == 3 and "InvalidFormat" in r[1].errors(), r and r[1].errors())
r = first_invalid(lambda c: c[3].update(proof_of_work=10 ** 9))
check("faked proof_of_work -> InvalidProofOfWork",
      r and r[0] == 3 and r[1].errors() == ["InvalidProofOfWork"], r and r[1].errors())

other_priv = KeyGenerator.private_key_to_hex(KeyGenerator.generate_key_pair()[0])
forged = make_block(other_priv, me, 4, chain[-1]["hash"], "forged", "2026-01-01 00:00:00")  # pretends to be `me`
st = Blockchain().verify_block(forged)
check("block signed with someone else's key -> InvalidSignature",
      not st.Status and st.errors() == ["InvalidSignature"], st.errors())

weak = make_block(priv, me, 4, chain[-1]["hash"], "weak", "2026-01-01 00:00:01")
n = 1
while Hash.hash(weak["message"], weak["prev_hash"], weak["signature"], n, weak["timeStamp"]).startswith("0000"):
    n += 1
weak.update(nonce=n, proof_of_work=n - 1,
            hash=Hash.hash(weak["message"], weak["prev_hash"], weak["signature"], n, weak["timeStamp"]))
st = Blockchain().verify_block(weak)
check("hash without 16 zero bits -> InvalidProofOfWork",
      not st.Status and st.errors() == ["InvalidProofOfWork"], st.errors())

# 4. receiving blocks (add_block) ------------------------------------------------------
good = make_block(priv, me, 4, chain[-1]["hash"], "good", "2026-01-01 00:00:02")
check("valid block extending the tip -> added", Blockchain().add_block(good)[0] == "added")
check("same block again -> duplicate", Blockchain().add_block(good)[0] == "duplicate")
check("forged block -> invalid", Blockchain().add_block(forged)[0] == "invalid")
winners, losers, i = [], [], 0
while not (winners and losers):
    s = make_block(priv, me, 4, chain[-1]["hash"], f"sibling {i}", f"2026-01-02 00:00:{i:02d}")
    (winners if block_wins(s, good) else losers).append(s)
    i += 1
check("fork at the tip, rival has LARGER proof_of_work -> sync", Blockchain().add_block(winners[0])[0] == "sync")
check("fork at the tip, rival has smaller proof_of_work -> fork (keep local)",
      Blockchain().add_block(losers[0])[0] == "fork")
old = make_block(priv, me, 2, chain[1]["hash"], "old branch", "2026-01-02 00:01:00")
check("fork deeper than the tip -> fork (local chain is longer)", Blockchain().add_block(old)[0] == "fork")
orphan = make_block(priv, me, 9, "ab" * 32, "unknown parent", "2026-01-02 00:01:01")
check("block with unknown parent -> sync", Blockchain().add_block(orphan)[0] == "sync")

# 5. replace_chain (consensus) ---------------------------------------------------------
local = DB.GetBlockChainData()                                  # g,1,2,3,good
ext = local + [make_block(priv, me, 5, local[-1]["hash"], "ext", "2026-01-03 00:00:00")]
check("shorter chain rejected", Blockchain().replace_chain(local[:3]) == (False, []))
bad = copy.deepcopy(ext)
bad[2]["message"] += "x"
check("invalid longer chain rejected", Blockchain().replace_chain(bad) == (False, []))
check("valid longer chain adopted", Blockchain().replace_chain(ext) == (True, []) and len(DB.GetBlockChainData()) == 6)

current = DB.GetBlockChainData()                                # g,1,2,3,good,ext
w = winners[0]
branch = current[:4] + [w, make_block(priv, me, 5, w["hash"], "w5", "2026-01-03 00:00:01")]
replaced, orphans = Blockchain().replace_chain(branch)
check("equal-length fork: branch with the larger proof_of_work adopted, our orphaned txs returned",
      replaced and set(orphans) == {current[4]["message"], current[5]["message"]}, (replaced, orphans))
check("equal-length fork: losing branch rejected", Blockchain().replace_chain(current) == (False, []))
now = DB.GetBlockChainData()                                    # g,1,2,3,w,w5
k = 0
while True:
    loser = make_block(priv, me, 4, now[3]["hash"], f"loser {k}", f"2026-01-04 00:00:{k:02d}")
    if not block_wins(loser, now[4]):
        break
    k += 1
long_chain = now[:4] + [loser]
for j in (5, 6):
    long_chain.append(make_block(priv, me, j, long_chain[-1]["hash"], f"long {j}", f"2026-01-04 00:01:0{j}"))
replaced, orphans = Blockchain().replace_chain(long_chain)
check("LONGER chain wins even if its fork block has a smaller proof_of_work",
      replaced and set(orphans) == {now[4]["message"], now[5]["message"]}, (replaced, orphans))

# 6. repair_chain ------------------------------------------------------------------------
chain_now = DB.GetBlockChainData()
broken = copy.deepcopy(chain_now)
broken[2]["message"] += " TAMPER"
DB.CreateBlockChainData(broken)
removed, status = Blockchain().repair_chain()
check("repair_chain drops the tampered block and everything after it",
      removed == len(broken) - 2 and len(DB.GetBlockChainData()) == 2 and Blockchain().verify_chain(),
      (removed, status and status.errors()))
check("repair_chain on a valid chain does nothing", Blockchain().repair_chain() == (0, None))
with open(Config.BLOCKCHAIN_DB, "w", encoding="utf-8") as f:
    f.write("{ this is not json")
check("corrupted (non-JSON) chain file does not crash, falls back to genesis",
      len(quiet(DB.GetBlockChainData)) == 1)

# 7. queue & addresses -------------------------------------------------------------------
DB.EnqueueBroadcast({"a": 1})
DB.EnqueueBroadcast({"b": 2})
check("broadcast queue keeps order and empties", DB.DequeueBroadcast() == [{"a": 1}, {"b": 2}] and DB.DequeueBroadcast() == [])
JSONWorker.CreateDataJSON(Config.WAITBOX, {"Draft": ""})
quiet(DB.InitStorage)
check("old WaitBox format {'Draft': ...} is migrated", JSONWorker.GetDataJSON(Config.WAITBOX) == {"Queue": []})
check("address normalization",
      [DB.NormalizeAddress(a) for a in ("192.168.1.5", "192.168.1.5:8333", "ws://10.0.0.1:8334/", "bad host", "1.2.3.4:99999")]
      == ["192.168.1.5", "192.168.1.5", "10.0.0.1:8334", None, None])
check("self address detection", DB.IsSelfAddress("127.0.0.1:8399") and not DB.IsSelfAddress("127.0.0.1:8398"))
check("AddPeers skips self and duplicates",
      DB.AddPeers(["127.0.0.1:8399", "127.0.0.1:8001", "127.0.0.1:8001"]) == ["127.0.0.1:8001"])
DB.UpdatePeer("127.0.0.1:8002", create=False, Status="Online")
check("UpdatePeer(create=False) does not re-add an unknown/removed peer", "127.0.0.1:8002" not in DB.GetPeers())
check("RemovePeer", DB.RemovePeer("127.0.0.1:8001") and "127.0.0.1:8001" not in DB.GetPeers())

print(f"\n{sum(results)}/{len(results)} unit checks passed")
sys.exit(0 if all(results) else 1)
