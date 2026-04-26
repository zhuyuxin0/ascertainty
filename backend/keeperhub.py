"""KeeperHub MCP client.

Talks to https://app.keeperhub.com/mcp via the streamable-HTTP MCP
transport (JSON-RPC 2.0 over POST). Authenticates with our org-scoped
`kh_<key>` API key — note that the docs incorrectly say `X-API-Key` is
the header; the live API only accepts `Authorization: Bearer kh_<key>`
(see FEEDBACK.md).

Used from `/bounty/submit` on the accept path: after the attestation is
built, we trigger the configured KeeperHub workflow to (in production)
post the on-chain settlement using KeeperHub's hosted Turnkey wallet.
For the demo we run BOTH this and our own claim_task — the on-chain
contract is idempotent so duplicate claims revert harmlessly.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import httpx

log = logging.getLogger("ascertainty.keeperhub")

DEFAULT_BASE_URL = "https://app.keeperhub.com/mcp"
PROTOCOL_VERSION = "2024-11-05"


class KeeperHubMcpError(RuntimeError):
    pass


class KeeperHubMcp:
    """Minimal async MCP client for KeeperHub's hosted server.

    Lifecycle: `await initialize()` once, then `call_tool(...)`, then `await close()`.
    The session id returned on initialize is preserved for subsequent requests.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._session_id: Optional[str] = None
        self._req_id = 0
        self._client = httpx.AsyncClient(timeout=timeout_seconds)

    def _headers(self) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            h["mcp-session-id"] = self._session_id
        return h

    async def _post(self, body: dict, expect_response: bool = True) -> dict:
        if expect_response:
            self._req_id += 1
            body["id"] = self._req_id
        body.setdefault("jsonrpc", "2.0")

        resp = await self._client.post(self._base_url, json=body, headers=self._headers())

        sid = resp.headers.get("mcp-session-id") or resp.headers.get("Mcp-Session-Id")
        if sid:
            self._session_id = sid

        if resp.status_code == 202 or not resp.content:
            return {}
        if resp.status_code != 200:
            raise KeeperHubMcpError(
                f"MCP request failed: HTTP {resp.status_code} body={resp.text[:300]}"
            )
        data = resp.json()
        if "error" in data:
            raise KeeperHubMcpError(f"MCP error: {data['error']}")
        return data

    async def initialize(self) -> dict:
        result = await self._post({
            "method": "initialize",
            "params": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "ascertainty", "version": "0.3.0"},
            },
        })
        await self._post({"method": "notifications/initialized"}, expect_response=False)
        return result.get("result", {})

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        result = await self._post({
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}},
        })
        content = result.get("result", {}).get("content", [])
        if content and content[0].get("type") == "text":
            text = content[0]["text"]
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
        return content

    async def list_workflows(self, limit: int = 50, offset: int = 0) -> list[dict]:
        return await self.call_tool("list_workflows", {"limit": limit, "offset": offset})

    async def execute_workflow(self, workflow_id: str, inputs: dict | None = None) -> dict:
        args: dict[str, Any] = {"workflowId": workflow_id}
        if inputs:
            args["inputs"] = inputs
        return await self.call_tool("execute_workflow", args)

    async def get_execution_status(self, execution_id: str) -> dict:
        return await self.call_tool("get_execution_status", {"executionId": execution_id})

    async def close(self) -> None:
        await self._client.aclose()


async def execute_oneoff(
    workflow_id: str, inputs: dict | None = None
) -> Optional[dict]:
    """Spin up a client, initialize, execute, close. Returns the execute_workflow
    result dict or None if `KEEPERHUB_API_KEY` not configured."""
    api_key = os.getenv("KEEPERHUB_API_KEY")
    if not api_key:
        return None
    mcp = KeeperHubMcp(api_key)
    try:
        await mcp.initialize()
        return await mcp.execute_workflow(workflow_id, inputs)
    except Exception as e:
        log.warning("keeperhub: execute_workflow failed: %s", e)
        return None
    finally:
        await mcp.close()


def is_configured() -> bool:
    return bool(os.getenv("KEEPERHUB_API_KEY")) and bool(os.getenv("KEEPERHUB_WORKFLOW_ID"))
