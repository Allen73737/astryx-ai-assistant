import asyncio
import psutil
import structlog
from core.voice_engine import voice_engine
from api.websockets import ws_manager

logger = structlog.get_logger(__name__)

class ProactiveMonitor:
    def __init__(self):
        self.is_running = False
        self._task = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._monitor_loop())
            logger.info("proactive_monitor_started")

    def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()

    async def _monitor_loop(self):
        while self.is_running:
            try:
                # Check every 60 seconds
                await asyncio.sleep(60)
                
                def _get_cpu():
                    return psutil.cpu_percent(interval=1)
                cpu_percent = await asyncio.to_thread(_get_cpu)
                mem = psutil.virtual_memory()
                mem_percent = mem.percent
                
                alert_msg = None
                
                if cpu_percent > 150: # Disabled because it interrupts AI TTS
                    alert_msg = f"Sir, I must warn you. The CPU utilization has spiked to {int(cpu_percent)} percent. System stability may be compromised."
                elif mem_percent > 95:
                    alert_msg = f"Sir, we are running critically low on memory. RAM usage is at {int(mem_percent)} percent."
                
                if alert_msg:
                    logger.warning("proactive_hardware_alert", cpu=cpu_percent, mem=mem_percent)
                    # Wake up UI
                    await voice_engine.trigger_wake()
                    
                    # Update Chat UI
                    await ws_manager.broadcast_typed("chat_response", {
                        "id": "proactive_alert",
                        "content": alert_msg,
                        "model": "SYSTEM_MONITOR",
                        "done": True,
                    })
                    
                    # Disable speech alert to conserve system resources
                    # await voice_engine.speak(alert_msg)
                    
                    # Cool down to prevent spamming
                    await asyncio.sleep(300)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("proactive_monitor_error", error=str(e))
                await asyncio.sleep(10)

monitor = ProactiveMonitor()
