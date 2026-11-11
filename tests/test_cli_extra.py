"""Remaining wallet menus + launcher. Usage: python test_cli_extra.py <root> <scratch_dir>"""
import importlib.util
import os
import shutil
import subprocess
import sys

ROOT, BASE = sys.argv[1], sys.argv[2]
shutil.rmtree(BASE, ignore_errors=True)
os.makedirs(BASE)
env = dict(os.environ, NODE_DATA_DIR=os.path.join(BASE, "wallet"), NODE_PORT="8397", NODE_HOST="127.0.0.1",
           NODE_PEERS="", PYTHONDONTWRITEBYTECODE="1")
results = []


def check(name, cond):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name)


def wallet(keys):
    run = subprocess.run([sys.executable, os.path.join(ROOT, "__main__.py")], input="\n".join(keys) + "\n",
                         env=env, capture_output=True, text=True, timeout=120)
    return run, run.stdout


from ecdsa import SECP256k1, SigningKey  # noqa: E402
from mnemonic import Mnemonic  # noqa: E402

other = SigningKey.generate(curve=SECP256k1)
other_seed = Mnemonic("english").to_mnemonic(other.to_string())
other_pub = other.get_verifying_key().to_string("compressed").hex()

run, out = wallet(["5", "not a valid seed", "5", other_seed, "y", "0", "4", "127.0.0.1:8001", "-127.0.0.1:8001",
                   "bad host!", "127.0.0.1:8397", "", "2", "q", "y"])
check("first start creates a wallet and shows the seed", "Generating Credential Keys" in out and "SEED =" in out)
check("startup without any peer neither hangs nor crashes", "Synchronization skipped" in out)
check("invalid seed is rejected", "Invalid seed" in out)
check("wallet restored from another seed (menu 5) and shown by menu 0",
      "Wallet restored" in out and f"PUBLIC KEY   = {other_pub}" in out)
check("menu 4: add peer", "Peer 127.0.0.1:8001 added" in out)
check("menu 4: remove peer", "Peer 127.0.0.1:8001 removed" in out)
check("menu 4: invalid address rejected", "Invalid address" in out)
check("menu 4: own address rejected", "That address is this node itself" in out)
check("menu 2 with no transactions", "No transactions yet" in out)
check("clean exit", run.returncode == 0 and "Goodbye" in out and "Traceback" not in out + run.stderr)

run, out = wallet(["3"])          # stdin closes without choosing q
check("closed stdin ends the program cleanly (no infinite loop / traceback)",
      run.returncode == 0 and "Input closed" in out and "Traceback" not in out + run.stderr)
check("second start does not show the seed again", "SEED =" not in out.split("--- Menu ---")[0])

# __executer__.py
run = subprocess.run([sys.executable, os.path.join(ROOT, "__executer__.py"), "--dry-run", "--port", "8350",
                      "--peer", "127.0.0.1:8341"], capture_output=True, text=True, timeout=60)
lines = [line for line in run.stdout.splitlines() if line.strip()]
print("     " + "\n     ".join(lines))
check("__executer__.py --dry-run prints server, client and wallet commands",
      run.returncode == 0 and len(lines) == 3 and all(line.startswith('cmd /s /k "title ') for line in lines)
      and "Server 8350" in lines[0] and "Client 8350" in lines[1] and "__main__.py" in lines[2])
spec = importlib.util.spec_from_file_location("executer", os.path.join(ROOT, "__executer__.py"))
executer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(executer)
spaced = os.path.join(BASE, "folder with spaces")
os.makedirs(spaced)
with open(os.path.join(spaced, "hello script.py"), "w") as f:
    f.write("import os, sys; print('HELLO-OK', os.environ.get('NODE_PORT'), len(sys.argv))")
executer.ROOT = spaced
command = executer.build_command("Wallet 8350", "hello script.py").replace("cmd /s /k", "cmd /s /c", 1)
run = subprocess.run(command, capture_output=True, text=True, env=dict(os.environ, NODE_PORT="8350"), timeout=60)
check("Windows command quoting works with spaces in the path and passes NODE_* variables",
      "HELLO-OK 8350 1" in run.stdout)

print(f"\n{sum(results)}/{len(results)} extra checks passed")
sys.exit(0 if all(results) else 1)
