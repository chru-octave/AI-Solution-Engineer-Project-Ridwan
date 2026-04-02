# Backend Architecture

## Overview

The backend is a **Node.js / Express** API that ingests commercial insurance submission emails (`.eml`) and PDF documents, extracts structured data using Claude (Anthropic), and persists it into a PostgreSQL database via Prisma ORM. It exposes a REST API consumed by the React frontend.

**Runtime:** Node.js 20 (Alpine) inside Docker  
**Language:** TypeScript  
**Port:** 3000 (container) → 3001 (host)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Postgres │◄───│ Express API  │◄───│  React Client │  │
│  │ :5432    │    │ :3000        │    │  (nginx)      │  │
│  │          │    │              │    │  :3000        │  │
│  └──────────┘    └──────┬───────┘    └───────────────┘  │
│                         │                                │
│                         ▼                                │
│                  ┌──────────────┐                        │
│                  │ Claude API   │                        │
│                  │ (Anthropic)  │                        │
│                  └──────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
server/
├── Dockerfile
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma              # Database schema (8 models)
│   └── migrations/
│       └── 0001_init/
│           └── migration.sql      # Initial DDL
└── src/
    ├── index.ts                   # Express entry point
    ├── lib/
    │   └── prisma.ts              # Prisma client singleton
    ├── routes/
    │   ├── submissions.ts         # CRUD for submissions
    │   ├── analytics.ts           # Aggregation endpoints
    │   └── ingest.ts              # Ingestion trigger
    ├── services/
    │   ├── email-parser.ts        # .eml and .pdf parsing
    │   ├── anthropic.ts           # Claude extraction + merging
    │   ├── extraction-schema.ts   # Zod validation schemas
    │   ├── extraction-merge.ts    # Programmatic multi-section merge
    │   └── ingestion.ts           # Orchestration pipeline
    ├── scripts/
    │   ├── ingest.ts              # CLI ingestion entry point
    │   └── preview.ts             # CLI preview/debug tool
    └── public/
        └── index.html             # Legacy static dashboard
```

---

## Data Ingestion Pipeline

The pipeline processes `.eml` and `.pdf` files in four stages:

### Stage 1 — File Discovery

`collectIngestableFiles()` in `ingestion.ts` recursively walks the email directory for files matching `.eml` or `.pdf`. Each file's basename is checked against the `email_submissions.sourceFile` unique index — already-ingested files are skipped (idempotent re-runs).

### Stage 2 — Parsing

**`.eml` files** are parsed with `mailparser`:
- Envelope fields: from, to, subject, date
- Body: plain text and HTML
- Attachments: each PDF attachment is further parsed with `pdf-parse` for text extraction; the raw buffer is also retained for vision-based extraction

**`.pdf` files** are parsed directly with `pdf-parse` for text, plus the raw buffer is kept.

Content is then split into **sections** — one for the email body (capped at 180K chars) and one per attachment that has extractable text or a PDF buffer.

### Stage 3 — LLM Extraction

Each section is sent to **Claude Sonnet** (`claude-sonnet-4-20250514`) with a system prompt that enforces the exact JSON schema. Two extraction modes exist:

| Mode | Single Section | Multiple Sections |
|------|---------------|-------------------|
| **Standard** | Direct extraction | Per-section extraction → programmatic merge (`extraction-merge.ts`) |
| **Thorough** | Direct extraction | Per-section raw extraction → second LLM call to merge (`mergeExtractionsViaLLM`) |

**Programmatic merge** (`extraction-merge.ts`):
- Singular objects (insured, broker, exposures): fill nulls from ordered partials
- Arrays (limits, losses, LOB, pricing): concatenate then deduplicate by `JSON.stringify`
- Exposure arrays (commodities, states, vehicles): union without duplicates

**LLM merge** (`anthropic.ts`): A second Claude call receives all partial JSON extractions with a merge-specific system prompt that handles semantic deduplication.

All LLM responses are validated through **Zod schemas** (`extraction-schema.ts`) which coerce number-like strings for monetary fields and default null arrays to `[]`.

### Stage 4 — Persistence

`buildSubmissionCreateData()` maps the validated `SubmissionExtraction` to Prisma's nested `create` syntax, writing the `Submission` row and all related child rows in a single transaction.

---

## Database Schema

PostgreSQL 16, managed by Prisma ORM. The schema uses a **star pattern** — one `email_submissions` hub table with 7 related tables, all cascade-deleting.

### Entity Relationship

```
                    email_submissions
                    ┌──────────────┐
          1:1       │ id (PK)      │       1:1
     ┌──────────────│ sourceFile   │──────────────┐
     │              │ emailFrom    │              │
     ▼              │ emailTo      │              ▼
┌──────────┐        │ emailSubject │        ┌──────────┐
│insured_  │        │ emailDate    │        │broker_   │
│info      │        │ rawBody      │        │info      │
└──────────┘        │ createdAt    │        └──────────┘
                    │ updatedAt    │
     1:1            └──────┬───────┘          1:N
     ┌─────────────────────┼─────────────────────┐
     ▼                     │                     ▼
┌──────────┐               │              ┌──────────────┐
│exposure_ │               │              │lines_of_     │
│info      │               │              │business      │
└──────────┘               │              └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │limits_   │ │target_   │ │loss_     │
        │requested │ │pricing   │ │records   │
        └──────────┘ └──────────┘ └──────────┘
            1:N          1:N          1:N
```

### Table Details

| Table | Cardinality | Key Fields |
|-------|-------------|------------|
| `email_submissions` | Hub | `sourceFile` (unique), `emailFrom`, `emailTo`, `emailSubject`, `emailDate`, `rawBody` |
| `insured_info` | 1:1 | `companyName`, `contactName`, `mailingAddress`, `dotNumber`, `mcNumber`, `yearsInBusiness`, `state` |
| `broker_info` | 1:1 | `companyName`, `contactName`, `email`, `phone` |
| `exposure_info` | 1:1 | `numberOfTrucks`, `numberOfDrivers`, `numberOfTrailers`, `radius`, `commodities[]`, `annualRevenue`, `annualMileage`, `operatingStates[]`, `vehicleTypes[]` |
| `lines_of_business` | 1:N | `type` (e.g. "Business Auto", "General Liability") |
| `limits_requested` | 1:N | `lineOfBusiness`, `limitAmount`, `deductible`, `description` |
| `target_pricing` | 1:N | `lineOfBusiness`, `targetPremium`, `currentPremium`, `description` |
| `loss_records` | 1:N | `policyYear`, `numberOfClaims`, `totalIncurred`, `totalPaid`, `description` |

All monetary/measurement fields are stored as **strings** because they arrive from the LLM with formatting (e.g. "$1,000,000"). Array fields (`commodities`, `operatingStates`, `vehicleTypes`) use Postgres `TEXT[]` native arrays.

---

## REST API

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness check — returns `{ status, timestamp }` |

### Submissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/submissions` | List submissions with pagination, search, LOB filter |
| `GET` | `/api/submissions/:id` | Full submission with all related data |
| `DELETE` | `/api/submissions/:id` | Delete submission and cascade all children |

Query params for list: `search`, `lineOfBusiness`, `page`, `limit`

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/summary` | Total count, LOB distribution, distinct brokers |
| `GET` | `/api/analytics/exposures` | All exposure records with parent submission info |
| `GET` | `/api/analytics/losses` | All loss records with parent submission info |

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest/upload` | Multipart file upload (field `files`, up to 50 files, `.eml`/`.pdf` only, 50 MB max per file). Writes to `UPLOAD_DIR` and returns `{ uploaded, uploadDir }` |
| `POST` | `/api/ingest/trigger` | Trigger ingestion. Body: `{ emailDir, mode }` |

The upload endpoint uses `multer` with disk storage. Files are written to `UPLOAD_DIR` (defaults to `/app/uploads`), preserving original filenames. Only `.eml` and `.pdf` extensions are accepted; all others are rejected with an error.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing |
| `@prisma/client` | PostgreSQL ORM |
| `@anthropic-ai/sdk` | Claude API for data extraction |
| `mailparser` | `.eml` file parsing (MIME, attachments) |
| `multer` | Multipart file upload handling (`.eml`/`.pdf` uploads) |
| `pdf-parse` | PDF text extraction |
| `zod` | Runtime schema validation for LLM output |
| `cors` | Cross-origin requests from frontend |

---

## Docker Configuration

**Image:** `node:20-alpine`  
**Build steps:** Install deps → Prisma generate → TypeScript compile → Copy static assets  
**Startup:** `prisma migrate deploy` (applies pending migrations) → `node dist/index.js`  
**Volume mounts:**
- `./Emails Round:/app/emails:ro` — read-only email directory for directory-based ingestion
- `uploads:/app/uploads` — named Docker volume for files received via the upload API

---

## Key Design Decisions

1. **Claude as the sole extraction engine** — No regex or rule-based parsing. The LLM interprets both free-text email bodies and structured PDF forms (ACORD, loss runs) using the same prompt schema.

2. **PDF document vision** — Standalone PDFs and PDF attachments are sent as base64-encoded documents to Claude's vision endpoint, enabling accurate table/number reading directly from the PDF layout.

3. **Idempotent ingestion** — The `sourceFile` unique constraint prevents duplicate processing on re-runs.

4. **Two merge strategies** — Standard mode is fast (programmatic), thorough mode uses a second LLM pass for semantic deduplication when multiple sections contain overlapping data.

5. **Zod as the LLM contract enforcer** — Every Claude response is parsed and validated through Zod schemas before database insertion, catching type mismatches and coercing edge cases.
