"""
LangGraph Goal Creation Agent

A state machine for handling multi-turn goal creation conversations.
Uses LangGraph for state management and conversation flow control.

Architecture Notes:
- The graph handles ALL transitions, including continuation
- No manual node calls outside the graph
- State is minimal and focused
- Opik observability added for LLM tracing
"""

from typing import TypedDict, Optional, List, Literal
from langgraph.graph import StateGraph, END
from contextlib import asynccontextmanager
import json
import os
import re

# Opik observability
from observability import get_opik_client, TraceNames

# Initialize Opik wrapper
_opik = get_opik_client()


# ============================================================================
# STATE DEFINITION (Simplified - removed unused messages field)
# ============================================================================

class GoalDraft(TypedDict, total=False):
    """Partial goal being built through conversation."""
    title: str
    description: str
    category: str
    frequency_days: int


class GoalCreationState(TypedDict):
    """State for the goal creation conversation."""
    user_id: str
    current_input: str  # Latest user message
    goal_draft: Optional[GoalDraft]
    missing_fields: List[str]
    status: Literal["idle", "collecting", "confirming", "complete", "cancelled"]
    response: str  # AI response to return
    entry_point: str  # Which node to start from ("detect_intent", "parse_answer", "handle_confirmation")


# ============================================================================
# LLM HELPER
# ============================================================================

def get_llm():
    """Get the LLM client based on environment."""
    from langchain_ollama import ChatOllama
    from langchain_openai import ChatOpenAI
    
    app_env = os.getenv("APP_ENV", "local")
    
    if app_env == "production":
        api_key = os.getenv("OPENAI_API_KEY")
        return ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
    else:
        return ChatOllama(model="minimax-m2:cloud", base_url="http://localhost:11434")


async def llm_generate(prompt: str) -> str:
    """Generate a response from the LLM."""
    llm = get_llm()
    try:
        response = await llm.ainvoke(prompt)
        return response.content
    except Exception as e:
        print(f"LLM Error: {e}")
        return f"Error: {str(e)}"


def extract_json(response: str) -> dict:
    """Extract JSON from LLM response."""
    response = response.strip()
    
    # Try direct parse
    try:
        return json.loads(response)
    except:
        pass
    
    # Try to find JSON in response
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except:
            pass
    
    return {}


def parse_frequency(text: str) -> int:
    """Robustly parse frequency from text. Fix #4: Harden frequency parsing."""
    text = text.lower().strip()
    
    # Try to find a number
    match = re.search(r"\d+", text)
    if match:
        freq = int(match.group())
        return max(1, min(7, freq))
    
    # Check for keywords
    if "daily" in text or "every day" in text:
        return 1
    elif "weekly" in text or "once a week" in text:
        return 7
    elif "other day" in text:
        return 2
    
    # Default
    return 3


# ============================================================================
# NODE FUNCTIONS
# ============================================================================

async def detect_intent(state: GoalCreationState) -> GoalCreationState:
    """
    Node 1: Detect if the user wants to create a goal.
    Uses LLM for ALL messages - no keyword filtering.
    """
    user_input = state["current_input"].strip()
    
    print(f"DEBUG - detect_intent: analyzing '{user_input}'")
    
    # Skip very short greetings/noise
    if len(user_input) < 2:
        _opik.log_span("detect_intent", 
            output={"user_input": user_input, "intent_detected": False, "reason": "input_too_short"},
            input={"user_input": user_input})
        return {
            **state,
            "status": "idle",
            "response": ""
        }
    
    # LLM-based intent classification
    prompt = f"""You are a goal intent classifier. Analyze if this message expresses intent to create, set, or work on a personal goal, habit, or resolution.

USER MESSAGE: "{user_input}"

CLASSIFICATION RULES:
1. Return YES if the user is describing something they want to DO regularly or ACHIEVE
2. Return YES if it's an activity, habit, or target (even without explicit "I want to")
3. Return NO if it's a question about the app, greeting, or unrelated chat

EXAMPLES:
- "exercise" -> YES (wants to exercise as a goal)
- "read more books" -> YES (reading habit)
- "run 5k" -> YES (fitness target)
- "save $500 monthly" -> YES (financial goal)
- "exercise 4 times a week" -> YES (specific goal)
- "hello" -> NO (greeting)
- "how does this app work?" -> NO (question)
- "what are my goals?" -> NO (asking about existing)

RESPOND WITH ONLY: YES or NO"""

    response = await llm_generate(prompt)
    response_clean = response.strip().upper()
    
    print(f"DEBUG - detect_intent: LLM said '{response_clean}'")
    
    has_intent = "YES" in response_clean
    
    _opik.log_span("detect_intent", 
        output={"user_input": user_input, "intent_detected": has_intent},
        input={"user_input": user_input, "llm_response": response_clean})
    
    if has_intent:
        return {
            **state,
            "status": "collecting"
        }
    else:
        return {
            **state,
            "status": "idle",
            "response": ""
        }


async def extract_goal(state: GoalCreationState) -> GoalCreationState:
    """
    Node 2: Extract goal details from user message.
    """
    prompt = f"""Extract goal details from this message. Fill in what you can, leave others empty.

Message: "{state['current_input']}"

Return ONLY this JSON:
{{
    "title": "short goal title (max 8 words)",
    "description": "1-2 sentence description",
    "category": "health|productivity|finance|learning|personal",
    "frequency_days": number between 1-7 (how often to check in)
}}

If you can't determine a field, use:
- title: empty string
- description: empty string  
- category: "personal"
- frequency_days: 0
"""
    
    response = await llm_generate(prompt)
    draft = extract_json(response)
    
    # Validate and clean
    goal_draft: GoalDraft = {
        "title": draft.get("title", "").strip(),
        "description": draft.get("description", "").strip(),
        "category": draft.get("category", "personal"),
        "frequency_days": parse_frequency(str(draft.get("frequency_days", 0)))
    }
    
    # Validate category
    valid_categories = ["health", "productivity", "finance", "learning", "personal"]
    if goal_draft["category"] not in valid_categories:
        goal_draft["category"] = "personal"
    
    _opik.log_span("extract_goal", 
        output={
            "extracted_title": goal_draft["title"],
            "extracted_category": goal_draft["category"],
            "extracted_frequency": goal_draft["frequency_days"]
        },
        input={"user_input": state['current_input']})
    
    return {
        **state,
        "goal_draft": goal_draft
    }


async def check_completeness(state: GoalCreationState) -> GoalCreationState:
    """
    Node 3: Check what fields are missing from the goal draft.
    Fix #3: Add confidence gate for generic goals (single word titles).
    """
    draft = state.get("goal_draft", {}) or {}
    missing = []
    
    title = draft.get("title", "")
    
    # Fix #3: Confidence gate - if title is too generic (1 word), ask for clarification
    if not title or len(title) < 3:
        missing.append("title")
    elif len(title.split()) <= 1:
        # Single word title - too vague, ask for more detail
        missing.append("title")
        draft["title"] = ""  # Reset to force clarification
    
    # Frequency is required
    if not draft.get("frequency_days") or draft.get("frequency_days", 0) < 1:
        missing.append("frequency")
    
    # Description is optional but auto-generate if missing and we have a good title
    if not draft.get("description") and draft.get("title") and len(draft.get("title", "").split()) > 1:
        prompt = f"Write a 1-sentence motivating description for this goal: {draft['title']}. No emojis."
        desc = await llm_generate(prompt)
        draft["description"] = desc.strip()[:200]
    
    status = "collecting" if missing else "confirming"
    
    _opik.log_span("check_completeness", 
        output={
            "missing_fields": missing,
            "confidence_gate_triggered": "title" in missing and len(title.split()) <= 1,
            "status": status
        },
        input={"title": title, "frequency_days": draft.get("frequency_days", 0)})
    
    return {
        **state,
        "goal_draft": draft,
        "missing_fields": missing,
        "status": status
    }


async def ask_clarification(state: GoalCreationState) -> GoalCreationState:
    """
    Node 4: Ask for missing information.
    """
    missing = state.get("missing_fields", [])
    draft = state.get("goal_draft", {}) or {}
    
    if "title" in missing:
        # Check if we have a vague hint
        original_input = state.get("current_input", "")
        question = f"I'd love to help you with that! Could you be more specific about what '{original_input}' means to you? For example: 'Run 3 times a week' or 'Read for 30 minutes daily'."
    elif "frequency" in missing:
        title = draft.get("title", "this goal")
        question = f"Great goal: '{title}'! How often would you like to check in - daily, every few days, or weekly?"
    else:
        question = "Could you tell me a bit more about this goal?"
    
    clarification_reason = "title" if "title" in missing else ("frequency" if "frequency" in missing else "general")
    _opik.log_span("ask_clarification", 
        output={
            "clarification_reason": clarification_reason,
            "question_text": question
        },
        input={"missing_fields": missing, "current_draft_title": draft.get("title", "")})
    
    return {
        **state,
        "response": question
    }


async def parse_answer(state: GoalCreationState) -> GoalCreationState:
    """
    Node 5: Parse user's answer and update the goal draft.
    """
    user_input = state["current_input"]
    draft = state.get("goal_draft", {}) or {}
    missing = state.get("missing_fields", [])
    
    # Check for cancellation
    cancel_words = ["cancel", "never mind", "stop", "forget it", "quit", "no"]
    if any(word in user_input.lower() for word in cancel_words):
        return {
            **state,
            "status": "cancelled",
            "response": "No problem! Goal creation cancelled. What else can I help you with?"
        }
    
    # Parse based on what's missing
    if "title" in missing:
        prompt = f"""The user is clarifying their goal. Extract a clear, specific goal title.

User said: "{user_input}"

Return ONLY the goal title (3-8 words), nothing else."""
        title = await llm_generate(prompt)
        draft["title"] = title.strip().strip('"').strip("'")[:100]
        updated_field = "title"
        
    elif "frequency" in missing:
        draft["frequency_days"] = parse_frequency(user_input)
        updated_field = "frequency"
    else:
        updated_field = None
    
    _opik.log_span("parse_answer", 
        output={
            "user_reply": user_input,
            "updated_fields": updated_field
        },
        input={"user_input": user_input, "missing_fields": missing})
    
    return {
        **state,
        "goal_draft": draft
    }


async def confirm_goal(state: GoalCreationState) -> GoalCreationState:
    """
    Node 6: Show goal preview and ask for confirmation.
    Fix #5: Consistent tone - no emojis.
    """
    draft = state.get("goal_draft", {}) or {}
    
    freq = draft.get("frequency_days", 3)
    freq_text = "daily" if freq == 1 else f"every {freq} days" if freq < 7 else "weekly"
    
    # Clean multiline markdown preview (no emojis for consistency)
    preview = f"""Here's what I understood:

**Goal:** {draft.get('title', 'Untitled Goal')}

**Description:** {draft.get('description', 'No description')}

**Category:** {draft.get('category', 'personal').title()}

**Check-in Frequency:** {freq_text}

---

Does this look right? Say **yes** to create, **edit** to change, or **cancel** to stop."""
    
    _opik.log_span("confirm_goal", 
        output={
            "preview_title": draft.get('title', 'Untitled Goal'),
            "preview_frequency": freq_text
        },
        input={"draft": draft})
    
    return {
        **state,
        "status": "confirming",
        "response": preview
    }


async def handle_confirmation(state: GoalCreationState) -> GoalCreationState:
    """
    Node 7: Handle user's confirmation response.
    """
    user_input = state["current_input"].lower()
    
    confirm_words = ["yes", "yeah", "yep", "sure", "ok", "okay", "create", "save", "looks good", "correct", "right", "confirm"]
    cancel_words = ["no", "cancel", "stop", "never mind", "forget"]
    edit_words = ["edit", "change", "modify", "update", "fix"]
    
    # Determine decision
    if any(word in user_input for word in confirm_words):
        decision = "confirm"
        result = {**state, "status": "complete"}
    elif any(word in user_input for word in cancel_words):
        decision = "cancel"
        result = {**state, "status": "cancelled", "response": "No problem! Goal creation cancelled. What else can I help you with?"}
    elif any(word in user_input for word in edit_words):
        decision = "edit"
        result = {**state, "status": "collecting", "missing_fields": ["title"], "response": "Sure! What would you like to change about this goal?"}
    else:
        decision = "unclear"
        result = {**state, "response": "I didn't quite catch that. Would you like me to create this goal? (yes/no/edit)"}
    
    _opik.log_span("handle_confirmation", 
        output={
            "user_input": user_input,
            "decision": decision
        },
        input={"user_input": user_input})
    
    return result


async def create_goal(state: GoalCreationState) -> GoalCreationState:
    """
    Node 8: Create the goal in the database.
    """
    from services.goals_service import GoalsService
    from models.database import AsyncSessionLocal
    
    draft = state.get("goal_draft", {}) or {}
    user_id = state["user_id"]
    
    try:
        async with AsyncSessionLocal() as session:
            goals_service = GoalsService(session)
            goal = await goals_service.create_goal(
                user_id=user_id,
                title=draft.get("title", "Untitled Goal"),
                description=draft.get("description", ""),
                category=draft.get("category", "personal")
            )
        
        freq = draft.get('frequency_days', 3)
        freq_text = "tomorrow" if freq == 1 else f"in {freq} days"
        
        # Clean success message (no emojis)
        response = f"Goal created: **{goal.title}**\n\nI'll check in with you {freq_text}. You've got this!"
        
        _opik.log_span("create_goal", 
            output={
                "goal_id": str(goal.id),
                "title": goal.title,
                "category": goal.category,
                "success": True
            },
            input={"draft_title": draft.get("title", "Unknown"), "user_id": user_id})
        
        return {
            **state,
            "status": "complete",
            "response": response
        }
    except Exception as e:
        print(f"Error creating goal: {e}")
        
        _opik.log_span("create_goal", 
            output={
                "title": draft.get("title", "Unknown"),
                "error": str(e),
                "success": False
            },
            input={"draft_title": draft.get("title", "Unknown"), "user_id": user_id})
        
        return {
            **state,
            "status": "cancelled",
            "response": "I had trouble saving that goal. Please try again."
        }


# ============================================================================
# ROUTING FUNCTIONS
# ============================================================================

def route_entry(state: GoalCreationState) -> str:
    """Route to the correct entry point based on state."""
    entry = state.get("entry_point", "detect_intent")
    print(f"DEBUG - route_entry: {entry}")
    return entry


def route_after_intent(state: GoalCreationState) -> str:
    """Route after intent detection."""
    if state.get("status") == "collecting":
        return "extract_goal"
    return END


def route_after_completeness(state: GoalCreationState) -> str:
    """Route after checking completeness."""
    if state.get("missing_fields"):
        return "ask_clarification"
    return "confirm_goal"


def route_after_confirmation(state: GoalCreationState) -> str:
    """Route after handling confirmation."""
    status = state.get("status")
    if status == "complete":
        return "create_goal"
    elif status == "collecting":
        return "ask_clarification"
    return END


# ============================================================================
# GRAPH BUILDER (Fix #1: Unified graph handles all transitions)
# ============================================================================

def build_goal_creation_graph() -> StateGraph:
    """
    Build the goal creation state graph.
    
    The graph handles ALL transitions including:
    - New conversations (via detect_intent)
    - Continuing from clarification (via parse_answer)
    - Continuing from confirmation (via handle_confirmation)
    """
    
    graph = StateGraph(GoalCreationState)
    
    # Entry router node
    graph.add_node("router", lambda x: x)  # Pass-through
    
    # Main nodes
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("extract_goal", extract_goal)
    graph.add_node("check_completeness", check_completeness)
    graph.add_node("ask_clarification", ask_clarification)
    graph.add_node("parse_answer", parse_answer)
    graph.add_node("confirm_goal", confirm_goal)
    graph.add_node("handle_confirmation", handle_confirmation)
    graph.add_node("create_goal", create_goal)
    
    # Entry point routes to the appropriate node based on entry_point field
    graph.set_entry_point("router")
    
    graph.add_conditional_edges(
        "router",
        route_entry,
        {
            "detect_intent": "detect_intent",
            "parse_answer": "parse_answer",
            "handle_confirmation": "handle_confirmation"
        }
    )
    
    # Intent detection flow
    graph.add_conditional_edges(
        "detect_intent",
        route_after_intent,
        {
            "extract_goal": "extract_goal",
            END: END
        }
    )
    
    graph.add_edge("extract_goal", "check_completeness")
    
    # Completeness check flow
    graph.add_conditional_edges(
        "check_completeness",
        route_after_completeness,
        {
            "ask_clarification": "ask_clarification",
            "confirm_goal": "confirm_goal"
        }
    )
    
    # Clarification and confirmation pause for user input
    graph.add_edge("ask_clarification", END)
    graph.add_edge("confirm_goal", END)
    
    # Parse answer continues to completeness check
    graph.add_edge("parse_answer", "check_completeness")
    
    # Confirmation handling
    graph.add_conditional_edges(
        "handle_confirmation",
        route_after_confirmation,
        {
            "create_goal": "create_goal",
            "ask_clarification": "ask_clarification",
            END: END
        }
    )
    
    graph.add_edge("create_goal", END)
    
    return graph.compile()


# ============================================================================
# AGENT CLASS (Fix #1: Let LangGraph handle continuation)
# ============================================================================

class GoalCreationAgent:
    """
    High-level interface for the goal creation agent.
    
    Fix #1: The graph now handles ALL transitions.
    No manual node calls - we just set entry_point and invoke.
    """
    
    def __init__(self):
        self.graph = build_goal_creation_graph()
        self._sessions: dict[str, GoalCreationState] = {}
    
    def _get_session(self, user_id: str) -> Optional[GoalCreationState]:
        return self._sessions.get(user_id)
    
    def _save_session(self, user_id: str, state: GoalCreationState):
        self._sessions[user_id] = state
    
    def _clear_session(self, user_id: str):
        if user_id in self._sessions:
            del self._sessions[user_id]
    
    async def process_message(self, user_id: str, message: str) -> dict:
        """
        Process a user message through the goal creation flow.
        
        Fix #1: All flows go through graph.ainvoke()
        Observability: Wrapped with Opik trace_context for explicit nesting.
        Thread ID links all traces from the same goal creation conversation.
        """
        import uuid
        
        existing_session = self._get_session(user_id)
        is_new_session = not (existing_session and existing_session.get("status") in ["collecting", "confirming"])
        entry_point = "detect_intent" if is_new_session else (
            "handle_confirmation" if existing_session.get("status") == "confirming" else "parse_answer"
        )
        
        # Generate or reuse thread_id to link traces from same conversation
        if is_new_session:
            thread_id = f"goal-{user_id}-{uuid.uuid4().hex[:8]}"
        else:
            # Reuse thread_id from existing session
            thread_id = existing_session.get("thread_id", f"goal-{user_id}-unknown")
        
        # Wrap execution with Opik trace for proper span nesting
        with _opik.trace_context(
            TraceNames.GOAL_CREATION,
            input_data={
                "user_id": user_id,
                "message": message[:100],  # Truncate for readability
                "entry_point": entry_point,
                "is_new_session": is_new_session
            },
            thread_id=thread_id  # Links related traces together
        ) as trace:
            # Execute the flow inside trace context
            if is_new_session:
                result = await self._start_conversation(user_id, message, thread_id)
            else:
                result = await self._continue_conversation(user_id, message, existing_session)
            
            # Set trace output (missing_fields is at top level of state, not in goal_draft)
            trace.set_output({
                "status": result.get("status"),
                "goal_created": result.get("goal_created", False),
                "has_goal_intent": result.get("has_goal_intent", False)
            })
        
        return result
    
    async def _start_conversation(self, user_id: str, message: str, thread_id: str) -> dict:
        """Start a new goal creation conversation."""
        initial_state: GoalCreationState = {
            "user_id": user_id,
            "current_input": message,
            "goal_draft": None,
            "missing_fields": [],
            "status": "idle",
            "response": "",
            "entry_point": "detect_intent"  # Start with intent detection
        }
        
        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)
        
        return self._handle_result(user_id, final_state, thread_id)
    
    async def _continue_conversation(self, user_id: str, message: str, session: GoalCreationState) -> dict:
        """
        Continue an existing goal creation conversation.
        
        Fix #1: We just set entry_point and let the graph handle everything.
        """
        # Determine entry point based on current status
        if session.get("status") == "confirming":
            entry_point = "handle_confirmation"
        else:  # collecting
            entry_point = "parse_answer"
        
        # Update state with new message and entry point
        updated_state: GoalCreationState = {
            **session,
            "current_input": message,
            "entry_point": entry_point
        }
        
        # Let the graph handle the entire flow
        final_state = await self.graph.ainvoke(updated_state)
        
        # Pass thread_id from session to _handle_result
        thread_id = session.get("thread_id")
        return self._handle_result(user_id, final_state, thread_id)
    
    def _handle_result(self, user_id: str, final_state: GoalCreationState, thread_id: str = None) -> dict:
        """Process the final state and update session."""
        status = final_state.get("status", "idle")
        
        # Clear session on completion or cancellation
        if status in ["complete", "cancelled", "idle"]:
            self._clear_session(user_id)
        else:
            # Save session for mid-flow states, including thread_id for trace linking
            session_to_save = {**final_state}
            if thread_id:
                session_to_save["thread_id"] = thread_id
            self._save_session(user_id, session_to_save)
        
        return {
            "has_goal_intent": status != "idle",
            "response": final_state.get("response", ""),
            "goal_created": status == "complete",
            "status": status,
            "goal_draft": final_state.get("goal_draft")
        }


# Global agent instance
goal_creation_agent = GoalCreationAgent()
