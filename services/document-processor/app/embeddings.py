"""Local embedding model — jina-embeddings-v5-omni-small-retrieval.

Runs the model in-process instead of calling the Jina API. Trades a ~3.5GB
BF16 GPU resident model for: no rate limits, no token budget, no per-request
cost, and no network in the hot path. The API path stays on `main`; this is
the local alternative.

Loaded lazily and cached — the first request pays model load (seconds on GPU,
longer on first run while weights download), every request after is free.
"""
from __future__ import annotations

import threading
from typing import Any

_model: Any = None
_lock = threading.Lock()

MODEL_NAME = "jinaai/jina-embeddings-v5-omni-small-retrieval"
DIMS = 1024


def _load() -> Any:
    global _model
    if _model is not None:
        return _model
    # Double-checked under a lock: two concurrent first-requests would
    # otherwise each load a multi-GB model into VRAM.
    with _lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(MODEL_NAME, trust_remote_code=True)
    return _model


def embed_texts(texts: list[str], task: str = "retrieval.passage") -> list[list[float]]:
    """Embed a batch of texts. `task` mirrors the Jina API's asymmetric
    retrieval task types -- passages and queries are encoded differently and
    mixing them up measurably hurts recall."""
    if not texts:
        return []
    model = _load()
    prompt_name = "query" if task.endswith("query") else "passage"
    vectors = model.encode(
        texts,
        prompt_name=prompt_name,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vectors]


def embed_images(paths_or_urls: list[str]) -> list[list[float]]:
    """Embed images into the SAME vector space as text.

    This is what the API path cannot do: a diagram with no caption (ABB
    manuals have none) is currently only findable by page proximity. Embedding
    the rendered diagram itself makes it retrievable by visual content.
    """
    if not paths_or_urls:
        return []
    model = _load()
    vectors = model.encode(paths_or_urls, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vectors]
