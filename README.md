# GoalPulse - AI Accountability Partner

## Quick Start

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Database & State

- **Database Connection:** Successfully established via PostgreSQL (AsyncPG).
- **ORM:** SQLAlchemy (2.0+) with Async sessions for performant data handling.
- **Migrations:** Alembic is used for version control. Use `alembic upgrade head` to sync schema.
- **Models:** Defined in `backend/models/database.py`.

## Project Structure
- `frontend/` - Next.js React app
- `backend/` - FastAPI Python backend (LLM & Business Logic)
- `shared/` - Shared types and constants
- `PLAN.md` - Development roadmap
