# 资产管理系统 (Zichan Manager)

**[English](./README_en.md) | 中文**

一个现代化的固定资产管理系统，采用前后端分离架构，支持资产的完整生命周期管理。

## 功能特性

### 核心功能

- **资产管理** - 资产登记、编辑、领用、归还、报废全流程管理
- **分类管理** - 资产分类的增删改查，支持查看分类下资产数量
- **人员管理** - 人员信息管理，关联部门，查看借用资产
- **部门管理** - 部门增删改查，预览部门人员和资产信息
- **数据导入导出** - Excel 批量导入导出资产数据，支持字段映射和预览编辑
- **工作台** - 数据概览，统计图表展示

### 技术亮点

- 🎨 **Apple 风格设计** - 采用苹果官网配色，现代简洁的 UI
- 📱 **响应式布局** - 完美适配桌面端和移动端
- 🔐 **用户认证** - 基于 JWT 的用户登录认证
- 📊 **数据可视化** - 使用 Recharts 展示统计图表
- 🚀 **容器化部署** - 支持 Podman/Docker 一键部署

## 技术栈

### 后端

- Python 3.12+
- FastAPI - 现代高性能 Web 框架
- SQLAlchemy - ORM 数据库操作
- SQLite - 轻量级数据库
- Pydantic - 数据验证

### 前端

- React 19 + TypeScript
- Ant Design 6 - UI 组件库
- Vite - 构建工具
- React Router - 路由管理
- Axios - HTTP 请求
- Day.js - 日期处理
- XLSX - Excel 文件处理
- Recharts - 图表库

## 项目结构

```
zichan-manager/
├── backend/                    # 后端代码
│   ├── app/
│   │   ├── main.py            # FastAPI 应用入口
│   │   ├── models.py          # SQLAlchemy 数据模型
│   │   ├── schemas.py         # Pydantic 数据模型
│   │   ├── database.py        # 数据库连接
│   │   ├── auth.py            # 认证相关
│   │   └── routers/           # API 路由
│   │       ├── assets.py      # 资产管理
│   │       ├── categories.py  # 分类管理
│   │       ├── persons.py     # 人员管理
│   │       ├── departments.py # 部门管理
│   │       ├── users.py       # 用户管理
│   │       └── dashboard.py   # 工作台
│   ├── Dockerfile
│   ├── requirements.txt
│   └── seed.py                # 数据库初始化
│
├── zichan-manager-frontend/    # 前端代码
│   ├── src/
│   │   ├── api/               # API 请求
│   │   ├── components/        # 公共组件
│   │   ├── pages/             # 页面组件
│   │   ├── types/             # TypeScript 类型
│   │   ├── App.tsx            # 应用入口
│   │   └── index.css          # 全局样式
│   ├── package.json
│   └── vite.config.ts
│
└── docker-compose.yml          # Docker Compose 配置
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- Podman 或 Docker

### 使用 Podman 部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd zichan-manager

# 启动服务
podman-compose up -d

# 或者使用 docker-compose
docker-compose up -d
```

服务启动后：
- 前端访问地址：http://localhost:8080
- 后端 API 地址：http://localhost:8000
- API 文档：http://localhost:8000/docs

默认管理员账号：`admin` / `admin123`

### 飞书集成（本系统支持飞书通讯录同步）

本系统**开箱即用，无需飞书也可独立运行**。如需接入飞书通讯录同步人员，只需配置飞书相关环境变量即可。

| 使用场景 | 是否需要飞书配置 |
|---------|---------------|
| 本地独立使用（手动管理人员） | ❌ 不需要 |
| 接入飞书通讯录同步 | ✅ 需要 |

### 克隆后必读

新用户克隆仓库后，需要完成以下初始化步骤：

#### 1. 复制环境变量配置文件

```bash
# 后端配置
cp backend/.env_example backend/.env

# 前端配置
cp zichan-manager-frontend/.env_example zichan-manager-frontend/.env
```

#### 2. 配置飞书应用（可选）

如果不使用飞书功能，可跳过此步骤，资产管理系统可独立运行。

如需使用飞书功能，请编辑 `backend/.env` 和 `zichan-manager-frontend/.env`，填入飞书应用凭证：

```bash
# backend/.env
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_feishu_app_secret_here

# zichan-manager-frontend/.env
VITE_FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
```

获取方式：访问 [飞书开放平台](https://open.feishu.cn/) → 创建企业自建应用 → 获取 App ID 和 App Secret

#### 3. 启动服务

**方式一：Podman/Docker 部署（推荐）**
```bash
podman-compose up -d
```

**方式二：本地开发**
```bash
# 后端
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
python seed.py && uvicorn app.main:app --reload --port 8000

# 前端（新开终端窗口）
cd zichan-manager-frontend
npm install
npm run dev
```

### 部署说明

#### 无需云服务器

本项目只需**任何一台能联网的电脑**即可运行。后端主动调用飞书 API 获取数据（出站请求），不要求飞书服务器访问你的电脑。

| 功能 | 是否需要公网 |
|------|------------|
| 飞书通讯录同步 | ❌ 不需要 |
| 飞书 OAuth 登录 | ❌ 不需要 |
| 飞书机器人事件回调 | ✅ 需要（当前未使用） |

#### 数据持久化

数据库文件 `backend/zichan.db` 存储在项目目录中（通过 bind mount 挂载到容器），**重启容器不会丢失数据**。

| 操作 | 数据是否丢失 |
|------|------------|
| `podman-compose down` + `up` | ❌ 不丢失 |
| `podman-compose restart` | ❌ 不丢失 |
| 手动删除 `backend/zichan.db` | ✅ 丢失 |
| `podman-compose down -v` | ❌ 不丢失（bind mount 不受影响） |

每次启动会自动执行 `seed.py` 初始化数据，但它使用 `create_all` + `if not` 判断，**不会覆盖已有数据**。

### 本地开发

#### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 初始化数据库并启动服务
python seed.py && uvicorn app.main:app --reload --port 8000
```

#### 前端

```bash
cd zichan-manager-frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 功能说明

### 资产管理

- **新增资产** - 录入资产名称、分类、价格、购买日期、型号、颜色、资产编码、SN码等信息
- **资产领用** - 选择领用人，资产状态变更为"领用中"
- **资产归还** - 领用中的资产可归还，状态变更为"在库"
- **资产报废** - 资产报废后无法恢复
- **导入导出** - 支持通过 Excel 批量导入资产，导出当前所有资产

### 数据导入

1. 点击"上传"按钮选择 `.xlsx/.xls/.csv` 文件
2. 系统自动识别并映射字段，可手动调整映射关系
3. 预览数据，支持在线编辑所有字段
4. 确认无误后点击"确认导入"

导出字段包括：资产编码、名称、型号、颜色、分类、价格、购买日期、状态、领用人、设备SN、描述

### 人员管理

- 新增/编辑人员信息
- 选择所属部门
- 查看人员借用的所有资产

### 部门管理

- 新增/编辑/删除部门
- 查看部门下人员数量和资产总数
- 点击详情可查看具体人员和资产列表
- 支持跳转到对应的人员/资产管理页面

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/assets` | GET/POST | 资产列表/新增资产 |
| `/api/assets/{id}` | GET/PUT/DELETE | 资产详情/更新/删除 |
| `/api/assets/{id}/checkout` | POST | 领用资产 |
| `/api/assets/{id}/return` | POST | 归还资产 |
| `/api/assets/{id}/dispose` | POST | 报废资产 |
| `/api/assets/batch-import` | POST | 批量导入资产 |
| `/api/categories` | GET/POST | 分类列表/新增 |
| `/api/persons` | GET/POST | 人员列表/新增 |
| `/api/departments` | GET/POST | 部门列表/新增 |
| `/api/users/me` | GET | 当前用户信息 |

完整 API 文档请访问：http://localhost:8000/docs

## 配置说明

### 环境变量

项目使用 `.env` 文件管理敏感配置，**敏感信息不写入代码**。

#### 后端配置 (`backend/.env`)

```bash
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_feishu_app_secret_here
```

首次部署前，复制模板并填入真实值：

```bash
cp backend/.env_example backend/.env
# 编辑 backend/.env 填入飞书 App ID 和 Secret
```

#### 前端配置 (`zichan-manager-frontend/.env`)

```bash
VITE_API_URL=http://localhost:8000
VITE_FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
```

首次部署前，复制模板并填入真实值：

```bash
cp zichan-manager-frontend/.env_example zichan-manager-frontend/.env
# 编辑 .env 填入飞书 App ID
```

#### 获取飞书配置

1. 访问 [飞书开放平台](https://open.feishu.cn/)，创建企业自建应用
2. 在应用详情页获取 `App ID` 和 `App Secret`
3. 配置应用权限：`contact:user.base:readonly`、`contact:user.email:readonly`、`authen:user.id:readonly`
4. 配置重定向 URL：`http://your-domain/login/feishu/callback`

### 端口配置

| 服务 | 容器端口 | 主机端口 |
|------|---------|---------|
| backend | 8000 | 8000 |
| frontend | 5173 | 8080 |

## 开发指南

### 添加新功能

1. 后端：在 `backend/app/models.py` 添加数据模型，在 `routers/` 添加路由
2. 前端：在 `src/types/index.ts` 添加类型，在 `src/pages/` 添加页面
3. 路由：在 `src/App.tsx` 注册路由，在 `AppLayout.tsx` 添加菜单项

### 数据库迁移

开发环境使用 SQLite，修改模型后删除 `zichan.db` 重启服务即可重建数据库。

生产环境建议使用 PostgreSQL/MySQL，需自行配置数据库连接。

## 页面风格
![alt text](asset/image-1.png)
![alt text](asset/image-2.png)
## 许可证

MIT License