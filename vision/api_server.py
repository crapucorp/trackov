"""
FastAPI server for scanner service
Provides HTTP endpoint for Electron app to trigger scans
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import logging
from scanner_service import FastScanner

# Try to import icon scanner (optional - requires OpenCV)
try:
    from icon_scanner import IconScanner
    ICON_SCANNER_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Icon scanner not available: {e}")
    IconScanner = None
    ICON_SCANNER_AVAILABLE = False

# Try to import tooltip scanner (optional - requires Tesseract)
try:
    from tooltip_scanner import TooltipScanner
    TOOLTIP_SCANNER_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Tooltip scanner not available: {e}")
    TooltipScanner = None
    TOOLTIP_SCANNER_AVAILABLE = False

# Try to import hover scanner (optional - requires OpenCV + Tesseract)
try:
    from hover_scanner import HoverScanner
    HOVER_SCANNER_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Hover scanner not available: {e}")
    HoverScanner = None
    HOVER_SCANNER_AVAILABLE = False

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

# Initialize icon scanner (for real-time icon recognition) - only if available
icon_scanner = IconScanner() if ICON_SCANNER_AVAILABLE else None

# Initialize tooltip scanner (for text-based recognition) - only if available
tooltip_scanner = TooltipScanner() if TOOLTIP_SCANNER_AVAILABLE else None

# Initialize hover scanner (for OCR-based scanning) - only if available
hover_scanner = HoverScanner() if HOVER_SCANNER_AVAILABLE else None


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
    # Note: Scanners are NOT auto-started
    # They start when user clicks the button in UI (calls /hover/start)


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


class ScanIconRequest(BaseModel):
    x: int
    y: int


@app.post("/scan-icon")
async def scan_icon(request: ScanIconRequest):
    """Scan for icon at given cursor position (triggered by Electron Shift+F5)"""
    # Try tooltip scanner first (more reliable)
    if TOOLTIP_SCANNER_AVAILABLE and tooltip_scanner is not None:
        try:
            logger.info(f"🔍 Scanning tooltip at position ({request.x}, {request.y})")
            result = tooltip_scanner.scan_at_position(request.x, request.y)
            
            if result:
                logger.info(f"✅ Found via tooltip: {result['name']} - {result.get('avg24hPrice', 0)}₽")
                return {
                    "success": True,
                    "method": "tooltip",
                    "item": {
                        "id": result['id'],
                        "name": result['name'],
                        "shortName": result['shortName'],
                        "price": result.get('avg24hPrice', 0),
                        "confidence": result.get('confidence', 0),
                        "fleaMinPrice": result.get('fleaMinPrice'),
                        "sellFor": result.get('sellFor', [])
                    }
                }
        except Exception as e:
            logger.warning(f"⚠️ Tooltip scan failed, falling back to icon matching: {e}")
    
    # Fallback to icon scanner
    if not ICON_SCANNER_AVAILABLE or icon_scanner is None:
        raise HTTPException(status_code=503, detail="No scanner available - install OpenCV or Tesseract")
    
    try:
        logger.info(f"🔍 Scanning icon at position ({request.x}, {request.y})")
        result = icon_scanner.scan_at_position(request.x, request.y)
        
        if result:
            logger.info(f"✅ Found via icon: {result['name']} - {result.get('avg24hPrice', 0)}₽")
            return {
                "success": True,
                "method": "icon",
                "item": {
                    "id": result['id'],
                    "name": result['name'],
                    "shortName": result['shortName'],
                    "price": result.get('avg24hPrice', 0),
                    "confidence": result.get('confidence', 0)
                }
            }
        else:
            logger.info("❌ No item found")
            return {"success": False, "item": None}
    except Exception as e:
        logger.error(f"❌ Scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/hover/start")
async def start_hover_scan():
    """Start hover scanning mode (Ctrl+Shift+Click OCR)"""
    if not HOVER_SCANNER_AVAILABLE or hover_scanner is None:
        raise HTTPException(status_code=503, detail="Hover scanner not available - OpenCV/Tesseract may not be installed")
    try:
        hover_scanner.start()
        return {"success": True, "message": "Hover scanning started"}
    except Exception as e:
        logger.error(f"❌ Hover scanner start error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/hover/stop")
async def stop_hover_scan():
    """Stop hover scanning mode (Ctrl+Shift+Click OCR)"""
    if not HOVER_SCANNER_AVAILABLE or hover_scanner is None:
        raise HTTPException(status_code=503, detail="Hover scanner not available")
    try:
        hover_scanner.stop()
        return {"success": True, "message": "Hover scanning stopped"}
    except Exception as e:
        logger.error(f"❌ Hover scanner stop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/hover/status")
async def get_hover_status():
    """Get current hover scan result (Ctrl+Shift+Click OCR)"""
    if not HOVER_SCANNER_AVAILABLE or hover_scanner is None:
        return {
            "isScanning": False,
            "result": None,
            "available": False
        }
    result = hover_scanner.get_result()
    return {
        "isScanning": hover_scanner.is_running,
        "result": result,
        "available": True
    }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info"
    )
