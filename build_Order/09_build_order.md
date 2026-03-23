# 09 — Build Order & Development Checklist

## Philosophy
Build in vertical slices — get one full flow working end-to-end before adding features.  
Each phase should result in something **testable**.

---

## Phase 1 — Backend Foundation
*Goal: Running API server with health check*

- [ ] Create `backend/` folder and virtual environment
- [ ] Install all Python dependencies
- [ ] Create folder structure (`routers/`, `services/`, `data/`)
- [ ] Write `main.py` with CORS and router registration
- [ ] Create `.env` from template and add your keys
- [ ] Run `uvicorn main:app --reload`
- [ ] Verify: `GET /health` returns `{"status": "ok"}`
- [ ] Verify: `GET /docs` shows Swagger UI

**Reference**: `03_backend_setup.md`

---

## Phase 2 — Transcription
*Goal: Upload an audio file and get back a transcript*

- [ ] Write `services/groq_service.py` with `transcribe_audio()`
- [ ] Write `routers/transcribe.py` with `POST /api/transcribe`
- [ ] Test with curl or Swagger UI using a real audio file
- [ ] Verify session JSON is saved in `data/sessions/`
- [ ] Verify temp file is cleaned up after transcription

**Reference**: `04_transcription.md`

---

## Phase 3 — PDF Indexing
*Goal: Drop PDFs in the folder, index them, confirm chunks are stored*

- [ ] Add your therapy PDFs to `backend/data/pdfs/`
- [ ] Write `services/embeddings_service.py`
- [ ] Write `routers/index.py` with `POST /api/index` and `GET /api/index/status`
- [ ] Call `POST /api/index` — note how many chunks were indexed
- [ ] Call `GET /api/index/status` — confirm chunk count > 0
- [ ] Verify `data/vectorstore/` folder is created with ChromaDB files

**Reference**: `05_pdf_indexing.md`

---

## Phase 4 — RAG Analysis
*Goal: Analyze a transcript against the indexed PDFs and get structured output*

- [ ] Write `services/rag_service.py` (retrieve_context, build_prompt, analyze_with_groq, fallback)
- [ ] Write `routers/analyze.py` with `POST /api/analyze` and session GET endpoints
- [ ] Test: call `POST /api/analyze` with a `session_id` from Phase 2
- [ ] Verify response contains `schools_detected`, `themes`, `summary`, etc.
- [ ] Verify session JSON is updated with the analysis
- [ ] Test the OpenRouter fallback by temporarily using a bad Groq key

**Reference**: `06_rag_analysis.md`

---

## Phase 5 — React Frontend
*Goal: Full working UI connected to the backend*

- [ ] Create `frontend/` with Vite React template
- [ ] Install all npm dependencies
- [ ] Configure Tailwind CSS
- [ ] Write `src/api/client.js`
- [ ] Build `Layout.jsx` with navigation
- [ ] Build `Home.jsx` with status cards
- [ ] Build `Upload.jsx` with dropzone + transcription flow
- [ ] Build `Sessions.jsx` with session list
- [ ] Build `SessionDetail.jsx` with transcript + analysis display
- [ ] Build `Library.jsx` with index trigger
- [ ] Wire up React Router
- [ ] Test full flow: upload audio → transcribe → analyze → view results

**Reference**: `07_frontend.md`

---

## Phase 6 — Polish & Enhancements (Optional)
*Post-MVP improvements*

- [ ] Add loading skeletons instead of plain spinners
- [ ] Add error toast notifications
- [ ] Add ability to delete sessions
- [ ] Add ability to re-run analysis on an existing session
- [ ] Add session notes field (manual annotations)
- [ ] Support uploading PDFs directly from the UI (instead of manually copying files)
- [ ] Add a "compare sessions" view to spot patterns over time
- [ ] Export analysis as PDF report

---

## Quick Reference: All API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/transcribe` | Upload audio → get transcript + session ID |
| POST | `/api/index` | Index all PDFs in /data/pdfs/ |
| GET | `/api/index/status` | Check how many chunks are indexed |
| POST | `/api/analyze` | Analyze a session via RAG |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Get one full session (transcript + analysis) |

---

## Running Both Services

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## First-Time Setup Checklist

```
1. Clone / create project folders
2. Set up Python venv and install deps
3. Copy .env template and add your API keys
4. Start backend → verify /health
5. Add PDFs to backend/data/pdfs/
6. Call POST /api/index → note chunk count
7. Set up React frontend
8. Open http://localhost:5173 and upload your first session!
```
