from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Any
from models.database import get_db, User
from services.auth_service import AuthService
from datetime import timedelta

router = APIRouter()

# --- Schemas ---
class Token(BaseModel):
    user_id: str
    access_token: str
    token_type: str
    name: Optional[str] = None
    email: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

# --- Endpoints ---

@router.post("/auth/signup", response_model=Token, tags=["Auth"])
async def signup(request: SignUpRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    # Check if user exists
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = AuthService.get_password_hash(request.password)
    new_user = User(
        email=request.email,
        name=request.name,
        password_hash=hashed_password
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user) # Get ID

    # Generate token
    token_data = {"sub": str(new_user.id), "email": new_user.email}
    access_token = AuthService.create_access_token(data=token_data)

    return {
        "user_id": str(new_user.id),
        "access_token": access_token,
        "token_type": "bearer",
        "name": new_user.name,
        "email": new_user.email
    }

@router.post("/auth/login", response_model=Token, tags=["Auth"])
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate existing user."""
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.password_hash:
         # Users created without password (if any) or corrupted
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This user account is not set up for password login.",
        )

    if not AuthService.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # Generate token
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = AuthService.create_access_token(data=token_data)

    return {
        "user_id": str(user.id),
        "access_token": access_token,
        "token_type": "bearer",
        "name": user.name,
        "email": user.email
    }

@router.post("/auth/login-as-default", response_model=Token, tags=["Auth"])
async def login_as_default(db: AsyncSession = Depends(get_db)):
    """Log in as the default 'neo' user (dev/demo mode)."""
    stmt = select(User).where(User.id == "neo")
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        # Create neo if missing (fallback)
        user = User(id="neo", email="neo@example.com", name="Neo")
        db.add(user)
        await db.commit()

    # Generate token (no password needed for default user in this flow)
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = AuthService.create_access_token(data=token_data)

    return {
        "user_id": str(user.id),
        "access_token": access_token,
        "token_type": "bearer",
        "name": user.name,
        "email": user.email
    }
