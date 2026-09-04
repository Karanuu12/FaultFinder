# Setup

## Prerequisites
- Node.js 18+, Python 3.11+
- `pip install fastapi uvicorn[standard] pypdf pymupdf python-multipart pydantic`

## Keys (free tier, no card)
Create `apps/web/.env.local`:
```
JINA_API_KEY=...       # jina.ai/embeddings — embeddings, 1M free tokens
GROQ_API_KEY=...       # console.groq.com — answer generation (optional; falls back to raw retrieval without it)
GROQ_MODEL=openai/gpt-oss-120b   # or qwen/qwen3.8-27b — check your account's available models
DOC_PROCESSOR_URL=http://127.0.0.1:8080
```

## Run
```bash
# Terminal 1 — PDF parser service
cd services/document-processor
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload

# Terminal 2 — web app
cd apps/web
npm install
npm run dev
```
Open http://localhost:3000/chat — upload a PDF, ask a question.

## Notes
- Index is a local JSON file (`.data/index.json`, gitignored) — dev/demo only, not for deploy (Vercel's filesystem is read-only; swap in Qdrant Cloud for production).
- Nothing is pre-loaded. Every manual must be uploaded through the site; delete via the trash icon per manual in the sidebar.
- No OCR — scanned pages are flagged in the upload result, not silently dropped, but not indexed either.
