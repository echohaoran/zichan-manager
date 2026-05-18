import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class AssetStatus(str, enum.Enum):
    in_stock = "在库"
    checked_out = "领用中"
    disposed = "已报废"


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    persons = relationship("Person", back_populates="department")


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="persons")
    assets = relationship("Asset", back_populates="person")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(String, default=UserRole.user.value)
    feishu_id = Column(String, unique=True, nullable=True, index=True)
    email = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, default="")

    assets = relationship("Asset", back_populates="category")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    price = Column(Float, default=0.0)
    purchase_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default=AssetStatus.in_stock.value)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    description = Column(String, default="")
    model = Column(String, default="")
    color = Column(String, default="")
    asset_code = Column(String, default="", index=True)
    sn = Column(String, default="", index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    category = relationship("Category", back_populates="assets")
    person = relationship("Person", back_populates="assets")
    logs = relationship("AssetLog", back_populates="asset")


class AssetLog(Base):
    __tablename__ = "asset_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    action = Column(String)
    operator_id = Column(Integer, ForeignKey("users.id"))
    detail = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    asset = relationship("Asset", back_populates="logs")


class FeishuDepartment(Base):
    __tablename__ = "feishu_departments"

    id = Column(Integer, primary_key=True, index=True)
    open_department_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    parent_open_department_id = Column(String, nullable=True)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)


class FeishuUser(Base):
    __tablename__ = "feishu_users"

    id = Column(Integer, primary_key=True, index=True)
    open_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    email = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    open_department_id = Column(String, index=True)
    department_name = Column(String, default="")
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)


class FeishuSyncLog(Base):
    __tablename__ = "feishu_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    sync_type = Column(String)
    departments_count = Column(Integer, default=0)
    users_count = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
