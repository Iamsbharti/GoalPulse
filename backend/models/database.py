import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs, create_async_engine, async_sessionmaker, AsyncSession
import os
from dotenv import load_dotenv

load_dotenv()

class Base(AsyncAttrs, DeclarativeBase):
    pass

class GoalStatus:
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # Hashed password (or null for default user)

    goals: Mapped[List["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    checkins: Mapped[List["Checkin"]] = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")

class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="productivity")
    status: Mapped[str] = mapped_column(String(20), default=GoalStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="goals")
    checkins: Mapped[List["Checkin"]] = relationship("Checkin", back_populates="goal", cascade="all, delete-orphan")

class CheckinProgress:
    YES = "YES"
    NO = "NO"
    PARTIAL = "PARTIAL"

class CheckinMood:
    GREAT = "GREAT"
    OKAY = "OKAY"
    LOW = "LOW"

class Checkin(Base):
    __tablename__ = "checkins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id: Mapped[str] = mapped_column(String(36), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    progress: Mapped[str] = mapped_column(String(20), nullable=False)  # YES | NO | PARTIAL
    mood: Mapped[str] = mapped_column(String(20), nullable=False)      # GREAT | OKAY | LOW
    response: Mapped[str] = mapped_column(Text, nullable=False)        # free text
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    goal: Mapped["Goal"] = relationship("Goal", back_populates="checkins")
    user: Mapped["User"] = relationship("User", back_populates="checkins")

class MotivationSnapshot(Base):
    """
    Stores historical motivation scores for trend visualization.
    
    Created whenever motivation is calculated (on insights load).
    Enables "Motivation over last 7 days" sparkline on Insights page.
    Reusable for per-goal motivation history in future phases.
    """
    __tablename__ = "motivation_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    goal_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("goals.id", ondelete="CASCADE"), nullable=True)  # None = overall, set = per-goal
    score: Mapped[int] = mapped_column(nullable=False)
    consistency_score: Mapped[Optional[int]] = mapped_column(nullable=True)
    vibe_score: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/GoalPulse")

# Ensure we use the async driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Fix for Vercel/Neon: asyncpg doesn't support sslmode in URL
if "sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")

# Configure engine with SSL if on Vercel (indicated by removed sslmode or existing URL structure)
connect_args = {}
if "vercel" in DATABASE_URL or "neon" in DATABASE_URL or os.getenv("VERCEL"):
    connect_args = {"ssl": "require"}

engine = create_async_engine(DATABASE_URL, echo=True, connect_args=connect_args)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed the demo user
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == "neo"))
        user = result.scalar_one_or_none()
        if not user:
            new_user = User(id="neo", email="neo@example.com", name="Neo")
            session.add(new_user)
            await session.commit()

async def close_db():
    await engine.dispose()
