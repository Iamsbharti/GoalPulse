from typing import Optional, List
from sqlalchemy import select
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
    
    async def create_checkin(
        self,
        goal_id: str,
        user_id: str,
        response: str,
        mood: Optional[str] = None
    ) -> Checkin:
        checkin = Checkin(
            goal_id=goal_id,
            user_id=user_id,
            response=response,
            mood=mood
        )
        self.session.add(checkin)
        await self.session.commit()
        await self.session.refresh(checkin)
        return checkin
