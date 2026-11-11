"""
API demo web (FastAPI): aliran state + event lewat WebSocket, aksi pengunjung lewat POST,
dan file web hasil build (web/dist) di path "/".

  GET  /api/health                      status server
  GET  /api/quota                       sisa kuota aksi untuk IP ini
  WS   /api/stream?client=<id>          {"type": "hello" | "snapshot" | "events", ...}
  POST /api/tx        {"from": "A", "to": "B", "message": "..."}
  POST /api/power     {"node": "A", "on": false}
  POST /api/tamper    {"node": "A", "block": 2, "message": "..."}
  POST /api/heal      {"node": "A"}
  POST /api/nodes                       tambah node
  POST /api/scenario  {"name": "fork" | "tamper" | "offline"}
  POST /api/reset
"""
import asyncio
import hashlib
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from demo.sandbox import WEB_DIST, Sandbox, SandboxError

TRUST_PROXY = os.environ.get("TRUST_PROXY", "") == "1"   # di belakang reverse proxy (Render, Fly, ...)
sandbox = Sandbox()


@asynccontextmanager
async def lifespan(_app):
    await sandbox.start()
    try:
        yield
    finally:
        await sandbox.shutdown()


app = FastAPI(title="ChainMesh demo", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def _ip(connection):
    if TRUST_PROXY:
        forwarded = connection.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return connection.client.host if connection.client else "unknown"


def _tag(client_id):
    """Penanda pengunjung (bukan IP): hash dari id acak yang dibuat browser."""
    if not client_id:
        return "anon"
    return hashlib.sha256(("chainmesh:" + str(client_id)[:64]).encode()).hexdigest()[:10]


async def _body(request):
    try:
        data = await request.json()
    except (ValueError, UnicodeDecodeError):
        data = {}
    return data if isinstance(data, dict) else {}


def _ok(request):
    return {"ok": True, "quota": sandbox.quota(_ip(request))}


@app.exception_handler(SandboxError)
async def _sandbox_error(request, error):
    return JSONResponse({"ok": False, "error": error.code, **error.info, "quota": sandbox.quota(_ip(request))},
                        status_code=error.status)


@app.get("/api/health")
async def health():
    return {"ok": True, "ready": sandbox.ready}


@app.get("/api/quota")
async def quota(request: Request):
    return _ok(request)


@app.post("/api/tx")
async def tx(request: Request):
    data = await _body(request)
    await sandbox.tx(_ip(request), _tag(request.headers.get("x-client-id")),
                     data.get("from"), data.get("to"), data.get("message"))
    return _ok(request)


@app.post("/api/power")
async def power(request: Request):
    data = await _body(request)
    await sandbox.power(_ip(request), _tag(request.headers.get("x-client-id")), data.get("node"),
                        bool(data.get("on")))
    return _ok(request)


@app.post("/api/tamper")
async def tamper(request: Request):
    data = await _body(request)
    await sandbox.tamper(_ip(request), _tag(request.headers.get("x-client-id")), data.get("node"),
                         data.get("block"), data.get("message"))
    return _ok(request)


@app.post("/api/heal")
async def heal(request: Request):
    data = await _body(request)
    await sandbox.heal(_ip(request), _tag(request.headers.get("x-client-id")), data.get("node"))
    return _ok(request)


@app.post("/api/nodes")
async def add_node(request: Request):
    await sandbox.add_node(_ip(request), _tag(request.headers.get("x-client-id")))
    return _ok(request)


@app.post("/api/scenario")
async def scenario(request: Request):
    data = await _body(request)
    await sandbox.run_scenario(_ip(request), _tag(request.headers.get("x-client-id")), data.get("name"))
    return _ok(request)


@app.post("/api/reset")
async def reset(request: Request):
    await sandbox.reset_by_visitor(_ip(request), _tag(request.headers.get("x-client-id")))
    return _ok(request)


@app.websocket("/api/stream")
async def stream(websocket: WebSocket):
    await websocket.accept()
    try:
        queue = sandbox.subscribe()
    except SandboxError as error:
        await websocket.close(code=1013, reason=error.code)
        return
    try:
        await websocket.send_text(json.dumps({
            "type": "hello", "you": _tag(websocket.query_params.get("client")),
            "quota": sandbox.quota(_ip(websocket))}))
        await websocket.send_text(json.dumps({"type": "snapshot", "data": sandbox.current_snapshot()}))
        await websocket.send_text(json.dumps({"type": "events", "data": sandbox.recent_events(), "replay": True}))
        receiver = asyncio.create_task(_drain(websocket))
        try:
            while not receiver.done():
                getter = asyncio.create_task(queue.get())
                done, _ = await asyncio.wait({getter, receiver}, return_when=asyncio.FIRST_COMPLETED)
                if getter in done:
                    await websocket.send_text(getter.result())
                else:
                    getter.cancel()
        finally:
            receiver.cancel()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        sandbox.unsubscribe(queue)


async def _drain(websocket):
    """Baca (dan abaikan) pesan dari browser; selesai saat koneksi ditutup."""
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        return


if os.path.isdir(WEB_DIST):
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
