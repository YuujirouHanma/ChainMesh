import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

from Network import WSServerHandler

try:
    asyncio.run(WSServerHandler.main())
except KeyboardInterrupt:
    print("Server stopped")
