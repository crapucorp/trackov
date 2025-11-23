"""
Endpoint for icon scanning triggered by Electron global shortcut
"""
from fastapi import HTTPException
from pydantic import BaseModel

class ScanIconRequest(BaseModel):
    x: int
    y: int

@app.post("/scan-icon")
async def scan_icon(request: ScanIconRequest):
    """Scan for icon at given cursor position"""
    if not ICON_SCANNER_AVAILABLE or icon_scanner is None:
        raise HTTPException(status_code=503, detail="Icon scanner not available")
    
    try:
        # Scan at the provided cursor position
        result = icon_scanner.scan_at_position(request.x, request.y)
        
        if result:
            return {
                "success": True,
                "item": {
                    "id": result['id'],
                    "name": result['name'],
                    "shortName": result['shortName'],
                    "price": result.get('avg24hPrice', 0),
                    "confidence": result.get('confidence', 0)
                }
            }
        else:
            return {"success": False, "item": None}
    except Exception as e:
        logger.error(f"❌ Icon scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
