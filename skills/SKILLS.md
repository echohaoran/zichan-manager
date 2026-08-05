---
name: zichan-mcp
description: 连接并调用资产管理（zichan-manager）系统的 MCP Server，可查询、搜索、分析、编辑固定资产。当用户需要查资产、盘点、统计、领用/归还/报废资产、修改资产信息时使用。调用前先读本文件了解连接方式与每个工具的参数。
---

# 资产管理系统 MCP 接入与调用指南

通过 MCP 协议连接生产环境的资产管理系统（192.168.10.241），对固定资产进行查询、搜索、分析、编辑。所有写操作都会写入操作日志（AssetLog）。

## 一、连接信息

| 项 | 值 |
|---|---|
| MCP URL | `http://192.168.10.241:8090/mcp` |
| 鉴权方式 | HTTP Header：`Authorization: Bearer <MCP_BEARER_TOKEN>` |
| 传输方式 | Streamable HTTP |
| Token 来源 | 问管理员索取；生产服务器存放于 `/root/zichan-manager/mcp-server/.env`（权限 600） |

### 客户端配置示例（ZCode / Claude Desktop / Cursor）

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

### 连接自检

```bash
# 无 token 应返回 401（鉴权生效）
curl -i http://192.168.10.241:8090/mcp

# 带 token 发 MCP initialize 请求（连接成功的标志）
curl -i http://192.168.10.241:8090/mcp \
  -H "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

## 二、工具总览（14 个）

| 类别 | 工具 | 说明 |
|---|---|---|
| 🔍 查询 | `search_assets` | 多条件搜索资产（关键词/状态/分类/领用人/部门/日期/分页） |
| 🔍 查询 | `get_asset` | 单个资产详情 + 完整操作日志 |
| 🔍 查询 | `get_stats` | 资产概览统计 |
| 🔍 查询 | `list_categories` | 分类列表（资产编辑用） |
| 🔍 查询 | `list_persons` | 人员列表（领用人） |
| 🔍 查询 | `list_departments` | 部门列表 |
| 📊 分析 | `analyze_assets` | 预聚合分析报告（分布/价值/异常提示） |
| ✏️ 编辑 | `create_asset` | 创建资产 |
| ✏️ 编辑 | `update_asset` | 编辑资产基本信息 |
| ✏️ 编辑 | `checkout_asset` | 资产领用（状态流转） |
| ✏️ 编辑 | `return_asset` | 资产归还（状态流转） |
| ✏️ 编辑 | `dispose_asset` | 资产报废（状态流转） |
| ✏️ 编辑 | `delete_asset` | ⚠️ 永久删除资产（含日志，需用户确认） |
| ✏️ 编辑 | `find_or_create_person` | 查找人员，不存在自动创建 |

## 三、工具详细说明

### 🔍 search_assets — 搜索资产

**用途**：按条件筛选资产列表，是最常用的查询工具。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyword` | string | 否 | 模糊匹配 **名称/资产编码/序列号/型号** 任一字段 |
| `status` | string | 否 | 状态精确匹配 |
| `category_id` | int | 否 | 分类 ID（用 list_categories 查） |
| `person_id` | int | 否 | 领用人 ID（用 list_persons 查） |
| `department_id` | int | 否 | 部门 ID（按领用人所属部门筛选，用 list_departments 查） |
| `start_date` / `end_date` | string | 否 | 购买日期范围，格式 `YYYY-MM-DD` |
| `limit` | int | 否 | 返回条数上限，默认 100，最大 1000 |
| `offset` | int | 否 | 分页偏移 |

**示例**：`search_assets({"keyword": "笔记本", "status": "使用中", "limit": 10})`

**返回**：资产数组，每项含 id、name、category_name、price、purchase_date、status、person_name、description、model、color、asset_code、sn、created_at、updated_at。

### 🔍 get_asset — 资产详情

**用途**：查看单个资产完整信息，**包含操作日志**（登记/编辑/领用/归还/报废的历史记录）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `asset_id` | int | 是 | 资产 ID |

**返回**：资产对象 + `logs` 数组（每条含 action、operator_id、detail、created_at）。用于追溯资产变更历史。

### 🔍 get_stats — 概览统计

**用途**：快速了解整体情况：资产总数、各状态数量、总价值（不含已报废）、按分类/部门统计。

**参数**：无。

### 🔍 list_categories / list_persons / list_departments — 参考数据

**用途**：获取分类/人员/部门的 ID 与名称，供搜索筛选和编辑时引用。

**参数**：无。返回含 `asset_count` / `department_name` 等辅助字段。

### 📊 analyze_assets — 预聚合分析

**用途**：生成完整分析报告，适合回答"整体情况如何"类问题，包含：

- **总览**：总数、各状态数量、总价值（不含报废）、平均价格、购买时间跨度
- **按状态/分类/部门/领用人分布**（领用人分布取前 20）
- **按分类价值**
- **最近更新（前 10）**
- **异常提示**：重复资产编码、重复序列号、在库却绑定领用人、序列号为空、价格为 0 或负数

**参数**：无。

### ✏️ create_asset — 创建资产

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 资产名称 |
| `category_id` | int | 二选一 | 分类 ID |
| `category_name` | string | 二选一 | 分类名称（自动解析为 ID，如"电子设备"） |
| `price` | float | 否 | 价格，默认 0 |
| `purchase_date` | string | 否 | 购买日期 `YYYY-MM-DD`，留空为今天 |
| `description` / `model` / `color` | string | 否 | 描述/型号/颜色，默认空 |
| `asset_code` | string | 否 | 资产编码，**留空自动生成** `wckg_XXXXX` |
| `sn` | string | 否 | 序列号，默认"空" |

**注意**：创建后状态默认为"在库"、无领用人。若需要领用，创建后再调 `checkout_asset`。

### ✏️ update_asset — 编辑资产

**用途**：修改资产基本信息（名称/分类/价格/购买日期/描述/型号/颜色/编码/序列号）。**只传需要修改的字段**；传空字符串 `""` 可**清空**某字段。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `asset_id` | int | 是 | 资产 ID |
| 其余字段 | 同 create_asset | 否 | 均为可选，缺省不修改 |

**注意**：状态和领用人**不能**通过此工具修改，必须用状态流转工具（checkout/return/dispose）。

### ✏️ checkout_asset — 资产领用

**用途**：把"在库"资产领给指定人员，状态变为"领用中"。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `asset_id` | int | 是 | 资产 ID |
| `person_id` | int | 是 | 领用人 ID |

**流程**：先 `list_persons` 找人员；不存在则 `find_or_create_person` 创建后再领用。非"在库"资产会返回 400。

### ✏️ return_asset — 资产归还

**用途**：归还"领用中"资产，状态变回"在库"，解除领用人。参数仅 `asset_id`。

### ✏️ dispose_asset — 资产报废

**用途**：把资产标记为"已报废"（**不可逆**的状态流转，报废后不计入总价值）。参数仅 `asset_id`。

### ✏️ delete_asset — 删除资产 ⚠️

**用途**：**永久删除**资产及其全部操作日志，不可恢复。

**注意**：这是最危险的操作，**执行前必须向用户明确确认**，说明将删除哪条资产（ID、名称、编码）。

### ✏️ find_or_create_person — 查找/创建人员

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 人员姓名（精确匹配） |
| `department_id` | int | 否 | 创建时指定部门（可选） |

**返回**：`{"found": true/false, "person": {...}}`，found=true 表示命中已有人员。

## 四、使用规范与工作流

1. **先查后改**：任何编辑操作前，先搜索/查看目标资产，确认 ID 与当前状态
2. **领用流程**：`list_persons` 找领用人 →（不存在则 `find_or_create_person`）→ `checkout_asset`
3. **状态流转专用**：状态只能用 checkout/return/dispose 修改，update_asset 改不了状态
4. **删除需确认**：delete_asset 前必须向用户复述将被删除的资产并取得确认
5. **真实数据为准**：所有回答基于工具返回的真实数据，不要臆测；查询结果为空时明确说明
6. **数据口径**：生产数据中状态是自由文本，实际常见值：`使用中`、`闲置`、`损坏`、`在库`、`领用中`、`已报废`（用 analyze_assets 看实际分布）；"领用人"字段也可能是位置（机房/茶水间等）

## 五、常见错误与处理

| 现象 | 原因与处理 |
|---|---|
| HTTP 401 | Token 缺失或错误，向管理员索取正确的 MCP_BEARER_TOKEN |
| "分类不存在: xxx" | category_name 拼写不符，先 `list_categories` 查看实际分类名 |
| "人员不存在"（领用失败） | 先 `find_or_create_person` 创建该人员再领用 |
| 400 状态流转被拒 | 当前状态不允许该操作（如"领用中"不能再次领用、"在库"不能归还），先 get_asset 确认状态 |
| "资产不存在" | asset_id 错误或资产已删除，用 search_assets 核实 |
