"""JARVIS-X Memory Core — Vector DB, Graph DB, and Watchdog Indexer."""

import os
import sqlite3
import chromadb
import networkx as nx
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions
import structlog
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from config import settings
from core.security import security_manager

logger = structlog.get_logger(__name__)

KNOWLEDGE_FOLDER = "knowledge_base"
os.makedirs(KNOWLEDGE_FOLDER, exist_ok=True)

class MemoryCore:
    """Manages persistent RAG DB, Graph DB, and Auto-Indexing."""

    def __init__(self) -> None:
        self.client = None
        self.collection = None
        self.status: str = "disconnected"
        self.nodes: int = 0
        self.graph = nx.DiGraph()
        self.observer = None
        self.ef = embedding_functions.DefaultEmbeddingFunction()

    def initialize(self) -> None:
        """Initialize all memory subsystems."""
        try:
            logger.info("initializing_memory_systems", path=settings.CHROMA_PERSIST_DIR)
            os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
            
            # 1. ChromaDB
            self.client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIR,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            self.collection = self.client.get_or_create_collection(name="jarvis_memory")
            self.nodes = self.collection.count()
            
            # 2. SQLite Graph DB Setup
            self._init_sqlite()
            
            # 3. Watchdog Auto-Indexer
            self.observer = Observer()
            self.observer.schedule(KnowledgeFolderHandler(self), path=KNOWLEDGE_FOLDER, recursive=True)
            self.observer.start()

            self.status = "connected"
            logger.info("memory_systems_ready", nodes=self.nodes)
        except Exception as e:
            logger.error("memory_systems_error", error=str(e))
            self.status = "error"

    def _init_sqlite(self):
        db_path = os.path.join(settings.CHROMA_PERSIST_DIR, "graph.db")
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS entities
                         (id TEXT PRIMARY KEY, type TEXT, properties TEXT)''')
            c.execute('''CREATE TABLE IF NOT EXISTS relationships
                         (source TEXT, target TEXT, relation TEXT)''')
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error("sqlite_init_error", error=str(e))

    def add_graph_node(self, node_id: str, node_type: str, properties: str):
        """Add an encrypted node to the graph database."""
        db_path = os.path.join(settings.CHROMA_PERSIST_DIR, "graph.db")
        enc_props = security_manager.encrypt_data(properties)
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO entities (id, type, properties) VALUES (?, ?, ?)",
                      (node_id, node_type, enc_props))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error("sqlite_add_error", error=str(e))

    def get_graph_node(self, node_id: str):
        """Retrieve and decrypt a node from the graph database."""
        db_path = os.path.join(settings.CHROMA_PERSIST_DIR, "graph.db")
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("SELECT type, properties FROM entities WHERE id=?", (node_id,))
            row = c.fetchone()
            conn.close()
            if row:
                return {"type": row[0], "properties": security_manager.decrypt_data(row[1])}
        except Exception as e:
            logger.error("sqlite_get_error", error=str(e))
        return None

    def add_memory(self, text: str, metadata: dict = None):
        """Add encrypted semantic memory to ChromaDB."""
        if not self.collection:
            return "Memory offline."
        
        doc_id = f"mem_{self.nodes}"
        
        # 1. Generate embedding from plaintext
        emb = self.ef([text])
        
        # 2. Encrypt text for storage
        enc_text = security_manager.encrypt_data(text)
        
        self.collection.add(
            documents=[enc_text],
            embeddings=emb,
            metadatas=[metadata or {}],
            ids=[doc_id]
        )
        self.nodes += 1
        return "Memory added."

    def search_memory(self, query: str, n_results: int = 3):
        """Search ChromaDB and decrypt results."""
        if not self.collection:
            return []
        
        # 1. Generate embedding for query plaintext
        emb = self.ef([query])
        
        # 2. Search using embedding
        results = self.collection.query(
            query_embeddings=emb,
            n_results=n_results
        )
        
        # 3. Decrypt results
        if results["documents"] and results["documents"][0]:
            decrypted_docs = [security_manager.decrypt_data(doc) for doc in results["documents"][0]]
            return decrypted_docs
        return []

    def get_status(self) -> dict:
        if self.collection:
            try:
                self.nodes = self.collection.count()
            except Exception:
                pass
        return {
            "status": self.status,
            "nodes": self.nodes
        }

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()

class KnowledgeFolderHandler(FileSystemEventHandler):
    def __init__(self, memory_core):
        self.memory_core = memory_core

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith(".txt"):
            logger.info("knowledge_file_modified", path=event.src_path)
            try:
                with open(event.src_path, "r", encoding="utf-8") as f:
                    content = f.read()
                self.memory_core.add_memory(content, {"source": event.src_path})
            except Exception as e:
                logger.error("file_indexing_error", path=event.src_path, error=str(e))

# Singleton
memory_core = MemoryCore()
