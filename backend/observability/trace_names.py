"""
Centralized trace name constants for Opik observability.
Using constants ensures consistent naming across all instrumented flows.
"""


class TraceNames:
    """Trace names for all GoalPulse LLM operations."""

    # Goal Creation Flow (LangGraph)
    GOAL_CREATION = "goal-creation-flow"
    GOAL_EXTRACTION = "goal-extraction"
    GOAL_REFINEMENT = "goal-refinement"

    # Check-in Flow (Phase 2)
    CHECKIN_CREATE = "checkin-event"
    CHECKIN_LIST = "checkin-history-view"
    CHECKIN_SUMMARY = "checkin-summary"
    # Legacy names (kept for compatibility)
    CHECKIN_ANALYSIS = "checkin-analysis"
    CHECKIN_RESPONSE = "checkin-response"

    # Motivation Engine
    MOTIVATION_CALCULATION = "motivation-calculation"
    MOTIVATION_CATCHPHRASE = "motivation-catchphrase"

    # AI Messages / Chat
    AI_MESSAGE_GENERATION = "ai-message-generation"
    CHAT_COMPLETION = "chat-completion"

    # At-Risk Detection
    AT_RISK_DETECTION = "at-risk-detection"
    AT_RISK_HEURISTIC = "at-risk-heuristic"
