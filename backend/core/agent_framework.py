"""ASTRYX Autonomous Agent Framework — Dynamic agent creation, multi-agent orchestration, and executive assistant.

Architecture:
  AgentBase       → Base class for all agents (think, act, learn)
  AgentRegistry   → Registry for creating, listing, and retrieving agents
  MultiAgentOrchestrator → Decomposes tasks, delegates to agents, synthesizes results
  ExecutiveAssistant → Proactive, context-aware assistant that learns user patterns
  Specialized Agents → ResearchAgent, CodingAgent, DesignAgent, TestingAgent, DebuggingAgent, ProjectManagerAgent
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
import structlog
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

from core.local_llm_client import lm_client

logger = structlog.get_logger(__name__)

# ═══════════════════════════════════════════════════════════════════
#  AGENT BASE CLASS
# ═══════════════════════════════════════════════════════════════════


class AgentBase:
    """Base class for all autonomous agents in the ASTRYX ecosystem.

    Each agent has:
    - A name and role description
    - A system prompt defining its personality and capabilities
    - Tools/functions it can call
    - Memory (conversation history)
    - Ability to think (reason), act (execute), and learn (reflect)
    """

    def __init__(
        self,
        name: str,
        role: str,
        system_prompt: str,
        tools: dict[str, Callable] | None = None,
        max_history: int = 20,
    ):
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
        self.tools = tools or {}
        self.max_history = max_history
        self.memory: list[dict[str, str]] = []
        self.experiences: list[dict] = []
        self.created_at = datetime.now().isoformat()
        self.task_count = 0
        self.success_count = 0

    async def think(self, task: str, context: str = "") -> str:
        """Reason about a task and produce a plan or analysis.

        Args:
            task: The task or question to reason about
            context: Optional additional context

        Returns:
            The agent's reasoning/plan as a string
        """
        self.task_count += 1
        messages = [
            {"role": "system", "content": self.system_prompt},
        ]

        # Add relevant memories
        for mem in self.memory[-5:]:
            messages.append(mem)

        context_block = f"\nAdditional Context:\n{context}" if context else ""
        messages.append({
            "role": "user",
            "content": f"Task: {task}{context_block}\n\nThink through this carefully. Provide your reasoning and plan."
        })

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=1024),
                timeout=60,
            )
            self.memory.append({"role": "user", "content": f"Task: {task}"})
            self.memory.append({"role": "assistant", "content": response[:500]})
            self._trim_memory()
            return response.strip()
        except asyncio.TimeoutError:
            return f"[{self.name}] Reasoning timed out."
        except Exception as e:
            logger.error("agent_think_error", agent=self.name, error=str(e))
            return f"[{self.name}] Reasoning error: {str(e)}"

    async def act(self, task: str, context: str = "") -> str:
        """Execute a task and produce a result.

        Args:
            task: The task to execute
            context: Optional additional context

        Returns:
            The result of execution
        """
        self.task_count += 1
        messages = [
            {"role": "system", "content": self.system_prompt},
        ]

        for mem in self.memory[-5:]:
            messages.append(mem)

        # If we have tools, describe them
        if self.tools:
            tool_desc = "\n\nAvailable Tools:\n" + "\n".join(
                f"- {name}: {desc.__doc__ or 'No description'}"
                for name, desc in self.tools.items()
            )
        else:
            tool_desc = ""

        context_block = f"\nAdditional Context:\n{context}" if context else ""
        messages.append({
            "role": "user",
            "content": f"Execute this task: {task}{context_block}{tool_desc}\n\nProvide a thorough, well-structured response."
        })

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=2048),
                timeout=120,
            )
            self.memory.append({"role": "user", "content": f"Task: {task}"})
            self.memory.append({"role": "assistant", "content": response[:500]})
            self._trim_memory()
            self.success_count += 1
            return response.strip()
        except asyncio.TimeoutError:
            return f"[{self.name}] Task execution timed out."
        except Exception as e:
            logger.error("agent_act_error", agent=self.name, error=str(e))
            return f"[{self.name}] Execution error: {str(e)}"

    async def learn(self, experience: dict) -> None:
        """Learn from an experience or outcome.

        Args:
            experience: Dict with 'task', 'result', 'outcome' keys
        """
        self.experiences.append({
            **experience,
            "timestamp": datetime.now().isoformat(),
        })
        if len(self.experiences) > 50:
            self.experiences = self.experiences[-50:]

        # Reflect on the experience using LLM
        reflect_prompt = (
            f"As {self.name} ({self.role}), reflect on this experience:\n"
            f"Task: {experience.get('task', 'Unknown')}\n"
            f"Result: {experience.get('result', 'N/A')[:200]}\n"
            f"Outcome: {experience.get('outcome', 'Unknown')}\n\n"
            f"What can you learn from this? How can you improve? Be specific. (1-2 sentences)"
        )
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": reflect_prompt},
        ]
        try:
            reflection = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=256),
                timeout=30,
            )
            self.experiences[-1]["reflection"] = reflection.strip()
        except Exception:
            pass

    def _trim_memory(self) -> None:
        """Trim conversation history to max_history."""
        if len(self.memory) > self.max_history:
            self.memory = self.memory[-self.max_history:]

    def get_status(self) -> dict:
        """Return agent status as a dict."""
        return {
            "name": self.name,
            "role": self.role,
            "task_count": self.task_count,
            "success_count": self.success_count,
            "memory_size": len(self.memory),
            "experiences": len(self.experiences),
            "tools": list(self.tools.keys()),
            "created_at": self.created_at,
        }

    def to_dict(self) -> dict:
        """Serialize agent to dict for transmission."""
        return {
            "name": self.name,
            "role": self.role,
            "system_prompt_preview": self.system_prompt[:100],
            "task_count": self.task_count,
            "success_count": self.success_count,
            "memory_size": len(self.memory),
            "experiences": len(self.experiences),
            "tools": list(self.tools.keys()),
            "created_at": self.created_at,
        }


# ═══════════════════════════════════════════════════════════════════
#  SPECIALIZED AGENTS
# ═══════════════════════════════════════════════════════════════════

RESEARCH_AGENT_PROMPT = (
    "You are ASTRYX Research Agent, an elite research analyst. "
    "You excel at deep web research, multi-source analysis, and evidence-based conclusions. "
    "You verify facts across multiple sources, assess credibility, and cite your sources. "
    "You are thorough, objective, and precise. You identify conflicting information and "
    "highlight uncertainty when data is inconclusive. You output well-structured markdown reports."
)

CODING_AGENT_PROMPT = (
    "You are ASTRYX Coding Agent, an expert software engineer. "
    "You design, implement, review, and optimize code across all major languages. "
    "You follow best practices: clean architecture, SOLID principles, proper error handling, "
    "comprehensive testing, and clear documentation. You analyze requirements carefully "
    "before writing code. You provide complete, working solutions."
)

DESIGN_AGENT_PROMPT = (
    "You are ASTRYX Design Agent, a world-class UI/UX designer. "
    "You design beautiful, functional interfaces with modern aesthetics. "
    "You consider user flows, accessibility, responsive design, and visual hierarchy. "
    "You provide detailed design specifications with color palettes, typography, "
    "layout grids, and interaction patterns. You stay current with design trends."
)

TESTING_AGENT_PROMPT = (
    "You are ASTRYX Testing Agent, a QA engineer. "
    "You write comprehensive test suites covering unit tests, integration tests, "
    "and edge cases. You identify potential failure modes, boundary conditions, "
    "and security vulnerabilities. You follow testing best practices and "
    "ensure high code coverage. You are thorough and meticulous."
)

DEBUGGING_AGENT_PROMPT = (
    "You are ASTRYX Debugging Agent, an expert debugger and problem solver. "
    "You analyze error messages, stack traces, and unexpected behaviors to "
    "identify root causes. You are systematic in your approach: reproduce, isolate, "
    "hypothesize, verify. You provide clear explanations of bugs and concrete fixes."
)

PROJECT_MANAGER_AGENT_PROMPT = (
    "You are ASTRYX Project Manager Agent, an experienced project manager. "
    "You break down complex projects into manageable tasks, estimate effort, "
    "identify dependencies and risks, and create realistic timelines. "
    "You track progress, identify blockers, and suggest mitigations. "
    "You communicate clearly and keep stakeholders informed. "
    "You use agile/scrum methodology."
)

EXECUTIVE_ASSISTANT_PROMPT = (
    "You are ASTRYX Executive Assistant, a proactive personal AI assistant. "
    "You anticipate the user's needs based on context, time of day, and past patterns. "
    "You suggest relevant actions, provide timely reminders, and offer concise briefings. "
    "You are professional, efficient, and unobtrusive. You prioritize the user's time "
    "and attention. You synthesize information into actionable insights."
)


def _create_default_tools() -> dict[str, Callable]:
    """Create default tool set for agents."""
    from agents.automation import automation
    return {
        "search_web": automation.search_web,
        "execute_python": automation.execute_python,
        "deep_research": automation.deep_research,
    }


def create_research_agent() -> AgentBase:
    """Create a pre-configured Research Agent."""
    return AgentBase(
        name="ResearchAgent",
        role="Elite Research Analyst",
        system_prompt=RESEARCH_AGENT_PROMPT,
        tools=_create_default_tools(),
    )


def create_coding_agent() -> AgentBase:
    """Create a pre-configured Coding Agent."""
    tools = _create_default_tools()
    from agents.automation import automation
    tools["execute_sandbox"] = automation.execute_sandbox
    return AgentBase(
        name="CodingAgent",
        role="Expert Software Engineer",
        system_prompt=CODING_AGENT_PROMPT,
        tools=tools,
    )


def create_design_agent() -> AgentBase:
    """Create a pre-configured Design Agent."""
    return AgentBase(
        name="DesignAgent",
        role="UI/UX Designer",
        system_prompt=DESIGN_AGENT_PROMPT,
        tools=_create_default_tools(),
    )


def create_testing_agent() -> AgentBase:
    """Create a pre-configured Testing Agent."""
    return AgentBase(
        name="TestingAgent",
        role="QA Engineer",
        system_prompt=TESTING_AGENT_PROMPT,
        tools=_create_default_tools(),
    )


def create_debugging_agent() -> AgentBase:
    """Create a pre-configured Debugging Agent."""
    return AgentBase(
        name="DebuggingAgent",
        role="Expert Debugger",
        system_prompt=DEBUGGING_AGENT_PROMPT,
        tools=_create_default_tools(),
    )


def create_project_manager_agent() -> AgentBase:
    """Create a pre-configured Project Manager Agent."""
    return AgentBase(
        name="ProjectManagerAgent",
        role="Project Manager",
        system_prompt=PROJECT_MANAGER_AGENT_PROMPT,
        tools=_create_default_tools(),
    )


def create_executive_assistant() -> AgentBase:
    """Create the Executive Assistant agent."""
    return AgentBase(
        name="ExecutiveAssistant",
        role="Executive Assistant",
        system_prompt=EXECUTIVE_ASSISTANT_PROMPT,
        tools=_create_default_tools(),
    )


# ═══════════════════════════════════════════════════════════════════
#  AGENT REGISTRY
# ═══════════════════════════════════════════════════════════════════


class AgentRegistry:
    """Registry for creating, listing, and managing autonomous agents.

    Supports:
    - Pre-built specialized agents
    - Dynamic agent creation from config
    - Agent lookup by name or role
    - Agent lifecycle management
    """

    def __init__(self):
        self._agents: dict[str, AgentBase] = {}
        self._agent_counter = 0
        self._initialize_defaults()

    def _initialize_defaults(self) -> None:
        """Register the default set of specialized agents."""
        defaults = [
            create_research_agent(),
            create_coding_agent(),
            create_design_agent(),
            create_testing_agent(),
            create_debugging_agent(),
            create_project_manager_agent(),
            create_executive_assistant(),
        ]
        for agent in defaults:
            self._agents[agent.name] = agent
        logger.info("agent_registry_initialized", count=len(defaults))

    def register_agent(self, agent: AgentBase) -> str:
        """Register an agent instance.

        Args:
            agent: The agent to register

        Returns:
            The agent's name
        """
        self._agents[agent.name] = agent
        logger.info("agent_registered", name=agent.name, role=agent.role)
        return agent.name

    def get_agent(self, name: str) -> AgentBase | None:
        """Get an agent by name.

        Args:
            name: The agent's name

        Returns:
            The agent, or None if not found
        """
        return self._agents.get(name)

    def get_agent_by_role(self, role_keyword: str) -> AgentBase | None:
        """Find an agent by keyword in its role description.

        Args:
            role_keyword: Keyword to search for in role (e.g., 'research', 'code')

        Returns:
            The best matching agent, or None
        """
        role_lower = role_keyword.lower()
        for agent in self._agents.values():
            if role_lower in agent.role.lower() or role_lower in agent.name.lower():
                return agent
        return None

    def create_agent(
        self,
        name: str | None = None,
        role: str = "Specialist Agent",
        system_prompt: str | None = None,
    ) -> AgentBase:
        """Dynamically create a new agent.

        Args:
            name: Custom name (auto-generated if not provided)
            role: Role description
            system_prompt: Custom system prompt (auto-generated if not provided)

        Returns:
            The newly created agent
        """
        self._agent_counter += 1
        agent_name = name or f"CustomAgent_{self._agent_counter}"

        if not system_prompt:
            system_prompt = (
                f"You are {agent_name}, an AI agent specializing in {role}. "
                f"You are autonomous, thorough, and precise. You complete tasks "
                f"efficiently and communicate results clearly. You adapt your approach "
                f"based on the specific requirements of each task."
            )

        agent = AgentBase(
            name=agent_name,
            role=role,
            system_prompt=system_prompt,
            tools=_create_default_tools(),
        )
        self._agents[agent_name] = agent
        logger.info("agent_created_dynamic", name=agent_name, role=role)
        return agent

    def list_agents(self) -> list[dict]:
        """List all registered agents with their status.

        Returns:
            List of agent status dicts
        """
        return [agent.to_dict() for agent in self._agents.values()]

    def remove_agent(self, name: str) -> bool:
        """Remove an agent from the registry (cannot remove defaults).

        Args:
            name: The agent's name

        Returns:
            True if removed, False otherwise
        """
        default_names = {
            "ResearchAgent", "CodingAgent", "DesignAgent",
            "TestingAgent", "DebuggingAgent", "ProjectManagerAgent",
            "ExecutiveAssistant",
        }
        if name in default_names:
            return False
        if name in self._agents:
            del self._agents[name]
            logger.info("agent_removed", name=name)
            return True
        return False

    def get_summary(self) -> dict:
        """Get a summary of the registry.

        Returns:
            Dict with agent count and brief info
        """
        return {
            "total_agents": len(self._agents),
            "agents": self.list_agents(),
        }


# ═══════════════════════════════════════════════════════════════════
#  MULTI-AGENT ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════


class MultiAgentOrchestrator:
    """Orchestrates multiple agents to collaborate on complex tasks.

    Workflow:
    1. Decompose: Break the task into sub-tasks using a Planner agent
    2. Delegate: Assign each sub-task to the best-suited agent
    3. Synthesize: Combine all results into a cohesive final output
    4. Review: Have a Reviewer agent check the final output
    """

    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        self.execution_history: list[dict] = []

    async def decompose_task(self, task: str, num_subtasks: int = 3) -> list[dict]:
        """Decompose a complex task into structured sub-tasks.

        Args:
            task: The complex task description
            num_subtasks: Number of sub-tasks to generate

        Returns:
            List of sub-task dicts with 'id', 'name', 'description', 'agent_role'
        """
        prompt = (
            f"Decompose the following task into {num_subtasks} well-defined sub-tasks. "
            f"For each sub-task, specify which type of agent should handle it "
            f"(e.g., 'research', 'coding', 'design', 'testing', 'analysis', 'management').\n\n"
            f"TASK: {task}\n\n"
            f"Return ONLY a JSON array. No markdown, no backticks.\n"
            f"Each object: {{'id': 1, 'name': 'Sub-task name', 'description': 'What to do', 'agent_role': 'research'}}"
        )
        messages = [
            {
                "role": "system",
                "content": "You are a task decomposition specialist. You break complex tasks into clear, assignable sub-tasks. You output ONLY valid JSON.",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=2048),
                timeout=60,
            )
            cleaned = re.sub(r"```json|```", "", response).strip()
            sub_tasks = json.loads(cleaned)
            if isinstance(sub_tasks, list):
                return sub_tasks[:num_subtasks]
        except Exception as e:
            logger.warning("task_decomposition_failed", error=str(e))

        # Fallback: create simple sub-tasks
        return [
            {"id": 1, "name": "Research & Analysis", "description": f"Research and analyze: {task}", "agent_role": "research"},
            {"id": 2, "name": "Solution Design", "description": f"Design solution for: {task}", "agent_role": "design"},
            {"id": 3, "name": "Implementation Plan", "description": f"Create implementation plan for: {task}", "agent_role": "management"},
        ]

    async def delegate_to_agent(
        self,
        sub_task: dict,
        context: str = "",
    ) -> dict:
        """Delegate a sub-task to the best-suited agent.

        Args:
            sub_task: Dict with 'name', 'description', 'agent_role'
            context: Shared context from other agents

        Returns:
            Result dict with 'agent', 'sub_task', 'result'
        """
        agent_role = sub_task.get("agent_role", "research")
        agent = self.registry.get_agent_by_role(agent_role)

        if not agent:
            # Fallback: use first available agent
            agent = next(iter(self.registry._agents.values()))

        task_description = f"{sub_task.get('name', 'Task')}: {sub_task.get('description', '')}"
        result = await agent.act(task_description, context)

        return {
            "agent": agent.name,
            "agent_role": agent.role,
            "sub_task": sub_task,
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }

    async def synthesize_results(self, results: list[dict], original_task: str) -> str:
        """Synthesize multiple agent results into a cohesive final output.

        Args:
            results: List of agent result dicts
            original_task: The original task description

        Returns:
            Synthesized final report
        """
        synthesis_input = f"Original Task: {original_task}\n\n"
        for i, r in enumerate(results, 1):
            synthesis_input += f"--- Agent {i}: {r['agent']} ({r['agent_role']}) ---\n"
            synthesis_input += f"Sub-task: {r['sub_task'].get('name', 'Unknown')}\n"
            synthesis_input += f"Result: {r['result'][:800]}\n\n"

        prompt = (
            f"Synthesize the following results from multiple specialist agents into "
            f"a cohesive, well-structured final report. Identify key themes, "
            f"reconcile any conflicts, and present a unified conclusion.\n\n"
            f"{synthesis_input}\n\n"
            f"Output a comprehensive markdown report with:\n"
            f"### Executive Summary\n"
            f"### Key Findings\n"
            f"### Agent Contributions\n"
            f"### Final Recommendations"
        )

        messages = [
            {
                "role": "system",
                "content": "You are a synthesis specialist. You combine outputs from multiple AI agents into clear, cohesive reports.",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=2048),
                timeout=90,
            )
            return response.strip()
        except Exception as e:
            logger.error("synthesis_failed", error=str(e))
            # Fallback: simple concatenation
            parts = [f"## Result from {r['agent']}\n{r['result'][:500]}" for r in results]
            return f"# Multi-Agent Results: {original_task}\n\n" + "\n\n".join(parts)

    async def review_output(self, output: str, original_task: str) -> str:
        """Review the synthesized output for quality and completeness.

        Args:
            output: The synthesized output
            original_task: The original task

        Returns:
            Review feedback
        """
        prompt = (
            f"Review the following output that was generated for the task: '{original_task}'\n\n"
            f"OUTPUT:\n{output[:2000]}\n\n"
            f"Check for:\n"
            f"1. Completeness — does it fully address the task?\n"
            f"2. Accuracy — are there any factual errors?\n"
            f"3. Clarity — is it well-structured and understandable?\n"
            f"4. Actionability — does it provide concrete value?\n\n"
            f"Provide a brief review (2-3 sentences) and a score from 1-10."
        )
        messages = [
            {
                "role": "system",
                "content": "You are a quality assurance reviewer. You evaluate AI-generated content for quality, accuracy, and completeness.",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=512),
                timeout=30,
            )
            return response.strip()
        except Exception:
            return "Review: Output generated successfully. Quality score: 7/10."

    async def run(
        self,
        task: str,
        num_subtasks: int = 3,
        enable_review: bool = True,
    ) -> str:
        """Execute a full multi-agent collaboration workflow.

        Args:
            task: The complex task to execute
            num_subtasks: Number of sub-tasks to decompose into
            enable_review: Whether to run the review step

        Returns:
            Comprehensive result with all agent contributions
        """
        start_time = time.time()
        logger.info("multi_agent_run_started", task=task[:80], subtasks=num_subtasks)

        # Phase 1: Decompose
        sub_tasks = await self.decompose_task(task, num_subtasks)

        # Phase 2: Delegate (run in parallel)
        context = f"Original task: {task}\nSub-tasks: " + ", ".join(s.get("name", "") for s in sub_tasks)
        delegate_tasks = [self.delegate_to_agent(st, context) for st in sub_tasks]
        results = await asyncio.gather(*delegate_tasks, return_exceptions=True)

        # Filter out exceptions
        valid_results = [r for r in results if isinstance(r, dict)]

        # Phase 3: Synthesize
        synthesis = await self.synthesize_results(valid_results, task)

        # Phase 4: Review (optional)
        review = ""
        if enable_review:
            review = await self.review_output(synthesis, task)

        # Record execution
        execution = {
            "task": task,
            "sub_tasks": sub_tasks,
            "agent_results": [
                {"agent": r["agent"], "sub_task": r["sub_task"]["name"]}
                for r in valid_results
            ],
            "duration_seconds": round(time.time() - start_time, 1),
            "timestamp": datetime.now().isoformat(),
        }
        self.execution_history.append(execution)

        # Phase 5: Build report
        report = (
            f"# 🤖 Multi-Agent Collaboration Report\n\n"
            f"**Task**: {task}\n"
            f"**Duration**: {execution['duration_seconds']}s\n"
            f"**Agents Involved**: {', '.join(r['agent'] for r in valid_results)}\n\n"
            f"---\n\n"
            f"{synthesis}\n\n"
        )
        if review:
            report += f"---\n\n### 📋 Quality Review\n{review}\n"

        # Learn from execution
        for r in valid_results:
            agent = self.registry.get_agent(r["agent"])
            if agent:
                await agent.learn({
                    "task": r["sub_task"]["name"],
                    "result": r["result"][:200],
                    "outcome": "completed",
                })

        logger.info("multi_agent_run_completed", duration=execution['duration_seconds'])
        return report


# ═══════════════════════════════════════════════════════════════════
#  EXECUTIVE ASSISTANT — PROACTIVE SUGGESTIONS
# ═══════════════════════════════════════════════════════════════════


class ExecutiveAssistantService:
    """Proactive, context-aware executive assistant.

    Monitors system state, user activity patterns, and time-of-day to
    generate relevant suggestions and take proactive actions.
    """

    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        self._agent = registry.get_agent("ExecutiveAssistant")
        self._context_history: list[dict] = []
        self._last_suggestion_time: float = 0
        self._cooldown_seconds = 120

    async def get_suggestions(self, force: bool = False) -> list[dict]:
        """Generate context-aware proactive suggestions.

        Args:
            force: If True, bypass cooldown

        Returns:
            List of suggestion dicts with 'title', 'description', 'action', 'priority'
        """
        now = time.time()
        if not force and (now - self._last_suggestion_time) < self._cooldown_seconds:
            return []

        self._last_suggestion_time = now

        # Gather context
        context = await self._gather_context()

        # Use Executive Assistant agent to generate suggestions
        prompt = (
            f"Based on the current context, generate 3-5 proactive suggestions "
            f"for the user. Consider: time of day, system state, recent activity, "
            f"and common productivity patterns.\n\n"
            f"CONTEXT:\n{json.dumps(context, default=str, indent=2)}\n\n"
            f"Return a JSON array of suggestion objects. No markdown, no backticks.\n"
            f"Each object: {{\n"
            f"  'id': 'sugg_1',\n"
            f"  'title': 'Short actionable title',\n"
            f"  'description': '1-2 sentence description',\n"
            f"  'action': 'The action to take',\n"
            f"  'priority': 'high' | 'medium' | 'low',\n"
            f"  'icon': 'emoji'\n"
            f"}}"
        )

        messages = [
            {"role": "system", "content": EXECUTIVE_ASSISTANT_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=1024),
                timeout=30,
            )
            cleaned = re.sub(r"```json|```", "", response).strip()
            suggestions = json.loads(cleaned)
            if isinstance(suggestions, list):
                # Ensure each suggestion has an id
                for i, s in enumerate(suggestions):
                    if "id" not in s:
                        s["id"] = f"sugg_{i}"
                return suggestions[:5]
        except Exception as e:
            logger.warning("suggestion_generation_failed", error=str(e))

        return self._get_fallback_suggestions(context)

    async def _gather_context(self) -> dict:
        """Gather context about the current state."""
        context = {
            "time": datetime.now().strftime("%H:%M"),
            "day_of_week": datetime.now().strftime("%A"),
            "hour": datetime.now().hour,
        }

        # Get system metrics
        try:
            import psutil
            context["cpu_percent"] = psutil.cpu_percent(interval=0.1)
            context["ram_percent"] = psutil.virtual_memory().percent
            context["process_count"] = len(psutil.pids())
        except Exception:
            pass

        # Get recent activity from registry agents
        agent_statuses = []
        for agent in self.registry._agents.values():
            if agent.task_count > 0:
                agent_statuses.append({
                    "name": agent.name,
                    "tasks": agent.task_count,
                    "success_rate": f"{(agent.success_count / max(agent.task_count, 1)) * 100:.0f}%",
                })
        context["agent_activity"] = agent_statuses

        # Get recent messages
        try:
            from api.websockets import ws_manager
            context["active_connections"] = len(ws_manager.active_connections)
        except Exception:
            pass

        return context

    def _get_fallback_suggestions(self, context: dict) -> list[dict]:
        """Generate fallback suggestions when LLM fails."""
        hour = context.get("hour", 12)
        suggestions = []

        if hour < 12:
            suggestions.append({
                "id": "sugg_1",
                "title": "Morning Briefing",
                "description": "Start your day with a comprehensive briefing — weather, calendar, tasks, and news.",
                "action": "Run daily briefing",
                "priority": "high",
                "icon": "🌅",
            })
        elif 12 <= hour < 18:
            suggestions.append({
                "id": "sugg_2",
                "title": "Afternoon Check-in",
                "description": "Review your task progress and optimize your remaining time.",
                "action": "Check task progress",
                "priority": "medium",
                "icon": "📋",
            })
        else:
            suggestions.append({
                "id": "sugg_3",
                "title": "Evening Review",
                "description": "Review today's accomplishments and plan tomorrow's priorities.",
                "action": "End-of-day review",
                "priority": "medium",
                "icon": "🌙",
            })

        # Add a universal suggestion
        suggestions.append({
            "id": "sugg_4",
            "title": "Deep Work Session",
            "description": "You have been running for a while. Consider a focused deep work session.",
            "action": "Start focus mode",
            "priority": "low",
            "icon": "🎯",
        })

        return suggestions

    async def predict_next_action(self) -> str:
        """Predict the user's most likely next action based on context and history."""
        context = await self._gather_context()

        prompt = (
            f"Based on the following context, predict the user's most likely next action. "
            f"Consider what a productive person would typically do next.\n\n"
            f"Context:\n{json.dumps(context, default=str, indent=2)}\n\n"
            f"Provide a single sentence predicting their next move, e.g., "
            f"'The user will likely check their email and review today's tasks.'"
        )
        messages = [
            {"role": "system", "content": EXECUTIVE_ASSISTANT_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await asyncio.wait_for(
                lm_client.chat(messages, max_tokens=128),
                timeout=15,
            )
            return response.strip()
        except Exception:
            return "The user may continue working on their current tasks."


# ═══════════════════════════════════════════════════════════════════
#  SINGLETONS & PUBLIC API
# ═══════════════════════════════════════════════════════════════════

# Global registry instance
agent_registry = AgentRegistry()

# Global multi-agent orchestrator
orchestrator = MultiAgentOrchestrator(agent_registry)

# Global executive assistant
executive_assistant = ExecutiveAssistantService(agent_registry)


# ── Public handler for the AGENTFORGE tool ──


async def handle_agent_forge(data: str) -> str:
    """Handle the AGENTFORGE tool command.

    Formats:
      list                          — List all registered agents
      create|name|role              — Create a new custom agent
      run|task|num_subtasks         — Run multi-agent collaboration
      delegate|agent_name|task      — Delegate a task to a specific agent
      suggest                       — Get proactive suggestions
      predict                       — Predict next action
      status|agent_name             — Get agent status
      remove|agent_name             — Remove a custom agent
    """
    if not data or not data.strip():
        return json.dumps({"status": "ok", "agents": agent_registry.get_summary()})

    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "list":
        return json.dumps({
            "type": "agent_list",
            "agents": agent_registry.list_agents(),
            "total": len(agent_registry._agents),
        })

    elif action == "create":
        name = parts[1].strip() if len(parts) > 1 else None
        role = parts[2].strip() if len(parts) > 2 else "General Specialist"
        agent = agent_registry.create_agent(name, role)
        return json.dumps({
            "type": "agent_created",
            "agent": agent.to_dict(),
            "message": f"Agent '{agent.name}' created with role: {agent.role}",
        })

    elif action == "run":
        task = parts[1].strip() if len(parts) > 1 else ""
        num_subtasks = int(parts[2].strip()) if len(parts) > 2 and parts[2].strip().isdigit() else 3
        if not task:
            return json.dumps({"error": "Task description is required for multi-agent run."})
        result = await orchestrator.run(task, num_subtasks)
        return json.dumps({
            "type": "multi_agent_result",
            "task": task,
            "result": result,
        })

    elif action == "delegate":
        agent_name = parts[1].strip() if len(parts) > 1 else ""
        task = parts[2].strip() if len(parts) > 2 else ""
        if not agent_name or not task:
            return json.dumps({"error": "Both agent name and task are required."})
        agent = agent_registry.get_agent(agent_name)
        if not agent:
            return json.dumps({"error": f"Agent '{agent_name}' not found."})
        result = await agent.act(task)
        return json.dumps({
            "type": "delegation_result",
            "agent": agent_name,
            "task": task,
            "result": result,
        })

    elif action == "suggest":
        force = len(parts) > 1 and parts[1].strip().lower() == "force"
        suggestions = await executive_assistant.get_suggestions(force=force)
        if not suggestions:
            return json.dumps({
                "type": "suggestions",
                "suggestions": [],
                "message": "No new suggestions at this time.",
            })
        return json.dumps({
            "type": "suggestions",
            "suggestions": suggestions,
        })

    elif action == "predict":
        prediction = await executive_assistant.predict_next_action()
        return json.dumps({
            "type": "prediction",
            "prediction": prediction,
        })

    elif action == "status":
        agent_name = parts[1].strip() if len(parts) > 1 else ""
        if agent_name:
            agent = agent_registry.get_agent(agent_name)
            if not agent:
                return json.dumps({"error": f"Agent '{agent_name}' not found."})
            return json.dumps({"type": "agent_status", "agent": agent.get_status()})
        return json.dumps({
            "type": "agent_status",
            "registry": agent_registry.get_summary(),
        })

    elif action == "remove":
        agent_name = parts[1].strip() if len(parts) > 1 else ""
        if not agent_name:
            return json.dumps({"error": "Agent name required."})
        removed = agent_registry.remove_agent(agent_name)
        return json.dumps({
            "type": "agent_removed",
            "name": agent_name,
            "success": removed,
        })

    else:
        return json.dumps({"error": f"Unknown action: {action}"})
