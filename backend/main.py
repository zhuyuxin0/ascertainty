import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import bounty_count, init_db, latest_bounties

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Ascertainty", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_origins=["https://ascertainty.xyz"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/stats")
async def stats():
    return {"bounties": await bounty_count()}


@app.get("/bounties")
async def bounties(limit: int = 50):
    return {"bounties": await latest_bounties(limit=limit)}
