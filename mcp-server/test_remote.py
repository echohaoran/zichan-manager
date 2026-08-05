"""远程 HTTP MCP 联调：连生产 192.168.10.241:8090/mcp，验证鉴权 + 工具调用。"""
import asyncio
import os

import httpx
from fastmcp import Client

URL = os.getenv("MCP_URL", "http://192.168.10.241:8090/mcp")
TOKEN = os.getenv("MCP_BEARER_TOKEN", "")


async def main():
    # 1) 无 token 应被拒
    r = httpx.get(URL, headers={"Accept": "application/json, text/event-stream"})
    print(f"无 token 访问: HTTP {r.status_code} (期望 401)")
    assert r.status_code == 401, "鉴权未生效！"

    # 2) 带 token 连接并调用工具
    async with Client(URL, auth=TOKEN) as client:
        tools = await client.list_tools()
        print(f"连接成功，工具数量: {len(tools)}")
        print("工具:", ", ".join(t.name for t in tools))

        stats = await client.call_tool("get_stats", {})
        print("get_stats:", str(stats)[:200])

        r = await client.call_tool("search_assets", {"keyword": "平板", "limit": 2})
        print("search_assets(平板):", str(r)[:400])

        # 3) 一次真实写操作：给资产 232 加描述标记，然后还原
        print("-- 写操作验证 --")
        r = await client.call_tool("update_asset", {"asset_id": 232, "description": "MCP远程联调标记"})
        print("update:", str(r)[:150])
        r = await client.call_tool("get_asset", {"asset_id": 232})
        print("日志:", str(r)[-300:])
        r = await client.call_tool("update_asset", {"asset_id": 232, "description": ""})
        print("还原:", str(r)[:80])


asyncio.run(main())
