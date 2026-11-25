from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, DateTime, create_engine, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class TargetConfig(Base):
    __tablename__ = 'target_configs'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    emoji = Column(String, nullable=True)

class StickerTier(Base):
    __tablename__ = 'sticker_tiers'
    
    id = Column(Integer, primary_key=True)
    sticker_name = Column(String, unique=True, nullable=False)
    tier = Column(Integer, nullable=False)
    base_sp_percent = Column(Float, default=0.0)
    best_pos_multiplier = Column(Float, default=1.0)
    snatch_enabled = Column(Boolean, default=False)
    snatch_max_price = Column(String, default="Market + $0")

class Sticker(Base):
    __tablename__ = 'stickers_list'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class Charm(Base):
    __tablename__ = 'charms_list'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

class TargetSkin(Base):
    __tablename__ = 'target_skins'
    
    id = Column(Integer, primary_key=True)
    item_name = Column(String, nullable=False)
    min_price = Column(Float, default=0.0)
    max_price = Column(Float, nullable=False)
    min_float = Column(Float, default=0.0)
    max_float = Column(Float, default=1.0)
    paint_seed = Column(String, nullable=True) # Comma separated seeds if needed
    stickers = Column(JSON, nullable=True) # List of sticker names
    charms = Column(JSON, nullable=True) # List of charm names
    blue_gem_tier = Column(Integer, nullable=True) # 1, 2, or 3
    mode = Column(String, default="Notify Only") # "Notify Only" or "Auto Buy"
    markup_pct = Column(Float, default=0.0)
    markup_mult = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    is_stattrak = Column(Boolean, nullable=True)  # None = Any, True = StatTrak only, False = Non-StatTrak only
    is_souvenir = Column(Boolean, nullable=True)  # None = Any, True = Souvenir only, False = Non-Souvenir only
    is_normal = Column(Boolean, nullable=True)  # None = Any, True = Normal only, False = Non-Normal only
    rarity_name = Column(String, nullable=True)  # Item rarity filter (e.g., "covert", "classified", etc.)
    zero_price_filter = Column(Boolean, default=False)  # Filter for items where predicted_price == price
    playside_blue_enabled = Column(Boolean, default=False)  # Enable playside blue filter
    playside_blue_min = Column(Float, default=0.0)  # Minimum playside blue percentage
    playside_blue_max = Column(Float, default=100.0)  # Maximum playside blue percentage
    backside_blue_enabled = Column(Boolean, default=False)  # Enable backside blue filter
    backside_blue_min = Column(Float, default=0.0)  # Minimum backside blue percentage
    backside_blue_max = Column(Float, default=100.0)  # Maximum backside blue percentage
    sp_sticker_enabled = Column(Boolean, default=False)  # Enable sticker percentage filter
    sp_sticker_percent_min = Column(Float, default=0.0)  # Minimum sticker wear percentage
    sp_sticker_percent_max = Column(Float, default=100.0)  # Maximum sticker wear percentage
    # Stickers Price Percentage Filter (новый фильтр для процента от цены наклеек)
    stickers_price_percent_enabled = Column(Boolean, default=False)  # Enable stickers price percentage filter
    stickers_price_percent_min = Column(Float, default=0.0)  # Minimum sticker price percentage
    stickers_price_percent_max = Column(Float, default=100.0)  # Maximum sticker price percentage
    charm_pattern_enabled = Column(Boolean, default=False)  # Enable charm pattern filter
    charm_pattern_min = Column(Integer, default=0)  # Minimum charm pattern
    charm_pattern_max = Column(Integer, default=100000)  # Maximum charm pattern
    charm_pattern_strict = Column(Boolean, default=True)  # Strict mode: false = ignore charms without pattern
    # Charm Profit
    charm_profit_enabled = Column(Boolean, default=False)  # Enable charm profit filter
    charm_profit_min = Column(Float, default=0.0)  # Minimum charm profit percentage
    charm_profit_max = Column(Float, default=100.0)  # Maximum charm profit percentage
    charm_profit_use_lowest_price = Column(Boolean, default=False) # Use Lowest Market Price instead of Highest Buy Order
    # Discount / Overpay
    discount_overpay_min = Column(Float, nullable=True)
    discount_overpay_max = Column(Float, nullable=True)
    # Fade
    fade_enabled = Column(Boolean, default=False)  # Enable fade filter
    fade_min = Column(Float, nullable=True)
    fade_max = Column(Float, nullable=True)
    # Float Rank Badge Filter (null = any, 'gold_highest_float', 'silver_highest_float', 'bronze_highest_float')
    float_rank = Column(String, nullable=True)
    # Phase/Gem filter
    phase = Column(String, nullable=True)
    # Grouping
    config_name = Column(String, default="Default")

    # User Notes
    description = Column(String, nullable=True)

    # Notification Settings
    notifications_enabled = Column(Boolean, default=True)  # Enable/disable notifications for this target

    # Creation Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SalesHistory(Base):
    __tablename__ = 'sales_history'
    
    id = Column(Integer, primary_key=True)
    asset_id = Column(String, unique=True, nullable=False)
    item_name = Column(String, nullable=False)
    wear_name = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    float_value = Column(Float)
    paint_seed = Column(Integer)
    stickers = Column(JSON)
    purchased = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    markup_pct = Column(Float, nullable=True)
    markup_mult = Column(Float, nullable=True)
    sell_price = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)

class Blacklist(Base):
    __tablename__ = 'blacklist'

    id = Column(Integer, primary_key=True)
    value = Column(String, unique=True, nullable=False) # asset_id or seller_id
    type = Column(String, nullable=False) # "asset" or "seller"

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(String, primary_key=True)  # UUID string
    type = Column(String, nullable=False)  # 'info', 'success', 'warning', 'error', 'autobuy'
    source = Column(String, nullable=False)  # 'scanner', 'autobuy', 'market_data', 'system', 'error'
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    read = Column(Boolean, default=False)
    data = Column(JSON, nullable=True)  # Additional data
