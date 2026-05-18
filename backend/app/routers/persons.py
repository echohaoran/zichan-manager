from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import Person, Asset, Department
from app.schemas import PersonCreate, PersonOut, PersonWithAssets, AssetOut, PersonBatchImportItem
from app.auth import get_current_user
from app.routers.assets import _asset_to_out as _convert_asset_to_out

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.post("", response_model=PersonOut)
def create_person(req: PersonCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if req.department_id:
        dept = db.query(Department).filter(Department.id == req.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="部门不存在")
    person = Person(name=req.name, department_id=req.department_id)
    db.add(person)
    db.commit()
    db.refresh(person)
    return _person_to_out(person, db)


@router.get("", response_model=list[PersonOut])
def list_persons(db: Session = Depends(get_db), user=Depends(get_current_user)):
    persons = db.query(Person).order_by(desc(Person.created_at)).all()
    return [_person_to_out(p, db) for p in persons]


@router.put("/{person_id}", response_model=PersonOut)
def update_person(person_id: int, req: PersonCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    if req.department_id:
        dept = db.query(Department).filter(Department.id == req.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="部门不存在")
    person.name = req.name
    person.department_id = req.department_id
    db.commit()
    db.refresh(person)
    return _person_to_out(person, db)


@router.delete("/{person_id}")
def delete_person(person_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    db.query(Asset).filter(Asset.person_id == person_id).update({Asset.person_id: None})
    db.delete(person)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{person_id}/assets", response_model=PersonWithAssets)
def get_person_assets(person_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")
    assets = db.query(Asset).filter(Asset.person_id == person_id).order_by(desc(Asset.updated_at)).all()
    return PersonWithAssets(
        id=person.id,
        name=person.name,
        department_id=person.department_id,
        department_name=person.department.name if person.department else None,
        created_at=person.created_at,
        assets=[_convert_asset_to_out(a, db) for a in assets],
    )



@router.post("/batch-import")
def batch_import_persons(items: List[PersonBatchImportItem], db: Session = Depends(get_db), user=Depends(get_current_user)):
    existing_persons = {p.name for p in db.query(Person).all()}
    departments = {d.name: d for d in db.query(Department).all()}
    created = 0
    skipped = 0
    for item in items:
        if item.name in existing_persons:
            skipped += 1
            continue
        dept_id = None
        if item.department_name:
            if item.department_name not in departments:
                dept = Department(name=item.department_name, description=从飞书导入)
                db.add(dept)
                db.flush()
                departments[item.department_name] = dept
            dept_id = departments[item.department_name].id
        person = Person(name=item.name, department_id=dept_id)
        db.add(person)
        existing_persons.add(item.name)
        created += 1
    db.commit()
    return {created: created, skipped: skipped, total: len(items)}


def _person_to_out(person: Person, db: Session) -> PersonOut:
    department_name = person.department.name if person.department else None
    return PersonOut(
        id=person.id,
        name=person.name,
        department_id=person.department_id,
        department_name=department_name,
        created_at=person.created_at,
    )
