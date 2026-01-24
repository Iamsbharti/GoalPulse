from typing import Optional, List
from sqlalchemy import select
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import Goal, Checkin, User, GoalStatus

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
        # 1. Get Active Goals
        goals_result = await self.session.execute(
            select(Goal).where(Goal.user_id == user_id, Goal.status == GoalStatus.ACTIVE)
        )
        active_goals = goals_result.scalars().all()
        total_active_goals = len(active_goals)
        
        if total_active_goals == 0:
            return {
                "score": 50,
                "consistency_summary": "No active goals yet",
                "vibe_summary": "Ready to start",
                "time_window": "N/A"
            }
            
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
        
        # 4. Calculate Vibe Score (40%)
        # Logic: Explicit Normalize Mood + Progress
        if not recent_checkins:
            vibe_score = 50
            vibe_summary = "No recent activity"
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
            
        # Weighted Average
        final_score = (consistency_score * 0.6) + (vibe_score * 0.4)
        final_score = max(0, min(100, final_score)) # Clamp 0-100
        
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
