from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from services.llm_service import LLMService
from services.goals_service import GoalsService
from models.database import get_db

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    userId: str = "neo"
    goalId: Optional[str] = None

class GenerateDescriptionRequest(BaseModel):
    title: str

class CreateGoalRequest(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "productivity"

class UpdateGoalRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None

class CreateCheckinRequest(BaseModel):
    response: str
    mood: Optional[str] = None

@router.post("/api/chat")
async def chat(request: ChatRequest):
    llm = LLMService()
    
    # System prompt to define the app's identity and handle goal creation attempts
    system_prompt = f"""You are GoalPulse, an AI accountability partner.
Current User: {request.userId}

About GoalPulse:
- We help users track goals and stay accountable.
- Users can set New Year resolutions or any personal goals.
- We check in every 2 days.

Instructions:
1. Answer questions about the app (what it offers, how it works).
2. If the user wants to ADD A NEW GOAL:
   - Acknowledge their intent.
   - You CANNOT save goals to the database yet, but you can discuss them.
   - Ask for a title and description if they are missing.
   - If they provide details, say something like "That sounds like a great goal! I'll note that down (mentally) for now."
3. If the user asks about existing goals, explain that you are currently in "Chat Only" mode and cannot access the database yet.
4. Keep responses helpful, encouraging, and concise.

User's Message: {request.message}
"""
    
    response_text = await llm.generate(system_prompt)
    
    return {"response": response_text, "agent": "chat"}

@router.post("/api/goals/generate-description")
async def generate_description(request: GenerateDescriptionRequest):
    llm = LLMService()
    prompt = f"Generate a short, inspiring description (1-2 sentences) for a goal titled: '{request.title}'."
    description = await llm.generate(prompt)
    return {"description": description}

@router.get("/api/goals")
async def list_goals(userId: str = "neo", db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    goals = await goals_service.get_user_goals(userId)
    return {"goals": goals}

@router.post("/api/goals")
async def create_goal(request: CreateGoalRequest, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    
    description = request.description
    if not description:
        llm = LLMService()
        prompt = f"Generate a short, inspiring description (1-2 sentences) for a goal titled: '{request.title}'."
        description = await llm.generate(prompt)

    goal = await goals_service.create_goal(
        user_id=userId,
        title=request.title,
        description=description,
        category="productivity" # Hardcoded as requested
    )
    
    return {
        "id": goal.id,
        "title": goal.title,
        "description": goal.description,
        "category": goal.category,
        "status": goal.status,
        "message": "Goal created successfully"
    }

@router.get("/api/goals/{goal_id}")
async def get_goal(goal_id: str, db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    goal = await goals_service.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal

@router.put("/api/goals/{goal_id}")
async def update_goal(goal_id: str, request: UpdateGoalRequest, db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    goal = await goals_service.update_goal(
        goal_id=goal_id,
        title=request.title,
        description=request.description,
        category=request.category,
        status=request.status
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal

@router.delete("/api/goals/{goal_id}")
async def delete_goal(goal_id: str, db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    success = await goals_service.delete_goal(goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": f"Goal {goal_id} deleted"}

@router.get("/api/goals/{goal_id}/checkins")
async def list_checkins(goal_id: str, db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    checkins = await goals_service.get_goal_checkins(goal_id)
    return {"checkins": checkins}

@router.post("/api/goals/{goal_id}/checkins")
async def create_checkin(goal_id: str, request: CreateCheckinRequest, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    goals_service = GoalsService(db)
    checkin = await goals_service.create_checkin(
        goal_id=goal_id,
        user_id=userId,
        response=request.response,
        mood=request.mood
    )
    return checkin