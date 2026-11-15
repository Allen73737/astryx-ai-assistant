import os
import chromadb
import networkx as nx
import sqlite3
import structlog
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logger = structlog.get_logger(__name__)

# Constants
MEMORY_DIR = "memory_data"
KNOWLEDGE_FOLDER = "knowledge_base"
os.makedirs(MEMORY_DIR, exist_ok=True)
os.makedirs(KNOWLEDGE_FOLDER, exist_ok=True)

class MemoryManager:
    def __init__(self):
        # 1. ChromaDB for RAG
        try:
            self.chroma_client = chromadb.PersistentClient(path=os.path.join(MEMORY_DIR, "chromadb"))
            self.collection = self.chroma_client.get_or_create_collection(name="astryx_memory")
            logger.info("chromadb_initialized")
        except Exception as e:
            logger.error("chromadb_init_error", error=str(e))
            self.collection = None

        # 2. Knowledge Graph (NetworkX + SQLite)
        self.graph = nx.DiGraph()
        self.db_path = os.path.join(MEMORY_DIR, "graph.db")
        self._init_sqlite()

        # 3. Watchdog for auto-indexing
        self.observer = Observer()
        self.observer.schedule(KnowledgeFolderHandler(self), path=KNOWLEDGE_FOLDER, recursive=True)
        self.observer.start()

    def _init_sqlite(self):
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS entities
                         (id TEXT PRIMARY KEY, type TEXT, properties TEXT)''')
            c.execute('''CREATE TABLE IF NOT EXISTS relationships
                         (source TEXT, target TEXT, relation TEXT)''')
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error("sqlite_init_error", error=str(e))

    def add_memory(self, text: str, metadata: dict = None):
        """Add semantic memory to ChromaDB."""
        if not self.collection:
            return "Memory offline."
        
        doc_id = f"mem_{len(self.collection.get()['ids'])}"
        self.collection.add(
            documents=[text],
            metadatas=[metadata or {}],
            ids=[doc_id]
        )
        return "Memory added."

    def search_memory(self, query: str, n_results: int = 3):
        """Search ChromaDB."""
        if not self.collection:
            return []
        
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results["documents"][0] if results["documents"] else []

    def stop(self):
        self.observer.stop()
        self.observer.join()

class KnowledgeFolderHandler(FileSystemEventHandler):
    def __init__(self, memory_manager):
        self.memory_manager = memory_manager

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith(".txt"):
            logger.info("knowledge_file_modified", path=event.src_path)
            try:
                with open(event.src_path, "r", encoding="utf-8") as f:
                    content = f.read()
                self.memory_manager.add_memory(content, {"source": event.src_path})
            except Exception as e:
                logger.error("file_indexing_error", path=event.src_path, error=str(e))

memory_manager = MemoryManager()
