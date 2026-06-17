from datetime import datetime, timedelta
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from app.database import get_db
from app.models import Asset, AssetLog, Category, Person, User
from app.schemas import AssetCreate, AssetUpdate, AssetOut, AssetLogOut, AssetImportItem, AssetBatchImportResponse, AssetBatchDeleteRequest
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



def _generate_asset_code(db):
    existing = {ac[0] for ac in db.query(Asset.asset_code).filter(Asset.asset_code.like('wckg_%')).all()}
    for _ in range(100):
        code = f"wckg_{random.randint(1, 99999):05d}"
        if code not in existing:
            return code
    return f"wckg_{random.randint(100000, 999999):06d}"

@router.post("", response_model=AssetOut)
def create_asset(req: AssetCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == req.category_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="分类不存在")
    purchase_date = datetime.strptime(req.purchase_date, "%Y-%m-%d") if req.purchase_date else datetime.utcnow()
    if not req.asset_code:
        req.asset_code = _generate_asset_code(db)
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

@router.post("/batch-import", response_model=AssetBatchImportResponse)
def batch_import_assets(items: List[AssetImportItem], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 缓存分类名 -> id
    cats = {c.name: c.id for c in db.query(Category).all()}

    # 缓存现有人员（按去除两端空格的姓名匹配），并跟踪本批内新建的人员避免重复
    existing_persons = {p.name.strip(): p for p in db.query(Person).all()}
    created_persons_in_batch: dict = {}
    persons_matched = 0
    persons_new = 0

    # 预加载本批可能命中的现有资产（按 asset_code 索引）
    target_codes = {item.asset_code for item in items if item.asset_code}
    existing_assets_by_code: dict = {}
    if target_codes:
        existing_assets_by_code = {
            a.asset_code: a
            for a in db.query(Asset).filter(Asset.asset_code.in_(target_codes)).all()
        }

    created_assets = []
    updated_assets = []
    # 本批内新建的资产（用于处理同批重复 asset_code：后行者 update 先行者）
    batch_created_by_code: dict = {}

    for item in items:
        category_id = cats.get(item.category_name)
        if not category_id:
            raise HTTPException(status_code=400, detail=f"分类 '{item.category_name}' 不存在，请先创建该分类")

        # —— 解析领用人：匹配现有人员，未命中则自动新建 ——
        person_id = None
        person_name_resolved = (item.person_name or "").strip()
        if person_name_resolved:
            if person_name_resolved in existing_persons:
                person_id = existing_persons[person_name_resolved].id
                persons_matched += 1
            elif person_name_resolved in created_persons_in_batch:
                person_id = created_persons_in_batch[person_name_resolved].id
            else:
                new_person = Person(name=person_name_resolved, department_id=None)
                db.add(new_person)
                db.flush()
                existing_persons[person_name_resolved] = new_person
                created_persons_in_batch[person_name_resolved] = new_person
                persons_new += 1

        # 状态自洽：有领用人且状态为"在库"或未填时，自动升级为"领用中"
        status = item.status or "在库"
        if person_id is not None and status == "在库":
            status = "领用中"

        purchase_date = _parse_purchase_date(item.purchase_date)

        # —— 增量更新核心：按 asset_code 匹配 ——
        matched = None
        if item.asset_code:
            if item.asset_code in existing_assets_by_code:
                matched = existing_assets_by_code[item.asset_code]
            elif item.asset_code in batch_created_by_code:
                matched = batch_created_by_code[item.asset_code]

        if matched is not None:
            # UPDATE：覆盖所有可变字段，保留 id / created_at / asset_code
            asset = matched
            asset.name = item.name
            asset.category_id = category_id
            asset.price = item.price
            asset.purchase_date = purchase_date
            asset.description = item.description
            asset.model = item.model
            asset.color = item.color
            asset.sn = item.sn
            asset.status = status
            asset.person_id = person_id
            updated_assets.append(asset)
            log_action = "编辑"
            log_detail = f"批量导入更新: {item.name}"
        else:
            # CREATE：asset_code 为空时自动生成 wckg_XXXXX
            asset = Asset(
                name=item.name,
                category_id=category_id,
                price=item.price,
                purchase_date=purchase_date,
                description=item.description,
                model=item.model,
                color=item.color,
                asset_code=item.asset_code or _generate_asset_code(db),
                sn=item.sn,
                status=status,
                person_id=person_id,
            )
            db.add(asset)
            db.flush()
            if asset.asset_code:
                batch_created_by_code[asset.asset_code] = asset
            created_assets.append(asset)
            log_action = "登记"
            log_detail = f"批量导入: {item.name}"

        if person_name_resolved:
            suffix = "（新建）" if person_name_resolved in created_persons_in_batch else ""
            log_detail += f"，领用人: {person_name_resolved}{suffix}"
        _add_log(db, asset.id, log_action, user.id, log_detail)

    db.commit()
    all_affected = created_assets + updated_assets
    for a in all_affected:
        db.refresh(a)

    return AssetBatchImportResponse(
        created=len(created_assets),
        updated=len(updated_assets),
        persons_created=persons_new,
        persons_matched=persons_matched,
        assets=[_asset_to_out(a, db) for a in all_affected],
    )


@router.get("", response_model=list[AssetOut])
def list_assets(
    status: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
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
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            q = q.filter(Asset.purchase_date >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            # Include assets up to end of day
            from datetime import timedelta as td
            q = q.filter(Asset.purchase_date < ed + td(days=1))
        except ValueError:
            pass
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


@router.post("/batch-delete")
def batch_delete_assets(
    req: AssetBatchDeleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """批量删除资产：连带日志一起删；报告请求数 / 实际删除数 / 不存在的 id"""
    ids = [int(i) for i in (req.ids or []) if i is not None]
    # 去重同时保留顺序
    seen = set()
    unique_ids = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            unique_ids.append(i)
    if not unique_ids:
        return {"requested": 0, "deleted": 0, "missing": []}

    existing = db.query(Asset).filter(Asset.id.in_(unique_ids)).all()
    existing_ids = {a.id for a in existing}
    missing = [i for i in unique_ids if i not in existing_ids]

    if existing:
        db.query(AssetLog).filter(AssetLog.asset_id.in_(existing_ids)).delete(synchronize_session=False)
        for a in existing:
            db.delete(a)
    db.commit()

    return {
        "requested": len(unique_ids),
        "deleted": len(existing),
        "missing": missing,
    }


def _add_log(db: Session, asset_id: int, action: str, operator_id: int, detail: str = ""):
    log = AssetLog(asset_id=asset_id, action=action, operator_id=operator_id, detail=detail)
    db.add(log)
    db.commit()
