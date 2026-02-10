# PDF Viewer

AI-powered PDF reader with semantic search and conversational chat.

Upload any PDF, and the system automatically extracts its content using Gemini Vision, generates vector embeddings, and lets you ask questions about the document with cited, page-linked answers.

## Features

- **In-browser PDF viewer** with page navigation, zoom, and page jump
- **AI document ingestion** — PDF pages are rendered to images, sent to Gemini Vision for markdown extraction, then embedded as 768-dim vectors with HNSW indexing
- **Conversational RAG chat** — per-document conversations where the AI uses semantic search and page lookup tools to answer questions with source citations
- **Clickable citations** — `[Pages X-Y]` references in AI responses link directly to the referenced page in the viewer
- **Selection tool** — drag-select a region of the PDF and send it as an image to the AI for analysis
- **Markdown rendering** — AI responses render with syntax highlighting, LaTeX math (KaTeX), and GFM tables
- **Authentication** — email/password via Better Auth
- **Background processing** — Inngest handles document ingestion with real-time progress indicators (pending → extracting → embedding → ready)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, React Server Components) |
| Runtime | Bun |
| Language | TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL 17 + pgvector (Docker) |
| ORM | Drizzle ORM |
| Auth | Better Auth (email/password) |
| AI | Vercel AI SDK v6, Gemini Flash 3 (vision + chat), Gemini Embedding 001 |
| Background Jobs | Inngest |
| PDF Rendering | react-pdf (client), pdf-to-img (server) |

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0)
- [Docker](https://www.docker.com/) & Docker Compose
- [Google Generative AI API key](https://aistudio.google.com/apikey) (for Gemini)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd pdf-viewer
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string. Default: `postgresql://postgres:postgres@localhost:5432/pdf_viewer` |
| `BETTER_AUTH_SECRET` | Random secret for session signing. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your app URL. Default: `http://localhost:3000` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key — used for vision extraction, embeddings, and chat |

### 3. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 17 with the pgvector extension on port 5432.

### 4. Run database migrations

```bash
bunx drizzle-kit migrate
```

> **Note:** `drizzle-kit` does not read `.env.local`. If using a non-default database URL, prefix the command: `DATABASE_URL=... bunx drizzle-kit migrate`

### 5. Start the dev server

You need two terminal sessions:

```bash
# Terminal 1 — Next.js
bun dev
```

```bash
# Terminal 2 — Inngest dev server (handles background jobs)
bun run dev:inngest
```

Open [http://localhost:3000](http://localhost:3000) to use the app. The Inngest dashboard is available at [http://localhost:8288](http://localhost:8288).

## How It Works

### User Flow

1. **Sign up / log in** — create an account with email/password
2. **Upload a PDF** — the file is saved to `uploads/` and a database record is created. An Inngest event (`document/uploaded`) fires to start background processing
3. **Ingestion pipeline** (3 steps, runs in Inngest):
   - **Extract** — PDF pages are rendered to PNG images (5 pages per group, 20 groups concurrently), sent to Gemini Flash 3 Vision to extract structured Markdown, and saved as document chunks
   - **Embed** — each chunk is embedded using `gemini-embedding-001` (768 dimensions) and stored with an HNSW cosine similarity index
   - **Mark ready** — the document status is set to `ready`
4. **View the PDF** — the in-browser viewer loads the PDF with page navigation, zoom controls, and a progress bar
5. **Open the AI chat panel** — create a conversation and ask questions about the document
6. **AI answers with RAG** — the model uses two tools:
   - `semanticSearch` — embeds your query and finds the top 3 most similar chunks via cosine distance
   - `pageSearch` — retrieves chunks that cover a specific page number
7. **Click a citation** — `[Pages X-Y]` links in the response navigate the PDF viewer to that page

### Ingestion Architecture

```
PDF file
  │
  ├─ pdf-to-img (scale 1.5x) ──→ PNG images (streamed, no disk I/O)
  │
  ├─ Groups of 5 pages ──→ Gemini Flash 3 Vision ──→ Markdown text
  │                         (20 concurrent, cyclic retry backoff)
  │
  ├─ Document chunks ──→ DB insert (documentChunk table)
  │
  └─ Chunks without embeddings ──→ Gemini Embedding 001 (768-dim)
                                    ──→ DB update with vector
```

### Chat Architecture

```
User message
  │
  ├─ Saved to DB (message table)
  │
  ├─ Sent to Gemini Flash 3 with system prompt + tools
  │
  ├─ Model calls tools (up to 5 steps):
  │   ├─ semanticSearch(query) ──→ embed query ──→ cosine similarity ──→ top 3 chunks
  │   └─ pageSearch(page) ──→ find chunks covering that page
  │
  ├─ Model generates final answer with [Pages X-Y] citations
  │
  └─ Streamed to client via UIMessageStreamResponse
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/               # Auth route group (login, signup)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx        # Centered layout with grid background
│   ├── dashboard/
│   │   ├── page.tsx          # Server component — fetches session + documents
│   │   └── layout.tsx        # Full-screen flex container
│   ├── api/
│   │   ├── auth/[...all]/    # Better Auth handler
│   │   ├── documents/        # Upload, delete, update, file stream, status polling
│   │   │   └── [id]/
│   │   │       ├── chat/     # AI chat streaming endpoint
│   │   │       └── conversations/ # CRUD for conversations
│   │   └── inngest/          # Inngest webhook
│   ├── actions/              # Server actions (conversation CRUD)
│   ├── layout.tsx            # Root layout (Inter font, globals.css)
│   ├── globals.css           # Tailwind v4 + shadcn theme
│   └── page.tsx              # Root redirect (→ dashboard or login)
├── components/
│   ├── auth/                 # Login form, signup form, sign-out
│   ├── dashboard/
│   │   ├── dashboard-shell.tsx    # Main orchestrator (state management)
│   │   ├── document-sidebar.tsx   # Document list + upload
│   │   ├── pdf-viewer.tsx         # PDF rendering + navigation + selection
│   │   ├── ai-chat-panel.tsx      # Chat interface + conversation list
│   │   ├── markdown-renderer.tsx  # Markdown + LaTeX + syntax highlighting
│   │   ├── selection-overlay.tsx  # Drag-select tool for PDF regions
│   │   ├── tool-invocation-card.tsx # Displays AI tool calls in chat
│   │   ├── progress-ring.tsx      # Circular ingestion progress indicator
│   │   └── use-ingestion-polling.ts # Hook to poll document status
│   └── ui/                   # shadcn/ui primitives (button, card, input, etc.)
├── db/
│   ├── index.ts              # Drizzle client (postgres connection)
│   └── schema.ts             # All table definitions
├── inngest/
│   ├── client.ts             # Inngest instance
│   └── functions/
│       └── ingest-document.ts # 3-step ingestion pipeline
├── lib/
│   ├── auth.ts               # Better Auth server config
│   ├── auth-client.ts        # Better Auth client exports
│   └── utils.ts              # cn() helper (clsx + tailwind-merge)
└── middleware.ts              # Route protection (session cookie check)
```

## Database Schema

### Application Tables

- **`document`** — uploaded PDFs (id, userId, title, filename, fileSize, lastPage, ingestionStatus)
- **`document_chunk`** — extracted markdown chunks with embeddings (id, documentId, content, startPage, endPage, chunkIndex, embedding vector(768))
- **`conversation`** — chat conversations per document (id, documentId, userId, title)
- **`message`** — chat messages (id, conversationId, role, content, parts JSON)

### Auth Tables (managed by Better Auth)

- **`user`**, **`session`**, **`account`**, **`verification`**

Cascading deletes: user → documents → chunks/conversations → messages.

## Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start Next.js dev server (localhost:3000) |
| `bun run dev:inngest` | Start Inngest dev server (localhost:8288) |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun run lint` | Run ESLint |
| `docker compose up -d` | Start PostgreSQL + pgvector |
| `docker compose down` | Stop PostgreSQL |
| `bunx drizzle-kit generate` | Generate migration files from schema changes |
| `bunx drizzle-kit migrate` | Apply migrations to database |
