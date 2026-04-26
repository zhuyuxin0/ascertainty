"""Telegram bot using the Bot API directly (no python-telegram-bot dep).

Commands:
  /start                    — subscribe this chat
  /bounties                 — list 5 most recent bounties
  /status <bounty_id>       — full status of one bounty
  /race <bounty_id>         — link to the racing visualization

Auto-broadcasts on key events (BountyCreated, BountyClaimed) — emitted by
the watcher via `broadcast_bounty_created` / `broadcast_bounty_claimed`.
"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

import httpx

from backend import db

log = logging.getLogger("ascertainty.telegram")

API_BASE = "https://api.telegram.org"
SUBS_PATH = Path(os.getenv("ASCERTAINTY_TELEGRAM_SUBS_PATH", "data/telegram_subs.json"))
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://ascertainty.xyz")
LONG_POLL_TIMEOUT = 25  # seconds


def _token() -> Optional[str]:
    return os.getenv("TELEGRAM_BOT_TOKEN")


def _default_chat_id() -> Optional[str]:
    return os.getenv("TELEGRAM_CHAT_ID")


def _url(method: str) -> str:
    return f"{API_BASE}/bot{_token()}/{method}"


# ---------- subscription persistence ----------

def _load_subs() -> set[str]:
    subs: set[str] = set()
    default = _default_chat_id()
    if default:
        subs.add(str(default))
    if SUBS_PATH.exists():
        try:
            data = json.loads(SUBS_PATH.read_text())
            subs.update(str(c) for c in data.get("chats", []))
        except Exception:
            pass
    return subs


def _save_subs(subs: set[str]) -> None:
    SUBS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUBS_PATH.write_text(json.dumps({"chats": sorted(subs)}, indent=2))


# ---------- formatting ----------

def _fmt_usdc(raw: int | str) -> str:
    raw_int = int(raw) if isinstance(raw, str) else raw
    return f"{raw_int / 1_000_000:,.2f} USDC"


def _fmt_status(s: str) -> str:
    emoji = {
        "open": "🟢", "submitted": "📥", "challenged": "⚠️",
        "settled": "✅", "cancelled": "🚫",
    }.get(s, "❓")
    return f"{emoji} {s}"


def _fmt_bounty_short(b: dict[str, Any]) -> str:
    onchain = f"#{b['onchain_bounty_id']}" if b.get("onchain_bounty_id") else "(off-chain only)"
    return (
        f"<b>bounty {b['id']}</b> {onchain}\n"
        f"  status: {_fmt_status(b['status'])}\n"
        f"  amount: {_fmt_usdc(b['amount_usdc'])}\n"
        f"  spec  : <code>{html.escape(b['spec_hash'][:16])}…</code>"
    )


# ---------- low-level send ----------

async def _send(client: httpx.AsyncClient, chat_id: str, text: str) -> None:
    try:
        await client.post(
            _url("sendMessage"),
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML",
                  "disable_web_page_preview": True},
            timeout=10.0,
        )
    except Exception as e:
        log.debug("telegram: send to %s failed: %s", chat_id, e)


# ---------- broadcasting ----------

_subs: set[str] = set()


async def broadcast_bounty_created(bounty: dict[str, Any]) -> None:
    if not _token() or not _subs:
        return
    text = (
        f"🟢 <b>New bounty</b>\n"
        f"id #{bounty.get('onchain_bounty_id', '?')}  amount {_fmt_usdc(bounty['amount_usdc'])}\n"
        f"deadline in {(bounty['deadline_unix'] - int(__import__('time').time())) // 60}min\n"
        f"<code>{html.escape(bounty['spec_hash'][:16])}…</code>"
    )
    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[_send(client, c, text) for c in _subs], return_exceptions=True)


async def broadcast_bounty_claimed(bounty: dict[str, Any], solver: str, amount: int) -> None:
    if not _token() or not _subs:
        return
    text = (
        f"✅ <b>Bounty settled</b>\n"
        f"id #{bounty.get('onchain_bounty_id', '?')}  paid {_fmt_usdc(amount)}\n"
        f"solver: <code>{html.escape(solver[:10])}…</code>"
    )
    async with httpx.AsyncClient() as client:
        await asyncio.gather(*[_send(client, c, text) for c in _subs], return_exceptions=True)


# ---------- command handling ----------

async def _handle_command(client: httpx.AsyncClient, chat_id: str, text: str) -> None:
    global _subs
    cmd = text.strip().split()
    if not cmd:
        return
    head = cmd[0].lower().split("@", 1)[0]

    if head == "/start":
        _subs.add(chat_id)
        _save_subs(_subs)
        await _send(client, chat_id,
            "Ascertainty online.\n"
            "Commands: /bounties, /status &lt;id&gt;, /race &lt;id&gt;")

    elif head == "/bounties":
        rows = await db.latest_bounties(limit=5)
        if not rows:
            await _send(client, chat_id, "No bounties yet.")
            return
        body = "\n\n".join(_fmt_bounty_short(r) for r in rows)
        await _send(client, chat_id, f"<b>Recent bounties</b>\n\n{body}")

    elif head == "/status":
        if len(cmd) < 2:
            await _send(client, chat_id, "Usage: /status &lt;bounty_id&gt;")
            return
        try:
            bid = int(cmd[1])
        except ValueError:
            await _send(client, chat_id, "bounty_id must be an integer")
            return
        bounty = await db.get_bounty(bid)
        if bounty is None:
            await _send(client, chat_id, f"bounty {bid} not found")
            return
        subs = await db.submissions_for_bounty(bid)
        sub_lines = [
            f"  • <code>{html.escape(s['solver_address'][:10])}…</code> "
            f"{'✅' if s['accepted'] else '❌'} <code>{html.escape(s['attestation_hash'][:16])}…</code>"
            for s in subs
        ] or ["  (no submissions yet)"]
        await _send(client, chat_id,
            f"{_fmt_bounty_short(bounty)}\n\n"
            f"<b>submissions</b>\n" + "\n".join(sub_lines))

    elif head == "/race":
        if len(cmd) < 2:
            await _send(client, chat_id, "Usage: /race &lt;bounty_id&gt;")
            return
        try:
            bid = int(cmd[1])
        except ValueError:
            await _send(client, chat_id, "bounty_id must be an integer")
            return
        await _send(client, chat_id,
            f"🏎  <a href=\"{DASHBOARD_URL}/race/{bid}\">{DASHBOARD_URL}/race/{bid}</a>")


# ---------- long-poll loop ----------

async def telegram_task() -> None:
    global _subs
    token = _token()
    if not token:
        log.warning("telegram: TELEGRAM_BOT_TOKEN not set, skipping")
        return

    _subs = _load_subs()
    log.info("telegram: starting with %d subscribed chats", len(_subs))

    async with httpx.AsyncClient() as client:
        try:
            await client.get(_url("deleteWebhook"), timeout=10.0)
        except Exception:
            pass

        offset: Optional[int] = None
        while True:
            try:
                params: dict[str, Any] = {"timeout": LONG_POLL_TIMEOUT}
                if offset is not None:
                    params["offset"] = offset
                resp = await client.get(
                    _url("getUpdates"),
                    params=params,
                    timeout=LONG_POLL_TIMEOUT + 5,
                )
                if resp.status_code != 200:
                    log.debug("telegram: getUpdates http %s", resp.status_code)
                    await asyncio.sleep(5)
                    continue
                body = resp.json()
                for update in body.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message") or update.get("channel_post")
                    if not msg:
                        continue
                    chat_id = str(msg.get("chat", {}).get("id", ""))
                    text = msg.get("text") or ""
                    if chat_id and text.startswith("/"):
                        await _handle_command(client, chat_id, text)
            except asyncio.CancelledError:
                log.info("telegram: cancelled")
                raise
            except Exception as e:
                log.debug("telegram: loop error: %s", e)
                await asyncio.sleep(5)
