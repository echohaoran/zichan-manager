from app.database import SessionLocal, engine, Base
from app.models import User, Category, Department, Person
from app.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

if not db.query(User).filter(User.username == "admin").first():
    admin = User(username="admin", password_hash=hash_password("admin123"), role="admin")
    db.add(admin)
    print("Created admin user (admin / admin123)")

if not db.query(Category).first():
    for name in ["电子设备", "办公家具", "交通工具", "仪器仪表", "房屋建筑"]:
        db.add(Category(name=name))
    print("Created default categories")

# Create default departments and persons
if not db.query(Department).first():
    depts = {}
    for name in ["技术部", "财务部", "行政部", "市场部"]:
        dept = Department(name=name, description=f"{name}描述")
        db.add(dept)
        db.flush()
        depts[name] = dept.id
    print("Created default departments")

    if not db.query(Person).first():
        persons = [("张三", "技术部"), ("李四", "财务部"), ("王五", "行政部"), ("赵六", "市场部")]
        for name, dept_name in persons:
            db.add(Person(name=name, department_id=depts.get(dept_name)))
        print("Created sample persons")

db.commit()
db.close()
print("Seed completed!")
