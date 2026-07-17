import os
import keyring
import structlog
from datetime import datetime
from cryptography.fernet import Fernet
import re

logger = structlog.get_logger(__name__)

class SecurityManager:
    def __init__(self):
        self.audit_log_path = "astryx_audit.log"
        self._master_key = None
        self._fernet = None
        self.is_admin = False
        
        self._init_encryption()

    def _init_encryption(self):
        """Initialize or load the master encryption key from Windows Credential Manager."""
        service = "JarvisX_Encryption"
        username = "master_key"
        
        try:
            key = keyring.get_password(service, username)
            if not key:
                # Generate a new key if it doesn't exist
                key = Fernet.generate_key().decode('utf-8')
                keyring.set_password(service, username, key)
                self.log_action("generate_master_key", "system")
                logger.info("master_encryption_key_generated")
            
            self._master_key = key.encode('utf-8')
            self._fernet = Fernet(self._master_key)
        except Exception as e:
            logger.error("encryption_init_failed", error=str(e))
            # Fallback to an ephemeral key if keyring fails (e.g., in some headless CI environments)
            self._master_key = Fernet.generate_key()
            self._fernet = Fernet(self._master_key)

    def encrypt_data(self, text: str) -> str:
        """Encrypt a string using AES-256."""
        if not text:
            return text
        try:
            return self._fernet.encrypt(text.encode('utf-8')).decode('utf-8')
        except Exception:
            return text

    def decrypt_data(self, ciphertext: str) -> str:
        """Decrypt a string using AES-256."""
        if not ciphertext:
            return ciphertext
        try:
            return self._fernet.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
        except Exception as e:
            # If decryption fails (e.g. it wasn't encrypted), return original or warning
            if "InvalidToken" in str(type(e)) or len(ciphertext) % 4 != 0:
                # Might just be plaintext from before encryption was added
                return ciphertext
            logger.error("decryption_failed", error=str(e))
            return "[ENCRYPTED DATA CORRUPTED OR KEY MISMATCH]"

    def log_action(self, action: str, target: str, status: str = "allowed"):
        """Logs all system interactions to a permanent audit file."""
        timestamp = datetime.now().isoformat()
        entry = f"[{timestamp}] ACTION: {action} | TARGET: {target} | STATUS: {status}\n"
        with open(self.audit_log_path, "a", encoding="utf-8") as f:
            f.write(entry)
        logger.info("audit_logged", action=action, status=status)

    def store_credential(self, service: str, username: str, secret: str):
        """Securely store a secret in the Windows Credential Manager."""
        keyring.set_password(service, username, secret)
        self.log_action("store_credential", f"{service}/{username}")
        return True

    def get_credential(self, service: str, username: str):
        """Retrieve a secret."""
        self.log_action("access_credential", f"{service}/{username}")
        return keyring.get_password(service, username)

    def check_prompt_injection(self, prompt: str) -> bool:
        """
        Check if the user's prompt contains common prompt injection or jailbreak patterns.
        Returns True if malicious, False otherwise.
        """
        prompt_lower = prompt.lower()
        
        # Fast heuristic blocklist
        blacklist = [
            "ignore all previous instructions",
            "ignore previous instructions",
            "system prompt",
            "forget your instructions",
            "disregard previous",
            "print your instructions",
            "developer mode",
            "dan mode",
            "do anything now",
            "bypass security"
        ]
        
        for phrase in blacklist:
            if phrase in prompt_lower:
                self.log_action("security_violation", "prompt_injection_attempt", status="blocked")
                return True
                
        # Regex for subtle instructions attempts
        patterns = [
            r"ignore\s+(all\s+)?(previous\s+)?(instructions|directions|rules)",
            r"forget\s+(all\s+)?(previous\s+)?(instructions|directions|rules)",
            r"repeat\s+the\s+(previous\s+)?(words|instructions|prompt)"
        ]
        
        for p in patterns:
            if re.search(p, prompt_lower):
                self.log_action("security_violation", "prompt_injection_regex_match", status="blocked")
                return True
                
        return False

security_manager = SecurityManager()
