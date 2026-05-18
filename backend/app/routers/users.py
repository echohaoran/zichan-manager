from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserOut, UserCreate, UserUpdate, UserPasswordUpdate, UserRoleUpdate
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_admin

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("", response_model=UserOut)
def create_user(req: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(username=req.username, password_hash=hash_password(req.password), role=req.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).all()


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, req: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if req.username is not None:
        existing = db.query(User).filter(User.username == req.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已存在")
        user.username = req.username
    if req.role is not None:
        user.role = req.role
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(user_id: int, req: UserRoleUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.role = req.role
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/password")
def change_password(user_id: int, req: UserPasswordUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    # Regular admin cannot change other admin's password
    if admin.username != "admin" and user.role == "admin":
        raise HTTPException(status_code=403, detail="无权限修改管理员密码")
    user.password_hash = hash_password(req.password)
    db.commit()
    return {"message": "密码已修改"}


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    # Regular admin cannot delete other admin users
    if admin.username != "admin" and user.role == "admin":
        raise HTTPException(status_code=403, detail="无权限删除管理员用户")
    db.delete(user)
    db.commit()
    return {"message": "删除成功"}
