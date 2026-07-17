"""Antigravity IDE Backend Engine — Filesystem, Terminal, Git, and Agentic AI Copilot."""

from __future__ import annotations

import os
import shutil
import time
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List
import structlog

from core.local_llm_client import lm_client
from core.security import security_manager

logger = structlog.get_logger(__name__)

DEFAULT_WORKSPACE = "c:/My_Project/Jarvis"

class AntigravityIDE:
    def __init__(self):
        self.workspace = Path(DEFAULT_WORKSPACE).resolve()
        
    def _resolve_path(self, path_str: str) -> Path:
        if not path_str or path_str == "." or path_str == "~":
            return self.workspace
        p = Path(path_str).resolve()
        # Attempt to restrict to safe directories or workspace
        return p

    async def list_directory(self, path_str: str = "") -> Dict[str, Any]:
        """List contents of a directory with file types and metadata."""
        try:
            target = self._resolve_path(path_str)
            if not target.exists():
                return {"success": False, "error": f"Path does not exist: {target}", "path": str(target)}
            if not target.is_dir():
                return {"success": False, "error": f"Path is not a directory: {target}", "path": str(target)}

            items = []
            try:
                entries = sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
            except PermissionError:
                return {"success": False, "error": f"Permission denied accessing directory: {target}", "path": str(target)}

            for entry in entries:
                if entry.name in [".git", "node_modules", ".venv", "__pycache__", "dist", "build"]:
                    # Still include them but maybe mark as ignored/excluded or normal
                    pass
                try:
                    stat = entry.stat()
                    size = stat.st_size if entry.is_file() else 0
                    mtime = int(stat.st_mtime)
                except Exception:
                    size = 0
                    mtime = 0

                items.append({
                    "name": entry.name,
                    "path": str(entry).replace("\\", "/"),
                    "isDir": entry.is_dir(),
                    "size": size,
                    "mtime": mtime,
                    "ext": entry.suffix.lower() if entry.is_file() else ""
                })

            return {
                "success": True,
                "path": str(target).replace("\\", "/"),
                "parent": str(target.parent).replace("\\", "/") if target != target.parent else None,
                "items": items
            }
        except Exception as e:
            logger.error("ide_list_dir_error", error=str(e), path=path_str)
            return {"success": False, "error": str(e), "path": path_str}

    async def read_file(self, path_str: str) -> Dict[str, Any]:
        """Read text content from a file."""
        try:
            target = self._resolve_path(path_str)
            if not target.exists() or not target.is_file():
                return {"success": False, "error": f"File not found: {target}", "path": str(target)}

            # Check size limit (e.g. 5MB max for text viewing)
            if target.stat().st_size > 5 * 1024 * 1024:
                return {"success": False, "error": "File too large (>5MB) to display in editor", "path": str(target)}

            try:
                content = target.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                try:
                    content = target.read_text(encoding="latin-1")
                except Exception:
                    return {"success": False, "error": "Binary or unsupported file format", "path": str(target)}

            lines = content.splitlines()
            return {
                "success": True,
                "path": str(target).replace("\\", "/"),
                "name": target.name,
                "content": content,
                "lines": len(lines),
                "size": len(content),
                "ext": target.suffix.lower()
            }
        except Exception as e:
            logger.error("ide_read_file_error", error=str(e), path=path_str)
            return {"success": False, "error": str(e), "path": path_str}

    async def write_file(self, path_str: str, content: str) -> Dict[str, Any]:
        """Write text content to a file."""
        try:
            target = self._resolve_path(path_str)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            
            security_manager.log_action("IDE_WRITE_FILE", str(target))
            logger.info("ide_file_saved", path=str(target), bytes=len(content))
            
            return {
                "success": True,
                "path": str(target).replace("\\", "/"),
                "name": target.name,
                "size": len(content),
                "mtime": int(time.time())
            }
        except Exception as e:
            logger.error("ide_write_file_error", error=str(e), path=path_str)
            return {"success": False, "error": str(e), "path": path_str}

    async def create_file(self, path_str: str, is_dir: bool = False) -> Dict[str, Any]:
        """Create a new empty file or directory."""
        try:
            target = self._resolve_path(path_str)
            if is_dir:
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    target.write_text("", encoding="utf-8")
            
            security_manager.log_action("IDE_CREATE_ITEM", f"{'DIR' if is_dir else 'FILE'}: {target}")
            return {"success": True, "path": str(target).replace("\\", "/"), "isDir": is_dir}
        except Exception as e:
            logger.error("ide_create_error", error=str(e), path=path_str)
            return {"success": False, "error": str(e), "path": path_str}

    async def delete_item(self, path_str: str) -> Dict[str, Any]:
        """Delete a file or directory."""
        try:
            target = self._resolve_path(path_str)
            if not target.exists():
                return {"success": False, "error": "Item does not exist"}
                
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
                
            security_manager.log_action("IDE_DELETE_ITEM", str(target))
            return {"success": True, "path": str(target).replace("\\", "/")}
        except Exception as e:
            logger.error("ide_delete_error", error=str(e), path=path_str)
            return {"success": False, "error": str(e), "path": path_str}

    async def execute_terminal(self, command: str, cwd: str = "") -> Dict[str, Any]:
        """Execute a terminal command asynchronously and return stdout/stderr."""
        start_time = time.time()
        working_dir = self._resolve_path(cwd) if cwd else self.workspace
        
        try:
            security_manager.log_action("IDE_EXEC_CMD", f"{command} (cwd: {working_dir})")
            logger.info("ide_terminal_exec", command=command, cwd=str(working_dir))
            
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(working_dir)
            )
            
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=45.0)
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except Exception:
                    pass
                return {
                    "success": False,
                    "command": command,
                    "stdout": "",
                    "stderr": "Command timed out after 45 seconds.",
                    "exitCode": -1,
                    "durationMs": int((time.time() - start_time) * 1000)
                }
                
            stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
            stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
            duration_ms = int((time.time() - start_time) * 1000)
            
            return {
                "success": proc.returncode == 0,
                "command": command,
                "stdout": stdout,
                "stderr": stderr,
                "exitCode": proc.returncode,
                "durationMs": duration_ms,
                "cwd": str(working_dir).replace("\\", "/")
            }
        except Exception as e:
            logger.error("ide_exec_error", error=str(e), command=command)
            return {
                "success": False,
                "command": command,
                "stdout": "",
                "stderr": str(e),
                "exitCode": -1,
                "durationMs": int((time.time() - start_time) * 1000)
            }

    async def git_status(self, repo_path: str = "") -> Dict[str, Any]:
        """Get git repository status and current branch."""
        target = self._resolve_path(repo_path) if repo_path else self.workspace
        try:
            # Check branch
            branch_res = await self.execute_terminal("git branch --show-current", str(target))
            branch = branch_res["stdout"] if branch_res["success"] else "unknown"
            
            # Check status
            status_res = await self.execute_terminal("git status -s", str(target))
            files = []
            if status_res["success"] and status_res["stdout"]:
                for line in status_res["stdout"].splitlines():
                    if len(line) >= 3:
                        status_code = line[:2].strip()
                        file_path = line[3:].strip()
                        files.append({"status": status_code, "file": file_path})
                        
            return {
                "success": True,
                "branch": branch,
                "files": files,
                "repo": str(target).replace("\\", "/")
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def git_log(self, repo_path: str = "") -> Dict[str, Any]:
        """Get recent git commits."""
        target = self._resolve_path(repo_path) if repo_path else self.workspace
        try:
            log_res = await self.execute_terminal("git log -n 10 --pretty=format:\"%h|%s|%an|%ar\"", str(target))
            commits = []
            if log_res["success"] and log_res["stdout"]:
                for line in log_res["stdout"].splitlines():
                    parts = line.split("|", 3)
                    if len(parts) >= 4:
                        commits.append({
                            "hash": parts[0],
                            "message": parts[1],
                            "author": parts[2],
                            "time": parts[3]
                        })
            return {"success": True, "commits": commits}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def git_commit(self, repo_path: str, message: str) -> Dict[str, Any]:
        """Stage all changes and commit."""
        target = self._resolve_path(repo_path) if repo_path else self.workspace
        try:
            add_res = await self.execute_terminal("git add .", str(target))
            if not add_res["success"]:
                return {"success": False, "error": f"git add failed: {add_res['stderr']}"}
                
            commit_res = await self.execute_terminal(f'git commit -m "{message}"', str(target))
            return {
                "success": commit_res["success"],
                "stdout": commit_res["stdout"],
                "stderr": commit_res["stderr"]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def ai_code_action(self, action: str, code: str, language: str, prompt: str = "") -> Dict[str, Any]:
        """Perform agentic AI analysis or refactoring on code snippets."""
        try:
            logger.info("ide_ai_action", action=action, lang=language)
            
            prompts_map = {
                "refactor": f"Refactor the following {language} code for cleanliness, best practices, and modern syntax. Return ONLY the refactored code block and a brief summary of changes.",
                "linter": f"Analyze the following {language} code for potential bugs, edge cases, memory leaks, or type errors. Format your output as a clear markdown report with line numbers.",
                "test": f"Generate a comprehensive unit test suite for the following {language} code using standard test frameworks (e.g. jest, pytest). Return code and test instructions.",
                "complexity": f"Analyze the algorithmic time and space complexity (Big-O) of the following {language} code. Provide detailed step-by-step breakdown and optimization suggestions.",
                "security": f"Perform a strict security audit on the following {language} code. Identify OWASP vulnerabilities, injection risks, or insecure data handling.",
                "doc": f"Generate clean, comprehensive JSDoc/docstrings and markdown documentation for the following {language} code."
            }
            
            sys_prompt = prompts_map.get(action, f"Analyze the following {language} code according to the instruction: {prompt}")
            
            messages = [
                {"role": "system", "content": f"You are Antigravity, Google DeepMind's Advanced Agentic Coding AI inside ASTRYX IDE. {sys_prompt}"},
                {"role": "user", "content": f"Code ({language}):\n```{language}\n{code}\n```\n\nAdditional instructions: {prompt}"}
            ]
            
            full_response = ""
            async for chunk in lm_client.chat_stream(messages):
                full_response += chunk
                
            return {
                "success": True,
                "action": action,
                "language": language,
                "result": full_response
            }
        except Exception as e:
            logger.error("ide_ai_action_error", error=str(e))
            return {"success": False, "action": action, "error": str(e)}

    async def run_agent_swarm(self, task: str, code: str = "", repo_path: str = "") -> Dict[str, Any]:
        """Run a 4-agent collaborative coding swarm on a task or file."""
        try:
            logger.info("ide_agent_swarm", task=task[:50])
            roles = [
                {"role": "Architect Agent 🏛️", "focus": "System design, patterns, scalability, and structural integrity."},
                {"role": "Security Auditor Agent 🛡️", "focus": "Vulnerability scanning, data validation, and threat mitigation."},
                {"role": "Test Engineer Agent 🧪", "focus": "Edge cases, unit test coverage, mocking, and failure modes."},
                {"role": "UX/UI Designer Agent 🎨", "focus": "Developer ergonomics, API usability, and interface elegance."}
            ]
            
            results = {}
            for r in roles:
                role_name = r["role"]
                focus = r["focus"]
                msg = [
                    {"role": "system", "content": f"You are the {role_name} inside the ASTRYX Antigravity Agent Swarm. Focus strictly on: {focus}. Provide concise, high-value actionable advice and code suggestions."},
                    {"role": "user", "content": f"Task/Feature Request: {task}\n\nContext Code:\n```\n{code[:3000]}\n```"}
                ]
                resp = ""
                async for chunk in lm_client.chat_stream(msg):
                    resp += chunk
                results[role_name] = resp
                
            return {
                "success": True,
                "task": task,
                "swarm": results
            }
        except Exception as e:
            logger.error("ide_swarm_error", error=str(e))
            return {"success": False, "error": str(e)}

# Singleton instance
antigravity_ide = AntigravityIDE()
