import secrets
import time
import concurrent.futures
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models import User, FeishuDepartment, FeishuUser, FeishuSyncLog
from app.schemas import (
    FeishuLoginRequest,
    FeishuTokenResponse,
    FeishuUserOut,
    FeishuContactsResponse,
    FeishuContactDepartment,
    FeishuContactMember,
)
from app.auth import create_access_token, get_current_user

router = APIRouter(prefix="/api/feishu", tags=["feishu"])

import os
from pathlib import Path
from dotenv import load_dotenv

candidates = [
    Path(__file__).parent.parent / ".env",
    Path(__file__).parent.parent.parent / ".env",
]
for env_path in candidates:
    if env_path.exists():
        load_dotenv(env_path)
        break

FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")

FEISHU_BASE = "https://open.feishu.cn/open-apis"

CACHE_EXPIRE_HOURS = 24  # 缓存过期时间（小时）


CACHE_EXPIRE_HOURS = 24  # 缓存过期时间（小时）


def _get_tenant_access_token() -> str:
    """获取飞书 tenant_access_token"""
    resp = httpx.post(
        f"{FEISHU_BASE}/auth/v3/tenant_access_token/internal",
        json={"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=500, detail=f"飞书 Token 获取失败: {data.get('msg')}")
    return data["tenant_access_token"]


def _sync_feishu_contacts(db: Session, tenant_token: str) -> tuple:
    """同步飞书通讯录到本地数据库，返回（部门数，用户数，耗时）"""
    start_time = time.time()
    
    # 1. 递归获取所有部门（带层级信息）
    def get_child_departments(parent_id: str) -> list:
        depts = []
        page_token = None
        while True:
            params = {"department_id_type": "open_department_id", "page_size": 50}
            if page_token:
                params["page_token"] = page_token
            try:
                resp = httpx.get(
                    f"{FEISHU_BASE}/contact/v3/departments/{parent_id}/children",
                    headers={"Authorization": f"Bearer {tenant_token}"},
                    params=params,
                    timeout=30,
                )
                data = resp.json()
                if data.get("code") == 0:
                    items = data.get("data", {}).get("items", [])
                    for dept in items:
                        depts.append({
                            "id": dept.get("open_department_id"),
                            "name": dept.get("name", "未命名部门"),
                            "parent_id": parent_id if parent_id != "0" else None,
                        })
                    if not data.get("data", {}).get("has_more", False):
                        break
                    page_token = data.get("data", {}).get("page_token")
                else:
                    print(f"获取子部门失败 (parent={parent_id}): code={data.get('code')}, msg={data.get('msg')}")
                    break
            except Exception as e:
                print(f"获取子部门异常 (parent={parent_id}): {e}")
                break
        return depts

    def get_all_depts_recursive(parent_id: str) -> list:
        """递归获取所有部门"""
        all_depts = []
        children = get_child_departments(parent_id)
        print(f"[DEBUG] get_all_depts_recursive({parent_id}): found {len(children)} children")
        for dept in children:
            all_depts.append(dept)
            sub_depts = get_all_depts_recursive(dept["id"])
            all_depts.extend(sub_depts)
        return all_depts

    all_depts = get_all_depts_recursive("0")
    print(f"获取到 {len(all_depts)} 个部门")

    # 2. 获取每个部门的用户
    def get_dept_users(dept_info):
        dept_id = dept_info["id"]
        dept_name = dept_info["name"]
        members = []
        page_token = None
        while True:
            try:
                params = {
                    "department_id": dept_id,
                    "department_id_type": "open_department_id",
                    "user_id_type": "open_id",
                    "page_size": 50,
                }
                if page_token:
                    params["page_token"] = page_token
                resp = httpx.get(
                    f"{FEISHU_BASE}/contact/v3/users/find_by_department",
                    headers={"Authorization": f"Bearer {tenant_token}"},
                    params=params,
                    timeout=30,
                )
                data = resp.json()
                if data.get("code") == 0:
                    items = data.get("data", {}).get("items", [])
                    for u in items:
                        members.append({
                            "open_id": u.get("open_id", ""),
                            "name": u.get("name", ""),
                            "email": u.get("email"),
                            "avatar": u.get("avatar", {}).get("avatar_240") if u.get("avatar") else None,
                            "department_id": dept_id,
                            "department_name": dept_name,
                        })
                    if not data.get("data", {}).get("has_more", False):
                        break
                    page_token = data.get("data", {}).get("page_token")
                else:
                    print(f"获取部门用户失败 (dept={dept_id}): code={data.get('code')}, msg={data.get('msg')}")
                    break
            except Exception as e:
                print(f"获取部门用户异常 (dept={dept_id}): {e}")
                break
        return members

    all_users = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(get_dept_users, dept): dept for dept in all_depts}
        for future in concurrent.futures.as_completed(futures):
            try:
                members = future.result()
                all_users.extend(members)
            except Exception:
                pass

    print(f"获取到 {len(all_users)} 个用户")

    # 3. 保存到数据库（增量更新）
    now = datetime.datetime.utcnow()
    
    # 更新部门（包含层级信息）
    for dept in all_depts:
        existing = db.query(FeishuDepartment).filter(
            FeishuDepartment.open_department_id == dept["id"]
        ).first()
        if existing:
            existing.name = dept["name"]
            existing.parent_open_department_id = dept["parent_id"]
            existing.synced_at = now
        else:
            db.add(FeishuDepartment(
                open_department_id=dept["id"],
                name=dept["name"],
                parent_open_department_id=dept["parent_id"],
                synced_at=now,
            ))
    
    db.flush()

    # 更新用户
    user_dept_map = {}
    for user in all_users:
        open_id = user["open_id"]
        if open_id not in user_dept_map:
            user_dept_map[open_id] = {
                "name": user["name"],
                "email": user["email"],
                "avatar": user["avatar"],
                "departments": [],
            }
        user_dept_map[open_id]["departments"].append({
            "id": user["department_id"],
            "name": user["department_name"],
        })

    for open_id, info in user_dept_map.items():
        primary_dept = info["departments"][0] if info["departments"] else {"id": "", "name": ""}
        
        existing = db.query(FeishuUser).filter(
            FeishuUser.open_id == open_id
        ).first()
        if existing:
            existing.name = info["name"]
            existing.email = info["email"]
            existing.avatar = info["avatar"]
            existing.open_department_id = primary_dept["id"]
            existing.department_name = primary_dept["name"]
            existing.synced_at = now
        else:
            db.add(FeishuUser(
                open_id=open_id,
                name=info["name"],
                email=info["email"],
                avatar=info["avatar"],
                open_department_id=primary_dept["id"],
                department_name=primary_dept["name"],
                synced_at=now,
            ))

    db.commit()

    duration = time.time() - start_time
    return len(all_depts), len(all_users), duration


import datetime


def _get_app_access_token() -> str:
    """获取飞书 app_access_token"""
    resp = httpx.post(
        f"{FEISHU_BASE}/auth/v3/app_access_token/internal",
        json={"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=500, detail=f"飞书 Token 获取失败: {data.get('msg')}")
    return data["app_access_token"]


@router.post("/login", response_model=FeishuTokenResponse)
def feishu_login(req: FeishuLoginRequest, db: Session = Depends(get_db)):
    """飞书 OAuth 登录：用 code 换取用户信息，返回 JWT token"""
    app_token = _get_app_access_token()

    # 用 code 换取 user_access_token
    resp = httpx.post(
        f"{FEISHU_BASE}/authen/v1/access_token",
        headers={"Authorization": f"Bearer {app_token}"},
        json={
            "grant_type": "authorization_code",
            "code": req.code,
        },
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=400, detail=f"飞书授权失败: {data.get('msg')}")

    user_access_token = data["data"]["access_token"]

    # 获取用户信息
    resp = httpx.get(
        f"{FEISHU_BASE}/authen/v1/user_info",
        headers={"Authorization": f"Bearer {user_access_token}"},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != 0:
        raise HTTPException(status_code=400, detail=f"飞书用户信息获取失败: {data.get('msg')}")

    feishu_user = data["data"]
    feishu_id = feishu_user["open_id"]
    name = feishu_user.get("name", "飞书用户")
    email = feishu_user.get("email", "")
    avatar = feishu_user.get("avatar_url", "")

    # 查找或创建用户
    user = db.query(User).filter(User.feishu_id == feishu_id).first()
    if user:
        user.email = email
        user.avatar = avatar
    else:
        # 创建新用户，username使用飞书名称；若重名则追加后缀
        base_username = name
        username = base_username
        suffix = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User(
            username=username,
            feishu_id=feishu_id,
            email=email,
            avatar=avatar,
            role="user",
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    # 生成 JWT token
    token = create_access_token({"sub": user.username})

    return FeishuTokenResponse(
        access_token=token,
        user=FeishuUserOut(
            id=user.id,
            username=user.username,
            role=user.role,
            email=user.email,
            avatar=user.avatar,
            created_at=user.created_at,
        ),
    )


@router.get("/search", response_model=list[FeishuContactMember])
def search_feishu_users(q: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """搜索飞书用户（使用缓存）"""
    results = []
    seen_open_ids = set()

    # 从缓存搜索
    cached_users = db.query(FeishuUser).filter(
        FeishuUser.name.contains(q)
    ).limit(50).all()

    for u in cached_users:
        results.append(FeishuContactMember(
            name=u.name,
            email=u.email,
            avatar=u.avatar,
            open_id=u.open_id,
            department_id=u.open_department_id,
            department_name=u.department_name,
        ))
        seen_open_ids.add(u.open_id)

    # 也搜索邮箱
    if len(results) < 50:
        email_users = db.query(FeishuUser).filter(
            FeishuUser.email.contains(q),
            ~FeishuUser.open_id.in_(seen_open_ids)
        ).limit(50 - len(results)).all()

        for u in email_users:
            results.append(FeishuContactMember(
                name=u.name,
                email=u.email,
                avatar=u.avatar,
                open_id=u.open_id,
                department_id=u.open_department_id,
                department_name=u.department_name,
            ))

    return results


@router.get("/contacts", response_model=FeishuContactsResponse)
def feishu_contacts(
    force: bool = Query(False, description="强制刷新缓存"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """获取飞书企业通讯录（使用缓存，返回树形结构）"""
    # 检查是否需要同步
    last_sync = db.query(FeishuSyncLog).order_by(FeishuSyncLog.created_at.desc()).first()
    need_sync = force or not last_sync or (
        datetime.datetime.utcnow() - last_sync.created_at
    ).total_seconds() > CACHE_EXPIRE_HOURS * 3600

    if need_sync:
        print("开始同步飞书通讯录...")
        tenant_token = _get_tenant_access_token()
        depts_count, users_count, duration = _sync_feishu_contacts(db, tenant_token)
        
        sync_log = FeishuSyncLog(
            sync_type="full" if force else "auto",
            departments_count=depts_count,
            users_count=users_count,
            duration_seconds=duration,
        )
        db.add(sync_log)
        db.commit()
        print(f"同步完成: {depts_count} 部门, {users_count} 用户, 耗时 {duration:.1f} 秒")

    # 从缓存读取数据，构建树形结构
    cached_depts = db.query(FeishuDepartment).all()
    cached_users = db.query(FeishuUser).all()
    
    # 构建部门映射
    dept_map = {d.open_department_id: d for d in cached_depts}
    
    # 构建部门-用户映射
    dept_users = {}
    for u in cached_users:
        dept_id = u.open_department_id
        if dept_id not in dept_users:
            dept_users[dept_id] = []
        dept_users[dept_id].append(FeishuContactMember(
            name=u.name,
            email=u.email,
            avatar=u.avatar,
            open_id=u.open_id,
            department_id=dept_id,
            department_name=u.department_name,
        ))
    
    # 构建树形结构
    from app.schemas import FeishuDepartmentTree
    
    def build_tree(parent_id: str = None) -> list:
        children = []
        for d in cached_depts:
            if d.parent_open_department_id == parent_id:
                node = FeishuDepartmentTree(
                    open_department_id=d.open_department_id,
                    name=d.name,
                    parent_open_department_id=d.parent_open_department_id,
                    members=dept_users.get(d.open_department_id, []),
                    children=build_tree(d.open_department_id),
                )
                children.append(node)
        return children
    
    tree = build_tree()
    total_users = len(cached_users)

    return FeishuContactsResponse(
        departments=tree,
        total_departments=len(cached_depts),
        total_users=total_users,
    )


@router.post("/sync")
def sync_feishu_contacts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """手动触发同步飞书通讯录"""
    tenant_token = _get_tenant_access_token()
    depts_count, users_count, duration = _sync_feishu_contacts(db, tenant_token)
    
    sync_log = FeishuSyncLog(
        sync_type="manual",
        departments_count=depts_count,
        users_count=users_count,
        duration_seconds=duration,
    )
    db.add(sync_log)
    db.commit()

    return {
        "message": "同步完成",
        "departments_count": depts_count,
        "users_count": users_count,
        "duration_seconds": round(duration, 2),
    }
