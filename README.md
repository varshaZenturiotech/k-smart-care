# K-SMART CARE — working platform (Auth + Dashboard + AI Assistant)

Three modules built end-to-end and wired together:

- **Module 1 — Authentication**: register/login, JWT sessions, role + district
  + department mapping. (Stands in for K-SMART SSO until that integration is
  available — swap the token issuance in `auth.controller.js` for an SSO
  token exchange later; nothing downstream needs to change.)
- **Module 2 — Employee Dashboard**: AI greeting, wellness score, focus
  score, pending tasks/files, today's meetings — all from one
  `/api/dashboard/summary` call.
- **Module 3 — AI Assistant**: the RAG pipeline (Groq + MiniLM + LangChain +
  ChromaDB) from before, now behind auth and embedded as a chat panel.
- Module 4 (Daily Wellness Check) is included too, since the dashboard's
  wellness score and mood check widget need it to mean anything.

## Project layout

```
k-smart-care/
  backend/   Express + MongoDB + LangChain RAG assistant
  frontend/  React + Vite dashboard
```

## Running it

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in GROQ_API_KEY, MONGO_URI if not local default
```

Start MongoDB locally (or point `MONGO_URI` at Atlas), then start ChromaDB:

```bash
pip install chromadb
chroma run --path ./chroma_data
```

Seed a demo employee with sample tasks/meetings/wellness history, and embed
the sample circular:

```bash
npm run seed
npm run ingest
npm start
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`. Log in with the credentials printed by
`npm run seed` (default: `anjali.secretary@lsgd.kerala.gov.in` / `Demo@1234`).

## What you'll see

- Login screen → dashboard with a personalized AI greeting, wellness/focus
  scores, a mood check-in (Module 4), pending tasks, today's meetings, and a
  live chat panel that answers questions grounded in the seeded circular
  (try: "How many casual leave days do I get?").

## Extending toward the other 8 modules

The pattern is consistent across the whole PRD: a Mongoose model → a
controller with the business logic → an Express route → a React widget
that calls it. For example, the Burnout Prediction Engine (Module 5) would
reuse the `WellnessCheck` and `Task` data already being collected here —
it's mostly a new controller that runs a scoring function across a longer
time window, not a new data pipeline.
