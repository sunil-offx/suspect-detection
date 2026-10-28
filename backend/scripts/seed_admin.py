import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.user import User
from app.security.passwords import get_password_hash


def seed_admin():
    db = SessionLocal()
    try:
        email = settings.ADMIN_EMAIL
        password = settings.ADMIN_PASSWORD
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Admin user already exists with email: {email}")
            user.role = "admin"
            user.hashed_password = get_password_hash(password)
            db.commit()
            print("Admin credentials refreshed.")
        else:
            new_user = User(
                email=email,
                hashed_password=get_password_hash(password),
                role="admin"
            )
            db.add(new_user)
            db.commit()
            print(f"Successfully seeded admin user with email: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
