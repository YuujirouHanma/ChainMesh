# Demo web ChainMesh

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
| `ALLOWED_ORIGINS` | – | origin halaman web di domain lain yang boleh memanggil API (CORS), dipisah koma |

## Deploy

Satu image Docker berisi web dan node:

```bash
docker build -t chainmesh .
docker run -p 8080:8080 chainmesh              # buka http://localhost:8080
```

`.dockerignore` mengecualikan `Database/*.json`, jadi private key wallet tidak ikut masuk image.
Kebutuhan: satu container dengan sekitar 300 MB RAM dan dukungan WebSocket.

Project ini memakai dua hosting gratis:

| Bagian | Hosting | Konfigurasi |
|---|---|---|
| Halaman web (statis) | GitHub Pages: selalu online, langsung terbuka | `.github/workflows/pages.yml` |
| Server demo + node | Render, Web Service Docker (0,1 CPU, 512 MB) | `render.yaml` |

Server Render tertidur setelah 15 menit tanpa pengunjung dan butuh sekitar satu menit untuk bangun.
Karena halaman web ada di GitHub Pages, studi kasus dan figur tetap langsung terbuka; hanya konsol live
yang menampilkan status "membangunkan server" sampai server siap.

Setup sekali:

1. Aktifkan GitHub Pages dengan sumber **GitHub Actions** (Settings → Pages). Setiap push yang mengubah
   `web/` akan membangun ulang halaman.
2. Buat server di Render dari blueprint: https://render.com/deploy?repo=https://github.com/YuujirouHanma/ChainMesh.
   `render.yaml` sudah berisi `ALLOWED_ORIGINS` untuk domain GitHub Pages.
3. Beri tahu halaman web alamat server itu, lalu bangun ulang:

   ```bash
   gh variable set DEMO_API_URL --body "https://<nama-service>.onrender.com"
   gh workflow run pages.yml
   ```

Hugging Face Spaces tidak dipakai: sekarang Space dengan SDK Docker butuh paket berbayar.
