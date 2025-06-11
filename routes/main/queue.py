from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from starlette.templating import Jinja2Templates

templates = Jinja2Templates(directory="views")
router = APIRouter()


@router.get("/dashboard/current-queue", response_class=HTMLResponse)
async def current_queue(request: Request) -> HTMLResponse:
    config = request.app.state.config
    context: dict[str, Any] = {
        "request": request,
        "name": config.get("name", ""),
        "active_page": "current-queue",
    }
    return templates.TemplateResponse("main/current-queue.html", context)
