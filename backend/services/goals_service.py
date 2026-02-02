from typing import Optional, List
from sqlalchemy import select
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Goal, Checkin, User, GoalStatus
from observability import get_opik_client, TraceNames

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
        level = motivation_data["score"]
        
        from services.llm_service import LLMService
        llm = LLMService()
        
        prompt = f"""
        User's Motivation Level: {level}%
        
        Context:
        - Consistency: {motivation_data['consistency_summary']}
        - Vibe: {motivation_data['vibe_summary']}
        - Window: {motivation_data['time_window']}
        
        Generate a short, punchy (1 sentence) 'Daily Pulse' message for the dashboard.
        
        Tone Guidelines:
        - 80-100 (Momentum): Be hyped, enforcing the streak.
        - 50-79 (Stability): Be supportive, steady encouragement.
        - 0-49 (Safety): Be gentle, empathetic, focus on "one small step".
        
        Explain WHY in the message based on the context (e.g. "Great consistency" or "Tough week but you showed up").
        Do not use hashtags. Keep it under 20 words.
        """
        
        return await llm.generate(prompt)
