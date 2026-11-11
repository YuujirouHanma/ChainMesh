import datetime
import time

import Config
from Database import Repositories as DB
from Middleware import Hash, KeyGenerator
from Models.Interface import GENESIS_BLOCK, BlockVerifyStatus

# field wajib setiap blok beserta tipe datanya
BLOCK_FIELDS = {"hash": str, "prev_hash": str, "message": str, "nonce": int,
                "proof_of_work": int, "number_of_block": int, "timeStamp": str, "signature": str}


def has_valid_format(block):
    return isinstance(block, dict) and all(type(block.get(field)) is kind
                                           for field, kind in BLOCK_FIELDS.items())


def block_wins(block, rival):
    """Aturan Block Fork (paper bagian 5): blok dengan proof_of_work TERBESAR yang dipilih.
    Jika sama besar, hash terkecil yang menang supaya semua node pasti memilih blok yang sama."""
    if block["proof_of_work"] != rival["proof_of_work"]:
        return block["proof_of_work"] > rival["proof_of_work"]
    return block["hash"] < rival["hash"]


class Blockchain:
    def __init__(self):
        self.BlockChainData = DB.GetBlockChainData()

    def reload(self):
        self.BlockChainData = DB.GetBlockChainData()

    # ------------------------------------------------------------------ verifikasi
    @staticmethod
    def calculate_hash(block):
        return Hash.hash(block["message"], block["prev_hash"], block["signature"],
                         block["nonce"], block["timeStamp"])

    def verify_block(self, block, previous_block=None):
        """Verifikasi `block` terhadap blok SEBELUMNYA (default: blok terakhir chain lokal)."""
        if previous_block is None:
            previous_block = self.BlockChainData[-1]
        number = block.get("number_of_block") if isinstance(block, dict) else None
        status = BlockVerifyStatus(number if type(number) is int else -1)
        if not has_valid_format(block):
            status.InvalidFormat = True
            return status.finish()
        try:
            # 1. keterhubungan & urutan blok (edge pada graf berarah blockchain)
            if block["prev_hash"] != previous_block["hash"]:
                status.PreviousHashBlockError = True
            if block["number_of_block"] != previous_block["number_of_block"] + 1:
                status.MissedBlock = True
            # 2. hash harus sesuai dengan isi blok
            if self.calculate_hash(block) != block["hash"]:
                status.InvalidBlockHash = True
            # 3. Proof of Work
            if (not Hash.meets_difficulty(block["hash"], Config.DIFFICULTY)
                    or block["proof_of_work"] != block["nonce"] - 1):
                status.InvalidProofOfWork = True
            # 4. signature pengirim atas (message + timeStamp), sama seperti saat mining
            transaction = KeyGenerator.ParseTransaction(block["message"])
            if transaction is None:
                status.InvalidFormat = True
            elif not KeyGenerator.verify_signature(transaction[0], block["message"] + block["timeStamp"],
                                                   block["signature"]):
                status.InvalidSignature = True
        except Exception:
            status.InvalidFormat = True
        return status.finish()

    def find_invalid_block(self, chain=None):
        """(index, status) blok pertama yang tidak valid, atau None jika seluruh chain valid."""
        chain = self.BlockChainData if chain is None else chain
        if not isinstance(chain, list) or not chain or chain[0] != GENESIS_BLOCK:
            status = BlockVerifyStatus(0)
            status.InvalidFormat = True
            return 0, status.finish()
        for index in range(1, len(chain)):
            status = self.verify_block(chain[index], chain[index - 1])
            if not status.Status:
                return index, status
        return None

    def verify_chain(self, chain=None):
        return self.find_invalid_block(chain) is None

    def valid_prefix(self, chain=None):
        """Bagian awal chain yang valid (berhenti sebelum blok rusak pertama)."""
        chain = self.BlockChainData if chain is None else chain
        invalid = self.find_invalid_block(chain)
        return list(chain) if invalid is None else list(chain[:invalid[0]])

    # ------------------------------------------------------------------ menambah blok
    def mine_block(self, block):
        """Isi number_of_block, prev_hash, timeStamp & signature, cari nonce (Proof of Work),
        lalu simpan. Dikunci agar tidak bentrok dengan proses lain yang juga menulis chain."""
        private_key = DB.GetUserData("PrivateKey")
        with DB.ChainLock():
            self.reload()
            previous_block = self.BlockChainData[-1]
            block.number_of_block = previous_block["number_of_block"] + 1
            block.prev_hash = previous_block["hash"]
            block.timeStamp = str(datetime.datetime.now())
            block.signature = KeyGenerator.sign_message(private_key, block.message + block.timeStamp)
            started = time.perf_counter()
            block.nonce, block.hash, block.proof_of_work = Hash.mine(
                block.message, block.prev_hash, block.signature, block.timeStamp, Config.DIFFICULTY)
            elapsed = time.perf_counter() - started
            self.BlockChainData.append(block.to_dict())
            DB.CreateBlockChainData(self.BlockChainData)
        print(f"Block #{block.number_of_block} mined in {elapsed:.2f}s "
              f"(nonce={block.nonce}, proof_of_work={block.proof_of_work}, hash={block.hash[:16]}...)")
        return block

    def add_block(self, block):
        """Proses blok yang DITERIMA dari peer. Return (hasil, status):
          "added"     valid & menyambung ke blok terakhir -> disimpan
          "duplicate" blok sudah ada di chain lokal
          "fork"      cabang lain yang kalah (chain lokal lebih panjang / proof_of_work lebih besar)
          "sync"      chain pengirim lebih panjang / menang fork -> perlu sinkronisasi dari pengirim
          "invalid"   blok tidak valid
        """
        if not has_valid_format(block):
            status = BlockVerifyStatus(-1)
            status.InvalidFormat = True
            return "invalid", status.finish()
        with DB.ChainLock():
            self.reload()
            chain = self.BlockChainData
            position = {item.get("hash"): index for index, item in enumerate(chain) if isinstance(item, dict)}
            if block["hash"] in position:
                return "duplicate", None
            parent = position.get(block["prev_hash"])
            if parent is None:
                return "sync", None          # induknya tidak dikenal: kita tertinggal / beda cabang
            status = self.verify_block(block, chain[parent])
            if not status.Status:
                return "invalid", status
            if parent == len(chain) - 1:
                chain.append(block)
                DB.CreateBlockChainData(chain)
                return "added", status
            status.BlocksFork = True        # sudah ada blok lain dengan prev_hash yang sama
            if parent == len(chain) - 2 and block_wins(block, chain[-1]):
                return "sync", status       # fork di ujung chain dan blok milik peer yang menang
            return "fork", status

    def replace_chain(self, new_chain, verified=False):
        """Ganti chain lokal dengan new_chain jika new_chain valid dan LEBIH BAIK, yaitu:
          1. new_chain lebih panjang (aturan longest chain: node mengejar ketertinggalan), atau
          2. sama panjang tetapi bercabang (fork) dan blok new_chain di titik fork menang:
             proof_of_work terbesar (paper bagian 5); jika sama besar, hash terkecil.
        Return (diganti?, daftar message transaksi milik node ini yang terbuang/orphan)."""
        if not verified and not self.verify_chain(new_chain):
            return False, []
        my_public_key = DB.GetUserData("PublicKey")
        with DB.ChainLock():
            self.reload()
            local = self.valid_prefix()     # blok lokal yang rusak tidak ikut dibandingkan
            fork = 0
            while (fork < len(local) and fork < len(new_chain)
                   and local[fork]["hash"] == new_chain[fork]["hash"]):
                fork += 1
            if len(new_chain) < len(local) or fork == len(new_chain):
                return False, []            # lebih pendek / tidak membawa blok baru
            if len(new_chain) == len(local) and not block_wins(new_chain[fork], local[fork]):
                return False, []            # fork sama panjang, cabang lokal yang menang
            new_hashes = {item["hash"] for item in new_chain}
            new_messages = {item["message"] for item in new_chain}
            orphans = [item["message"] for item in local[fork:]
                       if item["hash"] not in new_hashes and item["message"] not in new_messages
                       and KeyGenerator.ParseSender(item["message"]) == my_public_key]
            self.BlockChainData = list(new_chain)
            DB.CreateBlockChainData(self.BlockChainData)
            return True, orphans

    def repair_chain(self):
        """Buang blok mulai dari blok rusak pertama. Return (jumlah blok dibuang, status blok rusak),
        atau (0, None) jika chain lokal valid."""
        with DB.ChainLock():
            self.reload()
            invalid = self.find_invalid_block()
            if invalid is None:
                return 0, None
            index, status = invalid
            removed = len(self.BlockChainData) - index
            self.BlockChainData = self.BlockChainData[:index] or [dict(GENESIS_BLOCK)]
            DB.CreateBlockChainData(self.BlockChainData)
            return removed, status
