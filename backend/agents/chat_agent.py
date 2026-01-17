from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    messages: List[str]
    user_id: str
    goal_id: Optional[str]
    mood: Optional[str]
    intent: Optional[str]
    response: str

def classify_intent(message: str) -> str:
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["goal", "want to", "plan", "achieve", "objective"]):
        return "goal_setting"
    elif any(word in message_lower for word in ["checkin", "progress", "how am i doing", "update"]):
        return "checkin"
    elif any(word in message_lower for word in ["struggling", "hard", "difficult", "stuck", "frustrated"]):
        return "support"
    elif any(word in message_lower for word in ["done", "completed", "finished", "accomplished"]):
        return "celebration"
    else:
        return "general_chat"

async def chat_node(state: AgentState) -> AgentState:
    message = state["messages"][-1] if state["messages"] else ""
    
    intent = classify_intent(message)
    
    response = ""
    if intent == "goal_setting":
        response = "I'd love to help you set a goal! What would you like to achieve? A good goal should be specific and meaningful to you."
    elif intent == "checkin":
        response = "Let's check in on your progress. How have you been doing with your goals recently?"
    elif intent == "support":
        response = "I'm here to help. What specific challenges are you facing? Let's work through this together."
    elif intent == "celebration":
        response = "That's wonderful! Celebrating wins, big and small, is so important. What exactly did you accomplish?"
    else:
        response = "I'm here to support you on your journey. What would you like to talk about today?"
    
    return {
        **state,
        "intent": intent,
        "response": response
    }

async def coach_node(state: AgentState) -> AgentState:
    return {
        **state,
        "response": "As your accountability partner, I'm here to help you stay on track. Would you like me to remind you about your goals or help you break them into smaller steps?"
    }

def build_chat_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("chat", chat_node)
    workflow.add_node("coach", coach_node)
    workflow.set_entry_point("chat")
    workflow.add_edge("chat", END)
    workflow.add_edge("coach", END)
    return workflow.compile()

async def process_chat(user_id: str, message: str, goal_id: Optional[str] = None) -> dict:
    initial_state = AgentState(
        messages=[message],
        user_id=user_id,
        goal_id=goal_id,
        mood=None,
        intent=None,
        response=""
    )
    
    try:
        app = build_chat_graph()
        result = await app.ainvoke(initial_state)
        return {
            "response": result["response"],
            "agent": "coach",
            "intent": result["intent"]
        }
    except Exception as e:
        return {
            "response": f"I'm here to help! You said: {message}",
            "agent": "chat",
            "intent": "error"
        }
