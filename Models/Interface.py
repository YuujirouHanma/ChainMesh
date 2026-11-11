import datetime

# Genesis block (blok ke-0). Harus identik di semua node dan tidak di-mining.
GENESIS_BLOCK = {"hash": "0", "prev_hash": "0", "message": "genesis", "nonce": 0,
                 "proof_of_work": 0, "number_of_block": 0, "timeStamp": 0, "signature": 0}


class Block:
    def __init__(self, hash="",
                 prev_hash="",
                 message="",
                 nonce=0,
                 proof_of_work=0,
                 number_of_block=0,
                 timeStamp="",
                 signature=""):
        self.hash = hash
        self.prev_hash = prev_hash
        self.message = message
        self.nonce = nonce
        self.proof_of_work = proof_of_work
        self.number_of_block = number_of_block
        self.timeStamp = timeStamp or str(datetime.datetime.now())
        self.signature = signature

    def to_dict(self):
        return dict(self.__dict__)


class BlockVerifyStatus:
    """Hasil verifikasi satu blok. Status bernilai True HANYA jika semua pengecekan lolos."""

    CHECKS = ("InvalidFormat", "PreviousHashBlockError", "MissedBlock",
              "InvalidBlockHash", "InvalidProofOfWork", "InvalidSignature")

    def __init__(self, BlockNumber=0):
        self.BlockNumber = BlockNumber
        self.Status = True
        self.InvalidFormat = False           # field hilang / tipe data salah / format message salah
        self.PreviousHashBlockError = False  # prev_hash != hash blok sebelumnya
        self.MissedBlock = False             # number_of_block != nomor blok sebelumnya + 1
        self.InvalidBlockHash = False        # hash tidak cocok dengan isi blok
        self.InvalidProofOfWork = False      # hash tidak memenuhi DIFFICULTY / proof_of_work tidak cocok
        self.InvalidSignature = False        # signature tidak cocok dengan public key pengirim
        self.BlocksFork = False              # blok valid, tetapi berada di cabang lain (fork)

    def errors(self):
        return [name for name in self.CHECKS if getattr(self, name)]

    def finish(self):
        self.Status = not self.errors()
        return self
