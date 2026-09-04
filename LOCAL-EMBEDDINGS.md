# Local embeddings branch

Runs `jinaai/jina-embeddings-v5-omni-small-retrieval` in the doc-processor
instead of calling the Jina API. No API key, no rate limit, no token budget —
which removes the throttling pauses the API path has to live with.

## Why omni-small (vs omni-nano)

|  | params | dims | VRAM (BF16) | context |
|---|---|---|---|---|
| omni-nano | 1.04B | 768 | ~2.1 GB | 8k |
| **omni-small** | **1.74B** | **1024** | **~3.5 GB** | 32k |

1024 dims matches what the index already uses, ~3.5 GB leaves headroom on an
8 GB card, and it's the stronger model. Use the `-retrieval` task variant, not
the base repo.

## Install (one time, ~4–6 GB download)

```bash
pip install "torch>=2.5" --index-url https://download.pytorch.org/whl/cu124
pip install "sentence-transformers>=3.0" "transformers>=4.57"
```

First `/embed` request downloads the model (~3.5 GB) and loads it; that
request is slow, everything after is fast. The model is cached in
`~/.cache/huggingface`.

## Enable

In `apps/web/.env.local`:
```
EMBEDDINGS_PROVIDER=local
```
Then restart both services. Unset it (or set anything else) to go back to the
API — `JINA_API_KEY` is only required for the API path.

## Important

**Switching providers invalidates the index.** The two models produce
different vector spaces even at the same dimension count, so old vectors are
not comparable to new queries. Delete the manuals and re-upload after a
switch.

## Not done yet: multimodal diagram embedding

`embed_images()` exists in `app/embeddings.py` but nothing calls it. The
opportunity: omni embeds images into the *same* space as text, so a rasterized
wiring diagram could be retrieved by visual content. Right now diagrams are
only findable by page/section proximity — ABB manuals carry no "Figure N"
captions at all, so there is nothing textual to match against. That's the
natural next step on this branch.
