import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")   # karakter non-ASCII tidak membuat program crash

from Controller import NodeController
from Loader import Loader
from Middleware import BlockChainSync

try:
    NodeController.Control()
    print("Synchronize The BlockChain")
    try:
        BlockChainSync.VerifySyncBlockChain()
    except Exception as err:
        print("Synchronization failed:", err)
    Loader.Run()
except KeyboardInterrupt:
    print("\nGoodbye! ^^")
