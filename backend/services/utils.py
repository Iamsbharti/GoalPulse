"""
Utilities for GoalsService LLM interactions and computations.

This module contains:
1. Qualitative signal conversion (numbers → human-readable states)
2. Prompt templates for message generation
3. Prompt templates for LLM-as-judge evaluation
4. Risk computation utilities
5. Validation utilities
6. Presentation utilities (bands, labels, alerts)
"""

import re


# ============================================================
# METRIC CALCULATION UTILITIES
# ============================================================

def calculate_vibe_metrics(recent_checkins: list) -> dict:
    """
    Calculate vibe score based on mood and progress of checkins.
    Reused by overall and per-goal motivation calculation.
    
    Args:
        recent_checkins: List of Checkin objects (must have .mood and .progress)
        
    Returns:
        Dict with vibe_score, vibe_summary, avg_mood, avg_progress
    """
    if not recent_checkins:
        return {
            "vibe_score": 50.0,
            "vibe_summary": "No recent activity",
            "avg_mood": 0.5,
            "avg_progress": 0.5
        }
        
    mood_map = {"GREAT": 1.0, "OKAY": 0.6, "LOW": 0.2}
    progress_map = {"YES": 1.0, "PARTIAL": 0.6, "NO": 0.2}
    
    total_mood = sum(mood_map.get(c.mood, 0.6) for c in recent_checkins)
    total_progress = sum(progress_map.get(c.progress, 0.6) for c in recent_checkins)
    count = len(recent_checkins)
    
    avg_mood = total_mood / count
    avg_progress = total_progress / count
    
    # Equal weight between mood & progress
    vibe_val = (avg_mood * 0.5) + (avg_progress * 0.5)
    vibe_score = vibe_val * 100
    
    # Simple summary for LLM
    vibe_summary = f"Avg Mood: {avg_mood:.2f}, Avg Progress: {avg_progress:.2f}"
    
    return {
        "vibe_score": vibe_score,
        "vibe_summary": vibe_summary,
        "avg_mood": avg_mood,
        "avg_progress": avg_progress
    }


# ============================================================
# MOTIVATION MESSAGE UTILITIES
# ============================================================

def convert_to_qualitative_signals(motivation_data: dict) -> dict:
    """
    Convert numbers → human-readable states BEFORE LLM.
    
    This ensures the LLM never sees raw numbers, producing more natural language.
    
    Args:
        motivation_data: Dict with score, consistency_summary, vibe_summary
        
    Returns:
        Dict with motivation_state, consistency_state, vibe_state, tone
    """
    final_score = motivation_data["score"]
    consistency_summary = motivation_data["consistency_summary"]
    vibe_summary = motivation_data["vibe_summary"]
    
    # Motivation state (deterministic bands)
    if final_score >= 80:
        motivation_state = "strong momentum"
        tone = "momentum"
    elif final_score >= 50:
        motivation_state = "steady progress"
        tone = "steady"
    else:
        motivation_state = "needs a gentle boost"
        tone = "gentle"
    
    # Consistency state (parse from summary)
    if "floor applied" in consistency_summary.lower():
        consistency_state = "inconsistent lately"
    elif "of" in consistency_summary:
        parts = consistency_summary.split("of")
        if len(parts) >= 2:
            try:
                checked = int(parts[0].strip().split()[-1])
                total = int(parts[1].strip().split()[0])
                ratio = checked / total if total > 0 else 0
                if ratio >= 0.8:
                    consistency_state = "very consistent"
                elif ratio >= 0.5:
                    consistency_state = "fairly regular"
                else:
                    consistency_state = "could use more check-ins"
            except:
                consistency_state = "making progress"
        else:
            consistency_state = "making progress"
    else:
        consistency_state = "building habits"
    
    # Vibe state (parse from summary)
    vibe_lower = vibe_summary.lower()
    if "positive" in vibe_lower or "good" in vibe_lower or "great" in vibe_lower:
        vibe_state = "positive energy"
    elif "neutral" in vibe_lower or "okay" in vibe_lower:
        vibe_state = "stable mood"
    elif "low" in vibe_lower or "struggling" in vibe_lower:
        vibe_state = "could use encouragement"
    else:
        vibe_state = "mixed feelings"
    
    return {
        "motivation_state": motivation_state,
        "consistency_state": consistency_state,
        "vibe_state": vibe_state,
        "tone": tone
    }


def build_motivation_message_prompt(
    motivation_state: str,
    consistency_state: str,
    vibe_state: str,
    tone: str
) -> str:
    """
    Language-first prompt for motivational messages.
    Role-based, no numbers, no metrics exposure.
    """
    tone_instruction = {
        "momentum": "Be energetic and hyped!",
        "steady": "Be supportive and steady.",
        "gentle": "Be gentle and empathetic."
    }.get(tone, "Be supportive.")
    
    return f"""You are a warm, encouraging motivational coach.

                User state:
                - Momentum: {motivation_state}
                - Habits: {consistency_state}
                - Energy: {vibe_state}

                Write ONE short, encouraging sentence for their daily dashboard.

                Rules:
                - No numbers or percentages
                - No statistics or metrics
                - Focus on encouragement and continuity
                - Natural, conversational tone
                - Maximum 18 words
                - End with a period, exclamation, or dash

            Tone: {tone.upper()} - {tone_instruction}"""


# ============================================================
# MOTIVATION EVALUATION PROMPTS
# ============================================================

def build_encouragement_eval_prompt(message: str, eval_context: str) -> str:
    """Prompt for evaluating encouragement quality (1-5)."""
    return f"""{eval_context}
                
Rate the ENCOURAGEMENT QUALITY (1-5):
1 = Not motivating
3 = Somewhat encouraging  
5 = Highly inspiring

Example (Score: 5):
Message: "You're building something great — keep showing up!"

Respond with ONLY a number (1-5)."""


def build_alignment_eval_prompt(message: str, eval_context: str) -> str:
    """Prompt for evaluating emotional alignment (1-5)."""
    return f"""{eval_context}

Rate the EMOTIONAL ALIGNMENT (1-5):
Does the tone match the user's state?
1 = Mismatched
3 = Somewhat aligned
5 = Perfectly aligned

Respond with ONLY a number (1-5)."""


def build_clarity_eval_prompt(message: str, eval_context: str) -> str:
    """Prompt for evaluating clarity and natural tone (1-5)."""
    return f"""{eval_context}

Rate the CLARITY and NATURAL TONE (1-5):
1 = Robotic or confusing
3 = Acceptable
5 = Sounds like a real coach

Respond with ONLY a number (1-5)."""


# ============================================================
# RISK COMPUTATION UTILITIES
# ============================================================

def compute_risk_signals(
    motivation_score: int,
    recent_checkin_count: int,
    consistency_floor_triggered: bool,
    ai_eval_encouragement: int,
    expected_weekly_checkins: int = 3
) -> dict:
    """
    Compute deterministic risk signals from input data.
    
    Returns:
        Dict with triggered_signals, risk_score, risk_level, confidence
    """
    # Deterministic signal flags
    low_motivation = motivation_score < 50
    missed_checkins = recent_checkin_count < expected_weekly_checkins
    low_message_effectiveness = ai_eval_encouragement <= 2
    
    triggered_signals = {
        "low_motivation": low_motivation,
        "missed_checkins": missed_checkins,
        "consistency_floor_triggered": consistency_floor_triggered,
        "low_message_effectiveness": low_message_effectiveness
    }
    
    # Weighted risk score (0-100)
    risk_score = (
        (1 if low_motivation else 0) * 0.35 +
        (1 if missed_checkins else 0) * 0.25 +
        (1 if consistency_floor_triggered else 0) * 0.20 +
        (1 if low_message_effectiveness else 0) * 0.20
    ) * 100
    
    # Risk level classification
    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"
    
    # Confidence = signal density
    signal_count = sum(triggered_signals.values())
    confidence = round(signal_count / len(triggered_signals), 2)
    
    return {
        "triggered_signals": triggered_signals,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "confidence": confidence
    }


def build_risk_explanation_prompt(
    risk_level: str,
    signals_text: str,
    motivation_score: int
) -> str:
    """
    Prompt for AI to explain risk level.
    AI only explains, doesn't decide.
    """
    return f"""
                Risk Level: {risk_level}
                Triggered Signals: {signals_text}
                Motivation Score: {motivation_score}%
                
                Write a short, calm explanation (1 sentence, under 25 words) describing why this user may be at risk.
                
                Rules:
                - Use the provided signals only
                - Calm, non-alarming tone
                - No recommendations or advice
                - Do not predict future failure or success
                
                Example: "Your recent check-ins have dropped and motivation is below 50%, which may indicate a need to reset expectations."
                """


def build_goal_motivation_message_prompt(
    goal_title: str,
    motivation_state: str,
    consistency_state: str,
    vibe_state: str,
    tone: str
) -> str:
    """
    Language-first prompt for Single Goal motivational messages.
    Includes goal context.
    """
    tone_instruction = {
        "momentum": "Be energetic and hyped!",
        "steady": "Be supportive and steady.",
        "gentle": "Be gentle and empathetic."
    }.get(tone, "Be supportive.")
    
    return f"""You are a warm, encouraging motivational coach.

                Goal: "{goal_title}"
                User state for this goal:
                - Momentum: {motivation_state}
                - Habits: {consistency_state}
                - Energy: {vibe_state}

                Write ONE short, encouraging sentence for this specific goal.

                Rules:
                - Mention the goal context implicitly or explicitly
                - No numbers or percentages
                - No statistics or metrics
                - Focus on encouragement and continuity
                - Natural, conversational tone
                - Maximum 20 words
                - End with a period, exclamation, or dash

            Tone: {tone.upper()} - {tone_instruction}"""


# ============================================================
# RISK EVALUATION PROMPTS
# ============================================================

def build_risk_clarity_eval_prompt(eval_context: str) -> str:
    """Prompt for evaluating risk explanation clarity (1-5)."""
    return f"""
                {eval_context}
                
                Rate the CLARITY of this risk explanation on a 1-5 scale:
                1 = Confusing or unclear
                3 = Understandable
                5 = Crystal clear and concise
                
                Example:
                Explanation: "Your check-ins have dropped this week."
                → Score: 5
                
                Respond with ONLY a number (1-5).
                """


def build_risk_actionability_eval_prompt(eval_context: str) -> str:
    """Prompt for evaluating risk explanation actionability (1-5)."""
    return f"""
                {eval_context}
                
                Rate the ACTIONABILITY of this explanation on a 1-5 scale:
                Does it hint at what the user could reflect on (without giving direct advice)?
                1 = No insight
                3 = Some insight
                5 = Clearly points to a reason the user could act on
                
                Example:
                Explanation: "Low motivation and missed check-ins suggest a reset might help."
                → Score: 4
                
                Respond with ONLY a number (1-5).
                """


# ============================================================
# VALIDATION UTILITIES
# ============================================================

def is_valid_message(msg: str) -> bool:
    """
    Validate message quality (kept for logging, not actively enforced).
    
    Checks:
    - Word count <= 20
    - No numbers
    - Proper ending punctuation
    """
    words = msg.split()
    has_numbers = bool(re.search(r'\d', msg))
    proper_ending = msg.rstrip().endswith(('.', '!', '—', '-'))
    return len(words) <= 20 and not has_numbers and proper_ending


def parse_eval_score(response: str) -> int:
    """Parse LLM evaluation response to integer score (1-5) using regex."""
    try:
        match = re.search(r"\b([1-5])\b", response.strip())
        if match:
            return int(match.group(1))
        return 3
    except:
        return 3


def format_signals_text(triggered_signals: dict) -> str:
    """Format triggered signals dict to human-readable text."""
    return ", ".join([k.replace("_", " ") for k, v in triggered_signals.items() if v])


# ============================================================
# PRESENTATION UTILITIES (BANDS, LABELS, ALERTS)
# ============================================================

def determine_motivation_band(score: int) -> dict:
    """
    Determine motivation band and label based on score.
    Returns dict with 'band' and 'label'.
    """
    if score >= 80:
        return {"band": "high_momentum", "label": "High momentum"}
    elif score >= 50:
        return {"band": "steady", "label": "Steady progress"}
    else:
        return {"band": "needs_care", "label": "Needs care"}


def get_micro_label(motivation_band: str) -> str:
    """Get warmth layer micro-label based on motivation band."""
    MICRO_LABELS = {
        "high_momentum": "You're building strong momentum",
        "steady": "You're in a good rhythm",
        "needs_care": "A gentle reset could help"
    }
    return MICRO_LABELS.get(motivation_band, "You're doing great")


def build_risk_exposure_data(at_risk_data: dict) -> dict:
    """
    Determine if alert should be shown and specific reasons.
    Returns dict with 'show_alert' and 'triggered_reasons'.
    """
    risk_level = at_risk_data["risk_level"]
    triggered_signals = at_risk_data["triggered_signals"]
    
    show_alert = risk_level != "LOW"
    
    triggered_reasons = []
    if triggered_signals.get("low_motivation"):
        triggered_reasons.append("Motivation below 50%")
    if triggered_signals.get("missed_checkins"):
        triggered_reasons.append("Missed recent check-ins")
    if triggered_signals.get("consistency_floor_triggered"):
        triggered_reasons.append("Consistency floor triggered")
    if triggered_signals.get("low_message_effectiveness"):
        triggered_reasons.append("Recent encouragement didn't land")
        
    return {
        "show_alert": show_alert,
        "triggered_reasons": triggered_reasons
    }
