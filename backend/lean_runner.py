"""Real Lean4 kernel runner.

Spawns the `lean` binary against the submitted proof in a temp directory.
Lean's exit code distinguishes kernel acceptance (0) from any compile or
type-check failure (non-zero). Stdout/stderr is captured and returned as
the kernel_output portion of the attestation, giving us a real
diagnostic trail rather than the sentinel-fallback stub.

Scope (Phase 1, hackathon):
  - Verify against the Lean *stdlib* only, no Mathlib. The submitted
    proof must compile under a vanilla `lean` invocation. Mathlib-based
    verification (one toolchain build per pinned `mathlib_sha`) is the
    natural Phase 2.
  - Hard timeout (default 30s) so a malicious or buggy proof can't hang
    the request thread.

Behaviour when the binary isn't installed (e.g. local dev without elan):
  `is_available()` returns False; callers should fall back to the mock
  verifier in `backend/verifier.py`.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

log = logging.getLogger("ascertainty.lean")

LEAN_TIMEOUT_SECONDS = float(os.getenv("LEAN_TIMEOUT_SECONDS", "30"))


@dataclass(frozen=True)
class LeanResult:
    accepted: bool
    kernel_output: str
    axioms_used: tuple[str, ...]
    duration_seconds: float


def is_available() -> bool:
    """True if a `lean` binary is on PATH and reports a version."""
    return shutil.which("lean") is not None


async def lean_version() -> Optional[str]:
    """Cached at first call. Returns the `lean --version` line, or None."""
    if not is_available():
        return None
    try:
        proc = await asyncio.create_subprocess_exec(
            "lean", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        return stdout.decode().strip() or None
    except Exception:
        return None


_AXIOM_LINE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_.]*)\s*:", re.MULTILINE)


async def verify_proof(proof_text: str, theorem_signature: str | None = None) -> LeanResult:
    """Run `lean` against a tempfile containing the proof.

    The proof_text is the user's `.lean` source, typically a single
    `theorem`. We append a `#print axioms` directive on the theorem so
    Lean's output lists every axiom transitively used. The list is
    parsed back out for the attestation.
    """
    if not is_available():
        raise RuntimeError("lean binary not available")

    started = time.monotonic()
    theorem_name = _extract_theorem_name(proof_text) or "ascertainty_theorem"

    # If the user gave a bare expression, wrap it in a fresh theorem name
    full_source = proof_text
    if not _has_theorem_decl(proof_text):
        full_source = f"theorem {theorem_name} : True := by\n{_indent(proof_text)}\n"

    # Append `#print axioms` so we can introspect the trust base
    full_source += f"\n#print axioms {theorem_name}\n"

    with tempfile.TemporaryDirectory(prefix="ascertainty-lean-") as tmpdir:
        tmp = Path(tmpdir) / "Proof.lean"
        tmp.write_text(full_source)

        proc = await asyncio.create_subprocess_exec(
            "lean", str(tmp),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=tmpdir,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=LEAN_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            duration = time.monotonic() - started
            return LeanResult(
                accepted=False,
                kernel_output=f"Lean kernel timed out after {LEAN_TIMEOUT_SECONDS}s\n",
                axioms_used=(),
                duration_seconds=duration,
            )

    duration = time.monotonic() - started
    stdout = stdout_b.decode(errors="replace")
    stderr = stderr_b.decode(errors="replace")
    accepted = proc.returncode == 0

    output_lines: list[str] = [
        f"Lean 4 kernel (real) — {await lean_version() or 'unknown version'}",
        f"  source: {len(proof_text)} bytes",
        f"  exit_code: {proc.returncode}",
        f"  duration_seconds: {duration:.3f}",
        f"  result: {'ACCEPT' if accepted else 'REJECT'}",
        "",
    ]
    if stdout.strip():
        output_lines.append("--- stdout ---")
        output_lines.append(stdout.rstrip())
    if stderr.strip():
        output_lines.append("--- stderr ---")
        output_lines.append(stderr.rstrip())

    axioms = _parse_axioms(stdout) if accepted else ()
    return LeanResult(
        accepted=accepted,
        kernel_output="\n".join(output_lines) + "\n",
        axioms_used=axioms,
        duration_seconds=duration,
    )


def _has_theorem_decl(src: str) -> bool:
    return bool(re.search(r"\b(theorem|lemma|def|example)\b\s+\w+", src))


def _extract_theorem_name(src: str) -> Optional[str]:
    m = re.search(r"\b(?:theorem|lemma)\s+([A-Za-z_][A-Za-z0-9_]*)\b", src)
    return m.group(1) if m else None


def _indent(s: str, prefix: str = "  ") -> str:
    return "\n".join(prefix + line for line in s.splitlines())


def _parse_axioms(stdout: str) -> tuple[str, ...]:
    """Parse the output of `#print axioms <name>` from Lean's stdout.

    Lean prints lines like:
        'theoremName' depends on axioms: [propext, Classical.choice, Quot.sound]
    or in newer versions:
        propext
        Classical.choice
        Quot.sound

    We accept either format permissively.
    """
    axioms: list[str] = []
    in_block = False
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            in_block = False
            continue
        # Bracketed list form
        m = re.search(r"\[([^\]]+)\]", line)
        if m and "axiom" in line.lower():
            return tuple(name.strip() for name in m.group(1).split(",") if name.strip())
        # Header form
        if "depend" in line.lower() and "axiom" in line.lower():
            in_block = True
            continue
        if in_block and re.match(r"^[A-Za-z_][A-Za-z0-9_.]*$", line):
            axioms.append(line)
    return tuple(axioms)
