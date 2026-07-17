"""ASTRYX Knowledge Graph Explorer — Visualizes ChromaDB vector memory as an interactive knowledge graph.

Explores connections between memories, concepts, and entities stored
in ASTRYX's vector database and graph database, returning structured
data for interactive visualization.
"""

from __future__ import annotations

import asyncio
import json
import os
import structlog
import sqlite3

from core.local_llm_client import lm_client

# Lazy import for memory_core to avoid hard dependency on networkx at module level
_memory_core = None
def _get_memory():
    global _memory_core
    if _memory_core is None:
        from core.memory import memory_core as mc
        _memory_core = mc
    return _memory_core

logger = structlog.get_logger(__name__)


async def explore_knowledge_graph(query: str = "", depth: int = 1) -> str:
    """Explore the knowledge graph and return connected entities.

    Args:
        query: Search query to find related nodes (empty = get all)
        depth: How deep to traverse connections (1-3)

    Returns:
        JSON string with nodes and edges for visualization
    """
    logger.info("knowledge_graph_explore", query=query[:50] if query else "all", depth=depth)

    depth = max(1, min(depth, 3))
    nodes = []
    edges = []

    try:
        # ── Get nodes from ChromaDB ──
        chroma_nodes = []
        mem = _get_memory()
        if query and mem.collection:
            try:
                results = mem.collection.query(
                    query_texts=[query],
                    n_results=20,
                )
                if results.get("ids") and results["ids"][0]:
                    for i, doc_id in enumerate(results["ids"][0]):
                        metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
                        chroma_nodes.append({
                            "id": doc_id,
                            "label": doc_id.replace("mem_", "Memory #"),
                            "type": "memory",
                            "metadata": {k: str(v)[:100] for k, v in metadata.items()},
                            "size": 8,
                        })
            except Exception as e:
                logger.warning("chroma_query_failed", error=str(e))

        # ── Get nodes from SQLite graph DB ──
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "chroma", "graph.db"
        )
        sqlite_nodes = []

        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                c = conn.cursor()

                if query:
                    c.execute("SELECT * FROM entities WHERE id LIKE ? OR properties LIKE ? LIMIT 30",
                              (f"%{query}%", f"%{query}%"))
                else:
                    c.execute("SELECT * FROM entities LIMIT 30")

                for row in c.fetchall():
                    sqlite_nodes.append({
                        "id": row["id"],
                        "label": row["id"][:30],
                        "type": row["type"],
                        "metadata": {},
                        "size": 10 if row["type"] == "entity" else 6,
                    })

                # ── Get relationships as edges ──
                if query:
                    c.execute("""
                        SELECT * FROM relationships 
                        WHERE source LIKE ? OR target LIKE ? LIMIT 50
                    """, (f"%{query}%", f"%{query}%"))
                else:
                    c.execute("SELECT * FROM relationships LIMIT 50")

                for row in c.fetchall():
                    edges.append({
                        "source": row["source"],
                        "target": row["target"],
                        "label": row["relation"],
                        "weight": 1,
                    })

                conn.close()
            except Exception as e:
                logger.warning("sqlite_graph_query_failed", error=str(e))

        # ── Combine nodes ──
        all_nodes = chroma_nodes + sqlite_nodes
        seen_ids = set()
        unique_nodes = []
        for node in all_nodes:
            if node["id"] not in seen_ids:
                seen_ids.add(node["id"])
                unique_nodes.append(node)

        # ── If no results, generate synthetic demo graph ──
        if not unique_nodes:
            default_nodes = [
                {"id": "astryx", "label": "ASTRYX", "type": "system", "metadata": {}, "size": 20},
                {"id": "memory", "label": "Memory Core", "type": "system", "metadata": {}, "size": 14},
                {"id": "ppt", "label": "PPT Generator", "type": "tool", "metadata": {}, "size": 10},
                {"id": "compiler", "label": "Code Explainer", "type": "tool", "metadata": {}, "size": 10},
                {"id": "voice", "label": "Voice Engine", "type": "system", "metadata": {}, "size": 12},
                {"id": "news", "label": "News Engine", "type": "tool", "metadata": {}, "size": 10},
            ]
            default_edges = [
                {"source": "astryx", "target": "memory", "label": "stores", "weight": 1},
                {"source": "astryx", "target": "ppt", "label": "powers", "weight": 1},
                {"source": "astryx", "target": "compiler", "label": "powers", "weight": 1},
                {"source": "astryx", "target": "voice", "label": "powers", "weight": 1},
                {"source": "astryx", "target": "news", "label": "powers", "weight": 1},
                {"source": "memory", "target": "ppt", "label": "configures", "weight": 1},
            ]
            unique_nodes = default_nodes
            edges = default_edges

        result = {
            "query": query or "all",
            "nodes": unique_nodes,
            "edges": edges,
            "node_count": len(unique_nodes),
            "edge_count": len(edges),
        }

        return json.dumps(result, default=str)

    except Exception as e:
        logger.error("knowledge_graph_explore_failed", error=str(e))
        return json.dumps({
            "error": f"Knowledge graph exploration failed: {str(e)}",
            "query": query,
            "nodes": [],
            "edges": [],
        })


async def search_memory_connections(query: str) -> str:
    """Search for related memories and their connections.

    Args:
        query: Search query

    Returns:
        JSON string with related memories and their connections
    """
    logger.info("knowledge_graph_search", query=query[:50])

    try:
        # Search ChromaDB
        memories = []
        if _get_memory().collection:
            results = _get_memory().search_memory(query, n_results=10)
            memories = results if isinstance(results, list) else []

        # Use LLM to find connections between memories
        if memories and len(memories) >= 2:
            mem_text = "\n".join([f"- {m[:150]}" for m in memories[:5]])
            prompt = (
                f"Analyze these memories and identify key entities, concepts, and relationships between them.\\n\\n"
                f"MEMORIES:\\n{mem_text}\\n\\n"
                f"Return ONLY a JSON object with:\\n"
                f"- 'entities': array of objects with 'name' and 'type'\\n"
                f"- 'connections': array of objects with 'source', 'target', and 'relation'\\n"
                f"- 'insight': one sentence about the discovered pattern\\n\\n"
                f"Return ONLY valid JSON. No markdown."
            )

            messages = [
                {"role": "system", "content": "You are a knowledge graph analyst. You find connections between pieces of information."},
                {"role": "user", "content": prompt},
            ]

            try:
                response = await asyncio.wait_for(
                    lm_client.chat(messages, max_tokens=1024),
                    timeout=30,
                )
                import re
                cleaned = re.sub(r"```json|```", "", response).strip()
                analysis = json.loads(cleaned)
            except Exception:
                analysis = {"entities": [], "connections": [], "insight": "Pattern analysis available with more data."}
        else:
            analysis = {"entities": [], "connections": [], "insight": "Add more memories to discover patterns."}

        result = {
            "query": query,
            "memories": memories[:8],
            "total_memories": len(memories),
            "analysis": analysis,
        }

        return json.dumps(result, default=str)

    except Exception as e:
        logger.error("memory_search_failed", error=str(e))
        return json.dumps({"error": f"Memory search failed: {str(e)}"})


async def handle_knowledge_command(data: str) -> str:
    """Handle the KNOWLEDGE tool command.

    Format:
        explore|query|depth   — Explore the knowledge graph
        search|query           — Search memory connections
        status                 — Get graph database status
    """
    parts = data.split("|", 2) if "|" in data else [data]
    action = parts[0].strip().lower()

    if action == "explore":
        query = parts[1].strip() if len(parts) > 1 else ""
        depth = int(parts[2].strip()) if len(parts) > 2 and parts[2].strip().isdigit() else 1
        return await explore_knowledge_graph(query, depth)

    elif action == "search":
        query = parts[1].strip() if len(parts) > 1 else ""
        if not query:
            return json.dumps({"status": "usage", "message": "Provide a search query."})
        return await search_memory_connections(query)

    elif action == "status":
        status = _get_memory().get_status()
        return json.dumps({
            "status": status,
            "message": f"Knowledge graph has {status.get('nodes', 0)} memory nodes. Use 'explore|query' to explore or 'search|query' to find connections.",
        })

    else:
        # Default: explore
        return await explore_knowledge_graph(data)
