"""
FastAPI Server for CSFloat Sniper UI
Provides REST API endpoints for frontend operations only.
Core bot logic remains in main.py (unchanged).
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import get_db, init_db
from database.models import TargetSkin, SalesHistory, Sticker, Charm, TargetConfig
from sqlalchemy.orm import Session
import psutil
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:     %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="CSFloat Sniper API",
    description="REST API for CSFloat Sniper Dashboard",
    version="2.0.0"
)

# CORS middleware for dev mode and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://localhost:8000",
        "https://*.railway.app",  # Railway deployment URLs
        "https://*.up.railway.app"  # Railway custom domains
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Database Initialization
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup"""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")


# ============================================================================
# Pydantic Models (Request/Response schemas)
# ============================================================================

class TargetCreate(BaseModel):
    item_name: str
    min_price: float
    max_price: float
    min_float: float = 0.0
    max_float: float = 1.0
    stickers: Optional[Union[List[str], List[dict]]] = None
    charms: Optional[List[str]] = None
    is_stattrak: Optional[bool] = None
    is_souvenir: Optional[bool] = None
    is_normal: Optional[bool] = None
    is_active: bool = True
    config_name: str = "Default"
    mode: str = "Notify Only"
    markup_pct: float = 0.0
    markup_mult: float = 1.0
    paint_seed: Optional[str] = None  # Comma-separated seeds (e.g., "1,4,7") or single seed ("7")
    blue_gem_tier: Optional[int] = None
    rarity_name: Optional[str] = None
    zero_price_filter: bool = False
    playside_blue_enabled: bool = False
    playside_blue_min: float = 0.0
    playside_blue_max: float = 100.0
    backside_blue_enabled: bool = False
    backside_blue_min: float = 0.0
    backside_blue_max: float = 100.0
    sp_sticker_enabled: bool = False
    sp_sticker_percent_min: float = 0.0
    sp_sticker_percent_max: float = 100.0
    stickers_price_percent_enabled: bool = False
    stickers_price_percent_min: float = 0.0
    stickers_price_percent_max: float = 100.0
    charm_pattern_enabled: bool = False
    charm_pattern_min: int = 0
    charm_pattern_max: int = 100000
    charm_pattern_strict: bool = True
    charm_profit_enabled: bool = False
    charm_profit_min: float = 0.0
    charm_profit_max: float = 100.0
    charm_profit_use_lowest_price: Optional[bool] = False
    discount_overpay_min: Optional[float] = None
    discount_overpay_max: Optional[float] = None
    fade_enabled: bool = False
    fade_min: Optional[float] = None
    fade_max: Optional[float] = None
    float_rank: Optional[str] = None  # 'gold_highest_float', 'silver_highest_float', 'bronze_highest_float'
    phase: Optional[str] = None
    description: Optional[str] = None
    # Frontend blue gem filter fields (mapped to playside_blue_*)
    blueMin: Optional[str] = None
    blueMax: Optional[str] = None
    blueGemFilterEnabled: Optional[bool] = None
    created_at: Optional[datetime] = None

class TargetUpdate(BaseModel):
    item_name: Optional[str] = None
    config_name: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_float: Optional[float] = None
    max_float: Optional[float] = None
    is_active: Optional[bool] = None
    mode: Optional[str] = None
    markup_pct: Optional[float] = None
    markup_mult: Optional[float] = None
    paint_seed: Optional[str] = None  # Comma-separated seeds or single seed
    blue_gem_tier: Optional[int] = None
    is_stattrak: Optional[bool] = None
    is_souvenir: Optional[bool] = None
    is_normal: Optional[bool] = None
    rarity_name: Optional[str] = None
    zero_price_filter: Optional[bool] = None
    stickers: Optional[Union[List[str], List[dict]]] = None
    charms: Optional[List[str]] = None
    playside_blue_enabled: Optional[bool] = None
    playside_blue_min: Optional[float] = None
    playside_blue_max: Optional[float] = None
    backside_blue_enabled: Optional[bool] = None
    backside_blue_min: Optional[float] = None
    backside_blue_max: Optional[float] = None
    sp_sticker_enabled: Optional[bool] = None
    sp_sticker_percent_min: Optional[float] = None
    sp_sticker_percent_max: Optional[float] = None
    stickers_price_percent_enabled: Optional[bool] = None
    stickers_price_percent_min: Optional[float] = None
    stickers_price_percent_max: Optional[float] = None
    charm_pattern_enabled: Optional[bool] = None
    charm_pattern_min: Optional[int] = None
    charm_pattern_max: Optional[int] = None
    charm_pattern_strict: Optional[bool] = None
    charm_profit_enabled: Optional[bool] = None
    charm_profit_min: Optional[float] = None
    charm_profit_max: Optional[float] = None
    charm_profit_use_lowest_price: Optional[bool] = None
    discount_overpay_min: Optional[float] = None
    discount_overpay_max: Optional[float] = None
    fade_enabled: Optional[bool] = None
    fade_min: Optional[float] = None
    fade_max: Optional[float] = None
    float_rank: Optional[str] = None  # 'gold_highest_float', 'silver_highest_float', 'bronze_highest_float'
    phase: Optional[str] = None
    description: Optional[str] = None
    # Frontend blue gem filter fields (mapped to playside_blue_*)
    blueMin: Optional[str] = None
    blueMax: Optional[str] = None
    blueGemFilterEnabled: Optional[bool] = None

class TargetResponse(BaseModel):
    id: int
    item_name: str
    min_price: float
    max_price: float
    min_float: float
    max_float: float
    stickers: Optional[Union[List[str], List[dict]]]
    charms: Optional[List[str]]
    is_stattrak: Optional[bool]
    is_souvenir: Optional[bool]
    is_normal: Optional[bool]
    is_active: bool
    config_name: str
    mode: str
    markup_pct: float
    markup_mult: float
    paint_seed: Optional[str]  # Comma-separated seeds or single seed
    blue_gem_tier: Optional[int]
    rarity_name: Optional[str]
    zero_price_filter: bool
    playside_blue_enabled: bool
    playside_blue_min: float
    playside_blue_max: float
    backside_blue_enabled: bool
    backside_blue_min: float
    backside_blue_max: float
    sp_sticker_enabled: bool
    sp_sticker_percent_min: float
    sp_sticker_percent_max: float
    stickers_price_percent_enabled: bool
    stickers_price_percent_min: float
    stickers_price_percent_max: float
    charm_pattern_enabled: bool
    charm_pattern_min: int
    charm_pattern_max: int
    charm_pattern_strict: bool
    charm_profit_enabled: bool
    charm_profit_min: float
    charm_profit_max: float
    charm_profit_use_lowest_price: bool
    discount_overpay_min: Optional[float]
    discount_overpay_max: Optional[float]
    fade_enabled: bool
    fade_min: Optional[float]
    fade_max: Optional[float]
    float_rank: Optional[str]
    phase: Optional[str]
    description: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class ConfigResponse(BaseModel):
    name: str
    target_count: int
    active_count: int
    is_active: bool
    emoji: Optional[str] = None

class ConfigExtendedResponse(ConfigResponse):
    targets: List[TargetResponse]

class HistoryResponse(BaseModel):
    id: int
    asset_id: str
    item_name: str
    price: float
    float_value: float
    wear_name: str
    paint_seed: Optional[int]
    stickers: Optional[list]
    timestamp: datetime
    purchased: bool
    markup_pct: Optional[float]
    markup_mult: Optional[float]

    class Config:
        from_attributes = True

class BotStatusResponse(BaseModel):
    running: bool
    pid: Optional[int] = None
    start_time: Optional[str] = None  # ISO format timestamp
    uptime_seconds: Optional[int] = None
    scan_latency: Optional[float] = None


# ============================================================================
# Static Files & Frontend Serving
# ============================================================================

# Static files will be mounted at the end of the file to avoid conflicts with API routes.

# ============================================================================
# API Endpoints
# ============================================================================


# ----------------------------------------------------------------------------
# Configs Management
# ----------------------------------------------------------------------------

@app.get("/api/configs", response_model=Union[List[ConfigResponse], List[ConfigExtendedResponse]])
async def get_configs(include_targets: bool = False, db: Session = Depends(get_db)):
    """Get list of all configs with target counts, optionally including targets"""

    if include_targets:
        all_targets = db.query(TargetSkin).order_by(TargetSkin.id.desc()).all()
        all_configs = db.query(TargetConfig).all()

        config_map = {}
        for config in all_configs:
            config_map[config.name] = {
                "active": config.is_active,
                "emoji": config.emoji,
                "targets": [],
                "from_db": True  # Mark as existing in DB
            }

        # Also include config_names from TargetSkin that don't have TargetConfig yet
        # This handles legacy configs (e.g., "Default") and configs created on frontend
        # but not yet synced to backend. Set active=False to indicate they need to be enabled
        for target in all_targets:
            if target.config_name not in config_map:
                config_map[target.config_name] = {
                    "active": False,  # Frontend-only configs start disabled
                    "emoji": None,
                    "targets": [],
                    "from_db": False  # Mark as frontend-only (not yet persisted)
                }
            config_map[target.config_name]["targets"].append(target)

        result = []
        for name, data in config_map.items():
            targets = data["targets"]
            active_count = sum(1 for t in targets if t.is_active)

            result.append({
                "name": name,
                "target_count": len(targets),
                "active_count": active_count if data["active"] else 0,
                "is_active": data["active"],
                "emoji": data["emoji"],
                "targets": targets
            })

        return result

    else:
        all_configs = db.query(TargetConfig).all()

        # Also get unique config_names from TargetSkin for backward compatibility
        skin_config_names = db.query(TargetSkin.config_name).distinct().all()
        all_config_names = set(c.name for c in all_configs) | set(c[0] for c in skin_config_names)

        result = []
        for config_name in all_config_names:
            config = db.query(TargetConfig).filter(TargetConfig.name == config_name).first()
            targets = db.query(TargetSkin).filter(TargetSkin.config_name == config_name).all()
            active_count = sum(1 for t in targets if t.is_active)

            result.append({
                "name": config_name,
                "target_count": len(targets),
                "active_count": active_count,
                "is_active": config.is_active if config else False,  # Frontend-only configs start disabled
                "emoji": config.emoji if config else None
            })

        return result

@app.get("/api/configs/{config_name}/targets", response_model=List[TargetResponse])
async def get_config_targets(config_name: str, db: Session = Depends(get_db)):
    """Get all targets for a specific config"""
    targets = db.query(TargetSkin).filter(TargetSkin.config_name == config_name).order_by(TargetSkin.id.desc()).all()
    return targets

class ConfigCreate(BaseModel):
    name: str
    emoji: Optional[str] = None
    enabled: Optional[bool] = True

@app.post("/api/configs")
async def create_config_endpoint(payload: ConfigCreate, db: Session = Depends(get_db)):
    """Create a new empty config"""
    existing = db.query(TargetConfig).filter(TargetConfig.name == payload.name).first()
    if existing:
        # Return existing config id
        return {"id": existing.id, "name": existing.name, "emoji": existing.emoji, "enabled": existing.is_active}
    
    new_config = TargetConfig(
        name=payload.name,
        emoji=payload.emoji if payload.emoji else None,
        is_active=payload.enabled if payload.enabled is not None else True
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    return {"id": new_config.id, "name": new_config.name, "emoji": new_config.emoji, "enabled": new_config.is_active}

@app.delete("/api/configs/{config_name}")
async def delete_config(config_name: str, db: Session = Depends(get_db)):
    """Delete a config and all its targets"""
    deleted_count = db.query(TargetSkin).filter(TargetSkin.config_name == config_name).delete()
    db.query(TargetConfig).filter(TargetConfig.name == config_name).delete()
    db.commit()
    
    return {"message": f"Deleted config '{config_name}' with {deleted_count} targets"}

class ConfigRename(BaseModel):
    old_name: str
    new_name: str
    emoji: Optional[str] = None

@app.post("/api/configs/rename")
async def rename_config(payload: ConfigRename, db: Session = Depends(get_db)):
    """Rename a config and/or update its emoji"""
    # Check if new name already exists
    if payload.old_name != payload.new_name:
        existing = db.query(TargetSkin).filter(TargetSkin.config_name == payload.new_name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Config '{payload.new_name}' already exists")

        # Update all targets
        targets = db.query(TargetSkin).filter(TargetSkin.config_name == payload.old_name).all()
        for target in targets:
            target.config_name = payload.new_name
        target_count = len(targets)
    else:
        target_count = 0 
        
    config = db.query(TargetConfig).filter(TargetConfig.name == payload.old_name).first()
    if config:
        config.name = payload.new_name
        if payload.emoji is not None:
            config.emoji = payload.emoji if payload.emoji != "" else None
        
    db.commit()
    
    return {"message": f"Updated config '{payload.new_name}'", "count": target_count}

# ----------------------------------------------------------------------------
# Targets CRUD
# ----------------------------------------------------------------------------

@app.post("/api/targets", response_model=TargetResponse)
async def create_target(target: TargetCreate, db: Session = Depends(get_db)):
    """Create a new target"""
    
    # Map frontend blue gem filter fields to backend playside_blue fields
    playside_blue_enabled = target.playside_blue_enabled
    playside_blue_min = target.playside_blue_min
    playside_blue_max = target.playside_blue_max
    
    # Override with frontend fields if provided
    if target.blueGemFilterEnabled is not None:
        playside_blue_enabled = target.blueGemFilterEnabled
    if target.blueMin is not None:
        playside_blue_min = float(target.blueMin)
    if target.blueMax is not None:
        playside_blue_max = float(target.blueMax)
    
    db_target = TargetSkin(
        item_name=target.item_name,
        min_price=target.min_price,
        max_price=target.max_price,
        min_float=target.min_float,
        max_float=target.max_float,
        stickers=target.stickers,
        charms=target.charms,
        is_stattrak=target.is_stattrak,
        is_souvenir=target.is_souvenir,
        is_normal=target.is_normal,
        is_active=target.is_active,
        config_name=target.config_name,
        mode=target.mode,
        markup_pct=target.markup_pct,
        markup_mult=target.markup_mult,
        paint_seed=target.paint_seed,
        blue_gem_tier=target.blue_gem_tier,
        rarity_name=target.rarity_name,
        zero_price_filter=target.zero_price_filter,
        playside_blue_enabled=playside_blue_enabled,
        playside_blue_min=playside_blue_min,
        playside_blue_max=playside_blue_max,
        backside_blue_enabled=target.backside_blue_enabled,
        backside_blue_min=target.backside_blue_min,
        backside_blue_max=target.backside_blue_max,
        sp_sticker_enabled=target.sp_sticker_enabled,
        sp_sticker_percent_min=target.sp_sticker_percent_min,
        sp_sticker_percent_max=target.sp_sticker_percent_max,
        stickers_price_percent_enabled=target.stickers_price_percent_enabled,
        stickers_price_percent_min=target.stickers_price_percent_min,
        stickers_price_percent_max=target.stickers_price_percent_max,
        charm_pattern_enabled=target.charm_pattern_enabled,
        charm_pattern_min=target.charm_pattern_min,
        charm_pattern_max=target.charm_pattern_max,
        charm_pattern_strict=target.charm_pattern_strict,
        charm_profit_enabled=target.charm_profit_enabled,
        charm_profit_min=target.charm_profit_min,
        charm_profit_max=target.charm_profit_max,
        charm_profit_use_lowest_price=target.charm_profit_use_lowest_price,
        discount_overpay_min=target.discount_overpay_min,
        discount_overpay_max=target.discount_overpay_max,
        fade_enabled=target.fade_enabled,
        fade_min=target.fade_min,
        fade_max=target.fade_max,
        float_rank=target.float_rank,
        phase=target.phase,
        description=target.description,
        created_at=target.created_at if target.created_at else datetime.now()
    )
    
    db.add(db_target)
    db.commit()
    db.refresh(db_target)
    
    return db_target

@app.put("/api/targets/{target_id}", response_model=TargetResponse)
async def update_target(target_id: int, target: TargetUpdate, db: Session = Depends(get_db)):
    """Update an existing target"""
    db_target = db.query(TargetSkin).filter(TargetSkin.id == target_id).first()
    
    if not db_target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Update only provided fields
    update_data = target.dict(exclude_unset=True)
    
    # Map frontend blue gem filter fields to backend playside_blue fields
    if 'blueGemFilterEnabled' in update_data:
        update_data['playside_blue_enabled'] = update_data.pop('blueGemFilterEnabled')
    if 'blueMin' in update_data:
        update_data['playside_blue_min'] = float(update_data.pop('blueMin'))
    if 'blueMax' in update_data:
        update_data['playside_blue_max'] = float(update_data.pop('blueMax'))
    
    for field, value in update_data.items():
        setattr(db_target, field, value)
    
    db.commit()
    db.refresh(db_target)
    
    return db_target

@app.delete("/api/targets/{target_id}")
async def delete_target(target_id: int, db: Session = Depends(get_db)):
    """Delete a target"""
    db_target = db.query(TargetSkin).filter(TargetSkin.id == target_id).first()
    
    if not db_target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    db.delete(db_target)
    db.commit()
    
    return {"message": f"Target {target_id} deleted"}

@app.patch("/api/configs/{config_name}/toggle")
async def toggle_config_active(config_name: str, active: bool, db: Session = Depends(get_db)):
    """Enable/disable config using the TargetConfig table"""
    config = db.query(TargetConfig).filter(TargetConfig.name == config_name).first()
    if not config:
        config = TargetConfig(name=config_name, is_active=active)
        db.add(config)
    else:
        config.is_active = active
    
    db.commit()
    
    return {"message": f"Set config '{config_name}' to {'active' if active else 'inactive'}"}

# ----------------------------------------------------------------------------
# Target Management (Move, Import)
# ----------------------------------------------------------------------------

class TargetMove(BaseModel):
    new_config_name: str

@app.post("/api/targets/{target_id}/move", response_model=TargetResponse)
async def move_target(target_id: int, payload: TargetMove, db: Session = Depends(get_db)):
    """Move a target to a different config"""
    db_target = db.query(TargetSkin).filter(TargetSkin.id == target_id).first()
    
    if not db_target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Update config_name
    old_config = db_target.config_name
    db_target.config_name = payload.new_config_name
    
    db.commit()
    db.refresh(db_target)
    
    logger.info(f"Moved target {target_id} from '{old_config}' to '{payload.new_config_name}'")
    
    return db_target


class TargetImport(BaseModel):
    targets: List[TargetCreate]

@app.post("/api/configs/{config_name}/import")
async def import_targets(config_name: str, payload: TargetImport, db: Session = Depends(get_db), enabled: bool = False):
    """Import multiple targets into a config. Also upserts the TargetConfig record."""
    # Upsert TargetConfig so GET /api/configs returns a clean single entry
    existing_cfg = db.query(TargetConfig).filter(TargetConfig.name == config_name).first()
    if not existing_cfg:
        new_cfg = TargetConfig(name=config_name, is_active=enabled, emoji=None)
        db.add(new_cfg)
        db.flush()

    created_targets = []
    
    for target_data in payload.targets:
        # Override config_name with the one from URL
        target_data.config_name = config_name
        
        # Create new target
        db_target = TargetSkin(
            item_name=target_data.item_name,
            min_price=target_data.min_price,
            max_price=target_data.max_price,
            min_float=target_data.min_float,
            max_float=target_data.max_float,
            stickers=target_data.stickers,
            charms=target_data.charms,
            is_stattrak=target_data.is_stattrak,
            is_souvenir=target_data.is_souvenir,
            is_normal=target_data.is_normal,
            is_active=target_data.is_active,
            config_name=config_name,
            mode=target_data.mode,
            markup_pct=target_data.markup_pct,
            markup_mult=target_data.markup_mult,
            paint_seed=target_data.paint_seed,
            blue_gem_tier=target_data.blue_gem_tier,
            rarity_name=target_data.rarity_name,
            zero_price_filter=target_data.zero_price_filter,
            playside_blue_enabled=target_data.playside_blue_enabled,
            playside_blue_min=target_data.playside_blue_min,
            playside_blue_max=target_data.playside_blue_max,
            backside_blue_enabled=target_data.backside_blue_enabled,
            backside_blue_min=target_data.backside_blue_min,
            backside_blue_max=target_data.backside_blue_max,
            sp_sticker_enabled=target_data.sp_sticker_enabled,
            sp_sticker_percent_min=target_data.sp_sticker_percent_min,
            sp_sticker_percent_max=target_data.sp_sticker_percent_max,
            stickers_price_percent_enabled=target_data.stickers_price_percent_enabled,
            stickers_price_percent_min=target_data.stickers_price_percent_min,
            stickers_price_percent_max=target_data.stickers_price_percent_max,
            charm_pattern_enabled=target_data.charm_pattern_enabled,
            charm_pattern_min=target_data.charm_pattern_min,
            charm_pattern_max=target_data.charm_pattern_max,
            charm_pattern_strict=target_data.charm_pattern_strict,
            charm_profit_enabled=target_data.charm_profit_enabled,
            charm_profit_min=target_data.charm_profit_min,
            charm_profit_max=target_data.charm_profit_max,
            charm_profit_use_lowest_price=target_data.charm_profit_use_lowest_price,
            discount_overpay_min=target_data.discount_overpay_min,
            discount_overpay_max=target_data.discount_overpay_max,
            fade_enabled=target_data.fade_enabled,
            fade_min=target_data.fade_min,
            fade_max=target_data.fade_max,
            float_rank=target_data.float_rank,
            phase=target_data.phase,
            description=target_data.description,
            created_at=target_data.created_at if target_data.created_at else datetime.now()
        )
        
        db.add(db_target)
        created_targets.append(db_target)
    
    db.commit()
    
    # Refresh all created targets
    for target in created_targets:
        db.refresh(target)
    
    logger.info(f"Imported {len(created_targets)} targets into config '{config_name}'")
    return {
        "message": f"Successfully imported {len(created_targets)} targets",
        "count": len(created_targets),
        "targets": [TargetResponse.from_orm(t) for t in created_targets]
    }

# ----------------------------------------------------------------------------
# History & Analytics
# ----------------------------------------------------------------------------


@app.get("/api/history", response_model=List[HistoryResponse])
async def get_history(limit: int = 1000, db: Session = Depends(get_db)):
    """Get sales history"""
    history = db.query(SalesHistory).order_by(SalesHistory.timestamp.desc()).limit(limit).all()
    return history

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity(db: Session = Depends(get_db)):
    """Get last 5 recent activity items for dashboard widget"""
    recent = db.query(SalesHistory).order_by(SalesHistory.timestamp.desc()).limit(5).all()
    
    result = []
    for item in recent:
        # Determine status based on purchased flag
        if item.purchased:
            status = "Bought"
        elif hasattr(item, 'failed') and item.failed:
            status = "Failed"
        else:
            status = "Ignored"
        
        result.append({
            "item_name": item.item_name,
            "price": item.price,
            "float_value": item.float_value,
            "status": status,
            "timestamp": item.timestamp.isoformat() if item.timestamp else None
        })
    
    return {"items": result}

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    
    items_found = db.query(SalesHistory).filter(SalesHistory.timestamp >= since_24h).count()
    items_bought = db.query(SalesHistory).filter(
        SalesHistory.timestamp >= since_24h,
        SalesHistory.purchased == True
    ).count()
    
    return {
        "items_found_24h": items_found,
        "items_bought_24h": items_bought,
        "total_targets": db.query(TargetSkin).count(),
        "active_targets": db.query(TargetSkin).filter(TargetSkin.is_active == True).count()
    }

@app.get("/api/csfloat/balance")
async def get_csfloat_balance():
    """Get current user balance from CSFloat"""
    import yaml
    from curl_cffi.requests import AsyncSession
    
    settings_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "settings.yaml")
    
    if not os.path.exists(settings_file):
        raise HTTPException(status_code=500, detail="Settings file not found")
        
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = yaml.safe_load(f)
            
        # Try to find a valid API key from available accounts
        api_key = None
        
        # 1. Check Auto Buy Accounts (Preferred for balance check)
        auto_buy_accs = settings.get('auto_buy', {}).get('accounts', [])
        if auto_buy_accs and len(auto_buy_accs) > 0:
            api_key = auto_buy_accs[0].get('api_key')
            
        # 2. Check Scanner Accounts
        if not api_key:
            scanner_accs = settings.get('scanner', {}).get('accounts', [])
            if scanner_accs and len(scanner_accs) > 0:
                api_key = scanner_accs[0].get('api_key')
                
        # 3. Fallback to legacy single key
        if not api_key:
            api_key = settings.get('scanner', {}).get('api_key')
            
        if not api_key:
             raise HTTPException(status_code=400, detail="API Key not configured in any account")
             
        # Use curl_cffi to mimic browser and avoid blocks
        async with AsyncSession(impersonate="chrome110") as session:
            response = await session.get(
                "https://csfloat.com/api/v1/me",
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                # Return just the balance part or full user info if needed
                # The user asked for "balance string", usually "user.balance" in cents
                return {
                    "balance": data.get("user", {}).get("balance", 0),
                    "currency": "USD" 
                }
            else:
                 raise HTTPException(status_code=response.status_code, detail="Failed to fetch balance from CSFloat")

    except Exception as e:
        # If curl_cffi fails (e.g. not installed in this venv for some reason, though likely is),
        # we might fallback or just error. Assuming it is since it's in other modules.
        print(f"Balance fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ----------------------------------------------------------------------------
# Bot Control
# ----------------------------------------------------------------------------

# Global variable to track bot start time
bot_start_time = None

def is_bot_running():
    """Check if main.py bot process is running"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info.get('cmdline', [])
            if cmdline and any("python" in arg.lower() for arg in cmdline) and any("main.py" in arg for arg in cmdline):
                return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return None

@app.get("/api/bot/status", response_model=BotStatusResponse)
async def get_bot_status():
    """Get bot running status"""
    global bot_start_time
    proc = is_bot_running()
    
    # Calculate uptime if bot is running
    uptime_seconds = None
    start_time_str = None
    if proc and bot_start_time:
        from datetime import datetime, timezone
        uptime_seconds = int((datetime.now(timezone.utc) - bot_start_time).total_seconds())
        start_time_str = bot_start_time.isoformat()
    
    # Try to read scan_latency from bot_stats.json
    scan_latency = 0.0
    stats_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bot_stats.json")
    if os.path.exists(stats_file):
        try:
            with open(stats_file, 'r') as f:
                stats = json.load(f)
                scan_latency = stats.get("last_scan_duration", 0.0)
        except:
            pass

    return BotStatusResponse(
        running=proc is not None,
        pid=proc.pid if proc else None,
        start_time=start_time_str,
        uptime_seconds=uptime_seconds,
        scan_latency=scan_latency
    )

@app.post("/api/bot/start")
async def start_bot():
    """Start the bot (if not running)"""
    global bot_start_time
    if is_bot_running():
        raise HTTPException(status_code=400, detail="Bot is already running")
    
    import subprocess
    from datetime import datetime, timezone
    
    # Get the parent directory (where main.py is located)
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_py_path = os.path.join(parent_dir, "main.py")
    
    subprocess.Popen(
        [sys.executable, main_py_path],
        cwd=parent_dir,
        creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
    )
    
    # Record start time
    bot_start_time = datetime.now(timezone.utc)
    
    return {"message": "Bot starting..."}

@app.post("/api/bot/stop")
async def stop_bot():
    """Stop the bot"""
    global bot_start_time
    proc = is_bot_running()
    
    if not proc:
        raise HTTPException(status_code=400, detail="Bot is not running")
    
    proc.terminate()
    
    # Clear start time
    bot_start_time = None
    
    return {"message": "Bot stopped"}

# ----------------------------------------------------------------------------
# Ping
# ----------------------------------------------------------------------------

@app.get("/api/ping/csfloat")
async def ping_csfloat():
    """Measure HTTP latency to CSFloat API"""
    import time
    from curl_cffi.requests import AsyncSession

    targets = [
        {"name": "CSFloat API", "url": "https://csfloat.com/api/v1/listings?limit=1"},
    ]
    results = []
    try:
        async with AsyncSession(impersonate="chrome110") as session:
            for target in targets:
                try:
                    start = time.monotonic()
                    r = await session.get(target["url"], timeout=10)
                    elapsed_ms = round((time.monotonic() - start) * 1000)
                    results.append({
                        "name": target["name"],
                        "url": target["url"],
                        "latency_ms": elapsed_ms,
                        "status": r.status_code,
                        "ok": True,
                    })
                except Exception as e:
                    results.append({
                        "name": target["name"],
                        "url": target["url"],
                        "latency_ms": None,
                        "status": None,
                        "ok": False,
                        "error": str(e),
                    })
    except Exception as e:
        results.append({
            "name": "CSFloat API",
            "url": "https://csfloat.com/api/v1/listings?limit=1",
            "latency_ms": None,
            "status": None,
            "ok": False,
            "error": str(e),
        })

    return {
        "results": results,
        "checked_at": datetime.utcnow().isoformat(),
    }

# ----------------------------------------------------------------------------
# Static Data (Read-only)
# ----------------------------------------------------------------------------

@app.get("/api/data/skins")
async def get_skins():
    """Get list of available skins from clean_skin_names.txt and other parsed files"""
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    files_to_read = [
        "clean_skin_names.txt",
        "parsed_agents_h1.txt",
        "parsed_charms.txt",
        "parsed_stickers.txt",
        "parsed_gloves_h1.txt"
    ]
    
    all_items = []
    
    for filename in files_to_read:
        file_path = os.path.join(base_dir, filename)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                items = [line.strip() for line in f.readlines() if line.strip()]
                all_items.extend(items)
    
    # Return unique sorted items
    return sorted(list(set(all_items)))

@app.get("/api/data/skins/categorized")
async def get_skins_categorized():
    """Get skins categorized by weapon type"""
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    # Read skin names
    skin_file = os.path.join(base_dir, "clean_skin_names.txt")
    skins_by_category = {}
    
    if os.path.exists(skin_file):
        with open(skin_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "|" in line:
                    weapon, skin_name = line.split("|", 1)
                    weapon = weapon.strip()
                    skin_name = skin_name.strip()
                    
                    # Group weapons by category
                    category = categorize_weapon(weapon)
                    if category not in skins_by_category:
                        skins_by_category[category] = {}
                    if weapon not in skins_by_category[category]:
                        skins_by_category[category][weapon] = []
                    
                    skins_by_category[category][weapon].append(skin_name)
    
    return skins_by_category

def categorize_weapon(weapon):
    """Categorize weapon by type"""
    weapon_lower = weapon.lower()
    
    # Pistols
    pistols = ["glock-18", "usp-s", "p250", "five-seven", "tec-9", "cz75-auto", "desert eagle", "r8 revolver", "p2000"]
    if any(pistol in weapon_lower for pistol in pistols):
        return "Pistols"
    
    # SMGs
    smgs = ["mp9", "mp7", "mp5-sd", "ump-45", "pp-bizon", "mac-10"]
    if any(smg in weapon_lower for smg in smgs):
        return "SMGs"
    
    # Rifles
    rifles = ["ak-47", "m4a4", "m4a1-s", "aug", "sg 553", "galil ar", "famas"]
    if any(rifle in weapon_lower for rifle in rifles):
        return "Rifles"
    
    # Sniper Rifles
    snipers = ["awp", "ssg 08", "scar-20", "g3sg1"]
    if any(sniper in weapon_lower for sniper in snipers):
        return "Sniper Rifles"
    
    # Heavy
    heavy = ["nova", "xm1014", "sawed-off", "mag-7", "m249", "negev"]
    if any(h in weapon_lower for h in heavy):
        return "Heavy"
    
    # Knives
    if "knife" in weapon_lower or "bayonet" in weapon_lower or "karambit" in weapon_lower or "m9" in weapon_lower or "bowie" in weapon_lower or "butterfly" in weapon_lower or "falchion" in weapon_lower or "huntsman" in weapon_lower or "flip" in weapon_lower or "gut" in weapon_lower or "navaja" in weapon_lower or "shadow daggers" in weapon_lower or "paracord" in weapon_lower or "survival" in weapon_lower or "ursus" in weapon_lower or "talon" in weapon_lower:
        return "Knives"
    
    # Gloves
    if "gloves" in weapon_lower or "hand wraps" in weapon_lower:
        return "Gloves"
    
    # Agents
    if "agent" in weapon_lower:
        return "Agents"
    
    # Stickers
    if "sticker" in weapon_lower:
        return "Stickers"
    
    # Charms
    if "charm" in weapon_lower:
        return "Charms"
    
    return "Other"

@app.get("/api/data/stickers")
async def get_stickers(db: Session = Depends(get_db)):
    """Get list of available stickers from database"""
    stickers = db.query(Sticker).all()
    return [s.name for s in stickers]

@app.get("/api/data/charms")
async def get_charms(db: Session = Depends(get_db)):
    """Get list of available charms from database"""
    charms = db.query(Charm).all()
    return [c.name for c in charms]

# ============================================================================
# Settings Management
# ============================================================================

def _resolve_settings_file(profile: Optional[str] = None) -> str:
    config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
    normalized = (profile or "config-1").strip().lower()

    if normalized == "config-1":
        return os.path.join(config_dir, "settings.yaml")
    if normalized == "config-2":
        return os.path.join(config_dir, "settings.config2.yaml")

    raise HTTPException(status_code=400, detail="Invalid profile. Allowed: config-1, config-2")

@app.get("/api/accounts/status")
async def get_accounts_status():
    """Get the current HTTP status of all proxies"""
    status_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "proxy_status.json")
    if os.path.exists(status_file):
        try:
            with open(status_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"error": str(e)}
    return {"scanner": {}, "market_data": {}, "auto_buy": {}}

@app.get("/api/settings")
async def get_settings(profile: Optional[str] = None):
    """Get current bot settings from config/settings files."""
    import yaml

    settings_file = _resolve_settings_file(profile)
    
    if not os.path.exists(settings_file):
        # Create default if missing? Or return error.
        # Returning empty dict for now to prevent frontend crash
        return {}
    
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = yaml.safe_load(f) or {}
            
        # Ensure 'bot' key exists for frontend safety
        if 'bot' not in settings:
            settings['bot'] = {}
            
        return settings
    except Exception as e:
        print(f"Error reading settings: {e}")
        # Return partial/empty structure to allow UI to load
        return {"error": str(e), "bot": {}, "scanner": {}, "market_data": {}, "auto_buy": {}}

@app.put("/api/settings")
async def update_settings(settings: dict, profile: Optional[str] = None):
    """Update bot settings in config/settings files."""
    import yaml
    settings_file = _resolve_settings_file(profile)
    
    try:
        with open(settings_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump(settings, f, default_flow_style=False, allow_unicode=True)
        return {"message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

# ============================================================================
# Proxy Backup Pool Management
# ============================================================================

@app.get("/api/settings/proxy-pools")
async def get_proxy_pools(profile: Optional[str] = None):
    """Get backup IP pools for all account types (scanner, market_data, auto_buy)"""
    import yaml
    settings_file = _resolve_settings_file(profile)
    
    try:
        if not os.path.exists(settings_file):
            return {"accounts": []}

        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = yaml.safe_load(f) or {}
        
        result = []
        
        # Scanner accounts
        scanner_accounts = settings.get('scanner', {}).get('accounts', [])
        for i, account in enumerate(scanner_accounts):
            result.append({
                "account_type": "scanner",
                "index": i,
                "api_key": account.get('api_key', '')[:10] + '...',
                "current_proxy": account.get('proxy', ''),
                "backup_ips": account.get('backup_ips', [])
            })
        
        # Market Data accounts
        market_data_accounts = settings.get('market_data', {}).get('accounts', [])
        for i, account in enumerate(market_data_accounts):
            result.append({
                "account_type": "market_data",
                "index": i,
                "api_key": account.get('api_key', '')[:10] + '...',
                "current_proxy": account.get('proxy', ''),
                "backup_ips": account.get('backup_ips', [])
            })
        
        # Auto-Buy accounts
        auto_buy_accounts = settings.get('auto_buy', {}).get('accounts', [])
        for i, account in enumerate(auto_buy_accounts):
            result.append({
                "account_type": "auto_buy",
                "index": i,
                "api_key": account.get('api_key', '')[:10] + '...',
                "current_proxy": account.get('proxy', ''),
                "backup_ips": account.get('backup_ips', [])
            })
        
        return {"accounts": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load proxy pools: {str(e)}")

class ProxyPoolUpdate(BaseModel):
    account_type: str  # 'scanner', 'market_data', or 'auto_buy'
    account_index: int
    backup_ips: List[str]

@app.post("/api/settings/proxy-pools")
async def update_proxy_pool(payload: ProxyPoolUpdate, profile: Optional[str] = None):
    """Update backup IP pool for any account type"""
    import yaml
    settings_file = _resolve_settings_file(profile)
    
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = yaml.safe_load(f) or {}
        else:
            settings = {}
        
        # Determine which section to update
        if payload.account_type == "scanner":
            section_key = "scanner"
        elif payload.account_type == "market_data":
            section_key = "market_data"
        elif payload.account_type == "auto_buy":
            section_key = "auto_buy"
        else:
            raise HTTPException(status_code=400, detail=f"Invalid account_type: {payload.account_type}")
        
        # Ensure section exists
        if section_key not in settings:
            settings[section_key] = {}
        if 'accounts' not in settings[section_key]:
            settings[section_key]['accounts'] = []
        
        accounts = settings[section_key]['accounts']
        
        if payload.account_index < 0 or payload.account_index >= len(accounts):
            raise HTTPException(status_code=400, detail=f"Invalid account index for {payload.account_type}")
        
        # Update backup IPs for the specified account
        accounts[payload.account_index]['backup_ips'] = payload.backup_ips
        
        # Save updated accounts back to settings dict
        settings[section_key]['accounts'] = accounts
        
        # Save back to settings file
        with open(settings_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump(settings, f, default_flow_style=False, allow_unicode=True)
        
        return {
            "message": f"Updated backup IPs for {payload.account_type} account {payload.account_index}",
            "backup_count": len(payload.backup_ips)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update proxy pool: {str(e)}")

# ============================================================================
# Queue Management
# ============================================================================

@app.get("/api/queues/status")
async def get_queue_status():
    """Get current queue status and statistics"""
    try:
        # Import here to avoid circular imports
        from modules.queue_manager import QueueManager
        import yaml
        
        # Load settings to create queue manager
        settings_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "settings.yaml")
        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = yaml.safe_load(f) or {}
        
        # Check if queue system is enabled
        if not settings.get('scanner', {}).get('queue_config', {}).get('enabled', False):
            return {"enabled": False, "message": "Queue system is disabled"}
        
        # Create queue manager instance
        queue_manager = QueueManager(settings)
        return queue_manager.get_queue_status()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")

class QueueConfig(BaseModel):
    enabled: bool
    rate_limit_threshold: int
    check_interval: float
    queues: Dict[str, dict]

@app.put("/api/queues/config")
async def update_queue_config(config: QueueConfig):
    """Update queue configuration"""
    import yaml
    settings_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "settings.yaml")
    
    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            settings = yaml.safe_load(f) or {}
        
        # Update queue configuration
        if 'scanner' not in settings:
            settings['scanner'] = {}
        
        settings['scanner']['queue_config'] = {
            'enabled': config.enabled,
            'rate_limit_threshold': config.rate_limit_threshold,
            'check_interval': config.check_interval,
            'queues': config.queues
        }
        
        # Save back to settings file
        with open(settings_file, 'w', encoding='utf-8') as f:
            yaml.safe_dump(settings, f, default_flow_style=False, allow_unicode=True)
        
        return {"message": "Queue configuration updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update queue config: {str(e)}")

# ============================================================================
# Connection Monitoring Helpers
# ============================================================================

async def check_csfloat_connection() -> bool:
    """Check if CSFloat API is accessible"""
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get("https://csfloat.com/api/v1/market/items") as response:
                return response.status == 200
    except:
        return False

async def check_steam_connection() -> bool:
    """Check if Steam API is accessible"""
    try:
        import aiohttp
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get("https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/") as response:
                return response.status == 200
    except:
        return False

async def measure_latency() -> int:
    """Measure latency to CSFloat API in milliseconds"""
    try:
        import aiohttp
        import time
        start_time = time.time()
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get("https://csfloat.com/api/v1/market/items") as response:
                if response.status == 200:
                    latency_ms = int((time.time() - start_time) * 1000)
                    return latency_ms
    except:
        pass
    return 999  # Return high latency on failure

# ============================================================================
# Real-time Stats for Live Monitor
# ============================================================================

class LiveStatsResponse(BaseModel):
    scanned_total: int
    scanned_per_min: int
    matches_found: int
    buy_attempts: int
    successful_buys: int
    failed_buys: int
    avg_speed: int
    connection_csfloat: bool
    connection_steam: bool
    latency: int

@app.get("/api/live/stats", response_model=LiveStatsResponse)
async def get_live_stats(db: Session = Depends(get_db)):
    """Get real-time statistics for Live Monitor dashboard"""
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    since_1min = now - timedelta(minutes=1)
    since_24h = now - timedelta(hours=24)
    
    # Get scanning stats from logs (approximate)
    try:
        log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "cssniper.log")
        scanned_per_min = 0
        matches_found = 0
        buy_attempts = 0
        successful_buys = 0
        failed_buys = 0
        
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()[-100:]  # Last 100 lines for performance
                
                for line in lines:
                    if "Scanning" in line:
                        scanned_per_min += 1
                    elif "Found matching item" in line:
                        matches_found += 1
                    elif "Buying" in line or "Attempting purchase" in line:
                        buy_attempts += 1
                    elif "Successfully bought" in line:
                        successful_buys += 1
                    elif "Failed" in line and ("buy" in line.lower() or "purchase" in line.lower()):
                        failed_buys += 1
        
        # Get total scanned from database history
        total_scanned = db.query(SalesHistory).filter(SalesHistory.timestamp >= since_24h).count()
        
        # Calculate average speed (mock for now, could be calculated from log timestamps)
        avg_speed = 47  # ms
        
        # Check connection status with actual pings
        connection_csfloat = await check_csfloat_connection()
        connection_steam = await check_steam_connection()
        latency = await measure_latency()
        
        return LiveStatsResponse(
            scanned_total=total_scanned + scanned_per_min,
            scanned_per_min=scanned_per_min,
            matches_found=matches_found,
            buy_attempts=buy_attempts,
            successful_buys=successful_buys,
            failed_buys=failed_buys,
            avg_speed=avg_speed,
            connection_csfloat=connection_csfloat,
            connection_steam=connection_steam,
            latency=latency
        )
        
    except Exception as e:
        print(f"Error calculating live stats: {e}")
        # Return default values on error
        return LiveStatsResponse(
            scanned_total=0,
            scanned_per_min=0,
            matches_found=0,
            buy_attempts=0,
            successful_buys=0,
            failed_buys=0,
            avg_speed=0,
            connection_csfloat=False,
            connection_steam=False,
            latency=999
        )

# ============================================================================
# Logs
# ============================================================================

@app.get("/api/logs")
async def get_logs(lines: int = 20):
    """Get last N lines from logs/cssniper.log"""
    log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "cssniper.log")
    
    if not os.path.exists(log_file):
        return {"logs": [], "message": "Log file not found"}
    
    try:
        # Read last N lines efficiently
        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
            # Get file size
            f.seek(0, 2)
            file_size = f.tell()
            
            # Read from end in chunks
            block_size = 8192
            blocks = []
            lines_found = []
            
            # Start from end
            position = file_size
            
            while position > 0 and len(lines_found) < lines:
                # Move back by block_size
                position = max(0, position - block_size)
                f.seek(position)
                block = f.read(min(block_size, file_size - position))
                blocks.insert(0, block)
                
                # Get lines from combined blocks
                combined = ''.join(blocks)
                lines_found = combined.split('\n')
            
            # Return last N lines (excluding empty last line)
            result_lines = [l for l in lines_found if l.strip()][-lines:]
            return {"logs": result_lines}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")

# ============================================================================
# Notifications
# ============================================================================

class NotificationCreate(BaseModel):
    """Модель для создания уведомления"""
    type: str  # 'info', 'success', 'warning', 'error', 'autobuy'
    source: str  # 'scanner', 'autobuy', 'market_data', 'system', 'error'
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None


class NotificationResponse(BaseModel):
    """Модель ответа уведомления"""
    id: str
    type: str
    source: str
    title: str
    message: str
    timestamp: str
    read: bool
    data: Optional[Dict[str, Any]] = None


def get_notification_db():
    """Get database connection for notifications"""
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        yield db
    finally:
        db.close()


@app.post("/api/notifications", response_model=NotificationResponse)
async def create_notification(notification: NotificationCreate):
    """
    Создать новое уведомление.
    Уведомления сохраняются в базе данных.
    """
    import uuid
    from datetime import datetime
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        notification_id = str(uuid.uuid4())

        # Create notification in database
        db_notification = Notification(
            id=notification_id,
            type=notification.type,
            source=notification.source,
            title=notification.title,
            message=notification.message,
            read=False,
            data=notification.data or {}
        )

        db.add(db_notification)
        db.commit()
        db.refresh(db_notification)

        logger.info(f"Notification created: {notification.type} - {notification.title}")

        return NotificationResponse(
            id=db_notification.id,
            type=db_notification.type,
            source=db_notification.source,
            title=db_notification.title,
            message=db_notification.message,
            timestamp=db_notification.timestamp.isoformat(),
            read=db_notification.read,
            data=db_notification.data
        )
    finally:
        db.close()


@app.get("/api/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    notification_type: Optional[str] = None,
    source: Optional[str] = None
):
    """
    Получить список уведомлений из базы данных.
    """
    from database.database import get_db
    from database.models import Notification
    from sqlalchemy import desc

    db = next(get_db())
    try:
        # Build query
        query = db.query(Notification)

        # Apply filters
        if unread_only:
            query = query.filter(Notification.read == False)

        if notification_type:
            query = query.filter(Notification.type == notification_type)

        if source:
            query = query.filter(Notification.source == source)

        # Sort by timestamp (newest first)
        query = query.order_by(desc(Notification.timestamp))

        # Limit results
        notifications = query.limit(limit).all()

        logger.debug(f"GET /api/notifications: returning {len(notifications)} notifications")

        # Convert to response format
        result = []
        for notif in notifications:
            result.append(NotificationResponse(
                id=notif.id,
                type=notif.type,
                source=notif.source,
                title=notif.title,
                message=notif.message,
                timestamp=notif.timestamp.isoformat(),
                read=notif.read,
                data=notif.data
            ))

        return result
    finally:
        db.close()


@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_as_read(notification_id: str):
    """Пометить уведомление как прочитанное"""
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        notification = db.query(Notification).filter(Notification.id == notification_id).first()

        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        notification.read = True
        db.commit()

        return {"status": "success", "message": "Notification marked as read"}
    finally:
        db.close()


@app.put("/api/notifications/read-all")
async def mark_all_notifications_as_read():
    """Пометить все уведомления как прочитанные"""
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        db.query(Notification).update({Notification.read: True})
        db.commit()

        return {"status": "success", "message": "All notifications marked as read"}
    finally:
        db.close()


@app.delete("/api/notifications/{notification_id}")
async def delete_notification(notification_id: str):
    """Удалить уведомление"""
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        notification = db.query(Notification).filter(Notification.id == notification_id).first()

        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        db.delete(notification)
        db.commit()

        return {"status": "success", "message": "Notification deleted"}
    finally:
        db.close()


@app.delete("/api/notifications")
async def delete_all_notifications():
    """Удалить все уведомления"""
    from database.database import get_db
    from database.models import Notification

    db = next(get_db())
    try:
        db.query(Notification).delete()
        db.commit()

        return {"status": "success", "message": "All notifications deleted"}
    finally:
        db.close()


# ============================================================================
# Target Notification Settings
# ============================================================================

@app.put("/api/targets/{target_id}")
async def update_target(target_id: int, target_update: Dict[str, Any]):
    """Обновить настройки таргета (включая notifications_enabled)"""
    db = next(get_db())
    try:
        from database.models import TargetSkin
        target = db.query(TargetSkin).filter(TargetSkin.id == target_id).first()

        if not target:
            raise HTTPException(status_code=404, detail="Target not found")

        # Update fields
        update_data = {k: v for k, v in target_update.items() if v is not None}
        for field, value in update_data.items():
            if hasattr(target, field):
                setattr(target, field, value)

        db.commit()
        db.refresh(target)

        return {
            "id": target.id,
            "item_name": target.item_name,
            "notifications_enabled": target.notifications_enabled if hasattr(target, 'notifications_enabled') else True,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update target: {str(e)}")
    finally:
        db.close()


# ============================================================================
# Static Files & Frontend Serving (Moved to end)
# ============================================================================

# Frontend path - using the new version (sn1perb0t111-main/dist)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sn1perb0t111-main", "dist")

if os.path.exists(frontend_path):
    # Mount assets directory
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

# Mount vanilla JS frontend (frontend/)
vanilla_frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(vanilla_frontend_path):
    app.mount("/static", StaticFiles(directory=vanilla_frontend_path), name="static")


# Catch-all for SPA (must be last)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    """Serve index.html for any non-API path (SPA routing)"""
    # If API path wasn't matched above, return 404 instead of index.html
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
        
    # Serve static files from root if they exist (e.g. favicon.ico)
    file_path = os.path.join(frontend_path, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
        
    # Otherwise serve index.html for client-side routing
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "error", "message": "Frontend not found"}


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
