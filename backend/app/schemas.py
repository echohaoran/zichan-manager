from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role: str


class UserPasswordUpdate(BaseModel):
    password: str


class DepartmentCreate(BaseModel):
    name: str
    description: str = ""


class DepartmentOut(BaseModel):
    id: int
    name: str
    description: str
    person_count: int = 0
    asset_count: int = 0

    model_config = {"from_attributes": True}


class PersonCreate(BaseModel):
    name: str
    department_id: Optional[int] = None


class PersonOut(BaseModel):
    id: int
    name: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    description: str = ""


class CategoryOut(BaseModel):
    id: int
    name: str
    description: str
    asset_count: int = 0

    model_config = {"from_attributes": True}


class AssetCreate(BaseModel):
    name: str
    category_id: int
    price: float = 0.0
    purchase_date: str
    description: str = ""
    model: str = ""
    color: str = ""
    asset_code: str
    sn: str = "空"


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    purchase_date: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    asset_code: Optional[str] = None
    sn: Optional[str] = None


class AssetLogOut(BaseModel):
    id: int
    action: str
    operator_id: int
    detail: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: int
    name: str
    category_id: int
    category_name: str = ""
    price: float
    purchase_date: datetime
    status: str
    person_id: Optional[int] = None
    person_name: Optional[str] = None
    description: str
    model: str = ""
    color: str = ""
    asset_code: str = ""
    sn: str = ""
    created_at: datetime
    updated_at: datetime
    logs: List[AssetLogOut] = []

    model_config = {"from_attributes": True}


class PersonWithAssets(PersonOut):
    assets: List[AssetOut] = []


class DepartmentDetail(BaseModel):
    id: int
    name: str
    description: str
    persons: List[PersonOut] = []
    assets: List[AssetOut] = []

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_assets: int
    in_stock: int
    checked_out: int
    disposed: int
    total_value: float
    category_stats: List[dict]
    department_stats: List[dict] = []


class AssetImportItem(BaseModel):
    name: str
    category_name: str = ""
    price: float = 0.0
    purchase_date: Optional[str] = None
    description: str = ""
    model: str = ""
    color: str = ""
    asset_code: str = ""
    sn: str = ""
    status: str = "在库"


class FeishuLoginRequest(BaseModel):
    code: str


class FeishuUserOut(BaseModel):
    id: int
    username: str
    role: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeishuTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: FeishuUserOut


class FeishuContactMember(BaseModel):
    name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    open_id: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None


class FeishuContactDepartment(BaseModel):
    name: str
    members: list[FeishuContactMember] = []


class FeishuDepartmentTree(BaseModel):
    open_department_id: str
    name: str
    parent_open_department_id: Optional[str] = None
    members: List[FeishuContactMember] = []
    children: List["FeishuDepartmentTree"] = []


class FeishuContactsResponse(BaseModel):
    departments: List[FeishuDepartmentTree] = []
    total_departments: int = 0
    total_users: int = 0
