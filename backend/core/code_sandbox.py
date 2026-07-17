"""Multi-language code sandbox execution engine."""

from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Awaitable

EXECUTION_TIMEOUT_SECONDS = 30


def _sync_run_process(
    *args: str,
    cwd: Path | None = None,
    timeout: int = EXECUTION_TIMEOUT_SECONDS,
) -> tuple[int, str, str]:
    """Run a subprocess synchronously (reliable on Windows under uvicorn)."""
    try:
        result = subprocess.run(
            list(args),
            capture_output=True,
            cwd=str(cwd) if cwd else None,
            timeout=timeout,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", f"Execution timed out after {timeout} seconds."
    except FileNotFoundError:
        return -1, "", f"Command not found: {args[0]}"
    except Exception as exc:
        return -1, "", str(exc)


async def _run_process(
    *args: str,
    cwd: Path | None = None,
    timeout: int = EXECUTION_TIMEOUT_SECONDS,
) -> tuple[int, str, str]:
    return await asyncio.to_thread(_sync_run_process, *args, cwd=cwd, timeout=timeout)


def _format_output(returncode: int, stdout: str, stderr: str, success_hint: str = "") -> str:
    parts: list[str] = []
    if stdout.strip():
        parts.append(stdout.rstrip())
    if stderr.strip():
        parts.append(f"STDERR:\n{stderr.rstrip()}")
    if returncode != 0:
        if returncode == -1 and stderr.strip() and not stdout.strip():
            return stderr.rstrip()
        parts.append(f"Exit code: {returncode}")
    if parts:
        return "\n".join(parts)
    return success_hint or "Program executed successfully with no output."


@dataclass(frozen=True)
class LanguageConfig:
    id: str
    label: str
    extension: str
    default_code: str
    compile_and_run: Callable[[str, Path, Path], Awaitable[str]]


def _require_command(name: str) -> str | None:
    return shutil.which(name)


async def _run_python(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    rc, stdout, stderr = await _run_process(sys.executable, str(source_path))
    return _format_output(rc, stdout, stderr, "Python script executed successfully with no output.")


async def _run_javascript(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    node = _require_command("node")
    if not node:
        return "Error: Node.js is not installed or not on PATH."
    rc, stdout, stderr = await _run_process(node, str(source_path))
    return _format_output(rc, stdout, stderr, "JavaScript executed successfully with no output.")


async def _run_typescript(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    node = _require_command("node")
    if not node:
        return "Error: Node.js is not installed or not on PATH."
    rc, stdout, stderr = await _run_process(node, "--experimental-strip-types", str(source_path))
    if rc == 0 or "experimental-strip-types" not in stderr:
        return _format_output(rc, stdout, stderr, "TypeScript executed successfully with no output.")

    ts_node = _require_command("ts-node") or _require_command("npx")
    if ts_node == "npx":
        rc, stdout, stderr = await _run_process("npx", "--yes", "tsx", str(source_path))
    elif ts_node:
        rc, stdout, stderr = await _run_process("ts-node", str(source_path))
    else:
        return (
            "Error: TypeScript execution requires Node.js 22+ (--experimental-strip-types) "
            "or ts-node/tsx installed globally."
        )
    return _format_output(rc, stdout, stderr, "TypeScript executed successfully with no output.")


async def _run_java(source_path: Path, work_dir: Path, base_name: str) -> str:
    javac = _require_command("javac")
    java = _require_command("java")
    if not javac or not java:
        return "Error: Java JDK is not installed or javac/java are not on PATH."

    rc, stdout, stderr = await _run_process(javac, str(source_path), cwd=work_dir)
    if rc != 0:
        return _format_output(rc, stdout, stderr)

    rc, stdout, stderr = await _run_process(java, "-cp", str(work_dir), base_name, cwd=work_dir)
    return _format_output(rc, stdout, stderr, "Java program executed successfully with no output.")


async def _compile_native(
    source_path: Path,
    work_dir: Path,
    base_name: str,
    compiler_candidates: list[tuple[str, list[str]]],
    output_name: str,
) -> str:
    compiler_cmd: list[str] | None = None
    for binary, extra_args in compiler_candidates:
        if _require_command(binary):
            compiler_cmd = [binary, *extra_args, str(source_path), "-o", output_name]
            break

    if not compiler_cmd:
        names = ", ".join(name for name, _ in compiler_candidates)
        return f"Error: No compiler found. Install one of: {names}."

    rc, stdout, stderr = await _run_process(*compiler_cmd, cwd=work_dir)
    if rc != 0:
        return _format_output(rc, stdout, stderr)

    exe_path = work_dir / output_name
    if sys.platform == "win32" and not exe_path.exists():
        exe_path = work_dir / f"{output_name}.exe"

    rc, stdout, stderr = await _run_process(str(exe_path), cwd=work_dir)
    return _format_output(rc, stdout, stderr)


async def _run_c(source_path: Path, work_dir: Path, base_name: str) -> str:
    return await _compile_native(
        source_path,
        work_dir,
        base_name,
        [("gcc", []), ("clang", [])],
        base_name,
    )


async def _run_cpp(source_path: Path, work_dir: Path, base_name: str) -> str:
    return await _compile_native(
        source_path,
        work_dir,
        base_name,
        [("g++", []), ("clang++", [])],
        base_name,
    )


async def _run_csharp(source_path: Path, work_dir: Path, base_name: str) -> str:
    csc = _require_command("csc")
    if not csc:
        return "Error: C# compiler (csc) is not on PATH. Install the .NET SDK or Visual Studio Build Tools."

    exe_name = f"{base_name}.exe"
    rc, stdout, stderr = await _run_process(csc, "/nologo", f"/out:{exe_name}", str(source_path), cwd=work_dir)
    if rc != 0:
        return _format_output(rc, stdout, stderr)

    rc, stdout, stderr = await _run_process(str(work_dir / exe_name), cwd=work_dir)
    return _format_output(rc, stdout, stderr, "C# program executed successfully with no output.")


async def _run_go(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    go = _require_command("go")
    if not go:
        return "Error: Go toolchain is not installed or not on PATH."
    rc, stdout, stderr = await _run_process(go, "run", str(source_path))
    return _format_output(rc, stdout, stderr, "Go program executed successfully with no output.")


async def _run_rust(source_path: Path, work_dir: Path, base_name: str) -> str:
    rustc = _require_command("rustc")
    if not rustc:
        return "Error: Rust toolchain is not installed or rustc is not on PATH."

    exe_name = base_name if sys.platform != "win32" else f"{base_name}.exe"
    rc, stdout, stderr = await _run_process(rustc, str(source_path), "-o", exe_name, cwd=work_dir)
    if rc != 0:
        return _format_output(rc, stdout, stderr)

    rc, stdout, stderr = await _run_process(str(work_dir / exe_name), cwd=work_dir)
    return _format_output(rc, stdout, stderr, "Rust program executed successfully with no output.")


async def _run_ruby(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    ruby = _require_command("ruby")
    if not ruby:
        return "Error: Ruby is not installed or not on PATH."
    rc, stdout, stderr = await _run_process(ruby, str(source_path))
    return _format_output(rc, stdout, stderr, "Ruby script executed successfully with no output.")


async def _run_php(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    php = _require_command("php")
    if not php:
        return "Error: PHP is not installed or not on PATH."
    rc, stdout, stderr = await _run_process(php, str(source_path))
    return _format_output(rc, stdout, stderr, "PHP script executed successfully with no output.")


async def _run_powershell(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    pwsh = _require_command("pwsh") or _require_command("powershell")
    if not pwsh:
        return "Error: PowerShell is not available on this system."
    args = [pwsh, "-NoProfile", "-NonInteractive", "-File", str(source_path)]
    rc, stdout, stderr = await _run_process(*args)
    return _format_output(rc, stdout, stderr, "PowerShell script executed successfully with no output.")


async def _run_bash(source_path: Path, _work_dir: Path, _base_name: str) -> str:
    bash = _require_command("bash") or _require_command("sh")
    if not bash:
        return "Error: Bash is not installed. Install Git Bash or WSL to run shell scripts."
    rc, stdout, stderr = await _run_process(bash, str(source_path))
    return _format_output(rc, stdout, stderr, "Bash script executed successfully with no output.")


LANGUAGE_REGISTRY: dict[str, LanguageConfig] = {
    "python": LanguageConfig(
        id="python",
        label="Python",
        extension=".py",
        default_code=(
            'def solve():\n'
            '    print("Hello from Python sandbox!")\n'
            '    return 2 + 2\n\n'
            'print(f"Result: {solve()}")'
        ),
        compile_and_run=_run_python,
    ),
    "javascript": LanguageConfig(
        id="javascript",
        label="JavaScript",
        extension=".js",
        default_code=(
            'function solve() {\n'
            '  console.log("Hello from JavaScript sandbox!");\n'
            '  return [1, 2, 3].reduce((a, b) => a + b, 0);\n'
            '}\n\n'
            'console.log(`Result: ${solve()}`);'
        ),
        compile_and_run=_run_javascript,
    ),
    "typescript": LanguageConfig(
        id="typescript",
        label="TypeScript",
        extension=".ts",
        default_code=(
            'function solve(): number {\n'
            '  console.log("Hello from TypeScript sandbox!");\n'
            '  return 10 + 5;\n'
            '}\n\n'
            'console.log(`Result: ${solve()}`);'
        ),
        compile_and_run=_run_typescript,
    ),
    "java": LanguageConfig(
        id="java",
        label="Java",
        extension=".java",
        default_code=(
            'public class Main {\n'
            '    public static void main(String[] args) {\n'
            '        System.out.println("Hello from Java sandbox!");\n'
            '        System.out.println("Result: " + (6 * 7));\n'
            '    }\n'
            '}'
        ),
        compile_and_run=_run_java,
    ),
    "c": LanguageConfig(
        id="c",
        label="C",
        extension=".c",
        default_code=(
            '#include <stdio.h>\n\n'
            'int main() {\n'
            '    printf("Hello from C sandbox!\\n");\n'
            '    printf("Result: %d\\n", 21 + 21);\n'
            '    return 0;\n'
            '}'
        ),
        compile_and_run=_run_c,
    ),
    "cpp": LanguageConfig(
        id="cpp",
        label="C++",
        extension=".cpp",
        default_code=(
            '#include <iostream>\n\n'
            'int main() {\n'
            '    std::cout << "Hello from C++ sandbox!" << std::endl;\n'
            '    std::cout << "Result: " << (15 + 27) << std::endl;\n'
            '    return 0;\n'
            '}'
        ),
        compile_and_run=_run_cpp,
    ),
    "csharp": LanguageConfig(
        id="csharp",
        label="C#",
        extension=".cs",
        default_code=(
            'using System;\n\n'
            'class Program {\n'
            '    static void Main() {\n'
            '        Console.WriteLine("Hello from C# sandbox!");\n'
            '        Console.WriteLine($"Result: {40 + 2}");\n'
            '    }\n'
            '}'
        ),
        compile_and_run=_run_csharp,
    ),
    "go": LanguageConfig(
        id="go",
        label="Go",
        extension=".go",
        default_code=(
            'package main\n\n'
            'import "fmt"\n\n'
            'func main() {\n'
            '    fmt.Println("Hello from Go sandbox!")\n'
            '    fmt.Println("Result:", 30+12)\n'
            '}'
        ),
        compile_and_run=_run_go,
    ),
    "rust": LanguageConfig(
        id="rust",
        label="Rust",
        extension=".rs",
        default_code=(
            'fn main() {\n'
            '    println!("Hello from Rust sandbox!");\n'
            '    println!("Result: {}", 11 + 31);\n'
            '}'
        ),
        compile_and_run=_run_rust,
    ),
    "ruby": LanguageConfig(
        id="ruby",
        label="Ruby",
        extension=".rb",
        default_code=(
            'puts "Hello from Ruby sandbox!"\n'
            'puts "Result: #{6 * 7}"'
        ),
        compile_and_run=_run_ruby,
    ),
    "php": LanguageConfig(
        id="php",
        label="PHP",
        extension=".php",
        default_code=(
            '<?php\n'
            'echo "Hello from PHP sandbox!\\n";\n'
            'echo "Result: " . (8 * 5) . "\\n";\n'
            '?>'
        ),
        compile_and_run=_run_php,
    ),
    "powershell": LanguageConfig(
        id="powershell",
        label="PowerShell",
        extension=".ps1",
        default_code=(
            'Write-Output "Hello from PowerShell sandbox!"\n'
            '$result = 9 + 33\n'
            'Write-Output "Result: $result"'
        ),
        compile_and_run=_run_powershell,
    ),
    "bash": LanguageConfig(
        id="bash",
        label="Bash",
        extension=".sh",
        default_code=(
            '#!/usr/bin/env bash\n'
            'echo "Hello from Bash sandbox!"\n'
            'echo "Result: $((14 + 28))"'
        ),
        compile_and_run=_run_bash,
    ),
}


def get_supported_languages() -> list[dict[str, str]]:
    return [{"id": cfg.id, "label": cfg.label} for cfg in LANGUAGE_REGISTRY.values()]


def _normalize_java_source(code: str) -> tuple[str, str]:
    stripped = code.strip()
    for line in stripped.splitlines():
        line = line.strip()
        if line.startswith("public class "):
            class_name = line.split()[2].split("{")[0]
            return class_name, stripped
    return "Main", stripped


async def execute_code(language: str, code: str) -> str:
    lang_key = (language or "python").strip().lower()
    config = LANGUAGE_REGISTRY.get(lang_key)
    if not config:
        supported = ", ".join(cfg.label for cfg in LANGUAGE_REGISTRY.values())
        return f"Error: Unsupported language '{language}'. Supported: {supported}."

    if not code.strip():
        return "Error: No code provided."

    work_dir = Path(tempfile.mkdtemp(prefix="jarvis_sandbox_"))
    try:
        if lang_key == "java":
            class_name, normalized = _normalize_java_source(code)
            source_path = work_dir / f"{class_name}.java"
            source_path.write_text(normalized, encoding="utf-8")
            base_name = class_name
        else:
            base_name = "main"
            source_path = work_dir / f"{base_name}{config.extension}"
            source_path.write_text(code, encoding="utf-8")

        return await config.compile_and_run(source_path, work_dir, base_name)
    except Exception as exc:
        return f"Sandbox execution failed: {exc}"
    finally:
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


async def execute_sandbox_payload(data: str) -> str:
    """Expected format: language|code"""
    if "|" not in data:
        return await execute_code("python", data)
    language, code = data.split("|", 1)
    return await execute_code(language, code)
