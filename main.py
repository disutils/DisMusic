import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import Response
from starlette.templating import Jinja2Templates

from routes import routes


def load_config() -> dict[str, Any]:
    with open(Path("configuration/config.json"), encoding="utf-8") as f:
        return json.load(f)


app = FastAPI(redirect_slashes=True, include_in_schema=False)
app.state.config = load_config()
app.add_middleware(SessionMiddleware, secret_key="your-secret-key")

app.mount("/assets", StaticFiles(directory="assets"), name="assets")
templates = Jinja2Templates(directory="views")

app.include_router(routes.router)


# @app.get("/{lang}/trigger-400", response_class=HTMLResponse)
# async def trigger_400(request: Request, lang: str) -> Response:
#     return await render_error(request, 400, lang)
#
#
# @app.get("/{lang}/trigger-401", response_class=HTMLResponse)
# async def trigger_401(request: Request, lang: str) -> Response:
#     return await render_error(request, 401, lang)
#
#
# @app.get("/{lang}/trigger-403", response_class=HTMLResponse)
# async def trigger_403(request: Request, lang: str) -> Response:
#     return await render_error(request, 403, lang)
#
#
# @app.get("/{lang}/trigger-404", response_class=HTMLResponse)
# async def trigger_404(request: Request, lang: str) -> Response:
#     return await render_error(request, 404, lang)
#
#
# @app.get("/{lang}/trigger-500", response_class=HTMLResponse)
# async def trigger_500(request: Request, lang: str) -> Response:
#     return await render_error(request, 500, lang)
#
#
# @app.exception_handler(StarletteHTTPException)
# async def http_exception_handler(
#     request: Request, exc: StarletteHTTPException
# ) -> Response:
#     language = getattr(request.state, "language", "en")
#     return await render_error(request, exc.status_code, language)
#
#
# @app.exception_handler(Exception)
# async def generic_exception_handler(
#     request: Request, exc: Exception
# ) -> Response:
#     language = getattr(request.state, "language", "en")
#     return await render_error(request, 500, language)
#
#
# async def render_error(
#     request: Request, status_code: int, language: str
# ) -> Response:
#     config = request.app.state.config
#     context = {
#         "request": request,
#         "status": status_code,
#         "translations": getattr(request.state, "translations", {}),
#         "language": language,
#         "name": config.get("name", ""),
#     }
#     return templates.TemplateResponse(
#         "website/handlers/error-handler.html", context, status_code=status_code
#     )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", reload=True, host="0.0.0.0", port=3000)
