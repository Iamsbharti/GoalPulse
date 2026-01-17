from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(
    title="GoalPulse API",
    description="AI Accountability Partner API",
    version="0.3.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "GoalPulse API", "status": "running", "version": "0.3.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Include the API routes
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
