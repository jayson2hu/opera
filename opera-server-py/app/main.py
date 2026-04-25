from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings, validate_config
from app.routes.compose import router as compose_router
from app.routes.generate import router as generate_router
from app.routes.wechat_compose import router as wechat_compose_router


def create_app() -> FastAPI:
    settings = get_settings()
    validate_config(settings)

    app = FastAPI(title="Opera FastAPI Backend", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        from datetime import datetime, timezone

        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content={"error": "Not found"})
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})

    @app.exception_handler(Exception)
    async def handle_exception(_request: Request, exc: Exception) -> JSONResponse:
        print(f"[opera-server-py] Unhandled error: {exc}")
        return JSONResponse(status_code=500, content={"error": "Internal server error"})

    app.include_router(generate_router)
    app.include_router(compose_router)
    app.include_router(wechat_compose_router)

    return app


app = create_app()
