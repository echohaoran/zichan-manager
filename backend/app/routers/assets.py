from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from app.database import get_db
from app.models import Asset, AssetLog, Category, Person, User
from app.schemas import AssetCreate, AssetUpdate, AssetOut, AssetLogOut, AssetImportItem
from app.auth import get_current_user

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _asset_to_out(asset: Asset, db: Session) -> AssetOut:
    logs = db.query(AssetLog).filter(AssetLog.asset_id == asset.id).order_by(desc(AssetLog.created_at)).all()
    category_name = asset.category.name if asset.category else ""
    person_name = asset.person.name if asset.person else None
    return AssetOut(
        id=asset.id,
        name=asset.name,
        category_id=asset.category_id,
        category_name=category_name,
        price=asset.price,
        purchase_date=asset.purchase_date,
        status=asset.status,
        person_id=asset.person_id,
        person_name=person_name,
        description=asset.description,
        model=asset.model,
        color=asset.color,
        asset_code=asset.asset_code,
        sn=asset.sn,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        logs=[AssetLogOut(
            id=log.id,
            action=log.action,
            operator_id=log.operator_id,
            detail=log.detail,
            created_at=log.created_at,
        ) for log in logs],
    )


@router.post("", response_model=AssetOut)
def create_asset(req: AssetCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == req.category_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="分类不存在")
    purchase_date = datetime.strptime(req.purchase_date, "%Y-%m-%d") if req.purchase_date else datetime.utcnow()
    asset = Asset(
        name=req.name,
        category_id=req.category_id,
        price=req.price,
        purchase_date=purchase_date,
        description=req.description,
        model=req.model,
        color=req.color,
        asset_code=req.asset_code,
        sn=req.sn,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    _add_log(db, asset.id, "登记", user.id, f"登记资产: {req.name}")
    return _asset_to_out(asset, db)



def _parse_purchase_date(date_str):
    if not date_str:
        return datetime.utcnow()
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        pass
    try:
        serial = int(date_str)
        if 30000 < serial < 100000:
            return datetime(1899, 12, 30) + timedelta(days=serial)
    except (ValueError, TypeError):
        pass
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(date_str)
    except Exception:
        pass
    raise HTTPException(status_code=400, detail=f"无法解析日期: {date_str}")

@router.post("/batch-import", response_model=list[AssetOut])
def batch_import_assets(items: List[AssetImportItem], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    created = []
    # cache category name -> id
    cats = {c.name: c.id for c in db.query(Category).all()}
    for item in items:
        category_id = cats.get(item.category_name)
        if not category_id:
            raise HTTPException(status_code=400, detail=f"分类 '{item.category_name}' 不存在，请先创建该分类")
        purchase_date = _parse_purchase_date(item.purchase_date)
        asset = Asset(
            name=item.name,
            category_id=category_id,
            price=item.price,
            purchase_date=purchase_date,
            description=item.description,
            model=item.model,
            color=item.color,
            asset_code=item.asset_code,
            sn=item.sn,
            status=item.status,
        )
        db.add(asset)
        db.flush()
        _add_log(db, asset.id, "登记", user.id, f"批量导入: {item.name}")
        created.append(asset)
    db.commit()
    for a in created:
        db.refresh(a)
    return [_asset_to_out(a, db) for a in created]


@router.get("", response_model=list[AssetOut])
def list_assets(
    status: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Asset)
    if status:
        q = q.filter(Asset.status == status)
    if category_id:
        q = q.filter(Asset.category_id == category_id)
    if keyword:
        q = q.filter(Asset.name.contains(keyword))
    assets = q.order_by(desc(Asset.updated_at)).all()
    return [_asset_to_out(a, db) for a in assets]


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    return _asset_to_out(asset, db)


@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, req: AssetUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if req.name is not None:
        asset.name = req.name
    if req.category_id is not None:
        cat = db.query(Category).filter(Category.id == req.category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="分类不存在")
        asset.category_id = req.category_id
    if req.price is not None:
        asset.price = req.price
    if req.purchase_date is not None:
        asset.purchase_date = datetime.strptime(req.purchase_date, "%Y-%m-%d")
    if req.description is not None:
        asset.description = req.description
    if req.model is not None:
        asset.model = req.model
    if req.color is not None:
        asset.color = req.color
    if req.asset_code is not None:
        asset.asset_code = req.asset_code
    if req.sn is not None:
        asset.sn = req.sn
    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(asset)
    _add_log(db, asset_id, "编辑", user.id, f"编辑资产信息")
    return _asset_to_out(asset, db)


@router.post("/{asset_id}/checkout")
def checkout_asset(asset_id: int, person_id: int = Query(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if asset.status != "在库":
        raise HTTPException(status_code=400, detail=f"资产当前状态为'{asset.status}'，无法领用")
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    asset.status = "领用中"
    asset.person_id = person_id
    asset.updated_at = datetime.utcnow()
    db.commit()
    _add_log(db, asset_id, "领用", user.id, f"由 {person.name} 领用")
    return {"message": f"资产 '{asset.name}' 已由 {person.name} 领用"}


@router.post("/{asset_id}/return")
def return_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if asset.status != "领用中":
        raise HTTPException(status_code=400, detail="资产当前未处于领用状态")
    asset.status = "在库"
    asset.person_id = None
    asset.updated_at = datetime.utcnow()
    db.commit()
    _add_log(db, asset_id, "归还", user.id, f"由 {user.username} 归还")
    return {"message": f"资产 '{asset.name}' 已归还"}


@router.post("/{asset_id}/dispose")
def dispose_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if asset.status == "已报废":
        raise HTTPException(status_code=400, detail="资产已报废")
    asset.status = "已报废"
    asset.person_id = None
    asset.updated_at = datetime.utcnow()
    db.commit()
    _add_log(db, asset_id, "报废", user.id, "资产已报废")
    return {"message": f"资产 '{asset.name}' 已报废"}


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    db.query(AssetLog).filter(AssetLog.asset_id == asset_id).delete()
    db.delete(asset)
    db.commit()
    return {"message": "删除成功"}


def _add_log(db: Session, asset_id: int, action: str, operator_id: int, detail: str = ""):
    log = AssetLog(asset_id=asset_id, action=action, operator_id=operator_id, detail=detail)
    db.add(log)
    db.commit()
