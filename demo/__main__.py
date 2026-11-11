"""Jalankan demo web: python -m demo   (lalu buka http://127.0.0.1:8450)

Environment variable (semua opsional):
  HOST / PORT            alamat API + web            (default 127.0.0.1 / 8450)
  DEMO_NODE_PORT         port node pertama            (default 8451; node berikutnya +1)
  DEMO_INITIAL_NODES     jumlah node awal             (default 4, maksimal 6)
  DEMO_RESET_MINUTES     reset otomatis               (default 30 menit)
  DEMO_RUNTIME           folder data node demo        (default demo/runtime)
  TRUST_PROXY=1          pakai X-Forwarded-For untuk IP pengunjung (di belakang reverse proxy)
"""
import os

import uvicorn


def main():
    uvicorn.run("demo.server:app", host=os.environ.get("HOST", "127.0.0.1"),
                port=int(os.environ.get("PORT", "8450")), log_level="warning", proxy_headers=False)


if __name__ == "__main__":
    main()
