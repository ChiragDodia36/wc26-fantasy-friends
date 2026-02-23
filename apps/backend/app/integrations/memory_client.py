"""
ChromaDB episodic memory client — stores and retrieves lessons learned
from past rounds for the reflection agent.

Each "episode" is a round where the AI manager made decisions. After the
round completes, the reflection agent stores what worked and what didn't.
Future decisions query this memory for relevant past lessons.
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

import chromadb

_client: Optional[chromadb.ClientAPI] = None
_collection: Optional[chromadb.Collection] = None

COLLECTION_NAME = "fantasy_episodes"


def _get_collection() -> chromadb.Collection:
    """Lazy-init ChromaDB persistent client + collection."""
    global _client, _collection
    if _collection is not None:
        return _collection

    db_path = os.environ.get("CHROMADB_PATH", "./data/chromadb")
    _client = chromadb.PersistentClient(path=db_path)
    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def store_episode(
    round_id: str,
    squad_id: str,
    decision_type: str,
    lesson: str,
    points_earned: int,
    metadata: dict | None = None,
) -> str:
    """Store a round's lesson in episodic memory.

    Args:
        round_id: ID of the round
        squad_id: ID of the squad
        decision_type: 'lineup', 'transfer', 'captain', etc.
        lesson: Natural language description of what happened and what to learn
        points_earned: Fantasy points earned this round
        metadata: Optional extra metadata

    Returns:
        The ID of the stored document.
    """
    collection = _get_collection()
    doc_id = str(uuid.uuid4())
    doc_metadata = {
        "round_id": round_id,
        "squad_id": squad_id,
        "decision_type": decision_type,
        "points_earned": points_earned,
    }
    if metadata:
        doc_metadata.update(metadata)

    collection.add(
        documents=[lesson],
        ids=[doc_id],
        metadatas=[doc_metadata],
    )
    return doc_id


def query_lessons(
    query: str,
    n_results: int = 5,
    decision_type: str | None = None,
) -> list[dict]:
    """Query episodic memory for relevant past lessons.

    Args:
        query: Natural language query describing current situation
        n_results: Max results to return
        decision_type: Optional filter by decision type

    Returns:
        List of dicts with 'lesson', 'distance', and metadata.
    """
    collection = _get_collection()

    where = None
    if decision_type:
        where = {"decision_type": decision_type}

    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
    except Exception:
        return []

    lessons = []
    if results and results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            entry = {
                "lesson": doc,
                "distance": results["distances"][0][i] if results.get("distances") else None,
            }
            if results.get("metadatas") and results["metadatas"][0]:
                entry.update(results["metadatas"][0][i])
            lessons.append(entry)

    return lessons


def clear_memory():
    """Delete all episodes (for testing)."""
    global _collection
    collection = _get_collection()
    # Get all IDs and delete
    all_docs = collection.get()
    if all_docs["ids"]:
        collection.delete(ids=all_docs["ids"])


def get_episode_count() -> int:
    """Return total number of stored episodes."""
    collection = _get_collection()
    return collection.count()
