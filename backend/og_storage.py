"""0G Storage uploader for attestation artifacts.

Each accepted (or rejected) verification produces a JSON attestation that
gets uploaded to 0G Storage. The Merkle root hash that comes back is what
BountyFactory.submitProof anchors on-chain (via the `attestationHash`
argument), so that anyone can later fetch the full attestation, re-derive
its hash, and verify the operator's signature.

Auth and provider discovery delegate to python-0g (`a0g`); we bridge our
`OG_*` env vars to the SDK's expected `A0G_*` names. Same graceful-degrade
pattern as Enstabler's storage.py: if the operator key is missing, latch
disabled and return None forever.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger("ascertainty.storage")

_disabled: bool = False
_lock = asyncio.Lock()


@dataclass(frozen=True)
class StorageResult:
    root_hash: str           # hex string with 0x prefix
    tx_hash: str             # hex string with 0x prefix
    uploaded_at: int         # unix seconds

    @property
    def root_hash_bytes(self) -> bytes:
        raw = bytes.fromhex(self.root_hash.removeprefix("0x"))
        if len(raw) >= 32:
            return raw[:32]
        return raw.ljust(32, b"\x00")


def _map_env() -> None:
    """python-0g uses A0G_* env vars; bridge from OG_* names."""
    if not os.getenv("A0G_PRIVATE_KEY"):
        og = os.getenv("OG_PRIVATE_KEY")
        if og:
            os.environ["A0G_PRIVATE_KEY"] = og.removeprefix("0x")
    if not os.getenv("A0G_RPC_URL"):
        rpc = os.getenv("OG_RPC_URL")
        if rpc:
            os.environ["A0G_RPC_URL"] = rpc
    if not os.getenv("A0G_INDEXER_RPC_URL"):
        idx = os.getenv("OG_STORAGE_INDEXER")
        if idx:
            os.environ["A0G_INDEXER_RPC_URL"] = idx


def is_configured() -> bool:
    return bool(os.getenv("OG_PRIVATE_KEY")) and not _disabled


async def upload_blob(content: bytes, name_hint: str = "blob") -> Optional[StorageResult]:
    """Upload a raw byte blob to 0G Storage. Returns root_hash + tx_hash, or None
    if the storage layer is unavailable / fails. Never raises on the happy path."""
    global _disabled
    if _disabled:
        return None
    if not os.getenv("OG_PRIVATE_KEY"):
        log.info("storage: no OG_PRIVATE_KEY, disabled")
        _disabled = True
        return None

    _map_env()

    fd, path = tempfile.mkstemp(prefix=f"ascertainty-{name_hint}-", suffix=".bin")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(content)
        async with _lock:
            from a0g.base import A0G  # lazy import: SDK init is heavy

            def _do_upload() -> Any:
                return A0G().upload_to_storage(Path(path))

            loop = asyncio.get_running_loop()
            obj = await loop.run_in_executor(None, _do_upload)
            return StorageResult(
                root_hash=obj.root_hash,
                tx_hash=obj.tx_hash,
                uploaded_at=int(time.time()),
            )
    except Exception as e:
        log.warning("storage: upload failed: %s", e)
        return None
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


async def upload_attestation(attestation: dict[str, Any]) -> Optional[StorageResult]:
    """Upload a signed attestation JSON. Wraps upload_blob with canonical JSON."""
    blob = json.dumps(attestation, sort_keys=True, separators=(",", ":")).encode()
    name = attestation.get("bounty_id", "attestation")
    return await upload_blob(blob, name_hint=f"attestation-{name}")
