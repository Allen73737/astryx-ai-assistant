"""Astryx Ultra-Powerful Tool Registry — Internet, Full Computer Access, System Control & Memory"""

import os
import sys
import glob
import json
import time
import shutil
import asyncio
import io
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import webbrowser
import subprocess
from datetime import datetime
from typing import Any, Dict, List, Optional
import structlog

# Third-party integrations
import psutil
import pyperclip
from bs4 import BeautifulSoup

try:
    import pyautogui
    pyautogui.FAILSAFE = False
except Exception:
    pyautogui = None

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

try:
    from pywinauto import Desktop
except ImportError:
    Desktop = None

from security import security_manager
from memory_system import memory_manager

logger = structlog.get_logger(__name__)


class ToolRegistry:
    def __init__(self):
        self.tools = {
            # Web & Online Intelligence
            "search_web": self.search_web,
            "open_url": self.open_url,
            "read_webpage": self.read_webpage,
            "fetch_news": self.fetch_news,
            "get_weather": self.get_weather,
            
            # Full Computer Access & Execution
            "execute_command": self.execute_command,
            "execute_python": self.execute_python,
            
            # File System Operations
            "read_file": self.read_file,
            "write_file": self.write_file,
            "search_files": self.search_files,
            "list_directory": self.list_directory,
            
            # System Diagnostics & Process Control
            "get_system_info": self.get_system_info,
            "list_processes": self.list_processes,
            "kill_process": self.kill_process,
            "list_windows": self.list_windows,
            
            # System Hardware & Desktop Automation
            "control_system": self.control_system,
            "take_screenshot": self.take_screenshot,
            "get_clipboard": self.get_clipboard,
            "set_clipboard": self.set_clipboard,
            "press_hotkey": self.press_hotkey,
            
            # Long-term Memory
            "search_memory": self.search_memory,
            "add_memory": self.add_memory,
        }

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        """Returns standard OpenAI / Groq / LM Studio function schemas."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_web",
                    "description": "Searches the live internet for any topic, question, current event, facts, or technical documentation using DuckDuckGo and Wikipedia.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The exact search query to look up online."},
                            "max_results": {"type": "integer", "description": "Number of results to return (default 5)."}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "open_url",
                    "description": "Opens a website or link in the user's default browser (e.g., YouTube, Google, GitHub, or any search/article).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "The full URL to open (including https://)."}
                        },
                        "required": ["url"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_webpage",
                    "description": "Scrapes and extracts the readable article text, documentation, or content from any webpage or article URL.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "The URL of the webpage to read and extract."}
                        },
                        "required": ["url"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "fetch_news",
                    "description": "Fetches breaking real-time news headlines across tech, AI, business, science, or general topics.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "category": {"type": "string", "description": "Topic or category, e.g. 'technology', 'artificial intelligence', 'world', 'business'."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Fetches live weather reports, temperature, humidity, wind, and forecast for any city or location.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "City or location name (e.g. 'New York', 'London', 'Tokyo', 'Kochi')."}
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_command",
                    "description": "Runs an arbitrary shell, PowerShell, or CMD command with full admin privileges on the user's computer and returns stdout/stderr.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {"type": "string", "description": "The command line string to execute (e.g. 'ipconfig', 'git status', 'npm run build')."}
                        },
                        "required": ["command"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_python",
                    "description": "Dynamically executes Python code in the local environment and captures printed output or computed results.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "code": {"type": "string", "description": "Python source code to execute."}
                        },
                        "required": ["code"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Reads the text contents of a file on the computer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Absolute or relative path to the file."}
                        },
                        "required": ["path"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "Writes text content to a file on the computer, creating any missing directories automatically.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Path to the file to create or modify."},
                            "content": {"type": "string", "description": "Text content to write."},
                            "mode": {"type": "string", "description": "'overwrite' to replace or 'append' to append.", "enum": ["overwrite", "append"]}
                        },
                        "required": ["path", "content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_files",
                    "description": "Searches for files matching a pattern in a directory and its subdirectories.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "directory": {"type": "string", "description": "Starting directory (e.g. 'C:/Users/allen/Desktop' or '.')."},
                            "pattern": {"type": "string", "description": "Wildcard pattern (e.g. '*.py', '*report*', '*.pdf')."}
                        },
                        "required": ["directory", "pattern"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_directory",
                    "description": "Lists all files and subfolders in a directory with file sizes and timestamps.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Directory path to list (default: current directory)."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_system_info",
                    "description": "Retrieves comprehensive live computer diagnostic metrics: CPU usage %, RAM usage (used/total), disk usage %, battery status, uptime, and network IP.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_processes",
                    "description": "Lists the top active processes on the PC sorted by CPU and memory consumption.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "limit": {"type": "integer", "description": "Number of processes to list (default: 15)."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "kill_process",
                    "description": "Terminates a process by its name or process ID (PID).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name_or_pid": {"type": "string", "description": "Process name (e.g. 'notepad.exe', 'chrome') or PID integer."}
                        },
                        "required": ["name_or_pid"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_windows",
                    "description": "Lists all currently open desktop application windows.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "control_system",
                    "description": "Controls computer apps, audio volume, power, and display settings.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "description": "Action to perform: 'open_app', 'close_app', 'volume_mute', 'volume_up', 'volume_down', 'lock_screen', 'empty_recycle_bin'.",
                                "enum": ["open_app", "close_app", "volume_mute", "volume_up", "volume_down", "lock_screen", "empty_recycle_bin"]
                            },
                            "target": {"type": "string", "description": "App name or target (e.g. 'notepad', 'chrome', 'calc', 'vscode', 'explorer', 'terminal')."}
                        },
                        "required": ["action"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "take_screenshot",
                    "description": "Captures a screenshot of the computer screen and saves it as an image file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filename": {"type": "string", "description": "Optional custom filename or leave blank for automatic timestamped image."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_clipboard",
                    "description": "Reads the current text stored in the Windows clipboard.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "set_clipboard",
                    "description": "Copies text onto the Windows clipboard.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string", "description": "Text to copy to clipboard."}
                        },
                        "required": ["text"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "press_hotkey",
                    "description": "Presses a keyboard shortcut combination (e.g. 'win,d' to show desktop, 'alt,tab', 'ctrl,c', 'ctrl,v').",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "keys": {"type": "string", "description": "Comma-separated keys to press together (e.g. 'win,d', 'alt,f4', 'ctrl,shift,esc')."}
                        },
                        "required": ["keys"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_memory",
                    "description": "Searches your internal Second Brain (vector database) for remembered notes, facts, preferences, and personal knowledge.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The search query to look up in memory."}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "add_memory",
                    "description": "Stores a new fact, preference, user rule, or note into your permanent long-term memory.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string", "description": "The information or note to remember permanently."}
                        },
                        "required": ["text"]
                    }
                }
            }
        ]

    def execute_tool(self, name: str, args: dict) -> str:
        """Executes a registered tool and logs the audit record."""
        if name not in self.tools:
            return f"Error: Tool '{name}' not found."
            
        try:
            logger.info("executing_tool", tool=name, args=args)
            result = str(self.tools[name](**args))
            security_manager.log_action(name, args, result)
            return result
        except TypeError as te:
            err_msg = f"Argument error executing '{name}': {te}"
            logger.error("tool_argument_error", tool=name, error=err_msg)
            security_manager.log_action(name, args, err_msg)
            return err_msg
        except Exception as e:
            err_msg = f"Error executing '{name}': {e}"
            logger.error("tool_execution_failed", tool=name, error=err_msg)
            security_manager.log_action(name, args, err_msg)
            return err_msg

    # ═══════════════════════════════════════════════════════════════════
    #  INTERNET & ONLINE INTELLIGENCE IMPLEMENTATIONS
    # ═══════════════════════════════════════════════════════════════════

    def search_web(self, query: str, max_results: int = 5) -> str:
        """Searches DuckDuckGo and Wikipedia."""
        results_list = []
        
        # 1. DuckDuckGo Search via DDGS
        if DDGS:
            try:
                ddgs = DDGS(timeout=10)
                ddg_results = list(ddgs.text(query, max_results=max_results))
                for item in ddg_results:
                    title = item.get("title", "")
                    href = item.get("href", "")
                    body = item.get("body", "")
                    results_list.append(f"• **{title}**\n  URL: {href}\n  {body}")
            except Exception as e:
                logger.warning("ddgs_search_warning", error=str(e))

        # 2. Wikipedia API fallback / enhancement
        try:
            wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&format=json&utf8="
            req = urllib.request.Request(wiki_url, headers={"User-Agent": "Astryx-AI/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                wiki_data = json.loads(resp.read().decode())
                pages = wiki_data.get("query", {}).get("search", [])[:2]
                for p in pages:
                    clean_snippet = BeautifulSoup(p.get("snippet", ""), "html.parser").get_text()
                    title = p.get("title", "")
                    link = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                    results_list.append(f"• **Wikipedia: {title}**\n  URL: {link}\n  {clean_snippet}")
        except Exception as e:
            logger.warning("wiki_search_warning", error=str(e))

        if not results_list:
            return f"No live search results found online for '{query}'."

        return f"### Online Search Results for: \"{query}\"\n\n" + "\n\n".join(results_list)

    def open_url(self, url: str) -> str:
        """Opens any URL in the user's default browser."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        try:
            webbrowser.open(url)
            return f"Successfully opened {url} in your default browser."
        except Exception as e:
            return f"Failed to open URL: {e}"

    def read_webpage(self, url: str) -> str:
        """Fetches and parses text content from a web page."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                html = response.read().decode("utf-8", errors="ignore")
                
            soup = BeautifulSoup(html, "html.parser")
            
            # Remove scripts, styles, forms, ads
            for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "svg", "form"]):
                tag.extract()
                
            title = soup.title.string.strip() if soup.title and soup.title.string else url
            text = soup.get_text(separator="\n", strip=True)
            
            # Normalize whitespace
            lines = [line.strip() for line in text.splitlines() if len(line.strip()) > 30]
            clean_content = "\n\n".join(lines[:40]) # limit output length
            
            if not clean_content:
                clean_content = text[:2000]

            return f"### Webpage Content: {title}\nURL: {url}\n\n{clean_content[:3500]}"
        except Exception as e:
            return f"Failed to read webpage '{url}': {e}"

    def fetch_news(self, category: str = "technology") -> str:
        """Fetches real-time live news via Google News RSS."""
        try:
            query = urllib.parse.quote(f"{category} news")
            url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            
            with urllib.request.urlopen(req, timeout=8) as response:
                xml_data = response.read()
                
            root = ET.fromstring(xml_data)
            articles = []
            
            for item in root.findall("./channel/item")[:6]:
                title = item.find("title").text if item.find("title") is not None else "Untitled"
                link = item.find("link").text if item.find("link") is not None else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                source = item.find("source").text if item.find("source") is not None else "Google News"
                articles.append(f"• **{title}** ({source})\n  Published: {pub_date}\n  Link: {link}")
                
            if not articles:
                return f"No news articles found for category '{category}'."
                
            return f"### Latest Breaking News: {category.title()}\n\n" + "\n\n".join(articles)
        except Exception as e:
            return f"Failed to fetch news: {e}"

    def get_weather(self, location: str = "current") -> str:
        """Fetches live weather conditions and forecast via wttr.in."""
        try:
            loc_query = urllib.parse.quote(location)
            url = f"https://wttr.in/{loc_query}?format=%l:+%c+%t,+Condition:+%C,+Wind:+%w,+Humidity:+%h"
            req = urllib.request.Request(url, headers={"User-Agent": "curl/7.68.0"})
            with urllib.request.urlopen(req, timeout=6) as response:
                weather_summary = response.read().decode("utf-8").strip()
            return f"Weather Report: {weather_summary}"
        except Exception as e:
            # Fallback to web search
            return self.search_web(f"current weather in {location}", max_results=2)

    # ═══════════════════════════════════════════════════════════════════
    #  FULL COMPUTER ACCESS & COMMAND EXECUTION
    # ═══════════════════════════════════════════════════════════════════

    def execute_command(self, command: str) -> str:
        """Executes arbitrary PowerShell or CMD command with full permissions."""
        try:
            # Use PowerShell for maximum capability on Windows
            result = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True,
                text=True,
                timeout=45,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            stdout = result.stdout.strip()
            stderr = result.stderr.strip()
            
            output = []
            if stdout:
                output.append(stdout)
            if stderr:
                output.append(f"STDERR:\n{stderr}")
            if result.returncode != 0:
                output.append(f"(Exited with code {result.returncode})")
                
            return "\n\n".join(output) if output else "Command executed successfully with zero output."
        except subprocess.TimeoutExpired:
            return f"Command execution timed out after 45 seconds: {command}"
        except Exception as e:
            return f"Failed to execute command: {e}"

    def execute_python(self, code: str) -> str:
        """Executes Python code dynamically and captures stdout."""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirected_output = io.StringIO()
        redirected_error = io.StringIO()
        sys.stdout = redirected_output
        sys.stderr = redirected_error
        
        exec_globals = {
            "__builtins__": __builtins__,
            "os": os,
            "sys": sys,
            "json": json,
            "time": time,
            "datetime": datetime,
            "psutil": psutil,
            "shutil": shutil,
            "glob": glob
        }
        
        try:
            exec(code, exec_globals)
            out = redirected_output.getvalue().strip()
            err = redirected_error.getvalue().strip()
            res = ""
            if out: res += out
            if err: res += f"\nSTDERR: {err}"
            return res or "Code executed successfully (no stdout produced)."
        except Exception as e:
            return f"Python Execution Exception: {e}"
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    # ═══════════════════════════════════════════════════════════════════
    #  FILE SYSTEM OPERATIONS
    # ═══════════════════════════════════════════════════════════════════

    def read_file(self, path: str) -> str:
        """Reads file contents from system."""
        if not os.path.exists(path):
            return f"Error: File '{path}' does not exist."
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            return content
        except Exception as e:
            return f"Error reading file '{path}': {e}"

    def write_file(self, path: str, content: str, mode: str = "overwrite") -> str:
        """Writes or appends content to any file, creating directories automatically."""
        try:
            dir_name = os.path.dirname(os.path.abspath(path))
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
            
            write_mode = "a" if mode == "append" else "w"
            with open(path, write_mode, encoding="utf-8") as f:
                f.write(content)
            return f"Successfully wrote {len(content)} characters to '{path}' (mode={mode})."
        except Exception as e:
            return f"Error writing to file '{path}': {e}"

    def search_files(self, directory: str, pattern: str) -> str:
        """Recursively finds files matching pattern."""
        if not os.path.exists(directory):
            return f"Directory '{directory}' does not exist."
            
        search_path = os.path.join(directory, "**", pattern)
        files = glob.glob(search_path, recursive=True)
        if not files:
            return f"No files found matching '{pattern}' in '{directory}'."
            
        return f"Found {len(files)} files:\n" + "\n".join(files[:60])

    def list_directory(self, path: str = ".") -> str:
        """Lists directory entries with details."""
        if not os.path.exists(path):
            return f"Path '{path}' does not exist."
            
        try:
            items = os.listdir(path)
            output = []
            for item in items[:80]:
                full_item_path = os.path.join(path, item)
                is_dir = os.path.isdir(full_item_path)
                size_str = "<DIR>" if is_dir else f"{os.path.getsize(full_item_path):,} bytes"
                output.append(f"{size_str:<15} {item}")
            return f"Directory contents for '{path}':\n" + "\n".join(output)
        except Exception as e:
            return f"Error listing directory '{path}': {e}"

    # ═══════════════════════════════════════════════════════════════════
    #  SYSTEM DIAGNOSTICS & PROCESS CONTROL
    # ═══════════════════════════════════════════════════════════════════

    def get_system_info(self) -> str:
        """Provides full hardware & OS diagnostics."""
        try:
            # CPU
            cpu_pct = psutil.cpu_percent(interval=0.2)
            cpu_count = psutil.cpu_count(logical=True)
            
            # RAM
            mem = psutil.virtual_memory()
            ram_used_gb = mem.used / (1024 ** 3)
            ram_total_gb = mem.total / (1024 ** 3)
            
            # Disk
            disk = psutil.disk_usage("C:\\" if sys.platform == "win32" else "/")
            disk_used_gb = disk.used / (1024 ** 3)
            disk_total_gb = disk.total / (1024 ** 3)
            
            # Battery
            battery = psutil.sensors_battery()
            battery_info = "N/A (Desktop/AC)"
            if battery:
                plugged = "Plugged In" if battery.power_plugged else "On Battery"
                battery_info = f"{battery.percent}% ({plugged})"
                
            # Network
            import socket
            hostname = socket.gethostname()
            ip_address = socket.gethostbyname(hostname)
            
            # Boot time
            boot_time = datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")

            report = (
                f"### System Diagnostic Report — Host: {hostname}\n"
                f"• **OS**: {sys.platform.upper()} (Windows NT)\n"
                f"• **IP Address**: {ip_address}\n"
                f"• **CPU**: {cpu_pct}% utilization ({cpu_count} logical cores)\n"
                f"• **Memory (RAM)**: {ram_used_gb:.1f} GB used / {ram_total_gb:.1f} GB total ({mem.percent}%)\n"
                f"• **Main Disk**: {disk_used_gb:.1f} GB used / {disk_total_gb:.1f} GB total ({disk.percent}%)\n"
                f"• **Battery Power**: {battery_info}\n"
                f"• **System Boot Time**: {boot_time}\n"
                f"• **Status**: All Core Systems Optimal"
            )
            return report
        except Exception as e:
            return f"Failed to retrieve system info: {e}"

    def list_processes(self, limit: int = 15) -> str:
        """Lists processes sorted by CPU and memory."""
        try:
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    info = p.info
                    procs.append(info)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
                    
            procs.sort(key=lambda x: x.get('memory_percent') or 0, reverse=True)
            lines = [f"{'PID':<8} {'Process Name':<30} {'RAM %':<8}"]
            for p in procs[:limit]:
                lines.append(f"{str(p['pid']):<8} {str(p['name'])[:28]:<30} {p['memory_percent'] or 0:.1f}%")
                
            return "Active Top Processes:\n" + "\n".join(lines)
        except Exception as e:
            return f"Failed to list processes: {e}"

    def kill_process(self, name_or_pid: str) -> str:
        """Terminates a process by name or PID."""
        try:
            if name_or_pid.isdigit():
                pid = int(name_or_pid)
                p = psutil.Process(pid)
                p.terminate()
                return f"Terminated process with PID {pid} ({p.name()})."
            else:
                killed = 0
                for p in psutil.process_iter(['pid', 'name']):
                    if name_or_pid.lower() in p.info['name'].lower():
                        p.terminate()
                        killed += 1
                return f"Terminated {killed} processes matching '{name_or_pid}'."
        except Exception as e:
            return f"Failed to kill process: {e}"

    def list_windows(self) -> str:
        """Lists all open windows."""
        try:
            if Desktop:
                windows = Desktop(backend="uia").windows()
                names = [w.window_text().strip() for w in windows if w.window_text().strip()]
                unique_names = list(dict.fromkeys(names))
                return "Open Windows:\n" + "\n".join(f"• {name}" for name in unique_names[:25])
            else:
                return "Desktop window listing is unavailable (pywinauto not loaded)."
        except Exception as e:
            return f"Failed to list windows: {e}"

    # ═══════════════════════════════════════════════════════════════════
    #  DESKTOP & HARDWARE CONTROL
    # ═══════════════════════════════════════════════════════════════════

    def control_system(self, action: str, target: str = "") -> str:
        """Controls system actions like opening apps, volume, lock screen."""
        action = action.lower().strip()
        target = target.lower().strip()

        try:
            if action == "volume_mute":
                if pyautogui:
                    pyautogui.press("volumemute")
                    return "System volume muted/unmuted."
                return "PyAutoGUI not available to toggle volume."

            elif action == "volume_up":
                if pyautogui:
                    for _ in range(5):
                        pyautogui.press("volumeup")
                    return "System volume increased."
                return "PyAutoGUI not available to increase volume."

            elif action == "volume_down":
                if pyautogui:
                    for _ in range(5):
                        pyautogui.press("volumedown")
                    return "System volume decreased."
                return "PyAutoGUI not available to decrease volume."

            elif action == "lock_screen":
                os.system("rundll32.exe user32.dll,LockWorkStation")
                return "Workstation locked successfully."

            elif action == "empty_recycle_bin":
                os.system("powershell.exe -Command Clear-RecycleBin -Force -ErrorAction SilentlyContinue")
                return "Windows Recycle Bin emptied."

            elif action == "open_app":
                app_aliases = {
                    "notepad": "notepad.exe",
                    "calculator": "calc.exe",
                    "calc": "calc.exe",
                    "chrome": "chrome",
                    "edge": "msedge",
                    "terminal": "wt.exe",
                    "cmd": "cmd.exe",
                    "powershell": "powershell.exe",
                    "vscode": "code",
                    "code": "code",
                    "explorer": "explorer.exe",
                    "task manager": "taskmgr.exe",
                    "taskmgr": "taskmgr.exe",
                    "spotify": "spotify",
                    "word": "winword",
                    "excel": "excel",
                    "powerpoint": "powerpnt",
                    "settings": "ms-settings:"
                }
                executable = app_aliases.get(target, target)
                subprocess.Popen(["cmd", "/c", "start", "", executable], shell=True)
                return f"Opened application: {target}."

            elif action == "close_app":
                return self.kill_process(target)

            else:
                return f"Unknown system control action: {action}"
        except Exception as e:
            return f"Error executing system control '{action}': {e}"

    def take_screenshot(self, filename: str = "") -> str:
        """Captures a screenshot of the display."""
        try:
            if not pyautogui:
                return "Screenshot capability requires pyautogui."
                
            shots_dir = os.path.join(os.path.expanduser("~"), "Pictures", "Astryx_Screenshots")
            os.makedirs(shots_dir, exist_ok=True)
            
            if not filename:
                filename = f"screenshot_{int(time.time())}.png"
            elif not filename.endswith(".png"):
                filename += ".png"
                
            full_path = os.path.join(shots_dir, filename)
            screenshot = pyautogui.screenshot()
            screenshot.save(full_path)
            return f"Screenshot successfully saved to: {full_path}"
        except Exception as e:
            return f"Failed to capture screenshot: {e}"

    def get_clipboard(self) -> str:
        """Gets clipboard text."""
        try:
            return pyperclip.paste() or "Clipboard is empty."
        except Exception as e:
            return f"Failed to read clipboard: {e}"

    def set_clipboard(self, text: str) -> str:
        """Sets clipboard text."""
        try:
            pyperclip.copy(text)
            return "Successfully copied text to system clipboard."
        except Exception as e:
            return f"Failed to set clipboard: {e}"

    def press_hotkey(self, keys: str) -> str:
        """Simulates keyboard hotkey combination."""
        if not pyautogui:
            return "PyAutoGUI not available."
        try:
            key_list = [k.strip().lower() for k in keys.split(",") if k.strip()]
            pyautogui.hotkey(*key_list)
            return f"Pressed hotkey combo: {' + '.join(key_list)}"
        except Exception as e:
            return f"Failed to press hotkey: {e}"

    # ═══════════════════════════════════════════════════════════════════
    #  SECOND BRAIN / MEMORY OPERATIONS
    # ═══════════════════════════════════════════════════════════════════

    def search_memory(self, query: str) -> str:
        """Searches ChromaDB vector memory."""
        try:
            results = memory_manager.search_memory(query)
            if not results:
                return "No long-term memories found for that query."
            return "Memory Results:\n" + "\n".join(f"• {doc}" for doc in results)
        except Exception as e:
            return f"Error searching memory: {e}"

    def add_memory(self, text: str) -> str:
        """Stores a fact into long-term memory."""
        try:
            res = memory_manager.add_memory(text, {"timestamp": datetime.now().isoformat()})
            return f"Memory stored: {res}"
        except Exception as e:
            return f"Error adding memory: {e}"


tool_registry = ToolRegistry()
