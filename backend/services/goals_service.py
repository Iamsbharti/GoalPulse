from typing import Optional, List
from sqlalchemy import select
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Goal, Checkin, User, GoalStatus
from observability import get_opik_client, TraceNames
import os
import re
from services.llm_service import LLMService
from services.utils import (
            compute_risk_signals,
            build_risk_explanation_prompt,
            build_risk_clarity_eval_prompt,
            build_risk_actionability_eval_prompt,
            format_signals_text,
            parse_eval_score
        )

# Opik client for motivation engine tracing
_opik = get_opik_client()

class GoalsService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_user_goals(self, user_id: str) -> List[Goal]:
        result = await self.session.execute(
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_goal(self, goal_id: str) -> Optional[Goal]:
        result = await self.session.execute(
            select(Goal).where(Goal.id == goal_id)
        )
        return result.scalar_one_or_none()
    
    async def create_goal(
        self,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        category: str = "productivity"
    ) -> Goal:
        goal = Goal(
            user_id=user_id,
            title=title,
            description=description,
            category=category,
            status=GoalStatus.ACTIVE
        )
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return goal
    
    async def update_goal(
        self,
        goal_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None
    ) -> Optional[Goal]:
        goal = await self.get_goal(goal_id)
        if not goal:
            return None
        
        if title is not None:
            goal.title = title
        if description is not None:
            goal.description = description
        if category is not None:
            goal.category = category
        if status is not None:
            goal.status = status
        
        await self.session.commit()
        await self.session.refresh(goal)
        return goal
    
    async def delete_goal(self, goal_id: str) -> bool:
        goal = await self.get_goal(goal_id)
        if not goal:
            return False
        
        await self.session.delete(goal)
        await self.session.commit()
        return True
    
    async def get_goal_checkins(self, goal_id: str) -> List[Checkin]:
        result = await self.session.execute(
            select(Checkin)
            .where(Checkin.goal_id == goal_id)
            .order_by(Checkin.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_user_recent_checkins(self, user_id: str, limit: int = 4) -> List[Checkin]:
        result = await self.session.execute(
            select(Checkin)
            .options(joinedload(Checkin.goal))
            .where(Checkin.user_id == user_id)
            .order_by(Checkin.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_recent_checkin_count(self, user_id: str, days: int = 7) -> int:
        """
        Get the count of check-ins within the last N days.
        
        Used by Phase 5 at-risk snapshot and dashboard metrics.
        
        Args:
            user_id: User identifier
            days: Number of days to look back (default: 7)
        """
        from sqlalchemy import func
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = await self.session.execute(
            select(func.count(Checkin.id))
            .where(Checkin.user_id == user_id)
            .where(Checkin.created_at >= cutoff_date)
        )
        return result.scalar() or 0

    async def save_motivation_snapshot(
        self, 
        user_id: str, 
        score: int, 
        consistency_score: int = None, 
        vibe_score: int = None,
        goal_id: str = None
    ) -> None:
        """
        Save a motivation snapshot for historical tracking.
        
        Called after motivation is calculated. Enables trend visualization.
        Reusable for per-goal insights when goal_id is provided.
        
        Args:
            user_id: User identifier
            score: Overall motivation score (0-100)
            consistency_score: Optional consistency component
            vibe_score: Optional vibe component
            goal_id: Optional goal ID for per-goal tracking (None = overall)
        """
        from models.database import MotivationSnapshot
        
        snapshot = MotivationSnapshot(
            user_id=user_id,
            goal_id=goal_id,
            score=score,
            consistency_score=consistency_score,
            vibe_score=vibe_score
        )
        self.session.add(snapshot)
        await self.session.commit()

    async def get_motivation_history(
        self, 
        user_id: str, 
        days: int = 7, 
        goal_id: str = None
    ) -> list:
        """
        Get motivation history for trend visualization.
        
        Returns list of {date, score, consistency, vibe} dicts.
        Reusable for per-goal history when goal_id is provided.
        
        Args:
            user_id: User identifier
            days: Number of days to look back (default: 7)
            goal_id: Optional goal ID for per-goal history (None = overall)
        """
        from models.database import MotivationSnapshot
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = (
            select(MotivationSnapshot)
            .where(MotivationSnapshot.user_id == user_id)
            .where(MotivationSnapshot.created_at >= cutoff_date)
        )
        
        # Filter by goal_id (None = overall, specific = per-goal)
        if goal_id:
            query = query.where(MotivationSnapshot.goal_id == goal_id)
        else:
            query = query.where(MotivationSnapshot.goal_id.is_(None))
        
        query = query.order_by(MotivationSnapshot.created_at.asc())
        
        result = await self.session.execute(query)
        snapshots = result.scalars().all()
        
        return [
            {
                "date": s.created_at.strftime("%Y-%m-%d"),
                "score": s.score,
                "consistency": s.consistency_score,
                "vibe": s.vibe_score
            }
            for s in snapshots
        ]

    async def get_least_active_goals(self, user_id: str, limit: int = 3) -> List[dict]:
        from sqlalchemy import func
        
        # Query: Select Goal, Count(Checkin)
        # Left Join guarantees we get goals with 0 checkins too
        result = await self.session.execute(
            select(Goal, func.count(Checkin.id).label("checkin_count"))
            .outerjoin(Checkin, Checkin.goal_id == Goal.id)
            .where(Goal.user_id == user_id, Goal.status == GoalStatus.ACTIVE)
            .group_by(Goal.id)
            .order_by(func.count(Checkin.id).asc())
            .limit(limit)
        )
        
        # Format result as list of dicts with goal + count
        rows = result.all()
        return [
            {
                "id": goal.id,
                "title": goal.title,
                "category": goal.category,
                "checkin_count": count
            }
            for goal, count in rows
        ]

    async def create_checkin(
        self,
        goal_id: str,
        user_id: str,
        progress: str,
        mood: str,
        response: str
    ) -> Checkin:
        checkin = Checkin(
            goal_id=goal_id,
            user_id=user_id,
            progress=progress,
            mood=mood,
            response=response
        )
        self.session.add(checkin)
        await self.session.commit()
        await self.session.refresh(checkin)
        return checkin

    async def calculate_motivation_level(self, user_id: str) -> dict:
        """
        Calculate motivation level with full Opik observability.
        Phase 3: Added trace and spans without changing business logic.
        """
        # Thread ID groups all motivation calculations for the same user
        thread_id = f"motivation-{user_id}"
        
        with _opik.trace_context(
            TraceNames.MOTIVATION_CALCULATION,
            input_data={"user_id": user_id},
            thread_id=thread_id
        ) as trace:
            # 1. Get Active Goals
            goals_result = await self.session.execute(
                select(Goal).where(Goal.user_id == user_id, Goal.status == GoalStatus.ACTIVE)
            )
            active_goals = goals_result.scalars().all()
            total_active_goals = len(active_goals)
            
            if total_active_goals == 0:
                result = {
                    "score": 50,
                    "consistency_score": 50,
                    "vibe_score": 50,
                    "consistency_summary": "No active goals yet",
                    "vibe_summary": "Ready to start",
                    "time_window": "N/A"
                }
                trace.set_output({"final_score": 50, "reason": "no_active_goals"})
                return result
                
            # 2. Get Recent Checkins (Last 3 days approximation)
            checkins_result = await self.session.execute(
                select(Checkin)
                .where(Checkin.user_id == user_id)
                .order_by(Checkin.created_at.desc())
                .limit(20)
            )
            recent_checkins = checkins_result.scalars().all()
            
            # 3. Calculate Consistency Score (60%)
            # Logic: Anti-Zero Shock with 0.3 floor
            checked_goal_ids = set(c.goal_id for c in recent_checkins)
            active_checked_ids = [gid for gid in checked_goal_ids if any(g.id == gid for g in active_goals)]
            
            consistency_raw = len(active_checked_ids) / total_active_goals
            consistency_floored = max(consistency_raw, 0.3)
            consistency_score = consistency_floored * 100
            
            # Span: Consistency calculation
            _opik.log_span("motivation-consistency",
                output={
                    "active_checked_goal_count": len(active_checked_ids),
                    "consistency_raw": round(consistency_raw, 3),
                    "consistency_floored": round(consistency_floored, 3),
                    "consistency_score": round(consistency_score, 2)
                },
                input={"total_active_goals": total_active_goals, "recent_checkins_count": len(recent_checkins)})
            
            # 4. Calculate Vibe Score (40%)
            # Logic: Explicit Normalize Mood + Progress
            if not recent_checkins:
                vibe_score = 50
                vibe_summary = "No recent activity"
                avg_mood = 0.5
                avg_progress = 0.5
                vibe_val = 0.5
            else:
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
            
            # Span: Vibe calculation
            _opik.log_span("motivation-vibe",
                output={
                    "avg_mood": round(avg_mood, 3),
                    "avg_progress": round(avg_progress, 3),
                    "vibe_value": round(vibe_val, 3),
                    "vibe_score": round(vibe_score, 2)
                },
                input={"checkins_analyzed": len(recent_checkins)})
                
            # Weighted Average
            final_score = (consistency_score * 0.6) + (vibe_score * 0.4)
            final_score = max(0, min(100, final_score)) # Clamp 0-100
            
            # Span: Final score aggregation
            _opik.log_span("motivation-final-score",
                output={
                    "consistency_weighted_contribution": round(consistency_score * 0.6, 2),
                    "vibe_weighted_contribution": round(vibe_score * 0.4, 2),
                    "final_score": int(final_score)
                },
                input={"consistency_score": round(consistency_score, 2), "vibe_score": round(vibe_score, 2)})
            
            # Set trace output
            trace.set_output({
                "final_score": int(final_score),
                "consistency_score": round(consistency_score, 2),
                "vibe_score": round(vibe_score, 2)
            })
            
            return {
                "score": int(final_score),
                "consistency_score": int(consistency_score),
                "vibe_score": int(vibe_score),
                "consistency_summary": f"{len(active_checked_ids)} of {total_active_goals} active goals checked in (floor applied: {consistency_raw < 0.3})",
                "vibe_summary": vibe_summary,
                "time_window": "last 3 days"
            }
        
    async def generate_motivation_hook(self, user_id: str, motivation_data: dict) -> str:
        """
        Generate AI motivational message from structured motivation signals.
        
        Refactored to use utils for cleaner separation of concerns.
        Validation logic disabled to observe raw LLM responses.
        """
        from services.utils import (
            convert_to_qualitative_signals,
            build_motivation_message_prompt,
            build_encouragement_eval_prompt,
            build_alignment_eval_prompt,
            build_clarity_eval_prompt,
            is_valid_message
        )
        
        # Separate clients for generation vs evaluation
        gen_llm = LLMService()
        judge_llm = LLMService()
        
        # Feature flag for AI evaluation
        ENABLE_AI_EVAL = os.getenv("ENABLE_AI_EVAL", "true").lower() == "true"
        
        # Convert numbers → qualitative signals
        signals = convert_to_qualitative_signals(motivation_data)
        motivation_state = signals["motivation_state"]
        consistency_state = signals["consistency_state"]
        vibe_state = signals["vibe_state"]
        tone = signals["tone"]
        
        # Thread ID for Opik
        thread_id = f"motivation-{user_id}"
        
        with _opik.trace_context(
            TraceNames.AI_MOTIVATION_MESSAGE,
            input_data={
                "user_id": user_id,
                "motivation_state": motivation_state,
                "consistency_state": consistency_state,
                "vibe_state": vibe_state,
                "selected_tone": tone
            },
            thread_id=thread_id
        ) as trace:
            
            # Build prompt using utility (from prompt_utils)
            prompt = build_motivation_message_prompt(
                motivation_state, consistency_state, vibe_state, tone
            )
            
            # Generate message
            message = await gen_llm.generate(prompt)
            message = message.strip().strip('"').strip("'")
            
            # Validation check (logged but NOT enforced - observing raw responses)
            message_valid = is_valid_message(message)
            # NOTE: Retry/cleanup logic removed to observe raw LLM output
            
            # Log generation span
            final_words = message.split()
            trace.log_span("llm-generate-message",
                input={"prompt_length": len(prompt), "tone": tone, "motivation_state": motivation_state},
                output={
                    "generated_message": message, 
                    "word_count": len(final_words), 
                    "has_numbers": bool(re.search(r'\d', message)),
                    "is_valid": message_valid
                })
            
            # Default eval scores
            encouragement_score = 0
            alignment_score = 0
            clarity_score = 0
            
            # LLM-as-Judge Evaluation
            if ENABLE_AI_EVAL:
                eval_context = f"""
                User State: {motivation_state}, {consistency_state}, {vibe_state}
                Tone: {tone}
                Generated Message: "{message}"
                """
                
                # Eval prompts from utils
                encouragement_score = parse_eval_score(
                    await judge_llm.generate(build_encouragement_eval_prompt(message, eval_context))
                )
                trace.log_span("llm-eval-encouragement",
                    input={"message": message, "tone": tone},
                    output={"score": encouragement_score})
                
                alignment_score = parse_eval_score(
                    await judge_llm.generate(build_alignment_eval_prompt(message, eval_context))
                )
                trace.log_span("llm-eval-alignment",
                    input={"message": message, "tone": tone},
                    output={"score": alignment_score})
                
                clarity_score = parse_eval_score(
                    await judge_llm.generate(build_clarity_eval_prompt(message, eval_context))
                )
                trace.log_span("llm-eval-clarity",
                    input={"message": message},
                    output={"score": clarity_score})
            
            # Calculate average
            eval_average = round((encouragement_score + alignment_score + clarity_score) / 3, 2) if ENABLE_AI_EVAL else 0
            
            # Set trace output
            trace.set_output({
                "generated_message": message,
                "message_length": len(message),
                "word_count": len(final_words),
                "is_valid": message_valid,
                "qualitative_inputs": {
                    "motivation_state": motivation_state,
                    "consistency_state": consistency_state,
                    "vibe_state": vibe_state
                },
                "eval_enabled": ENABLE_AI_EVAL,
                "eval_encouragement": encouragement_score,
                "eval_alignment": alignment_score,
                "eval_clarity": clarity_score,
                "eval_average": eval_average
            })
            
            return message

    async def compute_at_risk_snapshot(
        self, 
        user_id: str, 
        motivation_data: dict,
        recent_checkin_count: int = 0,
        ai_eval_encouragement: int = 3
    ) -> dict:
        """
        Compute at-risk snapshot using deterministic heuristics.
        
        Refactored to use utils for cleaner separation of concerns.
        
        CRITICAL: Heuristics decide risk. AI explains risk. AI does NOT decide risk.
        """
        
        # Separate clients for explanation vs evaluation
        explain_llm = LLMService()
        judge_llm = LLMService()
        
        # Feature flag for AI evaluation
        ENABLE_AI_EVAL = os.getenv("ENABLE_AI_EVAL", "true").lower() == "true"
        
        # Extract signals from Phase 3
        motivation_score = motivation_data["score"]
        consistency_summary = motivation_data["consistency_summary"]
        vibe_summary = motivation_data["vibe_summary"]
        
        # Detect if consistency floor was triggered
        consistency_floor_triggered = "floor applied: True" in consistency_summary
        
        # Compute risk using utility
        risk_data = compute_risk_signals(
            motivation_score=motivation_score,
            recent_checkin_count=recent_checkin_count,
            consistency_floor_triggered=consistency_floor_triggered,
            ai_eval_encouragement=ai_eval_encouragement
        )
        
        triggered_signals = risk_data["triggered_signals"]
        risk_score = risk_data["risk_score"]
        risk_level = risk_data["risk_level"]
        confidence = risk_data["confidence"]
        
        # Thread ID for Opik
        thread_id = f"motivation-{user_id}"
        
        with _opik.trace_context(
            TraceNames.AT_RISK_SNAPSHOT,
            input_data={
                "user_id": user_id,
                "motivation_score": motivation_score,
                "consistency_summary": consistency_summary,
                "vibe_summary": vibe_summary,
                "recent_checkin_count": recent_checkin_count,
                "ai_eval_encouragement": ai_eval_encouragement
            },
            thread_id=thread_id
        ) as trace:
            
            # Log risk computation span
            trace.log_span("risk-computation",
                input={
                    "motivation_score": motivation_score,
                    "recent_checkin_count": recent_checkin_count,
                    "ai_eval_encouragement": ai_eval_encouragement
                },
                output={
                    "risk_score": risk_score,
                    "risk_level": risk_level,
                    "triggered_signals": triggered_signals,
                    "confidence": confidence
                })
            
            # AI Risk Explanation (only explains, doesn't decide)
            ai_explanation = ""
            if risk_level != "LOW":
                signals_text = format_signals_text(triggered_signals)
                explain_prompt = build_risk_explanation_prompt(risk_level, signals_text, motivation_score)
                
                ai_explanation = await explain_llm.generate(explain_prompt)
                ai_explanation = ai_explanation.strip()
                
                # Word-count enforcement
                words = ai_explanation.split()
                if len(words) > 25:
                    ai_explanation = " ".join(words[:25])
                
                trace.log_span("ai-risk-explanation",
                    input={"signals_text": signals_text, "risk_level": risk_level},
                    output={"explanation": ai_explanation, "word_count": len(words)})
            
            # LLM-as-Judge Evaluation
            eval_clarity = 0
            eval_actionability = 0
            eval_skip_reason = None
            
            if ENABLE_AI_EVAL and ai_explanation:
                eval_context = f"""
                Risk Level: {risk_level}
                Motivation Score: {motivation_score}%
                AI Explanation: "{ai_explanation}"
                """
                
                eval_clarity = parse_eval_score(await judge_llm.generate(build_risk_clarity_eval_prompt(eval_context)))
                trace.log_span("llm-eval-clarity",
                    input={"explanation": ai_explanation},
                    output={"score": eval_clarity})
                
                eval_actionability = parse_eval_score(await judge_llm.generate(build_risk_actionability_eval_prompt(eval_context)))
                trace.log_span("llm-eval-actionability",
                    input={"explanation": ai_explanation},
                    output={"score": eval_actionability})
            elif not ai_explanation:
                eval_skip_reason = "low_risk_no_explanation"
            else:
                eval_skip_reason = "disabled_by_feature_flag"
            
            # Calculate eval average
            eval_average = round((eval_clarity + eval_actionability) / 2, 2) if ENABLE_AI_EVAL and ai_explanation else 0
            
            # Build result
            result = {
                "risk_level": risk_level,
                "risk_score": risk_score,
                "triggered_signals": triggered_signals,
                "confidence": confidence,
                "ai_explanation": ai_explanation or None,
                "eval_clarity": eval_clarity,
                "eval_actionability": eval_actionability,
                "eval_average": eval_average,
                "eval_skip_reason": eval_skip_reason
            }
            
            # Set trace output
            trace.set_output(result)
            
            return result

