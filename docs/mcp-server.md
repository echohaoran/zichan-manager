# zichan-manager MCP Server

供外部 AI Agent 查询/搜索/分析/编辑资产管理系统的 MCP Server（已部署在生产服务器 192.168.10.241）。

## 连接信息

| 项 | 值 |
|---|---|
| MCP URL | `http://192.168.10.241:8090/mcp` |
| 鉴权 | `Authorization: Bearer <MCP_BEARER_TOKEN>` |
| 传输方式 | Streamable HTTP |

MCP_BEARER_TOKEN 保存在生产服务器 `/root/zichan-manager/mcp-server/.env`（权限 600），也可问管理员索取。

## 工具清单（14 个）

**查询**
- `search_assets` — 按关键词（名称/编码/序列号/型号）、状态、分类、领用人、部门、日期范围搜索，支持分页
- `get_asset` — 单个资产详情 + 完整操作日志
- `get_stats` — 概览统计（总数/状态/价值/分类/部门）
- `list_categories` / `list_persons` / `list_departments` — 参考数据

**分析**
- `analyze_assets` — 预聚合报告：状态/分类/部门/领用人分布、按分类价值、购买时间跨度、最近更新、异常提示（重复编码/序列号、状态不一致等）

**编辑**（均写入 AssetLog 操作日志）
- `create_asset` — 创建资产（编码留空自动生成）
- `update_asset` — 编辑基本信息（传 `""` 可清空字段）
- `checkout_asset` / `return_asset` / `dispose_asset` — 领用/归还/报废状态流转
- `delete_asset` — ⚠️ 永久删除（含日志），须用户确认
- `find_or_create_person` — 按姓名查找人员，不存在自动创建

## 客户端配置示例

### ZCode / Claude Code（JSON 配置）

```json
{
  "mcpServers": {
    "zichan-assets": {
      "url": "http://192.168.10.241:8090/mcp",
      "apiKey": "<MCP_BEARER_TOKEN>"
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "zichan-assets": {
      "url": "http://192.168.10.241:8090/mcp",
      "apiKey": "<MCP_BEARER_TOKEN>"
    }
  }
}
```

### Cursor

在 Settings → MCP → Add MCP Server 中填 URL，鉴权选 Bearer Token。

### 通用（HTTP 客户端，如 curl 探测）

```bash
# 无 token 应返回 401
curl -i http://192.168.10.241:8090/mcp

# 带 token 走 MCP JSON-RPC 协议交互
curl -i http://192.168.10.241:8090/mcp \
  -H "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

## 本地开发

```bash
cd mcp-server
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
# 配置 mcp-server/.env（BACKEND_URL 指向后端地址，本地调试用 http://192.168.10.241:8000）
MCP_TRANSPORT=stdio .venv/bin/python server.py   # stdio 模式
MCP_TRANSPORT=http  .venv/bin/python server.py   # HTTP 模式
```

联调脚本：`test_local.py`（stdio）/ `test_remote.py`（远程 HTTP，从环境变量读 `MCP_URL`、`MCP_BEARER_TOKEN`）。

## 安全说明

- 服务账号 `agent`（role=user，仅登录级权限即可完整读写资产；用户管理等 admin 端点不可访问）
- MCP 端点 Bearer Token 鉴权，端口 8090 仅监听内网
- 所有写操作走现有后端 API：状态机校验（如"在库"才能领用）+ AssetLog 全记录
- 删除类工具在描述中标注危险，由 agent 执行前向用户确认
