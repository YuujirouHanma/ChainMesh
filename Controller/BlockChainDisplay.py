import Config
from Database import Repositories as DB
from Middleware import KeyGenerator
from Models.Blockchain import Blockchain
from Models.Interface import GENESIS_BLOCK


def _short(text, width):
    text = str(text)
    return text if len(text) <= width else text[:width - 3] + "..."


def print_table(data):
    """Tampilkan blockchain lokal beserta hasil verifikasi setiap blok."""
    blockchain = Blockchain()
    print(f"\n{'No':>4}  {'Time':<19}  {'Sender':<12}  {'Receiver':<12}  {'Message':<18}  "
          f"{'PoW':>7}  {'Hash':<14}  Status")
    print("-" * 112)
    chain_valid = True
    for index, block in enumerate(data):
        if index == 0:
            sender = receiver = "-"
            text = block.get("message", "")
            valid = block == GENESIS_BLOCK
            status = "OK (genesis)" if valid else "INVALID genesis"
        else:
            result = blockchain.verify_block(block, data[index - 1])
            valid = result.Status
            status = "OK" if valid else "INVALID: " + ", ".join(result.errors())
            sender, receiver, text = (KeyGenerator.ParseTransaction(block.get("message"))
                                      or ("?", "?", block.get("message", "")))
        chain_valid = chain_valid and valid
        print(f"{str(block.get('number_of_block', '?')):>4}  {str(block.get('timeStamp', ''))[:19]:<19}  "
              f"{_short(sender, 12):<12}  {_short(receiver, 12):<12}  {_short(text, 18):<18}  "
              f"{str(block.get('proof_of_work', '')):>7}  {_short(block.get('hash', ''), 14):<14}  {status}")
    verdict = "VALID" if chain_valid else "INVALID (create a transaction or restart the wallet to repair & resync)"
    print(f"\n{len(data) - 1} block(s) after genesis | difficulty: {Config.DIFFICULTY} bit | chain {verdict}")


def Control():
    try:
        print_table(DB.GetBlockChainData())
    except Exception as e:
        print(e)
