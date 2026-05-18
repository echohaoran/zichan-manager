# 资产管理系统 (Zichan Manager)

**[中文](./README.md) | English**

A modern fixed asset management system with a frontend-backend separated architecture, supporting the complete lifecycle management of assets.

## Features

### Core Functions

- **Asset Management** - Complete lifecycle management: registration, editing, checkout, return, and disposal
- **Category Management** - CRUD operations for asset categories, view asset count per category
- **Person Management** - Personnel information management, department association, view borrowed assets
- **Department Management** - Department CRUD, preview personnel and asset information
- **Import/Export** - Excel batch import/export with field mapping and preview editing
- **Dashboard** - Data overview with statistical charts

### Technical Highlights

- 🎨 **Apple-style Design** - Apple official color scheme, modern and clean UI
- 📱 **Responsive Layout** - Perfect adaptation for desktop and mobile
- 🔐 **User Authentication** - JWT-based login authentication
- 📊 **Data Visualization** - Charts powered by Recharts
- 🚀 **Containerized Deployment** - One-click Podman/Docker deployment

## Tech Stack

### Backend

- Python 3.12+
- FastAPI - Modern high-performance web framework
- SQLAlchemy - ORM for database operations
- SQLite - Lightweight database
- Pydantic - Data validation

### Frontend

- React 19 + TypeScript
- Ant Design 6 - UI component library
- Vite - Build tool
- React Router - Routing
- Axios - HTTP client
- Day.js - Date handling
- XLSX - Excel file processing
- Recharts - Charting library

## Project Structure

```
zichan-manager/
├── backend/                    # Backend code
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── database.py        # Database connection
│   │   ├── auth.py            # Authentication
│   │   └── routers/           # API routes
│   │       ├── assets.py      # Asset management
│   │       ├── categories.py  # Category management
│   │       ├── persons.py     # Person management
│   │       ├── departments.py # Department management
│   │       ├── users.py       # User management
│   │       └── dashboard.py   # Dashboard
│   ├── Dockerfile
│   ├── requirements.txt
│   └── seed.py                # Database initialization
│
├── zichan-manager-frontend/    # Frontend code
│   ├── src/
│   │   ├── api/               # API requests
│   │   ├── components/        # Shared components
│   │   ├── pages/             # Page components
│   │   ├── types/             # TypeScript types
│   │   ├── App.tsx            # Application entry
│   │   └── index.css          # Global styles
│   ├── package.json
│   └── vite.config.ts
│
└── docker-compose.yml          # Docker Compose configuration
```

## Quick Start

### Requirements

- Python 3.12+
- Node.js 18+
- Podman or Docker

### Deploy with Podman (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd zichan-manager

# Start services
podman-compose up -d

# Or use docker-compose
docker-compose up -d
```

After startup:
- Frontend: http://localhost:8080
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

Default admin account: `admin` / `admin123`

### Feishu Integration (This system supports Feishu contacts sync)

This system **works out of the box without Feishu**. To enable Feishu contacts sync, simply configure the Feishu environment variables.

| Use Case | Feishu Config Required |
|----------|----------------------|
| Standalone use (manual person management) | ❌ Not required |
| Feishu contacts sync | ✅ Required |

### Must-Read After Clone

New users need to complete the following initialization steps after cloning:

#### 1. Copy Environment Variable Config Files

```bash
# Backend config
cp backend/.env_example backend/.env

# Frontend config
cp zichan-manager-frontend/.env_example zichan-manager-frontend/.env
```

#### 2. Configure Feishu App (Optional)

Skip this step if you don't need Feishu integration - the system works independently.

To enable Feishu features, edit `backend/.env` and `zichan-manager-frontend/.env` with your app credentials:

```bash
# backend/.env
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_feishu_app_secret_here

# zichan-manager-frontend/.env
VITE_FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
```

How to get credentials: Visit [Feishu Open Platform](https://open.feishu.cn/) → Create an enterprise self-built app → Get App ID and App Secret

#### 3. Start Services

**Option 1: Podman/Docker Deployment (Recommended)**
```bash
podman-compose up -d
```

**Option 2: Local Development**
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
python seed.py && uvicorn app.main:app --reload --port 8000

# Frontend (new terminal window)
cd zichan-manager-frontend
npm install
npm run dev
```

### Deployment Notes

#### No Cloud Server Required

This project only requires **any computer with internet access**. The backend actively calls Feishu API to fetch data (outbound requests), no need for Feishu servers to access your computer.

| Feature | Public IP Required |
|---------|-------------------|
| Feishu contacts sync | ❌ Not required |
| Feishu OAuth login | ❌ Not required |
| Feishu bot events callback | ✅ Required (currently unused) |

#### Data Persistence

Database file `backend/zichan.db` is stored in the project directory (mounted via bind mount to container). **Restarting the container will not lose data.**

| Operation | Data Lost? |
|-----------|-----------|
| `podman-compose down` + `up` | ❌ No |
| `podman-compose restart` | ❌ No |
| Manually delete `backend/zichan.db` | ✅ Yes |
| `podman-compose down -v` | ❌ No (bind mount unaffected) |

Each startup automatically runs `seed.py` for data initialization, but it uses `create_all` + `if not` checks, **so it won't overwrite existing data**.

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Initialize database and start service
python seed.py && uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd zichan-manager-frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Features Overview

### Asset Management

- **Add Asset** - Enter asset name, category, price, purchase date, model, color, asset code, SN, etc.
- **Checkout Asset** - Select person, asset status changes to "Checked Out"
- **Return Asset** - Checked out assets can be returned, status changes to "In Stock"
- **Dispose Asset** - Disposed assets cannot be recovered
- **Import/Export** - Batch import assets via Excel, export all current assets

### Data Import

1. Click "Upload" button to select `.xlsx/.xls/.csv` file
2. System automatically identifies and maps fields, manual adjustment supported
3. Preview data, support online editing of all fields
4. Click "Confirm Import" after verification

Export fields include: asset code, name, model, color, category, price, purchase date, status, holder, device SN, description

### Person Management

- Add/edit person information
- Select department
- View all assets borrowed by the person

### Department Management

- Add/edit/delete departments
- View personnel count and total assets in department
- Click details to view specific personnel and asset list
- Support jumping to corresponding person/asset management pages

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assets` | GET/POST | Asset list/create asset |
| `/api/assets/{id}` | GET/PUT/DELETE | Asset detail/update/delete |
| `/api/assets/{id}/checkout` | POST | Checkout asset |
| `/api/assets/{id}/return` | POST | Return asset |
| `/api/assets/{id}/dispose` | POST | Dispose asset |
| `/api/assets/batch-import` | POST | Batch import assets |
| `/api/categories` | GET/POST | Category list/create |
| `/api/persons` | GET/POST | Person list/create |
| `/api/departments` | GET/POST | Department list/create |
| `/api/users/me` | GET | Current user info |

Full API documentation: http://localhost:8000/docs

## Configuration

### Environment Variables

The project uses `.env` files for sensitive configuration, **sensitive information is never written into code**.

#### Backend Config (`backend/.env`)

```bash
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=your_feishu_app_secret_here
```

Before first deployment, copy template and fill in real values:

```bash
cp backend/.env_example backend/.env
# Edit backend/.env with Feishu App ID and Secret
```

#### Frontend Config (`zichan-manager-frontend/.env`)

```bash
VITE_API_URL=http://localhost:8000
VITE_FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
```

Before first deployment, copy template and fill in real values:

```bash
cp zichan-manager-frontend/.env_example zichan-manager-frontend/.env
# Edit .env with Feishu App ID
```

#### Getting Feishu Credentials

1. Visit [Feishu Open Platform](https://open.feishu.cn/), create an enterprise self-built app
2. Get `App ID` and `App Secret` from app details page
3. Configure app permissions: `contact:user.base:readonly`, `contact:user.email:readonly`, `authen:user.id:readonly`
4. Configure redirect URL: `http://your-domain/login/feishu/callback`

### Port Configuration

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| backend | 8000 | 8000 |
| frontend | 5173 | 8080 |

## Development Guide

### Adding New Features

1. Backend: Add data model in `backend/app/models.py`, add routes in `routers/`
2. Frontend: Add types in `src/types/index.ts`, add pages in `src/pages/`
3. Routing: Register routes in `src/App.tsx`, add menu items in `AppLayout.tsx`

### Database Migration

Development environment uses SQLite. After modifying models, delete `zichan.db` and restart service to rebuild database.

For production, PostgreSQL/MySQL is recommended. Configure database connection yourself.

## License

MIT License
