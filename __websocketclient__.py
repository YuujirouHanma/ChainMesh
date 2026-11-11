import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

from Network import WSClientHandler

try:
    asyncio.run(WSClientHandler.main())
except KeyboardInterrupt:
    print("Client stopped")
