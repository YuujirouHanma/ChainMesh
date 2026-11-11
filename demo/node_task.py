"""
Aksi sekali jalan untuk satu node demo, setara menu wallet (__main__.py). Dijalankan oleh
demo/sandbox.py dengan environment node tersebut (NODE_PORT, NODE_DATA_DIR, ...):

  python demo/node_task.py tx <public key penerima> <pesan>   menu 1: Create Transaction
  python demo/node_task.py heal                               verifikasi chain lokal + sinkronisasi
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace", line_buffering=True)

from Controller import NodeController, TransactionController  # noqa: E402
from Middleware import BlockChainSync  # noqa: E402


def main(argv):
    NodeController.InitNode()
    if len(argv) == 3 and argv[0] == "tx":
        mined = TransactionController.CreateTransaction(argv[1], argv[2])
        print(f"Transaction created: block #{mined.number_of_block} queued for broadcast")
        return 0
    if argv == ["heal"]:
        BlockChainSync.VerifySyncBlockChain()
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
