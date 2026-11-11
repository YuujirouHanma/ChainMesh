def _short(text, width):
    text = str(text)
    return text if len(text) <= width else text[:width - 3] + "..."


def Main():
    """Return (receiver, message), atau None jika transaksi dibatalkan."""
    print('''
    * Transaction Menu *
          ''')
    receiver = input("Receiver ID (public key, no spaces):").strip()
    if not receiver or any(char.isspace() for char in receiver) or "," in receiver:
        print("Transaction Canceled: the receiver ID must not be empty or contain spaces / commas")
        return None
    message = input("Message:").strip()
    if not message:
        print("Transaction Canceled: the message is empty")
        return None
    if input("Confirm The Transaction [y/N] :").strip().lower() != "y":
        print("Transaction Canceled")
        return None
    return receiver, message


def ShowBlock(block):
    print("\n    Block created:")
    for key in ("number_of_block", "timeStamp", "message", "prev_hash", "nonce",
                "proof_of_work", "hash", "signature"):
        print(f"    {key:<16}: {block.get(key)}")


def ShowHistory(rows, publicKey):
    print(f"\n    * Transaction History of {_short(publicKey, 19)} *\n")
    if not rows:
        print("    No transactions yet.")
        return
    print(f"    {'No':>4}  {'Time':<19}  {'Dir':<3}  {'Counterparty':<20}  Message")
    for number, timestamp, direction, other, text in rows:
        print(f"    {str(number):>4}  {str(timestamp)[:19]:<19}  {direction:<3}  {_short(other, 20):<20}  {text}")
