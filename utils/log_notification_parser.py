"""
Log Parser for CSFloat Sniper Bot
Parses bot logs and sends notifications to the web interface.
"""

import re
import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

NOTIFICATION_API_URL = "http://localhost:8000/api/notifications"


class LogNotificationParser:
    """Parses log lines and extracts notification data"""
    
    # Patterns for different notification types
    PATTERNS = {
        # Match Found
        "match_found": {
            "pattern": r"(?:Found matching item|Match found|Target matched)[:\s]+(.+?)(?:\s*\(|$)",
            "type": "success",
            "source": "scanner",
            "title": "🎯 Match Found!",
        },
        # Purchase Successful
        "purchase_success": {
            "pattern": r"(?:Successfully bought|Purchase successful|Successfully purchased)[:\s]+(.+?)(?:\s*for|$)",
            "type": "autobuy",
            "source": "autobuy",
            "title": "✅ Purchase Successful!",
        },
        # Purchase Failed
        "purchase_failed": {
            "pattern": r"(?:Failed to buy|Purchase failed|Buy failed)[:\s]+(.+?)(?:\:|$)",
            "type": "error",
            "source": "autobuy",
            "title": "❌ Purchase Failed",
        },
        # Rate Limit
        "rate_limit": {
            "pattern": r"(?:Rate limit|Rate limited|429)",
            "type": "warning",
            "source": "scanner",
            "title": "⚠️ Rate Limit Reached",
        },
        # Connection Error
        "connection_error": {
            "pattern": r"(?:Connection error|Connection failed|Connection timeout)",
            "type": "error",
            "source": "error",
            "title": "🔌 Connection Error",
        },
        # Scanning Started
        "scanning_started": {
            "pattern": r"(?:Starting scan|Scan started|Scanning started)",
            "type": "info",
            "source": "scanner",
            "title": "🔍 Scanning Started",
        },
        # Scanning Stopped
        "scanning_stopped": {
            "pattern": r"(?:Scan stopped|Scanning stopped|Stopping scan)",
            "type": "info",
            "source": "scanner",
            "title": "⏹️ Scanning Stopped",
        },
        # Insufficient Balance
        "insufficient_balance": {
            "pattern": r"(?:Insufficient balance|Not enough funds|Balance too low)",
            "type": "error",
            "source": "autobuy",
            "title": "💸 Insufficient Balance",
        },
    }
    
    def __init__(self, api_url: str = NOTIFICATION_API_URL):
        self.api_url = api_url
        self.sent_notifications = set()  # Track sent notifications to avoid duplicates
    
    def parse_line(self, log_line: str) -> Optional[Dict[str, Any]]:
        """Parse a single log line and extract notification data"""
        for notif_type, config in self.PATTERNS.items():
            match = re.search(config["pattern"], log_line, re.IGNORECASE)
            if match:
                # Extract additional data from log line
                data = self._extract_data(log_line)
                
                return {
                    "type": config["type"],
                    "source": config["source"],
                    "title": config["title"],
                    "message": log_line.strip(),
                    "data": data,
                }
        
        return None
    
    def _extract_data(self, log_line: str) -> Dict[str, Any]:
        """Extract structured data from log line"""
        data = {}
        
        # Extract price
        price_match = re.search(r'\$?([\d,]+\.?\d*)', log_line)
        if price_match:
            try:
                data["price"] = float(price_match.group(1).replace(",", ""))
            except ValueError:
                pass
        
        # Extract float
        float_match = re.search(r'[Ff]loat[:\s]+([\d.]+)', log_line)
        if float_match:
            try:
                data["float"] = float(float_match.group(1))
            except ValueError:
                pass
        
        # Extract item ID
        id_match = re.search(r'(?:item_id|asset_id|ID)[:\s]+(\d+)', log_line, re.IGNORECASE)
        if id_match:
            data["item_id"] = id_match.group(1)
        
        # Extract pattern
        pattern_match = re.search(r'[Pp]attern[:\s]+#?(\d+)', log_line)
        if pattern_match:
            data["pattern"] = pattern_match.group(1)
        
        return data
    
    def send_notification(self, notification: Dict[str, Any]) -> bool:
        """Send notification to API"""
        try:
            # Create unique key to avoid duplicates
            notif_key = f"{notification['type']}:{notification['title']}:{notification['message'][:50]}"
            skip_dedup = notification.get('type') == 'success' and notification.get('source') == 'scanner'

            if not skip_dedup and notif_key in self.sent_notifications:
                logger.debug(f"Skipping duplicate notification: {notification['title']}")
                return False

            response = requests.post(
                self.api_url,
                json=notification,
                timeout=5  # Increased timeout
            )

            if response.status_code == 200:
                logger.info(f"Notification sent: {notification['type']} - {notification['title']}")
                if not skip_dedup:
                    self.sent_notifications.add(notif_key)
                    # Clean old notifications from set (keep last 100)
                    if len(self.sent_notifications) > 100:
                        self.sent_notifications = set(list(self.sent_notifications)[-100:])
                return True
            else:
                logger.error(f"API returned status {response.status_code}: {response.text}")
                return False

        except requests.exceptions.ConnectionError:
            logger.error(f"Failed to send notification: Connection refused to {self.api_url}")
            return False
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False
    
    def process_log_file(self, log_file_path: str, lines: int = 10) -> int:
        """Process last N lines of log file and send notifications"""
        try:
            with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Get last N lines
                all_lines = f.readlines()
                last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
            notifications_sent = 0
            for line in last_lines:
                notification = self.parse_line(line.strip())
                if notification:
                    if self.send_notification(notification):
                        notifications_sent += 1
            
            return notifications_sent
            
        except Exception as e:
            logger.debug(f"Failed to process log file: {e}")
            return 0


# Integration with bot logging
class NotificationLogHandler(logging.Handler):
    """Logging handler that sends notifications to web interface"""

    def __init__(self, api_url: str = NOTIFICATION_API_URL):
        super().__init__()
        self.parser = LogNotificationParser(api_url)
        self.setLevel(logging.INFO)
        # Track sent notification hashes to avoid duplicates
        self._sent_hashes = set()
        self._max_hashes = 1000

    def _get_notification_hash(self, notif_type: str, title: str, message: str) -> str:
        """Create a unique hash for notification deduplication"""
        import hashlib
        # Use first 100 chars of message to avoid huge hashes
        msg_preview = message[:100] if message else ""
        key = f"{notif_type}:{title}:{msg_preview}"
        return hashlib.md5(key.encode()).hexdigest()

    def emit(self, record):
        try:
            log_entry = self.format(record)

            # Determine notification type based on log level and content
            notif_type = None
            source = "system"
            title = "📢 Notification"

            if record.levelno >= logging.ERROR:
                notif_type = "error"
                source = "error"
                title = "💥 Error"
            elif record.levelno >= logging.WARNING:
                notif_type = "warning"
                source = "system"
                title = "⚠️ Warning"
            elif record.levelno >= logging.INFO:
                # Check for specific INFO patterns
                if "Successfully bought" in log_entry or "Purchase successful" in log_entry:
                    notif_type = "autobuy"
                    source = "autobuy"
                    title = "✅ Purchase Successful!"
                elif "Failed to buy" in log_entry or "Purchase failed" in log_entry:
                    notif_type = "error"
                    source = "autobuy"
                    title = "❌ Purchase Failed"
                elif "Rate limit" in log_entry or "429" in log_entry:
                    notif_type = "warning"
                    source = "scanner"
                    title = "⚠️ Rate Limit Reached"
                elif "Connection error" in log_entry or "Connection failed" in log_entry:
                    notif_type = "error"
                    source = "error"
                    title = "🔌 Connection Error"
                elif "Starting scan" in log_entry or "Scan started" in log_entry:
                    notif_type = "info"
                    source = "scanner"
                    title = "🔍 Scanning Started"
                elif "Scan stopped" in log_entry or "Stopping scan" in log_entry:
                    notif_type = "info"
                    source = "scanner"
                    title = "⏹️ Scanning Stopped"
                elif "Insufficient balance" in log_entry or "Not enough funds" in log_entry:
                    notif_type = "error"
                    source = "autobuy"
                    title = "💸 Insufficient Balance"
                else:
                    # Don't send other info logs
                    return
            else:
                return

            # Check for duplicates (do NOT deduplicate match-found events)
            # Match events are high-frequency and can have similar log messages;
            # dedup here can drop valid new found-item notifications.
            skip_dedup = notif_type == "success" and source == "scanner"
            if not skip_dedup:
                notif_hash = self._get_notification_hash(notif_type, title, log_entry)
                if notif_hash in self._sent_hashes:
                    return  # Skip duplicate

                # Add to sent hashes
                self._sent_hashes.add(notif_hash)
                # Clean old hashes if too many
                if len(self._sent_hashes) > self._max_hashes:
                    # Remove oldest 50%
                    self._sent_hashes = set(list(self._sent_hashes)[self._max_hashes // 2:])

            notification = {
                "type": notif_type,
                "source": source,
                "title": title,
                "message": log_entry,
                "data": {
                    "level": record.levelname,
                    "module": record.module,
                    "function": record.funcName,
                }
            }

            self.parser.send_notification(notification)

        except Exception:
            self.handleError(record)


# Example usage
if __name__ == "__main__":
    parser = LogNotificationParser()
    
    # Test with sample log lines
    test_logs = [
        "2024-03-19 20:00:00 - INFO - Found matching item: AK-47 | Case Hardened (Float: 0.0021) - $1,245",
        "2024-03-19 20:01:00 - INFO - Successfully bought: Karambit | Fade for $1,890",
        "2024-03-19 20:02:00 - ERROR - Failed to buy 12345: Insufficient balance",
        "2024-03-19 20:03:00 - WARNING - Rate limit reached, waiting 5 seconds",
    ]
    
    for log_line in test_logs:
        notification = parser.parse_line(log_line)
        if notification:
            print(f"Would send: {notification['title']} - {notification['message']}")
