# Demo web ChainMesh dalam satu image: halaman web (React) + sandbox node asli (Python).
# Build: docker build -t chainmesh .     Jalankan: docker run -p 8080:8080 chainmesh

# 1) build halaman web
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2) node + API
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    TRUST_PROXY=1 \
    DEMO_RUNTIME=/tmp/chainmesh-runtime
WORKDIR /app
COPY requirements.txt ./
COPY demo/requirements.txt ./demo/requirements.txt
RUN pip install --no-cache-dir -r demo/requirements.txt
COPY . .
COPY --from=web /web/dist ./web/dist
RUN useradd --create-home app && chown -R app /app
USER app
EXPOSE 8080
CMD ["python", "-m", "demo"]
