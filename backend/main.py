from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from dotenv import load_dotenv
from datetime import datetime
from contextlib import asynccontextmanager
import os

# Load environment variables
load_dotenv()

# Import the router and database init
from api.routes import router as api_router
from models.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run database initialization on startup
    try:
        await init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
    yield

# API Tags for Swagger grouping
tags_metadata = [
    {
        "name": "Health",
        "description": "Health check and status endpoints",
    },
    {
        "name": "Chat",
        "description": "AI-powered chat and goal creation through conversation",
    },
    {
        "name": "Goals",
        "description": "CRUD operations for user goals",
    },
    {
        "name": "Check-ins",
        "description": "Goal progress check-ins and tracking",
    },
    {
        "name": "Insights",
        "description": "Motivation level and user insights",
    },
]

app = FastAPI(
    title="GoalPulse API",
    description="""
## 🎯 GoalPulse - AI Accountability Partner

GoalPulse helps users track their goals and stay accountable through AI-powered coaching.

### Features
- **Chat-based Goal Creation**: Describe goals naturally, AI extracts and confirms
- **LangGraph State Machine**: Multi-turn conversations with context retention
- **Check-in System**: Track progress with YES/NO/PARTIAL responses
- **Motivation Insights**: AI-generated encouragement based on performance

### Architecture
- **Backend**: FastAPI (Python)
- **AI Agent**: LangGraph + Ollama/OpenAI
- **Database**: PostgreSQL (Async)
- **Frontend**: Next.js

### Quick Links
- [Interactive Docs (Swagger)](/docs)
- [ReDoc](/redoc)
- [OpenAPI JSON](/openapi.json)
    """,
    version="1.0.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "GoalPulse Team",
        "email": "team@goalpulse.ai",
    },
    license_info={
        "name": "MIT",
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
def root():
    """
    Root endpoint - API status and version info.
    """
    return {"message": "GoalPulse API", "status": "running", "version": "1.0.0"}

@app.get("/health", tags=["Health"])
def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        - **status**: Current health status
        - **timestamp**: Server timestamp in ISO format
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Include the API routes
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

