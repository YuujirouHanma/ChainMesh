# Catatan Perbaikan

Dokumen ini menjelaskan perbaikan pada kode `master` (commit `89e1ba1`), kesesuaiannya dengan
paper *Theoretical Analysis* (`documentation/assets/theoretical-analysis-blockchain-p2p-network.pdf`),
dan cara menjalankan versi baru.

## Ringkasan

Versi sebelumnya tidak bisa dijalankan apa adanya, dan validasi blockchain-nya selalu lolos:
chain yang sengaja dirusak pun dianggap valid. Semua masalah itu sudah diperbaiki dan diuji
dengan 81 pemeriksaan otomatis, termasuk simulasi 3 node sungguhan.

## Cara menjalankan

```bash
python -m pip install -r requirements.txt     # mnemonic, websockets, ecdsa
python __executer__.py                         # membuka 3 jendela: Server, Client, Wallet
```

**Beberapa laptop dalam satu jaringan (LAN).** Jalankan `__executer__.py` di setiap laptop.
Cukup beri tahu satu IP teman, misalnya `python __executer__.py --peer 192.168.1.10` atau lewat
menu 4 di wallet. Node lain akan dikenal otomatis lewat *peer exchange*. Saat pertama kali
dijalankan, izinkan Python di Windows Firewall (Private network, port 8333).

**Demo beberapa node di satu laptop.** Gunakan port dan folder data berbeda. Dengan
`--bind 127.0.0.1`, firewall tidak akan bertanya.

```bash
python __executer__.py --host 127.0.0.1 --bind 127.0.0.1 --port 8341 --data-dir nodes/node1
python __executer__.py --host 127.0.0.1 --bind 127.0.0.1 --port 8342 --data-dir nodes/node2 --peer 127.0.0.1:8341 --no-install
python __executer__.py --host 127.0.0.1 --bind 127.0.0.1 --port 8343 --data-dir nodes/node3 --peer 127.0.0.1:8342 --no-install
```

`--dry-run` hanya menampilkan perintah yang akan dijalankan. Semua opsi juga bisa diatur lewat
environment variable (lihat `Config.py`).

**Demo immutability.** Ubah isi `message` salah satu blok di `Database/BlockChainDB.json`.
Menu 3 akan menandai blok itu `INVALID: InvalidBlockHash, InvalidSignature`. Saat transaksi
berikutnya dibuat (atau wallet dibuka ulang), blok rusak dan blok sesudahnya dibuang, lalu
chain dipulihkan dari peer terdekat.

### Menu wallet

| Menu | Fungsi |
|---|---|
| 1 | Create Transaction: verifikasi dan sinkronisasi, tanda tangan, mining, lalu broadcast |
| 2 | Get Transaction History: transaksi masuk dan keluar milik wallet ini |
| 3 | Get Local Block-Chain Data: tabel blok beserta status verifikasi tiap blok |
| 4 | Network Peers: graf jaringan (status edge, latency, derajat in/out), tambah atau hapus peer |
| 5 | Restore Wallet from Seed: pulihkan wallet dari 24 kata seed |
| 0 | Return to main Menu: tampilkan seed, public key, dan alamat node |
| q | Exit |

## Masalah dan perbaikannya

| # | Masalah di versi lama | Perbaikan |
|---|---|---|
| 1 | Crash saat start: `pandas` diimport padahal tidak terpasang dan tidak dipakai | Import dihapus, tabel dicetak manual. `requirements.txt` dirapikan (`asyncio`, `urllib3`, `tabulate` dihapus) |
| 2 | `verify_block` mengembalikan `True` (bool) jika valid, dan `Status` tetap `True` walaupun gagal. Akibatnya semua blok diterima | `verify_block` selalu mengembalikan `BlockVerifyStatus`, dengan `Status=False` jika ada pengecekan yang gagal |
| 3 | Yang ditandatangani `message + timeStamp`, tetapi yang diverifikasi hanya `message`, sehingga signature selalu gagal | Signature diverifikasi atas data yang sama (`message + timeStamp`), memakai ECDSA secp256k1 + SHA-256 |
| 4 | `add_block` menimpa `timeStamp` setelah hash dihitung | `timeStamp` tidak lagi diubah setelah mining |
| 5 | Setiap blok dibandingkan dengan blok terakhir chain lokal, bukan blok sebelumnya | Setiap blok diverifikasi terhadap blok sebelumnya. Genesis harus identik, dan tipe data setiap field dicek |
| 6 | Nomor blok pertama setelah genesis adalah 2 | Nomor blok = nomor sebelumnya + 1 (sesuai gambar di paper: genesis 0, lalu 1, 2, 3) |
| 7 | PoW tidak sungguhan: karakter hex diubah ke kode ASCII, sehingga `"00"` lolos dengan peluang 62,5% | Yang dicek adalah bit nol sungguhan pada nilai hash. `DIFFICULTY = 16` bit (rata-rata 65.536 percobaan, di bawah 1 detik). `proof_of_work = nonce - 1` ikut divalidasi |
| 8 | Sinkronisasi: `IndexError` jika semua peer offline, *infinite loop* jika belum ada peer, crash jika peer tidak bisa dihubungi | *Nearest neighbor* + *backtracking*. Tanpa peer, node tetap jalan dengan chain lokal. Chain hanya diganti jika valid dan lebih baik |
| 9 | Run pertama crash: objek `SigningKey` dikirim ke `bytes.fromhex` | Dikirim sebagai string hex. Seed sekarang encoding BIP-39 dari private key, jadi **bisa** dipakai untuk memulihkan wallet |
| 10 | Penanganan fork salah indentasi, sehingga tidak pernah dijalankan | Aturan fork diimplementasikan ulang (lihat bagian berikutnya), termasuk mining ulang transaksi yang kalah fork |
| 11 | Server: `await Broadcast_messages()` tidak pernah selesai, sehingga status Offline tidak pernah dicatat dan setiap koneksi meninggalkan loop zombie | Satu loop broadcast untuk seluruh server. Handler menunggu koneksi tutup lalu membersihkan datanya |
| 12 | Client: `asyncio.gather` menunggu semua koneksi selesai, sehingga peer baru tidak pernah dihubungi. Node juga terhubung ke dirinya sendiri (penyebab blok duplikat di DB lama) | Satu task per peer dengan reconnect otomatis. Peer baru langsung dihubungi. Koneksi ke diri sendiri dideteksi lewat public key |
| 13 | 3 proses menulis file JSON yang sama tanpa lock. `WaitBox` hanya menampung 1 draft, sehingga transaksi bisa hilang | Lock antar-proses + penulisan atomik. `WaitBox` menjadi antrian `{"Queue": [...]}` |
| 14 | Node yang belum saling kenal tidak pernah terhubung | Handshake `hello`/`welcome` dan pesan `peers` (*peer exchange*), sehingga complete graph terbentuk otomatis |
| 15 | Menu rekursif. Input selain angka langsung menutup program. Membatalkan transaksi menimbulkan error. Riwayat transaksi belum ada | Menu berupa loop, input divalidasi, pembatalan aman, riwayat transaksi diimplementasikan, ditambah menu jaringan dan restore wallet |
| 16 | `__executer__.py`: `; exit` bukan pemisah perintah di `cmd`, sehingga pip install gagal. Script juga dijalankan sebelum instalasi selesai | Instalasi dijalankan lebih dulu sampai selesai, path aman walaupun mengandung spasi, dan ada opsi `--port`, `--host`, `--bind`, `--data-dir`, `--peer`, `--dry-run` |
| 17 | Path data relatif terhadap folder kerja. IP dari `gethostbyname` bisa memilih adapter virtual | Path absolut dari `Config.py`. IP LAN dideteksi dari interface yang dipakai keluar jaringan, dan server bind ke `0.0.0.0` |

File yang dihapus:
- semua `__pycache__`;
- `Network/Handler.py` (tidak dipakai dan rusak);
- `test.py`, `Database/test.py`, dan `Dockerfile` (kosong).

Data chain dan peer lama di-reset karena chain-nya sudah rusak (5 blok duplikat, 6 link putus).

## Kesesuaian dengan paper

| Bagian paper | Implementasi |
|---|---|
| 1. Blockchain sebagai graf berarah | Setiap edge (`prev_hash` dan `number_of_block`) divalidasi |
| 2. Complete graph | Peer exchange membuat setiap node terhubung ke N−1 node lain. Menu 4 menampilkan derajat in/out |
| 3. Node initiation with level ordering | Client menghubungi semua peer secara konkuren (satu task per peer), lalu sinkron ke node terdekat |
| 4. Broadcasting with level-ordering | Server mengirim blok ke semua peer sekaligus. Node yang menerima blok baru meneruskannya ke level berikutnya; blok duplikat diabaikan |
| 5. Bipartite block forks | Fork dengan panjang sama: blok dengan `proof_of_work` terbesar menang (jika sama, hash terkecil). Transaksi node yang kalah di-mining ulang di atas chain pemenang |
| 6. Nearest neighbor | Peer diurutkan: Online dahulu, lalu latency (bobot edge) terkecil |
| 7.1 Verifikasi sebelum melayani sinkronisasi | `/get-blockchaindata` membuang blok rusak sebelum chain dikirim |
| 7.2 BFS dengan backtracking | Jika peer offline atau chain-nya tidak valid, sinkronisasi pindah ke peer terdekat berikutnya |

Tambahan di luar paper: **chain yang lebih panjang selalu menang**. Aturan `proof_of_work`
terbesar hanya dipakai untuk fork dengan panjang sama. Tanpa aturan ini, satu blok dengan
`proof_of_work` besar bisa membatalkan banyak blok yang sudah ada.

## Yang perlu disesuaikan di README

Beberapa potongan kode di `README.md` dan `documentation/README.MD` sekarang sudah berbeda dengan
kodenya:
- daftar *Requirements*;
- mining (`DIFFICULTY` sekarang 16 bit nol yang sungguhan);
- `verify_block`;
- `sign_message` dan `verify_signature` (keduanya memakai `message + timeStamp`);
- `SynchronizeHandler`;
- `Register` dan `Handler` di server, serta `ClientHandler` dan `Peering` di client.

Rumus hash tetap sama: `sha256(message + prev_hash + signature + nonce + timeStamp)`.

## Hasil pengujian

| Kelompok | Jumlah | Yang diuji |
|---|---|---|
| Unit | 42 | Wallet dan seed, mining, PoW, deteksi manipulasi, blok palsu, aturan fork, konsensus, perbaikan chain |
| Konkurensi | 1 | 3 proses × 4 blok ditulis bersamaan, tanpa blok yang hilang |
| Jaringan | 24 | 3 node sungguhan: complete graph terbentuk, transaksi tersebar, fork diselesaikan sesuai aturan PoW, chain yang dimanipulasi dipulihkan, node offline menyusul, seluruh menu wallet dijalankan lewat stdin |
| Menu & launcher | 14 | Restore wallet, tambah/hapus peer, stdin yang tertutup, quoting perintah `cmd` |

## Catatan

- **Tidak kompatibel dengan node versi lama**, karena aturan validasinya berubah. Semua anggota
  harus memakai versi ini.
- **Seed berubah.** Seed versi lama (dari `sha256(private key)`) tidak bisa dipakai. Seed baru
  ditampilkan sekali saat wallet pertama kali dibuka, dan bisa dilihat lagi lewat menu 0.
- **Private key disimpan tanpa enkripsi** di `Database/NodeDB.json`. Cukup untuk demo, jangan
  dipakai untuk aset sungguhan. File ini sudah masuk `.gitignore`.
- **`proof_of_work` bisa dimanipulasi** dengan memulai nonce dari angka besar. Blockchain sungguhan
  memakai akumulasi difficulty. Di sini aturan *longest chain* yang membatasi dampaknya.
- **Saat push ke GitHub**, hapus file yang sudah terlanjur ter-commit dari index:

  ```bash
  git rm -r --cached --ignore-unmatch "*__pycache__*" Database/NodeDB.json
  ```

  Private key lama yang pernah ter-commit tetap ada di riwayat git, jadi anggap key itu bocor.

## Tambahan: demo web untuk portofolio

Folder baru (hapus kedua folder ini jika ingin kembali ke struktur awal):
- `web/`: halaman studi kasus dan konsol live (React + Vite + Tailwind), dua bahasa (EN/ID).
- `demo/`: server demo (FastAPI) yang menjalankan 4–6 node **asli** project ini di satu mesin, lalu
  mengirim state dan log-nya ke browser. Cara menjalankan dan deploy ada di `demo/README.md`.
- `tests/`: 81 pengecekan di atas, dijalankan dengan `python tests/run_all.py`.
- `Dockerfile` dan `.dockerignore`. `Database/*.json` dikecualikan, jadi private key tidak ikut masuk image.

Perubahan kecil di kode inti:

| File | Perubahan |
|---|---|
| `Controller/TransactionController.py` | Logika menu 1 dipindah ke `CreateTransaction(receiver, message)` supaya bisa dipakai juga oleh demo. Perilaku wallet tetap sama |
| `Config.py`, `Network/Protocol.py` | Opsi `NODE_LATENCY_FILE`: latency buatan per edge untuk demo di satu mesin. Tanpa opsi ini perilakunya sama seperti sebelumnya |
| `Network/WSClientHandler.py`, `Network/WSServerHandler.py` | `measure_latency` menerima alamat peer (dipakai oleh opsi di atas) |

Setelah perubahan ini, ke-81 pengecekan dijalankan ulang dan semuanya lolos.
