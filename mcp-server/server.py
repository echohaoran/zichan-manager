"""zichan-manager 资产 MCP Server

供外部 AI Agent 查询/搜索/分析资产、编辑资产内容。
所有操作都通过现有后端 REST API 完成（写操作自动记录 AssetLog）。

运行方式：
- 本地调试（stdio）：MCP_TRANSPORT=stdio python server.py
- 生产（HTTP）：MCP_TRANSPORT=http python server.py （供远程 agent 通过 URL 连接）
"""
import os
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.server.auth.auth import AccessToken, AuthProvider

from analysis import analyze_assets as build_analysis
from backend_client import BackendClient

load_dotenv()

client = BackendClient()

BEARER_TOKEN = os.getenv("MCP_BEARER_TOKEN", "")


class StaticTokenAuthProvider(AuthProvider):
    """静态 Bearer Token 鉴权：客户端需带 Authorization: Bearer <MCP_BEARER_TOKEN>。"""

    def __init__(self, token: str) -> None:
        super().__init__()
        self._token = token

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        if self._token and token == self._token:
            return AccessToken(token=token, client_id="agent", scopes=[])
        return None

mcp = FastMCP(
    "zichan-manager 资产管理",
    auth=StaticTokenAuthProvider(BEARER_TOKEN) if BEARER_TOKEN else None,
    instructions=(
        "你是资产管理系统的外部助手。使用流程：先 search_assets / analyze_assets 了解情况，"
        "需要编辑时再调用编辑类工具。注意：\n"
        "1. 领用(领出)/归还/报废是状态流转，走专属工具 checkout_asset/return_asset/dispose_asset；\n"
        "2. 领用人不存在时，先调用 find_or_create_person 创建人员再 checkout；\n"
        "3. delete_asset 会永久删除资产和日志，必须向用户确认后再执行；\n"
        "4. 资产状态是自由文本，实际数据中常见值：使用中/闲置/损坏/在库/领用中/已报废，请用 analyze_assets 或 search_assets 查看实际分布；\n"
        "5. 所有修改都会写入操作日志，请基于真实查询结果回答，不要臆测数据。"
    ),
)


def _run(call):
    """把后端异常转成可读的错误信息返回给 agent。"""
    try:
        return call()
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail", str(e))
        except Exception:
            detail = str(e)
        return {"error": detail}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def _clean(params: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in params.items() if v not in (None, "")}


# ---------------------------------------------------------------- 查询
@mcp.tool(description="搜索资产。可按关键词（匹配名称/资产编码/序列号/型号）、状态、分类ID、领用人ID、部门ID、购买日期范围筛选，支持分页。返回资产列表。")
def search_assets(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
    person_id: Optional[int] = None,
    department_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Any:
    return _run(lambda: client.get("/api/assets", params=_clean(locals())))


@mcp.tool(description="获取单个资产的完整详情，包含操作日志（登记/编辑/领用/归还/报废记录）。")
def get_asset(asset_id: int) -> Any:
    return _run(lambda: client.get(f"/api/assets/{asset_id}"))


@mcp.tool(description="获取资产概览统计：总数、在库/领用中/已报废数量、总价值、按分类/部门统计。")
def get_stats() -> Any:
    return _run(lambda: client.get("/api/dashboard/stats"))


@mcp.tool(description="列出全部分类（创建/编辑资产时用 category_id 引用）。")
def list_categories() -> Any:
    return _run(lambda: client.get("/api/categories"))


@mcp.tool(description="列出全部人员（领用人）。返回含所属部门，用于查找人员 ID。")
def list_persons() -> Any:
    return _run(lambda: client.get("/api/persons"))


@mcp.tool(description="列出全部部门。")
def list_departments() -> Any:
    return _run(lambda: client.get("/api/departments"))


# ---------------------------------------------------------------- 分析
@mcp.tool(description="生成资产预聚合分析报告：按状态/分类/部门/领用人分布、按分类价值、总价值、购买时间跨度、平均价格、最近更新，以及异常提示（重复编码/重复序列号/状态不一致等）。适合回答'整体情况如何'类问题。")
def analyze_assets() -> Any:
    def _do() -> Dict[str, Any]:
        assets = client.get("/api/assets")
        persons = client.get("/api/persons")
        categories = client.get("/api/categories")
        departments = client.get("/api/departments")
        stats = client.get("/api/dashboard/stats")
        return build_analysis(assets, persons, categories, departments, stats)

    return _run(_do)


# ---------------------------------------------------------------- 编辑
@mcp.tool(description="创建新资产。category_id 与 category_name 二选一（name 会解析为 ID）；purchase_date 格式 YYYY-MM-DD，留空为今天；asset_code 留空自动生成 wckg_ 编码。")
def create_asset(
    name: str,
    category_id: Optional[int] = None,
    category_name: Optional[str] = None,
    price: float = 0.0,
    purchase_date: Optional[str] = None,
    description: str = "",
    model: str = "",
    color: str = "",
    asset_code: str = "",
    sn: str = "空",
) -> Any:
    def _do() -> Any:
        cid = category_id
        if not cid and category_name:
            cats = client.get("/api/categories")
            hit = next((c for c in cats if c["name"] == category_name), None)
            if not hit:
                return {"error": f"分类不存在: {category_name}（可用 list_categories 查看）"}
            cid = hit["id"]
        if not cid:
            return {"error": "必须提供 category_id 或 category_name"}
        return client.post(
            "/api/assets",
            json={
                "name": name,
                "category_id": cid,
                "price": price,
                "purchase_date": purchase_date or "",
                "description": description,
                "model": model,
                "color": color,
                "asset_code": asset_code,
                "sn": sn,
            },
        )

    return _run(_do)


@mcp.tool(description="编辑资产基本信息（名称/分类/价格/购买日期/描述/型号/颜色/编码/序列号）。只传需要修改的字段。注意：状态和领用人不能在此修改，状态流转请用 checkout_asset/return_asset/dispose_asset。")
def update_asset(
    asset_id: int,
    name: Optional[str] = None,
    category_id: Optional[int] = None,
    price: Optional[float] = None,
    purchase_date: Optional[str] = None,
    description: Optional[str] = None,
    model: Optional[str] = None,
    color: Optional[str] = None,
    asset_code: Optional[str] = None,
    sn: Optional[str] = None,
) -> Any:
    payload = _clean(locals())
    payload.pop("asset_id", None)
    return _run(lambda: client.put(f"/api/assets/{asset_id}", json=payload))


@mcp.tool(description="资产领用：把 '在库' 资产领给指定领用人（person_id），状态变为 '领用中'。人员不存在时先用 find_or_create_person 创建。")
def checkout_asset(asset_id: int, person_id: int) -> Any:
    return _run(lambda: client.post(f"/api/assets/{asset_id}/checkout", params={"person_id": person_id}))


@mcp.tool(description="资产归还：把 '领用中' 资产归还，状态变回 '在库'，解除领用人。")
def return_asset(asset_id: int) -> Any:
    return _run(lambda: client.post(f"/api/assets/{asset_id}/return"))


@mcp.tool(description="资产报废：把资产标记为 '已报废'（不可逆的状态流转，报废后不再计入总价值）。")
def dispose_asset(asset_id: int) -> Any:
    return _run(lambda: client.post(f"/api/assets/{asset_id}/dispose"))


@mcp.tool(description="⚠️ 危险操作：永久删除资产及其全部操作日志，不可恢复。执行前必须向用户确认。")
def delete_asset(asset_id: int) -> Any:
    return _run(lambda: client.delete(f"/api/assets/{asset_id}"))


@mcp.tool(description="按姓名查找人员，不存在则自动创建并返回（可带 department_id 部门ID）。用于资产领用前确认/创建领用人。")
def find_or_create_person(name: str, department_id: Optional[int] = None) -> Any:
    def _do() -> Any:
        persons = client.get("/api/persons")
        hit = next((p for p in persons if p["name"] == name), None)
        if hit:
            return {"found": True, "person": hit}
        created = client.post("/api/persons", json={"name": name, "department_id": department_id})
        return {"found": False, "person": created}

    return _run(_do)


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    if transport == "http":
        mcp.run(
            transport="http",
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8090")),
        )
    else:
        mcp.run(transport="stdio")
