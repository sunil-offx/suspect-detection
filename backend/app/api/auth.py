from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse
from app.security.passwords import get_password_hash, verify_password
from app.security.jwt import create_access_token
from app.security.deps import get_current_user, require_role
from app.services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_role("admin"))
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )

    assigned_role = payload.role if payload.role in ["admin", "investigator"] else "investigator"
    new_user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=assigned_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    client_ip = request.client.host if request.client else None
    log_action(
        db=db,
        user_id=current_user.id if current_user else new_user.id,
        case_id=None,
        action="auth_register",
        details={"registered_email": new_user.email, "role": new_user.role},
        ip_address=client_ip
    )

    return new_user


from app.security.rate_limit import login_limiter


@router.post("/login", response_model=TokenResponse)
def login_user(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    key = f"{client_ip}:{payload.email}"

    # Rate limiting: 6th bad login in 60s -> 429
    if login_limiter.check_rate_limit(key) or login_limiter.check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds."
        )

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        login_limiter.record_failure(key)
        login_limiter.record_failure(client_ip)
        log_action(
            db=db,
            user_id=None,
            case_id=None,
            action="auth_login_failed",
            details={"email": payload.email},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Successful login resets failed attempts
    login_limiter.reset(key)
    login_limiter.reset(client_ip)

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})

    log_action(
        db=db,
        user_id=user.id,
        case_id=None,
        action="auth_login",
        details={"email": user.email, "role": user.role},
        ip_address=client_ip
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user
