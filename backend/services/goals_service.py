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
                "consistency_summary": f"{len(active_checked_ids)} of {total_active_goals} active goals checked in (floor applied: {consistency_raw < 0.3})",
                "vibe_summary": vibe_summary,
                "time_window": "last 3 days"
            }
        
    async def generate_motivation_hook(self, user_id: str, motivation_data: dict) -> str:
        """
        Generate AI motivational message from structured motivation signals.
        
        Phase 4: Full Opik observability with LLM-as-judge evaluation.
        
        CRITICAL: This method does NOT compute motivation.
        It only EXPLAINS the precomputed signals from calculate_motivation_level().
        """
        
        
        # Separate clients for generation vs evaluation (future extensibility)
        gen_llm = LLMService()
        judge_llm = LLMService()  # Same model now, can swap later for experiments
        
        # Feature flag for AI evaluation (disable in production for speed)
        ENABLE_AI_EVAL = os.getenv("ENABLE_AI_EVAL", "true").lower() == "true"
        
        # Extract structured inputs (computed in Phase 3)
        final_score = motivation_data["score"]
        consistency_summary = motivation_data["consistency_summary"]
        vibe_summary = motivation_data["vibe_summary"]
        
        # P4-T2: Explicit tone selection (deterministic, NOT decided by LLM)
        if final_score >= 80:
            tone = "momentum"  # energetic, hyped
        elif final_score >= 50:
            tone = "steady"    # supportive, stable
        else:
            tone = "gentle"    # empathetic, small steps
        
        # Thread ID links AI explanation to Phase 3 motivation computation
        thread_id = f"motivation-{user_id}"
        
        with _opik.trace_context(
            TraceNames.AI_MOTIVATION_MESSAGE,
            input_data={
                "user_id": user_id,
                "final_score": final_score,
                "consistency_summary": consistency_summary,
                "vibe_summary": vibe_summary,
                "selected_tone": tone
            },
            thread_id=thread_id
        ) as trace:
            # Generate message prompt (no math, only structured inputs)
            prompt = f"""
            User's Motivation Level: {final_score}%
            Selected Tone: {tone.upper()}
            
            Context:
            - Consistency: {consistency_summary}
            - Vibe: {vibe_summary}
            
            Generate a short, punchy (1 sentence) 'Daily Pulse' message for the dashboard.
            
            Tone Guidelines:
            - MOMENTUM: Be hyped, enforcing the streak.
            - STEADY: Be supportive, steady encouragement.
            - GENTLE: Be empathetic, focus on "one small step".
            
            Explain WHY in the message based on the context.
            Do not use hashtags. Keep it under 20 words.
            """
            
            # Generate message
            message = await gen_llm.generate(prompt)
            message = message.strip()
            
            # Soft word-count enforcement (prevent LLM drift)
            words = message.split()
            if len(words) > 20:
                message = " ".join(words[:20])
            
            # Log message generation span (NESTED under trace)
            trace.log_span("llm-generate-message",
                input={"prompt_length": len(prompt), "tone": tone},
                output={"generated_message": message, "message_length": len(message), "word_count": len(words), "truncated": len(words) > 20})
            
            # Default eval scores (used if evals disabled)
            encouragement_score = 0
            alignment_score = 0
            clarity_score = 0
            
            # P4-T3: LLM-as-Judge Evaluation (3 separate spans)
            # Evaluations enabled in staging/experiments, optional in production
            if ENABLE_AI_EVAL:
                eval_context = f"""
                Motivation Score: {final_score}%
                Selected Tone: {tone}
                Generated Message: "{message}"
                """
                
                # Eval 1: Encouragement Quality (with calibration example)
                encouragement_prompt = f"""
                {eval_context}
                
                Rate the ENCOURAGEMENT QUALITY of this message on a 1-5 scale:
                1 = Not motivating at all
                3 = Somewhat encouraging
                5 = Highly motivating and inspiring
                
                Example:
                Motivation Score: 90%
                Tone: momentum
                Message: "You're on fire — keep pushing this streak!"
                → Score: 5
                
                Respond with ONLY a number (1-5).
                """
                encouragement_score = self._parse_eval_score(await judge_llm.generate(encouragement_prompt))
                trace.log_span("llm-eval-encouragement",
                    input={"message": message, "tone": tone},
                    output={"score": encouragement_score})
                
                # Eval 2: Emotional Alignment (with calibration example)
                alignment_prompt = f"""
                {eval_context}
                
                Rate the EMOTIONAL ALIGNMENT of this message on a 1-5 scale:
                Does the tone ({tone}) match the motivation score ({final_score}%)?
                1 = Completely mismatched tone
                3 = Somewhat aligned
                5 = Perfectly aligned with the user's state
                
                Example:
                Score: 30%, Tone: gentle
                Message: "It's okay to start small. One step at a time."
                → Score: 5
                
                Respond with ONLY a number (1-5).
                """
                alignment_score = self._parse_eval_score(await judge_llm.generate(alignment_prompt))
                trace.log_span("llm-eval-alignment",
                    input={"message": message, "tone": tone, "final_score": final_score},
                    output={"score": alignment_score})
                
                # Eval 3: Clarity (with calibration example)
                clarity_prompt = f"""
                {eval_context}
                
                Rate the CLARITY of this message on a 1-5 scale:
                1 = Confusing or unclear
                3 = Understandable
                5 = Crystal clear and concise
                
                Example:
                Message: "Great week! You're making progress."
                → Score: 5
                
                Respond with ONLY a number (1-5).
                """
                clarity_score = self._parse_eval_score(await judge_llm.generate(clarity_prompt))
                trace.log_span("llm-eval-clarity",
                    input={"message": message},
                    output={"score": clarity_score})
            
            # Calculate average (0 if evals disabled)
            eval_average = round((encouragement_score + alignment_score + clarity_score) / 3, 2) if ENABLE_AI_EVAL else 0
            
            # Set trace output with all data
            trace.set_output({
                "generated_message": message,
                "message_length": len(message),
                "eval_enabled": ENABLE_AI_EVAL,
                "eval_skip_reason": None if ENABLE_AI_EVAL else "disabled_by_feature_flag",
                "eval_encouragement": encouragement_score,
                "eval_alignment": alignment_score,
                "eval_clarity": clarity_score,
                "eval_average": eval_average
            })
            
            return message
    
    def _parse_eval_score(self, response: str) -> int:
        """Parse LLM evaluation response to integer score (1-5) using regex."""
        try:
            # Use regex to find standalone digit 1-5
            match = re.search(r"\b([1-5])\b", response.strip())
            if match:
                return int(match.group(1))
            return 3  # Default to middle score
        except:
            return 3

    async def compute_at_risk_snapshot(
        self, 
        user_id: str, 
        motivation_data: dict,
        recent_checkin_count: int = 0,
        ai_eval_encouragement: int = 3
    ) -> dict:
        """
        Compute at-risk snapshot using deterministic heuristics.
        
        Phase 5: Full Opik observability with AI explanation.
        
        CRITICAL: Heuristics decide risk. AI explains risk. AI does NOT decide risk.
        
        This is a READ-TIME diagnostic, called at insight/dashboard load,
        not during write-time actions like check-in creation.
        
        Args:
            user_id: User identifier
            motivation_data: Output from calculate_motivation_level()
            recent_checkin_count: Number of check-ins in last 7 days
            ai_eval_encouragement: Encouragement score from Phase 4 (1-5).
                                   Defaults to neutral (3) if no prior AI message exists.
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
        
        # Detect if consistency floor was triggered (from summary)
        # Note: Ideally Phase 3 would return this as a boolean directly
        consistency_floor_triggered = "floor applied: True" in consistency_summary
        
        # Heuristic baseline for expected weekly engagement
        EXPECTED_WEEKLY_CHECKINS = 3
        
        # Thread ID links to Phase 3-4 motivation traces
        thread_id = f"motivation-{user_id}"
        
        with _opik.trace_context(
            TraceNames.AT_RISK_SNAPSHOT,
            input_data={
                "user_id": user_id,
                "motivation_score": motivation_score,
                "consistency_summary": consistency_summary,
                "vibe_summary": vibe_summary,  # Context only, not a trigger
                "recent_checkin_count": recent_checkin_count,
                "ai_eval_encouragement": ai_eval_encouragement
            },
            thread_id=thread_id
        ) as trace:
            
            # P5-T2: Deterministic signal flags
            low_motivation = motivation_score < 50
            missed_checkins = recent_checkin_count < EXPECTED_WEEKLY_CHECKINS
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
            
            # Confidence = signal density (deterministic, no ML)
            signal_count = sum(triggered_signals.values())
            confidence = round(signal_count / len(triggered_signals), 2)
            
            # Log risk computation span (nested under trace)
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
            
            # P5-T4: AI Risk Explanation (only explains, doesn't decide)
            ai_explanation = ""
            if risk_level != "LOW":
                signals_text = ", ".join([k.replace("_", " ") for k, v in triggered_signals.items() if v])
                
                explain_prompt = f"""
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
                
                ai_explanation = await explain_llm.generate(explain_prompt)
                ai_explanation = ai_explanation.strip()
                
                # Word-count enforcement
                words = ai_explanation.split()
                if len(words) > 25:
                    ai_explanation = " ".join(words[:25])
                
                trace.log_span("ai-risk-explanation",
                    input={"signals_text": signals_text, "risk_level": risk_level},
                    output={"explanation": ai_explanation, "word_count": len(words)})
            
            # P5-T5: LLM-as-Judge Evaluation for explanation
            eval_clarity = 0
            eval_actionability = 0
            eval_skip_reason = None
            
            if ENABLE_AI_EVAL and ai_explanation:
                eval_context = f"""
                Risk Level: {risk_level}
                Motivation Score: {motivation_score}%
                AI Explanation: "{ai_explanation}"
                """
                
                # Eval 1: Clarity
                clarity_prompt = f"""
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
                eval_clarity = self._parse_eval_score(await judge_llm.generate(clarity_prompt))
                trace.log_span("llm-eval-clarity",
                    input={"explanation": ai_explanation},
                    output={"score": eval_clarity})
                
                # Eval 2: Actionability
                actionability_prompt = f"""
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
                eval_actionability = self._parse_eval_score(await judge_llm.generate(actionability_prompt))
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

