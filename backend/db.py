import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator, Optional

import aiosqlite

DB_PATH = Path(os.getenv("ASCERTAINTY_DB_PATH", "data/ascertainty.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS bounties (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    spec_hash                   TEXT NOT NULL UNIQUE,
    spec_yaml                   TEXT NOT NULL,
    poster                      TEXT NOT NULL,
    amount_usdc                 TEXT NOT NULL,
    deadline_unix               INTEGER NOT NULL,
    challenge_window_seconds    INTEGER NOT NULL,
    created_at                  INTEGER NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'open',
    onchain_bounty_id           INTEGER,
    tx_hash                     TEXT
);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster);
CREATE INDEX IF NOT EXISTS idx_bounties_deadline ON bounties(deadline_unix);

CREATE TABLE IF NOT EXISTS solvers (
    address         TEXT PRIMARY KEY,
    inft_token_id   INTEGER,
    reputation      INTEGER NOT NULL DEFAULT 0,
    solved_count    INTEGER NOT NULL DEFAULT 0,
    first_seen_ts   INTEGER NOT NULL,
    last_active_ts  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_solvers_reputation ON solvers(reputation DESC);

CREATE TABLE IF NOT EXISTS submissions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bounty_id           INTEGER NOT NULL REFERENCES bounties(id),
    solver_address      TEXT NOT NULL REFERENCES solvers(address),
    attestation_hash    TEXT NOT NULL,
    proof_hash          TEXT NOT NULL,
    accepted            INTEGER NOT NULL DEFAULT 0,
    submitted_at        INTEGER NOT NULL,
    onchain_tx_hash     TEXT,
    UNIQUE(bounty_id, solver_address)
);
CREATE INDEX IF NOT EXISTS idx_submissions_bounty ON submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_submissions_solver ON submissions(solver_address);

CREATE TABLE IF NOT EXISTS race_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bounty_id       INTEGER NOT NULL REFERENCES bounties(id),
    solver_address  TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    data_json       TEXT,
    ts              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_race_events_bounty ON race_events(bounty_id, ts);
CREATE INDEX IF NOT EXISTS idx_race_events_ts ON race_events(ts DESC);

CREATE TABLE IF NOT EXISTS kh_executions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ts                  INTEGER NOT NULL,
    bounty_id           INTEGER,
    workflow_id         TEXT NOT NULL,
    execution_id        TEXT,
    status              TEXT,
    error               TEXT,
    inputs_json         TEXT
);
CREATE INDEX IF NOT EXISTS idx_kh_exec_ts ON kh_executions(ts DESC);

-- Tables ported from Enstabler for the embedded flow-classifier subsystem
CREATE TABLE IF NOT EXISTS flows (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT NOT NULL,
    chain         TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    log_index     INTEGER NOT NULL,
    block_number  INTEGER NOT NULL,
    ts            INTEGER NOT NULL,
    stablecoin    TEXT NOT NULL,
    from_addr     TEXT NOT NULL,
    to_addr       TEXT NOT NULL,
    amount_raw    TEXT NOT NULL,
    amount_usd    REAL,
    UNIQUE(chain, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_flows_ts ON flows(ts DESC);
CREATE INDEX IF NOT EXISTS idx_flows_stablecoin ON flows(stablecoin);

CREATE TABLE IF NOT EXISTS classifications (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_id           INTEGER NOT NULL UNIQUE REFERENCES flows(id),
    classification    TEXT NOT NULL,
    risk_level        INTEGER NOT NULL,
    features_json     TEXT,
    ts                INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cls_ts ON classifications(ts DESC);

CREATE TABLE IF NOT EXISTS cctp_messages (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts                          INTEGER NOT NULL,
    source_chain                TEXT NOT NULL,
    source_domain               INTEGER NOT NULL,
    destination_chain           TEXT NOT NULL,
    destination_domain          INTEGER NOT NULL,
    nonce                       INTEGER NOT NULL,
    burn_token                  TEXT NOT NULL,
    amount_raw                  TEXT NOT NULL,
    amount_usd                  REAL,
    depositor                   TEXT NOT NULL,
    mint_recipient              TEXT NOT NULL,
    tx_hash                     TEXT NOT NULL,
    block_number                INTEGER NOT NULL,
    log_index                   INTEGER NOT NULL,
    UNIQUE(source_domain, nonce)
);
CREATE INDEX IF NOT EXISTS idx_cctp_ts ON cctp_messages(ts DESC);
CREATE INDEX IF NOT EXISTS idx_cctp_dst ON cctp_messages(destination_domain);
"""


@asynccontextmanager
async def _conn() -> AsyncIterator[aiosqlite.Connection]:
    db = await aiosqlite.connect(DB_PATH)
    try:
        await db.execute("PRAGMA busy_timeout=5000")
        yield db
    finally:
        await db.close()


async def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA busy_timeout=5000")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.executescript(SCHEMA)
        # Idempotent migration: add spec_yaml to bounties if upgrading from M1.
        async with db.execute("PRAGMA table_info(bounties)") as cur:
            cols = {row[1] for row in await cur.fetchall()}
        if "spec_yaml" not in cols:
            await db.execute("ALTER TABLE bounties ADD COLUMN spec_yaml TEXT NOT NULL DEFAULT ''")
        await db.commit()


# ---------- bounties ----------

async def insert_bounty(
    *,
    spec_hash: str,
    spec_yaml: str,
    poster: str,
    amount_usdc: str,
    deadline_unix: int,
    challenge_window_seconds: int,
    created_at: int,
    onchain_bounty_id: Optional[int] = None,
    tx_hash: Optional[str] = None,
) -> Optional[int]:
    async with _conn() as db:
        try:
            cur = await db.execute(
                """INSERT INTO bounties
                   (spec_hash, spec_yaml, poster, amount_usdc, deadline_unix,
                    challenge_window_seconds, created_at,
                    onchain_bounty_id, tx_hash)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (spec_hash, spec_yaml, poster, amount_usdc, deadline_unix,
                 challenge_window_seconds, created_at,
                 onchain_bounty_id, tx_hash),
            )
            await db.commit()
            return cur.lastrowid
        except aiosqlite.IntegrityError:
            return None


async def get_bounty(bounty_id: int) -> Optional[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM bounties WHERE id = ?", (bounty_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def update_bounty_status(bounty_id: int, status: str) -> None:
    async with _conn() as db:
        await db.execute(
            "UPDATE bounties SET status = ? WHERE id = ?", (status, bounty_id)
        )
        await db.commit()


async def latest_bounties(limit: int = 50) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM bounties ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def bounty_count() -> int:
    async with _conn() as db:
        async with db.execute("SELECT COUNT(*) FROM bounties") as cur:
            row = await cur.fetchone()
            return row[0] if row else 0


# ---------- solvers ----------

async def upsert_solver(
    *, address: str, ts: int, inft_token_id: Optional[int] = None
) -> None:
    async with _conn() as db:
        await db.execute(
            """INSERT INTO solvers (address, inft_token_id, first_seen_ts, last_active_ts)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(address) DO UPDATE SET
                 last_active_ts = excluded.last_active_ts,
                 inft_token_id = COALESCE(excluded.inft_token_id, solvers.inft_token_id)""",
            (address, inft_token_id, ts, ts),
        )
        await db.commit()


async def increment_solver_reputation(address: str, delta: int = 1) -> None:
    async with _conn() as db:
        await db.execute(
            """UPDATE solvers SET reputation = reputation + ?,
                                  solved_count = solved_count + 1
               WHERE address = ?""",
            (delta, address),
        )
        await db.commit()


async def get_solver(address: str) -> Optional[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM solvers WHERE address = ?", (address,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def leaderboard(limit: int = 20) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM solvers ORDER BY reputation DESC, solved_count DESC LIMIT ?",
            (limit,),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ---------- submissions ----------

async def insert_submission(
    *,
    bounty_id: int,
    solver_address: str,
    attestation_hash: str,
    proof_hash: str,
    accepted: bool,
    submitted_at: int,
    onchain_tx_hash: Optional[str] = None,
) -> Optional[int]:
    async with _conn() as db:
        try:
            cur = await db.execute(
                """INSERT INTO submissions
                   (bounty_id, solver_address, attestation_hash, proof_hash,
                    accepted, submitted_at, onchain_tx_hash)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (bounty_id, solver_address, attestation_hash, proof_hash,
                 1 if accepted else 0, submitted_at, onchain_tx_hash),
            )
            await db.commit()
            return cur.lastrowid
        except aiosqlite.IntegrityError:
            return None


async def submissions_for_bounty(bounty_id: int) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM submissions WHERE bounty_id = ? ORDER BY submitted_at",
            (bounty_id,),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ---------- race events ----------

async def insert_race_event(
    *, bounty_id: int, solver_address: str, event_type: str,
    data_json: Optional[str], ts: int,
) -> int:
    async with _conn() as db:
        cur = await db.execute(
            """INSERT INTO race_events (bounty_id, solver_address, event_type, data_json, ts)
               VALUES (?, ?, ?, ?, ?)""",
            (bounty_id, solver_address, event_type, data_json, ts),
        )
        await db.commit()
        return cur.lastrowid or 0


async def race_events_for_bounty(bounty_id: int, since_ts: int = 0) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM race_events WHERE bounty_id = ? AND ts >= ? ORDER BY ts",
            (bounty_id, since_ts),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ---------- kh executions ----------

async def insert_kh_execution(
    *,
    ts: int,
    bounty_id: Optional[int],
    workflow_id: str,
    execution_id: Optional[str],
    status: Optional[str],
    error: Optional[str],
    inputs_json: Optional[str],
) -> int:
    async with _conn() as db:
        cur = await db.execute(
            """INSERT INTO kh_executions
               (ts, bounty_id, workflow_id, execution_id, status, error, inputs_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ts, bounty_id, workflow_id, execution_id, status, error, inputs_json),
        )
        await db.commit()
        return cur.lastrowid or 0


async def latest_kh_executions(limit: int = 20) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM kh_executions ORDER BY ts DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ---------- cctp messages (Enstabler port) ----------

async def insert_cctp_message(
    *,
    ts: int,
    source_chain: str,
    source_domain: int,
    destination_chain: str,
    destination_domain: int,
    nonce: int,
    burn_token: str,
    amount_raw: str,
    amount_usd: Optional[float],
    depositor: str,
    mint_recipient: str,
    tx_hash: str,
    block_number: int,
    log_index: int,
) -> bool:
    async with _conn() as db:
        try:
            await db.execute(
                """INSERT INTO cctp_messages
                   (ts, source_chain, source_domain, destination_chain, destination_domain,
                    nonce, burn_token, amount_raw, amount_usd, depositor, mint_recipient,
                    tx_hash, block_number, log_index)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (ts, source_chain, source_domain, destination_chain, destination_domain,
                 nonce, burn_token, amount_raw, amount_usd, depositor, mint_recipient,
                 tx_hash, block_number, log_index),
            )
            await db.commit()
            return True
        except aiosqlite.IntegrityError:
            return False


async def latest_cctp_messages(limit: int = 50) -> list[dict]:
    async with _conn() as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM cctp_messages ORDER BY ts DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


# ---------- classifications (Enstabler port) ----------

async def insert_classification(
    *,
    flow_id: int,
    classification: str,
    risk_level: int,
    features_json: str,
    ts: int,
) -> Optional[int]:
    async with _conn() as db:
        try:
            cur = await db.execute(
                """INSERT INTO classifications
                   (flow_id, classification, risk_level, features_json, ts)
                   VALUES (?, ?, ?, ?, ?)""",
                (flow_id, classification, risk_level, features_json, ts),
            )
            await db.commit()
            return cur.lastrowid
        except aiosqlite.IntegrityError:
            return None
