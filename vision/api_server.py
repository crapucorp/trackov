"""
FastAPI server for scanner service
Provides HTTP endpoint for Electron app to trigger scans
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import uvicorn
import logging
from scanner_service import FastScanner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kappa Scanner API")

# Allow CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scanner
scanner = FastScanner()


class ScanResponse(BaseModel):
    success: bool
    matches: List[Dict]
    scan_time_ms: float
    template_count: int


@app.on_event("startup")
async def startup_event():
    """Load templates on startup"""
    logger.info("🚀 Starting Kappa Scanner API...")
    count = scanner.load_templates()
    logger.info(f"✅ Scanner ready with {count} templates")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Kappa Scanner API",
        "status": "running",
        "templates_loaded": len(scanner.templates)
    }


@app.post("/scan", response_model=ScanResponse)
async def scan():
    """Perform a screen scan for Kappa items"""
    try:
        import time
        start = time.time()
        
        matches = scanner.scan()
        
        scan_time = (time.time() - start) * 1000
        
        return ScanResponse(
            success=True,
            matches=matches,
            scan_time_ms=scan_time,
            template_count=len(scanner.templates)
        )
    except Exception as e:
        logger.error(f"❌ Scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/templates")
async def list_templates():
    """List all loaded templates"""
    return {
        "count": len(scanner.templates),
        "templates": list(scanner.templates.keys())
    }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info"
    )
