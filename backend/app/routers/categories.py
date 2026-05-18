from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Category, Asset
from app.schemas import CategoryCreate, CategoryOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.post("", response_model=CategoryOut)
def create_category(req: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.query(Category).filter(Category.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="分类已存在")
    cat = Category(name=req.name, description=req.description)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    cat.asset_count = db.query(Asset).filter(Asset.category_id == cat.id).count()
    return cat


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cats = db.query(Category).all()
    for c in cats:
        c.asset_count = db.query(Asset).filter(Asset.category_id == c.id).count()
    return cats


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, req: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    cat.name = req.name
    cat.description = req.description
    db.commit()
    db.refresh(cat)
    cat.asset_count = db.query(Asset).filter(Asset.category_id == cat.id).count()
    return cat


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    asset_count = db.query(Asset).filter(Asset.category_id == category_id).count()
    if asset_count > 0:
        raise HTTPException(status_code=400, detail=f"该分类下有 {asset_count} 个资产，无法删除")
    db.delete(cat)
    db.commit()
    return {"message": "删除成功"}
