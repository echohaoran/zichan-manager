from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import assets, categories, users, dashboard, persons, departments, feishu, version

Base.metadata.create_all(bind=engine)

app = FastAPI(title="资产管理 - zichan-manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)
app.include_router(categories.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(persons.router)
app.include_router(departments.router)
app.include_router(feishu.router)
app.include_router(version.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
