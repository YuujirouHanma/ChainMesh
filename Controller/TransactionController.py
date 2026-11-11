from Database import Repositories as DB
from Middleware import BlockChainSync, KeyGenerator
from Models.Blockchain import Blockchain
from Models.Interface import Block
from View import TransactionView


def CreateTransaction(receiver, message):
    """Verifikasi & sinkronisasi chain, tanda tangan, mining, lalu antrekan blok untuk di-broadcast
    oleh server. Dipakai menu 1 wallet dan demo web (demo/node_task.py)."""
    # chain lokal harus valid & terbaru sebelum mining (memperkecil peluang fork)
    BlockChainSync.VerifySyncBlockChain(online_only=True)
    public_key = DB.GetUserData("PublicKey")
    print("Mining the block ...")
    mined = Blockchain().mine_block(Block(message=f"From {public_key} to {receiver}, {message}"))
    DB.EnqueueBroadcast(mined.to_dict())
    return mined


def Control():
    transaction = TransactionView.Main()
    if not transaction:
        return
    mined = CreateTransaction(*transaction)
    TransactionView.ShowBlock(mined.to_dict())
    print("Transaction created. The block is queued and will be broadcast by the server window.")


def History():
    public_key = DB.GetUserData("PublicKey")
    rows = []
    for block in DB.GetBlockChainData()[1:]:
        transaction = KeyGenerator.ParseTransaction(block.get("message")) if isinstance(block, dict) else None
        if transaction is None:
            continue
        sender, receiver, text = transaction
        if sender == public_key:
            rows.append((block.get("number_of_block"), block.get("timeStamp"), "OUT", receiver, text))
        elif receiver == public_key:
            rows.append((block.get("number_of_block"), block.get("timeStamp"), "IN", sender, text))
    TransactionView.ShowHistory(rows, public_key)
