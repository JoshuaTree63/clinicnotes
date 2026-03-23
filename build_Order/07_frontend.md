# 07 — Frontend (React + Vite)

## Goal
Build a clean, personal-use React app with 4 pages, connecting to the FastAPI backend. No login required.

---

## Setup

```bash
cd therapy-analyzer
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom axios @tanstack/react-query \
  react-dropzone tailwindcss framer-motion react-markdown lucide-react
npx tailwindcss init -p
```

Configure `tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Pages

### `/` — Home
- App title + description
- Status card: "X sessions stored · PDF library indexed (N chunks)"
- Quick links to Upload and Sessions

### `/upload` — Upload Session
- Drag-and-drop audio file zone (react-dropzone)
- Supported formats listed
- Upload button → POST /api/transcribe
- Loading state: "Transcribing... (this may take 30–60 seconds)"
- On success: show transcript in scrollable text box
- "Analyze this session" button → POST /api/analyze

### `/sessions` — Session History
- List of all past sessions (GET /api/sessions)
- Each row: date, filename, badge "Analyzed" or "Pending"
- Click → goes to `/sessions/:id`

### `/sessions/:id` — Session Detail + Analysis
- Shows transcript (collapsible)
- If analysis exists: render the full analysis dashboard
  - Schools detected (tags)
  - Themes (tag cloud)
  - Summary paragraph
  - Notable moments (accordion)
  - Literature references
- If no analysis: "Analyze Session" button

### `/library` — PDF Library Manager
- List PDFs in /data/pdfs/ (future: GET /api/pdfs)
- "Re-index Library" button → POST /api/index
- Shows index status: N chunks indexed

---

## `src/api/client.js`

```js
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

export const transcribeAudio = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const analyzeSession = (session_id) =>
  api.post('/analyze', { session_id })

export const getSessions = () => api.get('/sessions')
export const getSession = (id) => api.get(`/sessions/${id}`)
export const indexPdfs = () => api.post('/index')
export const getIndexStatus = () => api.get('/index/status')
```

---

## Component Map

```
src/
├── pages/
│   ├── Home.jsx
│   ├── Upload.jsx
│   ├── Sessions.jsx
│   ├── SessionDetail.jsx
│   └── Library.jsx
├── components/
│   ├── Layout.jsx          ← nav + page wrapper
│   ├── AudioDropzone.jsx   ← drag-drop upload
│   ├── TranscriptView.jsx  ← scrollable transcript
│   ├── AnalysisCard.jsx    ← full analysis display
│   ├── ThemeTag.jsx        ← colored badge
│   ├── SessionRow.jsx      ← row in sessions list
│   └── StatusBar.jsx       ← index/session counts
└── api/
    └── client.js
```

---

## UX Flow Diagram

```
Home
 ├─→ Upload page
 │     ├─ Drop audio file
 │     ├─ [Transcribe] → show transcript
 │     └─ [Analyze] → show analysis → saved
 │
 └─→ Sessions page
       └─ Click session
             ├─ View transcript
             ├─ If analyzed: view analysis dashboard
             └─ If not: [Analyze Now] button
```

---

## Design Direction

- **Palette**: Deep navy background, warm cream text, sage green accents
- **Typography**: `Playfair Display` for headings (therapeutic, serious), `IBM Plex Sans` for body
- **Feel**: Clinical but warm — like a well-designed therapy journal
- **No flashy animations** — subtle fade-ins, clean hover states
- **Mobile-friendly** but optimized for desktop (personal tool)
