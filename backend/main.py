"""
AquaGNN - AI-Driven Urban Flood Nowcasting & Inundation Prediction System
Main FastAPI Application Entrypoint
"""

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure both project root and backend dir are in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)

import asyncio
from contextlib import asynccontextmanager

try:
    from .api.routes import router as api_router
    from .api.db_routes import db_router
    from .api.ws_telemetry import ws_router, telemetry_broadcaster
    from .database.seed import seed_database
except (ImportError, ValueError):
    from backend.api.routes import router as api_router
    from backend.api.db_routes import db_router
    from backend.api.ws_telemetry import ws_router, telemetry_broadcaster
    from backend.database.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan context manager:
    - Initializes database and demo data.
    - Starts the background WebSocket telemetry broadcaster task.
    - Gracefully stops the background task on application shutdown.
    """
    seed_database()
    telemetry_task = asyncio.create_task(telemetry_broadcaster.start())
    try:
        yield
    finally:
        await telemetry_broadcaster.stop()
        if not telemetry_task.done():
            telemetry_task.cancel()
            try:
                await telemetry_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="AquaGNN: AI-Driven Urban Flood Nowcasting System",
    description="Couples live/simulated rainfall nowcasts with urban spatial topology (DEM + stormwater drainage graph) to predict street-level flood depth over 1-3 hour forecast horizons.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(api_router)
app.include_router(db_router)
app.include_router(ws_router)

# Mount frontend dist static files if built
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return None
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "AquaGNN API is running. Frontend build not yet generated."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
