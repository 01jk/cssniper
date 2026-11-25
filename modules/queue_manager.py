import asyncio
import time
import logging
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger("CSSniper")

class QueueStatus(Enum):
    ACTIVE = "active"
    COOLDOWN = "cooldown"
    WAITING = "waiting"

@dataclass
class QueueAccount:
    api_key: str
    proxy: str
    queue_id: int
    index: int
    rate_limit_until: float = 0
    is_active: bool = True

class QueueManager:
    def __init__(self, settings: dict):
        self.settings = settings
        self.queues: Dict[int, List[QueueAccount]] = {}
        self.queue_status: Dict[int, QueueStatus] = {}
        self.active_queue: int = 1
        self.rate_limit_threshold: int = 3  # Количество аккаунтов с 429 для переключения очереди
        self.check_interval: float = 5.0  # Интервал проверки состояния очередей
        
        # Инициализация очередей из настроек
        self._initialize_queues()
        
    def _initialize_queues(self):
        """Инициализация очередей из настроек с фильтрацией отключенных аккаунтов"""
        all_scanner_accounts = self.settings.get('scanner', {}).get('accounts', [])
        queue_config = self.settings.get('scanner', {}).get('queue_config', {})
        
        # Фильтруем только включенные аккаунты (enabled=True или не задано)
        scanner_accounts = [acc for acc in all_scanner_accounts if acc.get('enabled', True) is not False]
        
        # Логируем сколько аккаунтов отфильтровано
        filtered_count = len(all_scanner_accounts) - len(scanner_accounts)
        if filtered_count > 0:
            logger.info(f"[QUEUE] Filtered out {filtered_count} disabled accounts from queues")
        
        # Если нет конфигурации очередей, создаем одну очередь по умолчанию
        if not queue_config or 'queues' not in queue_config:
            logger.info("No queue configuration found, creating default single queue")
            self.queues[1] = [
                QueueAccount(
                    api_key=acc.get('api_key', ''),
                    proxy=acc.get('proxy', ''),
                    queue_id=1,
                    index=i
                ) for i, acc in enumerate(scanner_accounts)
            ]
            self.queue_status[1] = QueueStatus.ACTIVE
        else:
            # Инициализация из конфигурации
            for queue_id, queue_info in queue_config['queues'].items():
                queue_id = int(queue_id)
                start_idx = queue_info.get('start_index', 0)
                end_idx = queue_info.get('end_index', len(scanner_accounts) - 1)
                
                # Пересчитываем индексы с учетом фильтрации
                # Используем исходные индексы из настроек, но только для включенных аккаунтов
                self.queues[queue_id] = []
                for i in range(start_idx, min(end_idx + 1, len(all_scanner_accounts))):
                    if i < len(all_scanner_accounts) and all_scanner_accounts[i].get('enabled', True) is not False:
                        self.queues[queue_id].append(QueueAccount(
                            api_key=all_scanner_accounts[i].get('api_key', ''),
                            proxy=all_scanner_accounts[i].get('proxy', ''),
                            queue_id=queue_id,
                            index=i
                        ))
                
                self.queue_status[queue_id] = QueueStatus.WAITING
                
            # Устанавливаем первую очередь как активную
            if self.queues:
                self.active_queue = min(self.queues.keys())
                self.queue_status[self.active_queue] = QueueStatus.ACTIVE
                
        # Настройки из конфигурации
        self.rate_limit_threshold = queue_config.get('rate_limit_threshold', 3)
        self.check_interval = queue_config.get('check_interval', 5.0)
        
        logger.info(f"Initialized {len(self.queues)} queues")
        for queue_id, accounts in self.queues.items():
            logger.info(f"Queue {queue_id}: {len(accounts)} accounts, status: {self.queue_status[queue_id].value}")
    
    def get_active_accounts(self) -> List[QueueAccount]:
        """Получить аккаунты из активной очереди"""
        if self.active_queue not in self.queues:
            return []
        
        return [acc for acc in self.queues[self.active_queue] if acc.is_active]
    
    def mark_rate_limit(self, account_index: int, retry_after: float):
        """Отметить аккаунт как достигший rate limit"""
        current_time = time.time()
        found = False
        
        # Найти аккаунт по индексу в активной очереди
        for acc in self.queues.get(self.active_queue, []):
            if acc.index == account_index:
                acc.rate_limit_until = current_time + retry_after
                logger.warning(f"[QUEUE] Account {acc.index} in queue {acc.queue_id} marked as rate limited for {retry_after}s (until {acc.rate_limit_until:.0f})")
                found = True
                break
        
        if not found:
            logger.error(f"[QUEUE] Account {account_index} not found in active queue {self.active_queue}")
            # Show available accounts in queue for debugging
            for acc in self.queues.get(self.active_queue, []):
                logger.debug(f"[QUEUE]   Available account index: {acc.index}")
        
        # Проверить нужно ли переключить очередь
        self._check_queue_switch()
    
    def _check_queue_switch(self):
        """Проверить условия для переключения очереди"""
        if self.active_queue not in self.queues:
            logger.warning(f"[QUEUE] Active queue {self.active_queue} not found in queues")
            return
        
        current_queue = self.queues[self.active_queue]
        current_time = time.time()
        rate_limited_count = sum(1 for acc in current_queue if acc.rate_limit_until > current_time)
        
        # Detailed logging for debugging
        logger.info(f"[QUEUE] Queue {self.active_queue} status: {rate_limited_count}/{len(current_queue)} accounts rate limited (threshold: {self.rate_limit_threshold})")
        
        # Show each account status
        for acc in current_queue:
            status = "RATE_LIMITED" if acc.rate_limit_until > current_time else "ACTIVE"
            remaining = max(0, acc.rate_limit_until - current_time) if acc.rate_limit_until > current_time else 0
            logger.debug(f"[QUEUE]   Account {acc.index}: {status} (cooldown: {remaining:.0f}s)")
        
        # Если количество аккаунтов с rate limit достигло порога, переключаем очередь
        if rate_limited_count >= self.rate_limit_threshold:
            logger.warning(f"[QUEUE] THRESHOLD REACHED! Queue {self.active_queue} has {rate_limited_count} rate limited accounts (>= {self.rate_limit_threshold}), switching queue")
            self._switch_to_next_queue()
    
    def _switch_to_next_queue(self):
        """Переключиться на следующую доступную очередь"""
        # Помечаем текущую очередь как в cooldown
        self.queue_status[self.active_queue] = QueueStatus.COOLDOWN
        
        # Ищем следующую очередь со статусом WAITING
        queue_ids = sorted(self.queues.keys())
        current_idx = queue_ids.index(self.active_queue)
        
        for i in range(1, len(queue_ids)):
            next_queue_id = queue_ids[(current_idx + i) % len(queue_ids)]
            if self.queue_status[next_queue_id] == QueueStatus.WAITING:
                # Переключаемся на следующую очередь
                self.active_queue = next_queue_id
                self.queue_status[self.active_queue] = QueueStatus.ACTIVE
                logger.info(f"Switched to queue {self.active_queue}")
                
                # Отправляем уведомление
                self._send_queue_switch_notification()
                return
        
        # Если нет доступных очередей, остаемся в текущей и ждем
        logger.warning("No available queues to switch to, staying in current queue")
        self.queue_status[self.active_queue] = QueueStatus.ACTIVE
    
    def _send_queue_switch_notification(self):
        """Отправить уведомление о переключении очереди"""
        try:
            from modules.notifier import notifier
            notifier.send_queue_change_notification(
                queue_name=f"Queue #{self.active_queue}",
                action="switch",
                item_count=len(self.queues[self.active_queue])
            )
            logger.info(f"Queue switch notification sent for queue {self.active_queue}")
        except Exception as e:
            logger.error(f"Failed to send queue switch notification: {e}")
    
    async def start_queue_monitoring(self):
        """Запустить фоновую задачу мониторинга очередей"""
        logger.info("Starting queue monitoring task")
        while True:
            try:
                await self._monitor_queues()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in queue monitoring: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def _monitor_queues(self):
        """Мониторинг состояния очередей и восстановление"""
        current_time = time.time()
        
        # Проверяем все очереди
        for queue_id, accounts in self.queues.items():
            # Проверяем аккаунты в очереди
            rate_limited_count = sum(1 for acc in accounts if acc.rate_limit_until > current_time)
            total_count = len(accounts)
            
            # Если все аккаунты восстановились и очередь в cooldown, переводим в waiting
            if (self.queue_status[queue_id] == QueueStatus.COOLDOWN and 
                rate_limited_count == 0 and 
                queue_id != self.active_queue):
                self.queue_status[queue_id] = QueueStatus.WAITING
                logger.info(f"Queue {queue_id} recovered and moved to waiting status")
            
            # Восстанавливаем аккаунты с истекшим rate limit
            for acc in accounts:
                if acc.rate_limit_until > 0 and acc.rate_limit_until <= current_time:
                    acc.rate_limit_until = 0
                    logger.debug(f"Account {acc.index} in queue {acc.queue_id} recovered from rate limit")
        
        # Логирование текущего состояния
        active_accounts = self.get_active_accounts()
        logger.debug(f"Current state: Active queue {self.active_queue}, {len(active_accounts)} active accounts")
    
    def get_queue_status(self) -> dict:
        """Получить статус всех очередей для API"""
        current_time = time.time()
        status = {
            'active_queue': self.active_queue,
            'queues': {}
        }
        
        for queue_id, accounts in self.queues.items():
            rate_limited_count = sum(1 for acc in accounts if acc.rate_limit_until > current_time)
            status['queues'][queue_id] = {
                'status': self.queue_status[queue_id].value,
                'total_accounts': len(accounts),
                'rate_limited_accounts': rate_limited_count,
                'active_accounts': len([acc for acc in accounts if acc.is_active])
            }
        
        return status
    
    def is_account_available(self, account_index: int) -> bool:
        """Проверить доступен ли аккаунт для использования"""
        current_time = time.time()
        
        for acc in self.queues.get(self.active_queue, []):
            if acc.index == account_index:
                return acc.is_active and acc.rate_limit_until <= current_time
        
        return False
