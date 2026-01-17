# GoalPulse - Phase 1 Implementation Plan

## Project Overview
**GoalPulse** is an AI Accountability Partner for New Year resolutions.
- **Frontend**: Next.js (React) - deploys to Vercel
- **Backend**: FastAPI (Python) - deploys to Vercel Functions
- **Database**: PostgreSQL via SQLAlchemy 2.0 + Alembic
- **AI**: LangGraph with Ollama (local) / OpenAI (production)
- **Check-in Cadence**: Every 2 days

---


## Database Configuration

### Local Development
```
PG_HOST = "localhost"
PG_PORT = 5432
PG_DB   = "GoalPulse"
PG_USER = "postgres"
PG_PASS = "Icandoit@123"
```

### Async Database Setup Details (Important for Vercel/Production)
1.  **Driver**: Use `asyncpg` for high-performance async database access.
    *   Connection string format: `postgresql+asyncpg://user:pass@host:port/dbname`
2.  **SQLAlchemy**:
    *   Use `create_async_engine` from `sqlalchemy.ext.asyncio`.
    *   Use `async_sessionmaker` for session management.
3.  **Alembic (Async Config)**:
    *   **`env.py`**: Refactored to support async migrations using `connectable.connect()` with `await connection.run_sync()`.
    *   **Config Parser**: Avoid setting `sqlalchemy.url` directly in the Config object in `env.py` to prevent `%` character interpolation errors with complex passwords.
    *   **Templates**: Updated `script.py.mako` to import `Sequence` from `typing` and use valid python boolean logic (`or` instead of `||`) for the `Revises` line.
4.  **Dependencies**:
    *   Required: `sqlalchemy`, `asyncpg`, `alembic`.
    *   Ensure compatible versions for Python 3.13 (e.g., loose version pinning).

### Production (Vercel)
- Use Vercel Postgres
- Connection string from Vercel dashboard (ensure `postgresql+asyncpg://` prefix)

---


## Project Structure

```
goalpulse/
├── frontend/                    # Next.js App Router
│   ├── app/
│   │   ├── api/                # Next.js API routes (proxy to backend)
│   │   ├── chat/               # Chat page
│   │   ├── goals/              # Goals management
│   │   ├── layout.tsx
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── ChatWindow.tsx
│   │   ├── GoalCard.tsx
│   │   └── ui/                 # Reusable UI components
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   └── utils.ts
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env.local
│
├── backend/                     # FastAPI
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── chat_agent.py       # LangGraph chat agent
│   │   └── coaching_agent.py   # Coaching logic
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py           # API endpoints
│   │   └── dependencies.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── database.py         # SQLAlchemy models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_service.py      # LLM abstraction layer
│   │   └── goals_service.py    # Goals CRUD operations
│   ├── alembic/
│   │   ├── versions/           # Migration files
│   │   └── env.py              # Alembic configuration
│   ├── main.py                 # FastAPI app entry
│   ├── requirements.txt
│   └── .env
│
├── shared/                      # Shared TypeScript types
│   └── types/
│       ├── goal.ts
│       ├── chat.ts
│       └── index.ts
│
├── docs/                        # Documentation
├── PLAN.md                      # This file
└── README.md
```

---


## Checkpoint Schedule

| Checkpoint | Date | Goal | Deploy Status |
|------------|------|------|---------------|
| CP1 | Day 1 | Project setup, hello world | ✅ Deployed |
| CP2 | Day 2 | Basic chat UI + API | ✅ Deployed |
| CP3 | Day 3 | Goal CRUD + database | ✅ Deployed |
| CP4 | Day 4 | LLM integration (Ollama) | ✅ Deployed |
| CP5 | Day 5 | LangGraph chat agent | ✅ Deployed |
| CP6 | Day 6 | User authentication | ✅ Deployed |
| CP7 | Day 7 | Full MVP ready | ✅ Deployed |

---


## Day 1 Tasks (Today)

### Goal
Project structure created, hello world deployed, pipeline verified.

### Deliverables
1. [ ] Frontend: Next.js app with home page
2. [ ] Backend: FastAPI with `/health` endpoint
3. [ ] Database: SQLAlchemy models and Alembic migrations
4. [ ] Deployment apps deployed: Both to Vercel

### Commands to Run

```bash
# 1. Setup Frontend (in /frontend directory)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
npm install

# 2. Setup Backend (in /backend directory)
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn python-dotenv openai langgraph langchain-ollama
pip install sqlalchemy[asyncio] asyncpg alembic pydantic pydantic-settings

# 3. Setup Alembic Migrations
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# 4. Test locally
# Frontend: cd frontend && npm run dev
# Backend: cd backend && uvicorn main:app --reload
```

### Environment Files

**frontend/.env.local**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**backend/.env**
```env
OPENAI_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434/v1
DATABASE_URL=postgresql+asyncpg://postgres:Icandoit%40123@localhost:5432/TICS
```

### Today's Success Criteria
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Backend health check at `http://localhost:8000/health`
- [ ] Both apps deployed to Vercel
- [ ] Chat page shows "Hello, GoalPulse!" message

---


## Database Schema (SQLAlchemy 2.0)

```python
# backend/models/database.py

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import AsyncAttrs, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import uuid
from datetime import datetime

class Base(AsyncAttrs, DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    checkins: Mapped[list["Checkin"]] = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")

class Goal(Base):
    __tablename__ = "goals"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="productivity")
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user: Mapped["User"] = relationship("User", back_populates="goals")
    checkins: Mapped[list["Checkin"]] = relationship("Checkin", back_populates="goal", cascade="all, delete-orphan")

class Checkin(Base):
    __tablename__ = "checkins"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id: Mapped[str] = mapped_column(String(36), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    goal: Mapped["Goal"] = relationship("Goal", back_populates="checkins")
    user: Mapped["User"] = relationship("User", back_populates="checkins")
```

---


## API Endpoints

### Health Check
```
GET /health
Response: { "status": "healthy", "timestamp": "..." }
```

### Chat
```
POST /api/chat
Body: { "message": "Hi", "userId": "..." }
Response: { "response": "Hello! How can I help?", "agent": "chat" }
```

### Goals
```
GET    /api/goals              # List all goals
POST   /api/goals              # Create goal
GET    /api/goals/:id          # Get goal details
PUT    /api/goals/:id          # Update goal
DELETE /api/goals/:id          # Delete goal
```

### Checkins
```
GET    /api/goals/:id/checkins # List checkins
POST   /api/goals/:id/checkins # Create checkin
```

---


## AI Configuration

### LLM Service Abstraction

```python
# backend/services/llm_service.py

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

class LLMService:
    def __init__(self, provider="ollama"):
        self.provider = provider
        
    def get_client(self):
        if self.provider == "ollama":
            return ChatOllama(model="llama3.2", base_url="http://localhost:11434/v1")
        return ChatOpenAI(model="gpt-4")
```

### LangGraph Agent Setup

```python
# backend/agents/chat_agent.py

from langgraph.graph import StateGraph, END

# Define state
class AgentState(TypedDict):
    messages: list
    user_id: str
    goal_id: str | None
    mood: str | None

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("chat", chat_node)
workflow.add_node("coach", coach_node)
workflow.set_entry_point("chat")
workflow.add_edge("chat", END)
workflow.add_edge("coach", END)

app = workflow.compile()
```

---


## Vercel Deployment Setup

### Frontend (Next.js)
1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Backend (FastAPI with Vercel Functions)
```json
// backend/vercel.json
{
  "builds": [
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "main.py"
    }
  ]
}
```

### Environment Variables on Vercel
- `OPENAI_API_KEY` - OpenAI key
- `DATABASE_URL` - Vercel Postgres connection string (use `postgresql+asyncpg://...`)
- `OLLAMA_BASE_URL` - (not needed in production)

---


## Alembic Migration Commands

### Initial Setup
```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### Day-to-Day Development
```bash
# Create after changing models migration
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Check current migration
alembic current

# View migration history
alembic history

# Rollback one migration
alembic downgrade -1
```

---


## Daily Deployment Checklist

Before ending each work session:
- [ ] All changes committed to git
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Vercel
- [ ] Both URLs working
- [ ] Update this PLAN.md with completed items
- [ ] Note any blockers for next session

---


## Notes for Next Session

**Start Here:**
1. Run `git pull` to get latest
2. Check PLAN.md current status
3. Continue from next incomplete checkpoint
4. Deploy after completing tasks

**Common Commands:**
```bash
# Frontend
cd frontend
npm run dev
npm run build
vercel --prod

# Backend
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload
vercel --prod

# Database Migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic current
alembic downgrade -1
```

---


## Contact & Resources

- **Project Docs**: 01_Project_Description.md
- **Brand Assets**: 02_Image_Prompts.md
- **Database GUI**: pgAdmin or DBeaver
- **Alembic Docs**: https://alembic.sqlalchemy.org/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/

---


*Last Updated: January 18, 2026 - Database & API Integration Complete*

---


## Session: Backend Implementation & API Endpoints (Day 1 - Evening Session)

**Date:** January 18, 2026
**Status:** COMPLETED

### Completed This Session

1. **Backend Services Layer**
   - Created `backend/models/database.py` - SQLAlchemy 2.0 models (Async)
   - Created `backend/services/goals_service.py` - Goals CRUD operations
   - Created `backend/services/llm_service.py` - LLM abstraction layer (with support for Ollama and OpenAI)

2. **API Endpoints & Database Integration**
   - `/health` - Health check (verified working)
   - `/` - Root endpoint with version info
   - `/api/goals` - GET (list goals) & POST (create goal) **Fully connected to PostgreSQL**
   - `/api/goals/generate-description` - POST (AI-powered goal description generation)
   - `/api/goals/:id` - GET (get goal), PUT (update goal), DELETE (delete goal) **Fully connected to PostgreSQL**
   - `/api/goals/:id/checkins` - GET (list checkins), POST (create checkin) **Fully connected to PostgreSQL**
   - `/api/chat` - Chat with AI coach (connected to LLM service with Markdown support)

3. **Frontend Integration**
   - **Chat Interface**: Added `react-markdown` and `@tailwindcss/typography` for rich AI responses.
   - **Goals Management**: Implemented full CRUD UI on `/goals` page.
   - **AI Assistance**: Added "Generate with AI" feature for goal descriptions in the frontend.

4. **Database Migration & Recovery**
   - Successfully used Alembic to restore the `goals` table after a manual drop.
   - Verified async migration flow with `alembic upgrade head`.

5. **Testing Results**
   - Health check: OK
   - Goal Creation with AI Description: OK
   - List goals from DB: OK
   - Chat with Markdown formatting: OK
   - Database Migrations: OK

### Files Created/Modified

- `backend/api/routes.py` (MODIFIED) - Fully connected to GoalsService and LLMService
- `backend/services/llm_service.py` (MODIFIED) - Fixed imports and base URL
- `frontend/app/goals/page.tsx` (MODIFIED) - Implemented Goal CRUD and AI generation UI
- `frontend/app/chat/page.tsx` (MODIFIED) - Added Markdown rendering support
- `frontend/tailwind.config.ts` (MODIFIED) - Added typography plugin
- `README.md` (MODIFIED) - Added database pointers

### Next Steps (Priority Order)

1. **High Priority**
   - Add user authentication/session handling (currently hardcoded to 'neo')
   - Implement Check-in flow in the UI
   - Enhance LangGraph agent for deeper coaching logic

2. **Medium Priority**
   - Add conversation memory/context persistence
   - Implement goal reminders/notifications
   - Progress visualization/charts

3. **Lower Priority**
   - User profile settings
   - Social accountability features
   - Export functionality

---


*Last Updated: January 18, 2026 - Database & API Integration Complete*
