from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.models.user import User
from app.schemas import UserResponse

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user
