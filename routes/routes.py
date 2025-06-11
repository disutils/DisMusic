from fastapi import APIRouter
from .main import queue

router = APIRouter()

router.include_router(queue.router)