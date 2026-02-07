from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from services.llm_service import LLMService
from services.goals_service import GoalsService
from agents.goal_creation_agent import goal_creation_agent
from agents.coaching_agent import coaching_agent
from models.database import get_db
from observability import get_opik_client, TraceNames
from sqlalchemy import select, func
from models.database import Checkin
from datetime import datetime, timedelta
from services.utils import (
    determine_motivation_band,
    get_micro_label,
    build_risk_exposure_data
)

router = APIRouter()

# Opik client for tracing
_opik = get_opik_client()

class ChatRequest(BaseModel):
    message: str
    userId: str = "neo"
    goalId: Optional[str] = None
    messages: Optional[List[Dict[str, str]]] = []

class ProcessGoalMessageRequest(BaseModel):
    message: str
    userId: str = "neo"
    existing_goal_draft: Optional[Dict[str, Any]] = None

class CreateGoalFromChatRequest(BaseModel):
    title: str
    description: str
    category: str
    checkin_frequency_days: int = 3
    userId: str = "neo"

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
    progress: str  # YES | NO | PARTIAL
    mood: str      # GREAT | OKAY | LOW
    response: str  # free text

@router.post("/api/chat", tags=["Chat"])
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Main chat endpoint using LangGraph for goal creation.
    
    This is the primary interface for:
    - Natural language goal creation ("I want to exercise daily")
    - Multi-turn conversations with context retention
    - General coaching and accountability chat
    
    The LangGraph agent handles:
    - Intent detection (goal vs general chat)
    - Goal extraction and clarification
    - Confirmation flow before saving
    """
    print(f"DEBUG - /api/chat called with message: {request.message}")
    
    # Process through LangGraph goal creation agent
    result = await goal_creation_agent.process_message(
        user_id=request.userId,
        message=request.message
    )
    
    print(f"DEBUG - LangGraph result: {result}")
    
    # If goal intent was detected, return the agent's response
    if result.get("has_goal_intent"):
        status = result.get("status", "collecting")
        goal_draft = result.get("goal_draft")
        
        # Transform goal_draft to match frontend expectations
        transformed_draft = None
        if goal_draft:
            transformed_draft = {
                "title": goal_draft.get("title", ""),
                "description": goal_draft.get("description", ""),
                "category": goal_draft.get("category", "personal"),
                "suggested_checkin_frequency_days": goal_draft.get("frequency_days", 3)
            }
        
        return {
            "has_goal_intent": True,
            "message": result.get("response", ""),
            "goal_draft": transformed_draft,
            "goal_created": result.get("goal_created", False),
            "status": status,
            # Frontend expects these boolean flags
            "needs_confirmation": status == "confirming",
            "needs_clarification": status == "collecting",
            "cancelled": status == "cancelled"
        }
    
    # No goal intent - use normal chat
    print(f"DEBUG - No goal intent, using normal chat")
    llm = LLMService()
    
    system_prompt = f"""You are GoalPulse, an AI accountability partner.
        Current User: {request.userId}

        About GoalPulse:
        - We help users track goals and stay accountable.
        - Users can set New Year resolutions or any personal goals.
        - We check in every 2 days.

        Instructions:
        1. Answer questions about the app (what it offers, how it works).
        2. Keep responses helpful, encouraging, and concise.
        3. If the user wants to create a goal, encourage them with phrases like "I want to..." or "My goal is..."

        User's Message: {request.message}
        """

    response_text = await llm.generate(system_prompt)
    print(f"DEBUG - Normal chat response: {response_text}")

    return {"response": response_text, "agent": "chat", "has_goal_intent": False}

@router.post("/api/chat/coaching", tags=["Chat"])
async def coaching_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Goal Coaching Logic
    
    Handles:
    - Context loading (deterministic)
    - Intent classification
    - Check-ins via chat
    - Emotional mirroring
    """
    if not request.goalId:
        raise HTTPException(status_code=400, detail="goalId is required for coaching")

    # Opik Thread ID: coaching-{user_id}-{goal_id}
    # This groups the entire coaching session in Opik
    thread_id = f"coaching-{request.userId}-{request.goalId}"
    
    # Initialize State
    initial_state = {
        "user_id": request.userId,
        "goal_id": request.goalId,
        "current_input": request.message,
        "messages": request.messages or [], # We don't persist history in DB yet, relied on Opik for visibility
        "context": None,
        "intent": None,
        "response": None,
        "checkin_data": None
    }
    
    print(f"DEBUG - Coaching chat for goal {request.goalId}: {request.message}")
    
    with _opik.trace_context(
        "coaching-session-turn", 
        input_data=initial_state,
        thread_id=thread_id
    ) as trace:
        
        # Invoke Agent
        try:
            result = await coaching_agent.ainvoke(
                initial_state, 
                config={"configurable": {"db": db}}
            )
            
            response = result.get("response", "I'm not sure how to help with that, but I'm listening.")
            intent = result.get("intent")
            
            trace.set_output({"response": response, "intent": intent})
            
            return {
                "response": response,
                "agent": "coach",
                "intent": intent,
                "thread_id": thread_id
            }
            
        except Exception as e:
            print(f"Coaching Agent Error: {e}")
            trace.set_output({"error": str(e)})
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/goals/generate-description", tags=["Goals"])
async def generate_description(request: GenerateDescriptionRequest):
    """
    Generate an AI-powered description for a goal title.
    
    Uses LLM to create an inspiring 1-2 sentence description.
    """
    llm = LLMService()
    prompt = f"Generate a short, inspiring description (1-2 sentences) for a goal titled: '{request.title}'."
    description = await llm.generate(prompt)
    return {"description": description}

@router.get("/api/goals", tags=["Goals"])
async def list_goals(userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """List all goals for a user."""
    goals_service = GoalsService(db)
    goals = await goals_service.get_user_goals(userId)
    return {"goals": goals}

@router.post("/api/goals", tags=["Goals"])
async def create_goal(request: CreateGoalRequest, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """Create a new goal (form-based, not chat-based)."""
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
        category=request.category
    )
    
    return {
        "id": goal.id,
        "title": goal.title,
        "description": goal.description,
        "category": goal.category,
        "status": goal.status,
        "message": "Goal created successfully"
    }

@router.get("/api/goals/least-active", tags=["Goals"])
async def get_least_active_goals(userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """Get goals with the least recent check-in activity."""
    goals_service = GoalsService(db)
    goals = await goals_service.get_least_active_goals(userId)
    return {"goals": goals}

@router.get("/api/goals/{goal_id}", tags=["Goals"])
async def get_goal(goal_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific goal by ID."""
    goals_service = GoalsService(db)
    goal = await goals_service.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal

@router.put("/api/goals/{goal_id}", tags=["Goals"])
async def update_goal(goal_id: str, request: UpdateGoalRequest, db: AsyncSession = Depends(get_db)):
    """Update an existing goal."""
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

@router.delete("/api/goals/{goal_id}", tags=["Goals"])
async def delete_goal(goal_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a goal."""
    goals_service = GoalsService(db)
    success = await goals_service.delete_goal(goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": f"Goal {goal_id} deleted"}

@router.get("/api/goals/{goal_id}/checkins", tags=["Check-ins"])
async def list_checkins(goal_id: str, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """List all check-ins for a specific goal."""
    goals_service = GoalsService(db)
    checkins = await goals_service.get_goal_checkins(goal_id)
    
    # Log check-in history view
    _opik.log_span(TraceNames.CHECKIN_LIST,
        output={
            "goal_id": goal_id,
            "count_returned": len(checkins)
        },
        input={"user_id": userId, "goal_id": goal_id})
    
    return {"checkins": checkins}

@router.post("/api/goals/{goal_id}/checkins", tags=["Check-ins"])
async def create_checkin(goal_id: str, request: CreateCheckinRequest, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """
    Create a check-in for a goal.
    
    - **progress**: YES, NO, or PARTIAL
    - **mood**: GREAT, OKAY, or LOW
    - **response**: Free text describing what was done
    """
    # Thread ID groups all check-ins for the same goal
    thread_id = f"checkin-{userId}-{goal_id}"
    
    with _opik.trace_context(
        TraceNames.CHECKIN_CREATE,
        input_data={
            "user_id": userId,
            "goal_id": goal_id,
            "progress": request.progress,
            "mood": request.mood,
            "response_length": len(request.response) if request.response else 0
        },
        thread_id=thread_id
    ) as trace:
        goals_service = GoalsService(db)
        checkin = await goals_service.create_checkin(
            goal_id=goal_id,
            user_id=userId,
            progress=request.progress,
            mood=request.mood,
            response=request.response
        )
        
        trace.set_output({
            "checkin_id": str(checkin.id),
            "created_at": checkin.created_at.isoformat() if checkin.created_at else None,
            "success": True
        })
    
    return {
        "id": checkin.id,
        "goal_id": checkin.goal_id,
        "user_id": checkin.user_id,
        "progress": checkin.progress,
        "mood": checkin.mood,
        "response": checkin.response,
        "created_at": checkin.created_at.isoformat() if checkin.created_at else None
    }

@router.get("/api/checkins/recent", tags=["Check-ins"])
async def get_recent_checkins(userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """Get the most recent check-ins for a user (for dashboard feed)."""
    goals_service = GoalsService(db)
    checkins = await goals_service.get_user_recent_checkins(userId)
    
    # Calculate summary metrics for Opik
    goals_touched = len(set(c.goal_id for c in checkins))
    
    # Log check-in summary view
    _opik.log_span(TraceNames.CHECKIN_SUMMARY,
        output={
            "total_checkins": len(checkins),
            "goals_touched": goals_touched
        },
        input={"user_id": userId})
    
    return {
        "checkins": [
            {
                "id": c.id,
                "goalId": c.goal_id,
                "goalTitle": c.goal.title if c.goal else "Unknown Goal",
                "goalCategory": c.goal.category if c.goal else "productivity",
                "progress": c.progress,
                "mood": c.mood,
                "response": c.response,
                "date": c.created_at.isoformat() if c.created_at else None
            }
            for c in checkins
        ]
    }


@router.get("/api/insights/motivation", tags=["Insights"])
async def get_motivation_insight(userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """
    Get comprehensive motivation insights for the Insights page.
    
    Returns:
    - Human-friendly presentation layer (micro_label, motivation_label, message)
    - Motivation breakdown (consistency vs vibe)
    - Motivation history (last 7 days)
    - AI message quality scores (from LLM-as-judge)
    - At-risk snapshot (conditional display)
    
    All traces linked under thread_id: motivation-{userId}
    """
    goals_service = GoalsService(db)
    
    # --- Calculate motivation ---
    motivation_data = await goals_service.calculate_motivation_level(userId)
    score = motivation_data["score"]
    
    # Save snapshot for historical tracking
    await goals_service.save_motivation_snapshot(
        user_id=userId,
        score=score,
        consistency_score=motivation_data.get("consistency_score"),
        vibe_score=motivation_data.get("vibe_score")
    )
    
    # Get motivation history for trend
    motivation_history = await goals_service.get_motivation_history(userId, days=7)
    
    # --- Generate AI message ---
    message = await goals_service.generate_motivation_hook(userId, motivation_data)
    
    # --- At-risk snapshot ---
    recent_checkin_count = await goals_service.get_recent_checkin_count(userId, days=7)
    at_risk = await goals_service.compute_at_risk_snapshot(
        user_id=userId,
        motivation_data=motivation_data,
        recent_checkin_count=recent_checkin_count,
        ai_eval_encouragement=3
    )
    
    # Deterministic motivation bands 
    band_data = determine_motivation_band(score)
    motivation_band = band_data["band"]
    motivation_label = band_data["label"]
    
    # Micro-label (deterministic warmth layer)
    micro_label = get_micro_label(motivation_band)
    
    # At-risk exposure (using utils)
    risk_exposure = build_risk_exposure_data(at_risk)
    show_alert = risk_exposure["show_alert"]
    triggered_reasons = risk_exposure["triggered_reasons"]
    
    # API Response
    return {
        # UI
        "micro_label": micro_label,
        "motivation_label": motivation_label,
        "message": message,
        "show_alert": show_alert,
        "alert_explanation": at_risk["ai_explanation"] if show_alert else None,
        
        # Motivation breakdown (for insight cards)
        "motivation_breakdown": {
            "score": score,
            "consistency": motivation_data.get("consistency_score", 0),
            "vibe": motivation_data.get("vibe_score", 0)
        },
        
        # Motivation history (for sparkline)
        "motivation_history": motivation_history,
        
        # Message quality (AI eval panel)
        "message_quality": {
            "encouragement": motivation_data.get("eval_encouragement", 3),
            "alignment": motivation_data.get("eval_alignment", 3),
            "clarity": motivation_data.get("eval_clarity", 3),
            "average": motivation_data.get("eval_average", 3.0)
        },
        
        # At-risk data (conditional display)
        "at_risk": {
            "level": at_risk["risk_level"],
            "confidence": at_risk["confidence"],
            "reasons": triggered_reasons
        },
        
        # Debug layer (for Opik, developers)
        "_debug": {
            "level": score,
            "motivation_band": motivation_band,
            "raw_consistency": motivation_data.get("consistency_score"),
            "raw_vibe": motivation_data.get("vibe_score"),
            "at_risk_score": at_risk["risk_score"],
            "triggered_signals": at_risk["triggered_signals"],
            "thread_id": f"motivation-{userId}"
        }
    }


@router.get("/api/insights/goals/{goal_id}", tags=["Insights"])
async def get_goal_motivation_insight(goal_id: str, userId: str = "neo", db: AsyncSession = Depends(get_db)):
    """
    Get motivation insights for a SINGLE goal.
    On-demand computation.
    """
    goals_service = GoalsService(db)
    
    # Get Goal details
    goal = await goals_service.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    # --- Calculate motivation ---
    motivation_data = await goals_service.calculate_goal_motivation_level(userId, goal_id)
    score = motivation_data["score"]
    
    # Save snapshot
    await goals_service.save_motivation_snapshot(
        user_id=userId,
        score=score,
        consistency_score=motivation_data.get("consistency_score"),
        vibe_score=motivation_data.get("vibe_score"),
        goal_id=goal_id
    )
    
    # Get history
    motivation_history = await goals_service.get_motivation_history(user_id=userId, days=7, goal_id=goal_id)
    
    # --- Generate AI message (On-Demand) ---
    message = await goals_service.generate_goal_motivation_hook(
        user_id=userId, goal_id=goal_id, goal_title=goal.title, motivation_data=motivation_data
    )
    
    # --- At-risk snapshot ---
    recent_checkin_count = await goals_service.get_goal_recent_checkin_count(user_id=userId, goal_id=goal_id, days=7)
    
    at_risk = await goals_service.compute_at_risk_snapshot(
        user_id=userId,
        motivation_data=motivation_data,
        recent_checkin_count=recent_checkin_count,
        goal_title=goal.title,
        goal_id=goal_id
    )
    
    # Presentation Logic
    band_data = determine_motivation_band(score)
    motivation_band = band_data["band"]
    motivation_label = band_data["label"]
    micro_label = get_micro_label(motivation_band)
    
    risk_exposure = build_risk_exposure_data(at_risk)
    show_alert = risk_exposure["show_alert"]
    triggered_reasons = risk_exposure["triggered_reasons"]
    
    return {
        "goal_id": goal.id,
        "goal_title": goal.title,
        
        # UI
        "micro_label": micro_label,
        "motivation_label": motivation_label,
        "message": message,
        "show_alert": show_alert,
        "alert_explanation": at_risk["ai_explanation"] if show_alert else None,
        
        # Motivation breakdown
        "motivation_breakdown": {
            "score": score,
            "consistency": motivation_data.get("consistency_score", 0),
            "vibe": motivation_data.get("vibe_score", 0)
        },
        
        # Motivation history
        "motivation_history": motivation_history,
        
        # Message Quality
        "message_quality": {
            "encouragement": motivation_data.get("eval_encouragement", 3),
            "alignment": motivation_data.get("eval_alignment", 3),
            "clarity": motivation_data.get("eval_clarity", 3),
            "average": motivation_data.get("eval_average", 3.0)
        },
        
        # At-risk data
        "at_risk": {
            "level": at_risk["risk_level"],
            "confidence": at_risk["confidence"],
            "reasons": triggered_reasons
        },
        
        # Debug layer
        "_debug": {
            "level": score,
            "motivation_band": motivation_band,
            "raw_consistency": motivation_data.get("consistency_score"),
            "raw_vibe": motivation_data.get("vibe_score"),
            "at_risk_score": at_risk["risk_score"],
            "triggered_signals": at_risk.get("triggered_signals", {}),
            "thread_id": f"{userId}-goal-{goal.id}"
        }
    }