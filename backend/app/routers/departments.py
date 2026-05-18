from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import User, Department, Person, Asset
from app.schemas import DepartmentCreate, DepartmentOut, DepartmentDetail, PersonOut, AssetOut
from app.auth import get_current_user
from app.routers.assets import _asset_to_out as _convert_asset_to_out

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.post("", response_model=DepartmentOut)
def create_department(req: DepartmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.query(Department).filter(Department.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="部门已存在")
    dept = Department(name=req.name, description=req.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _enrich_department(dept, db)


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    depts = db.query(Department).order_by(desc(Department.created_at)).all()
    return [_enrich_department(d, db) for d in depts]


@router.get("/{department_id}", response_model=DepartmentDetail)
def get_department(department_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    persons = db.query(Person).filter(Person.department_id == department_id).all()
    person_ids = [p.id for p in persons]
    assets = db.query(Asset).filter(Asset.person_id.in_(person_ids)).all() if person_ids else []
    return DepartmentDetail(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        persons=[PersonOut(
            id=p.id,
            name=p.name,
            department_id=p.department_id,
            department_name=dept.name,
            created_at=p.created_at,
        ) for p in persons],
        assets=[_convert_asset_to_out(a, db) for a in assets],
    )


@router.put("/{department_id}", response_model=DepartmentOut)
def update_department(department_id: int, req: DepartmentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    existing = db.query(Department).filter(Department.name == req.name, Department.id != department_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="部门名称已存在")
    dept.name = req.name
    dept.description = req.description
    db.commit()
    db.refresh(dept)
    return _enrich_department(dept, db)


@router.delete("/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    person_count = db.query(Person).filter(Person.department_id == department_id).count()
    if person_count > 0:
        raise HTTPException(status_code=400, detail=f"该部门下有 {person_count} 名人员，无法删除")
    db.delete(dept)
    db.commit()
    return {"message": "删除成功"}


def _enrich_department(dept: Department, db: Session) -> DepartmentOut:
    person_count = db.query(Person).filter(Person.department_id == dept.id).count()
    person_ids = db.query(Person.id).filter(Person.department_id == dept.id).all()
    person_ids = [p[0] for p in person_ids]
    asset_count = db.query(Asset).filter(Asset.person_id.in_(person_ids)).count() if person_ids else 0
    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        person_count=person_count,
        asset_count=asset_count,
    )