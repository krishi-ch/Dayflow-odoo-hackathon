from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import RedirectResponse
from fastapi.exceptions import RequestValidationError
from fastapi import Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import engine, Base

from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.attendance import router as attendance_router
from app.routers.leave import router as leave_router
from app.routers.payroll import router as payroll_router
from app.routers.dashboard import router as dashboard_router
from app.routers.ai_chat import router as ai_router

# ── Rate limiter (shared across all routers via app.state.limiter) ──
limiter = Limiter(key_func=get_remote_address)


def _extract_client_ip(request: Request) -> str:
    """Extract client IP, preferring X-Forwarded-For in production."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        version=settings.APP_VERSION,
        description=(
            "Dayflow HRMS — Full-featured Human Resource Management System. "
            "Features: Auth, Role-based Access, Employee Profiles, Attendance, "
            "Leave Workflow, Payroll Generation with PDF Payslips, Audit Logging, "
            "Notifications, AI Chat Assistant, Reports Export (CSV/PDF)."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        debug=settings.DEBUG,
    )

    # ── Attach limiter to app so routers can reference it ──
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.middleware("http")
    async def attach_request_context(request: Request, call_next):
        """Attach client_ip and user_agent to request.state for audit logging."""
        request.state.client_ip = _extract_client_ip(request)
        request.state.user_agent = request.headers.get("user-agent", "")
        response = await call_next(request)
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    if not settings.DEBUG:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            loc = " → ".join(str(x) for x in err.get("loc", []))
            errors.append({"field": loc, "message": err.get("msg", "Unknown error")})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation failed", "errors": errors},
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": f"Rate limit exceeded: {exc.detail}"},
        )

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/docs")

    @app.get("/health", tags=["Meta"])
    def health_check():
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
        }

    app.include_router(auth_router)
    app.include_router(employees_router)
    app.include_router(attendance_router)
    app.include_router(leave_router)
    app.include_router(payroll_router)
    app.include_router(dashboard_router)
    app.include_router(ai_router)

    @app.on_event("startup")
    def on_startup():
        import os
        os.makedirs(settings.PROFILE_PICTURES_DIR, exist_ok=True)
        os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)
        os.makedirs(settings.PAYSLIPS_DIR, exist_ok=True)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
