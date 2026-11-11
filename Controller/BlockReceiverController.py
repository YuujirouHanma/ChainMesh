from Database import Repositories as DB
from Middleware import BlockChainSync
from Models.Blockchain import Blockchain


def Control(block, source=None):
    """Dipanggil client setiap menerima blok dari peer `source`."""
    try:
        result, status = Blockchain().add_block(block)
        number = block.get("number_of_block", "?") if isinstance(block, dict) else "?"
        if result == "added":
            print(f"Block #{number} from {source} verified and added to the local chain")
            DB.EnqueueBroadcast(block)       # teruskan ke peer lain (broadcast level berikutnya)
        elif result == "sync":
            print(f"Block #{number} from {source} is ahead / wins a fork, synchronizing with {source} ...")
            BlockChainSync.SynchronizeFrom(source)
        elif result == "fork":
            print(f"Block fork at #{number} from {source}: local chain kept "
                  f"(longer, or its block has the larger proof_of_work)")
        elif result == "invalid":
            reasons = ", ".join(status.errors()) if status else "unknown"
            print(f"Block #{number} from {source} REJECTED ({reasons})")
        return result
    except Exception as err:
        print("Error while processing a received block:", err)
        return "error"
