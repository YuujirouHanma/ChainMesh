# Demo web K-Chain

Halaman portofolio (studi kasus + 6 figur) dan **konsol live** yang mengendalikan node asli project ini.

```
browser ──HTTP/WebSocket──> demo/server.py (FastAPI)
                                │  menjalankan & membaca
                                ▼
          node A    node B    node C    node D   (maks. 6)
          demo/node_runner.py = server + client WebSocket project ini, satu proses per node
          aksi pengunjung     = demo/node_task.py (sama dengan menu wallet), di folder data node itu
```

- Setiap node punya port, kunci wallet, dan file JSON sendiri di `demo/runtime/node-X/`.
  Wallet asli di `Database/` tidak pernah dibaca.
- Server hanya mengirim **public key** ke browser, tidak pernah private key.
- Latency antar node diemulasikan lewat `NODE_LATENCY_FILE`, karena semua node berada di satu mesin.
  Node tetap mengukurnya sendiri dengan ping/pong.
- Pengaman sandbox publik:
  - batas aksi per IP: 5 transaksi per menit;
  - pesan maksimal 64 karakter, tanpa tautan atau kata kasar;
  - node yang dimatikan menyala lagi setelah 90 detik;
  - reset otomatis setiap 30 menit atau saat chain mencapai 60 blok.

## Menjalankan di laptop

```bash
pip install -r demo/requirements.txt        # mnemonic, websockets, ecdsa, fastapi, uvicorn
cd web && npm install && npm run build && cd ..
python -m demo                               # buka http://127.0.0.1:8450
```

Saat mengubah tampilan, jalankan `python -m demo`, lalu di terminal lain `cd web && npm run dev`.
Buka http://127.0.0.1:5173; `/api` otomatis diteruskan ke port 8450.

Konfigurasi (semua opsional):

| Variabel | Default | Fungsi |
|---|---|---|
| `HOST`, `PORT` | `127.0.0.1`, `8450` | alamat API dan web |
| `DEMO_NODE_PORT` | `8451` | port node A; node berikutnya +1 |
| `DEMO_INITIAL_NODES` | `4` | jumlah node awal (2–6) |
| `DEMO_RESET_MINUTES` | `30` | interval reset otomatis |
| `DEMO_RUNTIME` | `demo/runtime` | folder data node demo |
| `TRUST_PROXY` | – | `1` jika berjalan di belakang reverse proxy (pakai `X-Forwarded-For`) |

## Deploy

Satu image Docker berisi web dan node:

```bash
docker build -t k-chain .
docker run -p 8080:8080 k-chain              # buka http://localhost:8080
```

`.dockerignore` mengecualikan `Database/*.json`, jadi private key wallet tidak ikut masuk image.
Kebutuhan: satu container dengan sekitar 300 MB RAM dan dukungan WebSocket. Pilihan hosting gratis:

- **Hugging Face Spaces (Docker)**: RAM besar; Space tertidur setelah lama tidak dipakai.
  Tambahkan `app_port: 8080` di metadata README Space.
- **Render (Web Service, Docker)**: instance gratis tertidur setelah 15 menit tanpa pengunjung.
  Kunjungan pertama butuh ±1 menit; halaman web sudah menampilkan status "membangunkan server".

Jika halaman web di-hosting terpisah (misalnya di hosting statis), build dengan
`VITE_API_BASE=https://alamat-server-demo npm run build`.
