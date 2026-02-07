"""
Goal Coaching Agent (Pulse AI Coach)

An interactive AI coach that helps users reflect, check in, and recover when a specific goal is at risk.
Uses LangGraph for state management and Opik for observability.

Architecture:
- Deterministic Context Loading
- LLM as Guide/Explainer (not decider)
- One Session = One Thread
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig
from services.utils import (
    determine_motivation_band
)
from services.llm_service import llm_service
from services.goals_service import GoalsService
from observability import get_opik_client, TraceNames
import json
import logging

# Initialize Opik
_opik = get_opik_client()
logger = logging.getLogger(__name__)

# ============================================================================
# STATE DEFINITIONS
# ============================================================================

class CoachingContext(TypedDict):
    """Deterministic context loaded from DB."""
    goal_title: str
    goal_frequency: int
    risk_level: str  # LOW, MEDIUM, HIGH
    triggered_signals: List[str]
    recent_checkins: List[Dict[str, Any]]
    motivation_score: float
    motivation_label: str
    polarity: Literal["positive", "negative"]

class CoachingState(TypedDict):
    """State for the coaching conversation."""
    user_id: str
    goal_id: str
    messages: List[Dict[str, str]]  # Chat history
    current_input: str   # Latest user message
    
    # Context (Loaded deterministically)
    context: Optional[CoachingContext]
    
    # AI Logic
    intent: Optional[str]
    response: Optional[str]
    
    # Check-in Data (if intent is checkin)
    checkin_data: Optional[Dict[str, Any]] # {progress: ..., mood: ...}

    # Add: Temp store for action before confirmation
    pending_checkin: Optional[Dict[str, Any]]  

# ============================================================================
# NODES
# ============================================================================

async def load_context(state: CoachingState, config: RunnableConfig) -> CoachingState:
    """
    Fetch all deterministic context before the LLM speaks.
    # opik_trace: coach-context-load
    """
    user_id = state["user_id"]
    goal_id = state["goal_id"]
    db = config["configurable"]["db"]
    goals_service = GoalsService(db)

    # Fetch Goal
    goal = await goals_service.get_goal(goal_id)
    if not goal:
        return {**state, "response": "Goal not found."}

    # Fetch Motivation & Risk
    # Node: calculate_goal_motivation_level returns a DICT
    motivation_data = await goals_service.calculate_goal_motivation_level(user_id, goal_id)
    motivation_score = motivation_data.get("score", 0) # Extract the score
    
    # Fetch recent checkins
    checkins = await goals_service.get_goal_checkins(goal_id, limit=3)
    checkins_data = [
        {"date": c.created_at.isoformat(), "progress": c.response} # Simplified for context
        for c in checkins
    ]

    # Compute Risk Snapshot
    # For MVP of this node, let's trust the motivation score and checkins.
    # We will compute risk level based on motivation score for now.
    
    # infer polarity of the goal
    if not hasattr(goal, 'polarity'):
        polarity_prompt = f"""
        Classify the goal "{goal.title}" as:
        - "positive" if it's about building/doing more (e.g., exercise, read).
        - "negative" if it's about reducing/avoiding (e.g., quit smoking, eat less junk).
        Respond with ONLY "positive" or "negative".
        """
        polarity = await llm_service.generate(polarity_prompt)
    print("polarity::",polarity)

    context: CoachingContext = {
        "goal_title": goal.title,
        "goal_frequency": 3, # Default or from goal (if DB has it)
        "risk_level": "LOW", # Placeholder until fully calculated
        "triggered_signals": [],
        "recent_checkins": checkins_data,
        "motivation_score": motivation_score,
        "motivation_label": determine_motivation_band(motivation_score)["label"],
        "polarity": polarity,
    }
    # If motivation is low, mark as High Risk
    if motivation_score < 40:
        context["risk_level"] = "HIGH"
        context["triggered_signals"] = ["low_motivation"]
        
    elif motivation_score < 70:
        context["risk_level"] = "MEDIUM"
        context["triggered_signals"] = ["declining_motivation"]
        
    print("context::",context)
    return {**state, "context": context}


async def generate_opening_question(state: CoachingState) -> CoachingState:
    """
    Ask ONE reflective, non-advisory question grounded in risk signals.
    # opik_trace: coach-open-question
    """
    context = state["context"]
    prompt = f"""
    You are a supportive, calm accountability coach.
    Goal: "{context['goal_title']}"
    Risk Level: {context['risk_level']}
    Motivation Score: {context['motivation_score']}
    
    Ask EXACTLY ONE reflective question to help the user explore why they might be stuck or how they are feeling.
    Do NOT give advice. Do NOT suggest solutions yet.
    Keep it under 20 words.
    """
    
    question = await llm_service.generate(prompt)
    return {**state, "response": question}


async def detect_intent(state: CoachingState) -> CoachingState:
    """
    Classify the user's reply to determine the coaching path.
    # opik_trace: coach-intent-detection
    """
    user_message = state["current_input"]
    
    prompt = f"""
    You are an intent classifier for a goal coaching assistant.

    Your job is to classify the user's message into ONE of the categories below.

    User message:
    "{user_message}"

    Context:
    - This is a coaching conversation about a specific goal.
    - Do NOT assume actions were completed unless the user clearly says so.
    - Future plans or intentions are NOT completed actions.

    Previous Conversation:
    {state.get("messages", [])[-6:] if state.get("messages") else "No history"}

    (Note: treat the above history as context for the current user message)

    INTENT CATEGORIES (choose exactly one):

    1. emotional_venting
    - User expresses feelings, emotions, frustration, tiredness, or stress
    - Examples:
        - "I feel sleepy"
        - "I'm overwhelmed"
        - "This feels hard"

    2. wants_advice
    - User asks what to do next, for suggestions, OR for feedback/status
    - Examples:
        - "What should I do?"
        - "Any tips?"
        - "How can I start?"
        - "How am I doing?"

    3. future_commitment
    - User says they plan or intend to act later
    - NO action has happened yet
    - Examples:
        - "I will start today"
        - "I'll try this"
        - "Okay, I'll do that"

    4. completed_action
    - User clearly states they already did the action
    - Examples:
        - "I read for 10 minutes"
        - "I finished the chapter"
        - "I did it today"

    5. wants_checkin
    - User explicitly asks to log or record progress
    - Examples:
        - "Log this as a check-in"
        - "Mark this as done"
        - "Can you save this?"

    6. end_session
    - User wants to end or wrap up the coaching session
    - Examples:
        - "Thanks, that's all"
        - "I'm done for now"
        - "Let's stop here"

    7. wants_followup
    - User asks the coach to check back later
    - No action has been completed yet
    - Examples:
        - "Check with me later"
        - "Remind me"
        - "Ask me again later"


    CLASSIFICATION RULES:
    - If the message sounds positive but describes future intent -> future_commitment
    - Do NOT infer completed_action unless explicitly stated
    - Do NOT infer wants_checkin without an explicit request
    - Questions about status ("How am I doing?") -> wants_advice

    Respond with ONLY the category name.
    """
    
    intent = await llm_service.generate(prompt)
    intent = intent.strip().lower()
    
    # Fallback normalization / Validation
    valid_intents = ["emotional_venting", "wants_advice", "future_commitment", "completed_action", "wants_checkin", "end_session", "wants_followup"]
    if intent not in valid_intents:
        # Simple heuristic fallback
        if "did it" in user_message.lower() or "done" in user_message.lower():
            intent = "completed_action" 
        else:
            intent = "emotional_venting" # Default safe fallback
            
    return {**state, "intent": intent}


async def reflect_emotion(state: CoachingState) -> CoachingState:
    """
    Reflect and Normalize (No Advice).
    # opik_trace: coach-reflection
    """
    context = state["context"]
    prompt = f"""
    The user is feeling emotional/stuck about their goal "{context['goal_title']}".
    User said: "{state['current_input']}"
    
    Write a short, empathetic response validating their feeling.
    Do NOT offer a solution. Just be a mirror.
    Keep it under 30 words.
    """
    response = await llm_service.generate(prompt)
    return {**state, "response": response}


async def provide_advice(state: CoachingState) -> CoachingState:
    """
    Scoped Coach Suggestion.
    # opik_trace: coach-advice
    """
    context = state["context"]
    prompt = f"""
    The user asked for advice or status on goal "{context['goal_title']}".
    User said: "{state['current_input']}"
    Current Motivation Score: {context.get('motivation_score', 'Unknown')}
    
    If the user asked "How am I doing?" or similar:
    - Briefly answer based on their motivation score (e.g., "Your motivation is holding steady" or "It looks like you're building momentum").
    - Then suggest ONE small, actionable step they can do in 5 minutes.

    If the user asked for advice/tips:
    - Provide ONE small, actionable step they can do in 5 minutes.
    
    Use optional language ("You might try...", "Could you...").
    Keep it concise.
    """
    response = await llm_service.generate(prompt)
    return {**state, "response": response}


async def handle_checkin(state: CoachingState, config: RunnableConfig) -> CoachingState:
    """
    Chat Check-in Flow & Intent Handling.
    Handles logging check-ins, pending confirmations, and polarity-aware responses.
    # opik_trace: coach-chat-checkin
    """
    intent = state.get("intent")
    user_id = state["user_id"]
    goal_id = state["goal_id"]
    db = config["configurable"]["db"]
    goals_service = GoalsService(db)
    context = state.get("context", {})
    polarity = context.get("polarity", "positive")  # fallback
    user_input = state["current_input"].strip()

    response = ""
    pending_checkin = state.get("pending_checkin")

    # -------------------------------------------------------------------------
    # Helper: Extract or recall actual check-in data
    # -------------------------------------------------------------------------
    async def get_checkin_data() -> Dict[str, Any]:
        nonlocal pending_checkin

        # 1. If we have pending data from previous turn → use it on confirmation
        if pending_checkin and user_input.lower() in ["yes", "yes please", "sure", "please", "ok", "yep", "yeah"]:
            data = pending_checkin
            state["pending_checkin"] = None  # consume it
            return data

        # 2. Otherwise extract from current message + recent history
        history = state.get("messages", [])[-5:]  # last 5 messages give good context
        formatted_history = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history
        )

        prompt = f"""\
            Extract check-in information for the goal: "{context.get('goal_title', 'the goal')}"
            Goal polarity: {polarity} (positive = building/doing more is good; negative = avoiding/reducing is good)

            Current user message: "{user_input}"

            Recent conversation:
            {formatted_history if formatted_history else "(no recent history)"}

            Rules:
            - If current message is confirmation ("yes", "please", etc.) → use the action described in previous user message
            - For positive polarity goals: doing the thing → progress "YES", mood tends "GREAT"/"OKAY"
            - For negative polarity goals: doing the bad thing → progress "NO"/"PARTIAL", mood tends "LOW"/"OKAY"
            - response field should contain WHAT actually happened (e.g. "smoked 5 cigarettes", "read 12 pages", "skipped gym")
            - Do NOT use confirmation text like "yes please" as the response summary

            Return ONLY valid JSON:
            {{
            "progress": "YES" | "PARTIAL" | "NO",
            "mood": "GREAT" | "OKAY" | "LOW",
            "response": "short factual summary of what the user did or didn't do"
            }}
        """

        raw = await llm_service.generate(prompt)
        try:
            data = json.loads(raw.strip())
            if data.get("progress") not in ["YES", "PARTIAL", "NO"]:
                data["progress"] = "PARTIAL"
            if data.get("mood") not in ["GREAT", "OKAY", "LOW"]:
                data["mood"] = "OKAY"
            return data
        except Exception:
            # Ultimate fallback — better than saving "yes please"
            fallback_response = user_input if len(user_input) > 5 else "check-in completed"
            return {
                "progress": "YES" if polarity == "positive" else "NO",
                "mood": "OKAY",
                "response": fallback_response
            }

    # -------------------------------------------------------------------------
    # Main intent handling
    # -------------------------------------------------------------------------
    if intent == "wants_checkin":
        data = await get_checkin_data()

        try:
            await goals_service.create_checkin(
                user_id=user_id,
                goal_id=goal_id,
                progress=data["progress"],
                mood=data["mood"],
                response=data["response"]
            )
            if data["progress"] in ["YES", "PARTIAL"]:
                response = "Logged! You're making progress — let's keep the streak going."
            else:
                response = "Logged. One slip doesn't define you. Ready for the next chance?"
        except Exception as e:
            logger.error(f"Check-in save failed: {e}")
            response = "I tried to save that check-in but something went wrong. Can you try again?"

        _opik.log_span("checkin_write_decision", output={
            "decision": "written",
            "intent": intent,
            "data": data
        })

    elif "completed_action" in intent:  # positive or negative variant
        # Evaluate whether this action was actually good for the goal
        eval_prompt = f"""\
        Goal: "{context.get('goal_title')}" (polarity: {polarity})
        User said: "{user_input}"

        Did this action move the user TOWARD their goal?
        Answer ONLY with JSON:
        {{"helpful": true/false, "short_summary": "brief description"}}
        """
        try:
            eval_raw = await llm_service.generate(eval_prompt)
            eval_data = json.loads(eval_raw.strip())
            helpful = eval_data.get("helpful", True)
            summary = eval_data.get("short_summary", user_input[:60])
        except:
            helpful = polarity == "positive"  # conservative fallback
            summary = user_input[:60]

        # Store as pending
        state["pending_checkin"] = {
            "progress": "YES" if helpful else "NO",
            "mood": "GREAT" if helpful else "LOW",
            "response": summary
        }

        # Dynamic response
        if helpful:
            resp_prompt = f"""\
            You just heard the user made good progress on "{context.get('goal_title')}".
            Say something encouraging but not over-the-top.
            Then ask if they want to log it as an official check-in.
            One sentence encouragement + one question. Max 25 words.
            """
        else:
            resp_prompt = f"""\
        The user just shared a slip / non-ideal action on "{context.get('goal_title')}".
        Respond with calm empathy — no judgment, no toxic positivity.
        Then gently ask if they still want to log it.
        One validating sentence + one question. Max 25 words.
        """

        response = await llm_service.generate(resp_prompt)
        _opik.log_span("checkin_write_decision", output={
            "decision": "pending_confirmation",
            "helpful": helpful,
            "summary": summary
        })

    elif intent == "future_commitment":
        response = "Sounds like a solid plan. Want me to check in with you later today or tomorrow?"

    elif intent == "wants_followup":
        response = "Got it — I'll follow up with you soon. You've got this."

    elif intent == "end_session":
        response = "Alright, session complete. I'm proud of you for showing up. Talk soon!"

    else:
        response = "Got it. If you'd like to log a check-in or talk more, just let me know."

    return {**state, "response": response}

async def extract_checkin_data(state: CoachingState) -> Dict:
    context = state["context"]
    history = state.get("messages", [])[-4:]  # More history for better context
    formatted_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])

    prompt = f"""
    Extract check-in for goal "{context['goal_title']}" (polarity: {context['polarity']}).

    Current Input: "{state['current_input']}"
    History:
    {formatted_history}

    Rules:
    - If current is confirmation (yes/sure), use history to find the action (e.g., previous user message).
    - For negative polarity: Doing the bad thing = progress "NO"/"PARTIAL", mood "LOW".
    - For positive polarity: Doing the good thing = "YES", "GREAT".
    - Infer mood from tone.

    Output ONLY JSON: {{"progress": "YES"/"PARTIAL"/"NO", "mood": "GREAT"/"OKAY"/"LOW", "response": "short summary of action"}}
    No other text.
    """
    extraction = await llm_service.generate(prompt)
    try:
        return json.loads(extraction)
    except:
        return {"progress": "PARTIAL", "mood": "OKAY", "response": state["current_input"]}  # Better fallback: Avoid confirmation text

async def session_closure(state: CoachingState) -> CoachingState:
    """
    End the session with clarity.
    # opik_trace: coach-session-close
    """
    return state


# ============================================================================
# GRAPH CONSTRUCTION
# ============================================================================

def build_coaching_graph():
    workflow = StateGraph(CoachingState)
    
    workflow.add_node("load_context", load_context)
    workflow.add_node("generate_opening_question", generate_opening_question)
    workflow.add_node("detect_intent", detect_intent)
    workflow.add_node("reflect_emotion", reflect_emotion)
    workflow.add_node("provide_advice", provide_advice)
    workflow.add_node("handle_checkin", handle_checkin)
    
    # Conditional Edge Logic
    def route_intent(state: CoachingState):
        intent = state.get("intent")
        if intent == "emotional_venting":
            return "reflect_emotion"
        elif intent == "wants_advice":
            return "provide_advice"
        elif intent in ["wants_checkin", "completed_action", "future_commitment", "end_session", "wants_followup"]:
            return "handle_checkin"
        else:
            return "reflect_emotion" # Default to empathetic reflection/fallback
            
    # Entry Point
    workflow.set_entry_point("load_context")
    
    def route_start(state: CoachingState):
        # If user just clicked "Coach Me" (empty current_input or special signal), generate question
        if not state.get("current_input") or state.get("current_input") == "START_COACHING":
            return "generate_opening_question"
        else:
            return "detect_intent"

    workflow.add_conditional_edges(
        "load_context",
        route_start,
        {
            "generate_opening_question": "generate_opening_question",
            "detect_intent": "detect_intent"
        }
    )
    
    workflow.add_conditional_edges(
        "detect_intent",
        route_intent,
        {
            "reflect_emotion": "reflect_emotion",
            "provide_advice": "provide_advice",
            "handle_checkin": "handle_checkin"
        }
    )
    
    workflow.add_edge("generate_opening_question", END)
    workflow.add_edge("reflect_emotion", END)
    workflow.add_edge("provide_advice", END)
    workflow.add_edge("handle_checkin", END)
    
    return workflow.compile()

coaching_agent = build_coaching_graph()
