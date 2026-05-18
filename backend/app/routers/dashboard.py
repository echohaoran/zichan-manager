from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, Asset, Category, Department, Person
from app.schemas import DashboardStats
from app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    total = db.query(Asset).count()
    in_stock = db.query(Asset).filter(Asset.status == "在库").count()
    checked_out = db.query(Asset).filter(Asset.status == "领用中").count()
    disposed = db.query(Asset).filter(Asset.status == "已报废").count()
    total_value = db.query(func.sum(Asset.price)).filter(Asset.status != "已报废").scalar() or 0.0

    cats = db.query(Category).all()
    category_stats = []
    for c in cats:
        count = db.query(Asset).filter(Asset.category_id == c.id).count()
        category_stats.append({"name": c.name, "count": count})

    # 部门统计
    dept_stats = []
    depts = db.query(Department).all()
    for d in depts:
        person_ids = [p.id for p in db.query(Person).filter(Person.department_id == d.id).all()]
        count = db.query(Asset).filter(Asset.person_id.in_(person_ids)).count() if person_ids else 0
        dept_stats.append({"name": d.name, "count": count})

    return DashboardStats(
        total_assets=total,
        in_stock=in_stock,
        checked_out=checked_out,
        disposed=disposed,
        total_value=total_value,
        category_stats=category_stats,
        department_stats=dept_stats,
    )
