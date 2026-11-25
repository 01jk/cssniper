import os
import json
import time
import asyncio
import logging
from typing import Dict, Any
from threading import Lock

logger = logging.getLogger("CSSniper")

class StatusTracker:
    _instance = None
    _lock = Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(StatusTracker, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        with self._lock:
            if not self._initialized:
                # Structure: { account_type: { str(index): { status_code: int, error: str, last_updated: float } } }
                self.statuses: Dict[str, Dict[str, Any]] = {
                    "scanner": {},
                    "market_data": {},
                    "auto_buy": {}
                }
                self.status_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "proxy_status.json")
                self._initialized = True

    def update_status(self, account_type: str, index: int, status_code: int, error: str = ""):
        """Update the status of a specific account"""
        with self._lock:
            if account_type not in self.statuses:
                self.statuses[account_type] = {}
            
            self.statuses[account_type][str(index)] = {
                "status_code": status_code,
                "error": error,
                "last_updated": time.time()
            }

    def get_all_statuses(self) -> dict:
        """Get a copy of all current statuses"""
        with self._lock:
            return json.loads(json.dumps(self.statuses))

    async def start_saving_loop(self, interval: int = 5):
        """Background asyncio task to save statuses to file"""
        logger.info("Started status tracker saving loop")
        while True:
            try:
                data = self.get_all_statuses()
                with open(self.status_file, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            except Exception as e:
                logger.debug(f"Failed to save proxy status: {e}")
            
            await asyncio.sleep(interval)

# Global singleton instance
status_tracker = StatusTracker()
