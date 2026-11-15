import keyring
import json
import os
import datetime
import structlog

logger = structlog.get_logger(__name__)
AUDIT_LOG_FILE = "astryx_audit.log"

class SecurityManager:
    @staticmethod
    def log_action(tool_name: str, args: dict, result: str):
        """Immutable local audit log."""
        entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "action": tool_name,
            "args": args,
            "result": result[:500] # truncate
        }
        try:
            with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            logger.error("audit_log_error", error=str(e))

    @staticmethod
    def store_secret(service: str, username: str, password: str):
        try:
            keyring.set_password(service, username, password)
            return f"Successfully stored secret for {username}@{service}"
        except Exception as e:
            return f"Failed to store secret: {e}"

    @staticmethod
    def get_secret(service: str, username: str):
        try:
            val = keyring.get_password(service, username)
            return val if val else "Secret not found."
        except Exception as e:
            return f"Failed to get secret: {e}"

security_manager = SecurityManager()
