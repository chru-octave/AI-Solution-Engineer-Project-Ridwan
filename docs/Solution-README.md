# Solution Architecture

## Overview

A Dockerized TypeScript Express API that ingests commercial insurance submission emails, extracts structured data using Anthropic's Claude, stores it in PostgreSQL via Prisma ORM, and exposes REST endpoints for querying.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCKER COMPOSE                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        SERVER CONTAINER                               │  │
│  │                                                                       │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐  │  │
│  │  │  Express     │    │  Ingestion   │    │  Preview (dry-run)      │  │  │
│  │  │  REST API    │    │  Pipeline    │    │  --parse-only or        │  │  │
│  │  │  :3000       │    │              │    │  with LLM extraction    │  │  │
│  │  └──────┬───────┘    └──────┬───────┘    └──────────┬──────────────┘  │  │
│  │         │                   │                       │                  │  │
│  │         │            ┌──────▼───────┐               │                  │  │
│  │         │            │ Email Parser │◄──────────────┘                  │  │
│  │         │            │ (mailparser  │                                  │  │
│  │         │            │  + pdf-parse)│                                  │  │
│  │         │            └──────┬───────┘                                  │  │
│  │         │                   │                                          │  │
│  │         │            ┌──────▼───────┐                                  │  │
│  │         │            │  Anthropic   │                                  │  │
│  │         │            │  Claude API  │                                  │  │
│  │         │            │  (Sonnet)    │                                  │  │
│  │         │            └──────┬───────┘                                  │  │
│  │         │                   │                                          │  │
│  │         │            ┌──────▼───────┐                                  │  │
│  │         │            │  Zod Schema  │                                  │  │
│  │         │            │  Validation  │                                  │  │
│  │         │            └──────┬───────┘                                  │  │
│  │         │                   │                                          │  │
│  │  ┌──────▼───────────────────▼───────┐                                  │  │
│  │  │         Prisma ORM Client        │                                  │  │
│  │  └──────────────┬───────────────────┘                                  │  │
│  │                 │                                                      │  │
│  └─────────────────┼──────────────────────────────────────────────────────┘  │
│                    │                                                         │
│  ┌─────────────────▼──────────────────┐    ┌──────────────────────────────┐  │
│  │         PostgreSQL 16              │    │    Emails Volume             │  │
│  │         (DB Container)             │    │    ./Emails Round:/app/emails│  │
│  │                                    │    │    (read-only mount)         │  │
│  │  submissions ──┬── insured_info    │    └──────────────────────────────┘  │
│  │                ├── broker_info     │                                      │
│  │                ├── lines_of_biz    │                                      │
│  │                ├── limits          │                                      │
│  │                ├── target_pricing  │                                      │
│  │                ├── exposure_info   │                                      │
│  │                └── loss_records    │                                      │
│  │                                    │                                      │
│  │  pgdata volume (persistent)        │                                      │
│  └────────────────────────────────────┘                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Ingestion Pipeline

```
 .eml file
    │
    │  Entry points:
    │    CLI  → src/scripts/ingest.ts  → calls ingestAllEmails()
    │    API  → src/routes/ingest.ts   → POST /api/ingest/trigger
    │    Both delegate to:
    │           src/services/ingestion.ts
    │
    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  1. PARSE EMAIL                                                      │
│     File: src/services/email-parser.ts → parseEmlFile()              │
│                                                                      │
│     Uses: mailparser.simpleParser()                                  │
│     Extracts:                                                        │
│       - headers (from, to, subject, date)                            │
│       - text body (with html fallback)                               │
│       - attachment list with metadata                                │
│                                                                      │
│     For each attachment:                                             │
│       .txt/.csv  → read as UTF-8 text                                │
│       .pdf       → extract text via pdf-parse (PDFParse.getText())   │
│       .xls/.jpg  → skipped (logged as "binary — not extracted")      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  2. ASSEMBLE CONTENT                                                 │
│     File: src/services/email-parser.ts → buildContentString()        │
│                                                                      │
│     Combines into a single string:                                   │
│       From: / To: / Subject: / Date:                                 │
│       === EMAIL BODY ===                                             │
│       === ATTACHMENT: filename (type, size) ===                      │
│       ... extracted text per attachment ...                          │
│                                                                      │
│     Truncates at 180,000 chars (MAX_CONTENT_CHARS)                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  3. LLM EXTRACTION                                                   │
│     File: src/services/anthropic.ts → extractSubmissionData()        │
│                                                                      │
│     Sends to: Claude Sonnet (claude-sonnet-4-20250514)               │
│     System prompt defines 7 extraction categories                    │
│     Returns: raw JSON string                                         │
│                                                                      │
│     Extracts:                                                        │
│       • Insured info       • Broker info                             │
│       • Lines of business  • Limits requested                        │
│       • Target pricing     • Exposure info                           │
│       • Loss history                                                 │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  4. VALIDATE                                                         │
│     File: src/services/extraction-schema.ts                          │
│                                                                      │
│     Zod schemas: SubmissionExtractionSchema                          │
│       → InsuredInfoSchema, BrokerInfoSchema, LineOfBusinessSchema,   │
│         LimitRequestedSchema, TargetPricingSchema,                   │
│         ExposureInfoSchema, LossRecordSchema                         │
│                                                                      │
│     Called in: src/services/anthropic.ts                             │
│       JSON.parse(response) → SubmissionExtractionSchema.parse(raw)   │
│       Rejects malformed LLM output with Zod errors                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  5. STORE                                                            │
│     File: src/services/ingestion.ts → ingestSingleEmail()            │
│                                                                      │
│     Uses: src/lib/prisma.ts (singleton PrismaClient)                 │
│                                                                      │
│     prisma.submission.create() with nested cascade:                  │
│       data: {                                                        │
│         sourceFile, emailFrom, emailTo, emailSubject, emailDate,     │
│         insured:        { create: ... },                             │
│         broker:         { create: ... },                             │
│         linesOfBusiness:{ create: [...] },                           │
│         limits:         { create: [...] },                           │
│         targetPricing:  { create: [...] },                           │
│         exposures:      { create: ... },                             │
│         losses:         { create: [...] },                           │
│       }                                                              │
│                                                                      │
│     Deduplication: skips if sourceFile already exists                │
│     Schema: prisma/schema.prisma → 8 models                          │
│     Migration: prisma/migrations/0001_init/migration.sql             │
└──────────────────────────────────────────────────────────────────────┘
```

### Pipeline file call chain

```
src/scripts/ingest.ts                    ← CLI entry: npm run ingest
  └─ services/ingestion.ts               ← ingestAllEmails() / ingestSingleEmail()
       ├─ services/email-parser.ts        ← parseEmlFile() + buildContentString()
       │    └─ (pdf-parse)                ← PDFParse for .pdf attachments
       ├─ services/anthropic.ts           ← extractSubmissionData()
       │    └─ services/extraction-schema.ts  ← Zod validation
       └─ lib/prisma.ts                   ← DB write

src/routes/ingest.ts                     ← API entry: POST /api/ingest/trigger
  └─ services/ingestion.ts               ← (same chain as above)

src/scripts/preview.ts                   ← Dry-run entry: npm run preview
  ├─ services/email-parser.ts             ← parseEmlFile() + buildContentString()
  ├─ services/anthropic.ts                ← extractSubmissionData() (unless --parse-only)
  └─ services/ingestion.ts               ← collectEmlFiles() (directory walker only)
```

---

## Data Model (ERD)

```
┌──────────────────────────┐
│       Submission         │
├──────────────────────────┤
│ id          (PK, cuid)   │
│ sourceFile  (unique)     │
│ emailFrom                │
│ emailTo                  │
│ emailSubject             │
│ emailDate                │
│ rawBody                  │
│ createdAt                │
│ updatedAt                │
├──────────────────────────┤
│ 1:1  → InsuredInfo       │
│ 1:1  → BrokerInfo        │
│ 1:1  → ExposureInfo      │
│ 1:N  → LineOfBusiness[]  │
│ 1:N  → LimitRequested[]  │
│ 1:N  → TargetPricing[]   │
│ 1:N  → LossRecord[]      │
└──────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  InsuredInfo    │  │  BrokerInfo     │  │  ExposureInfo   │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ companyName     │  │ companyName     │  │ numberOfTrucks  │
│ contactName     │  │ contactName     │  │ numberOfDrivers │
│ mailingAddress  │  │ email           │  │ numberOfTrailers│
│ dotNumber       │  │ phone           │  │ radius          │
│ mcNumber        │  │                 │  │ commodities     │
│ yearsInBusiness │  │                 │  │ annualRevenue   │
│ state           │  │                 │  │ annualMileage   │
└─────────────────┘  └─────────────────┘  │ operatingStates │
                                          │ vehicleTypes    │
                                          └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ LineOfBusiness  │  │ LimitRequested  │  │  TargetPricing  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ type            │  │ lineOfBusiness  │  │ lineOfBusiness  │
│                 │  │ limitAmount     │  │ targetPremium   │
│                 │  │ deductible      │  │ currentPremium  │
│                 │  │ description     │  │ description     │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐
│  LossRecord     │
├─────────────────┤
│ policyYear      │
│ numberOfClaims  │
│ totalIncurred   │
│ totalPaid       │
│ description     │
└─────────────────┘
```

---

## File Structure

```
├── docker-compose.yml                  # Orchestration: db + server + preview
├── .env.example                        # Environment template
├── .dockerignore
├── Solution-README.md                  # This file
│
├── Emails Round/                       # Raw .eml input data (mounted read-only)
│   ├── *.eml
│   └── ANON/
│       └── *.eml
│
└── server/
    ├── Dockerfile                      # Node 20 Alpine, multi-step build
    ├── package.json
    ├── tsconfig.json
    ├── .gitignore
    │
    ├── prisma/
    │   ├── schema.prisma               # 8 models, PostgreSQL
    │   └── migrations/
    │       └── 0001_init/
    │           └── migration.sql       # Auto-generated DDL
    │
    └── src/
        ├── index.ts                    # Express app entry point
        │
        ├── lib/
        │   └── prisma.ts              # Singleton Prisma client
        │
        ├── routes/
        │   ├── submissions.ts         # GET (list/search/filter), GET/:id, DELETE/:id
        │   ├── analytics.ts           # GET /summary, /losses, /exposures
        │   └── ingest.ts             # POST /trigger
        │
        ├── services/
        │   ├── email-parser.ts        # .eml → parsed headers + body + PDF text
        │   ├── anthropic.ts           # Claude extraction (structured JSON)
        │   ├── extraction-schema.ts   # Zod schema (LLM ↔ DB contract)
        │   └── ingestion.ts          # Orchestrator: parse → extract → store
        │
        └── scripts/
            ├── ingest.ts             # CLI: batch ingest all emails
            └── preview.ts            # CLI: dry-run preview (--parse-only or with LLM)
```

---

## API Endpoints


| Method | Endpoint                   | Description                                         |
| ------ | -------------------------- | --------------------------------------------------- |
| GET    | `/health`                  | Health check                                        |
| GET    | `/api/submissions`         | List submissions (search, filter, paginate)         |
| GET    | `/api/submissions/:id`     | Single submission with all related data             |
| DELETE | `/api/submissions/:id`     | Delete a submission and all related records         |
| POST   | `/api/ingest/trigger`      | Trigger email ingestion from mounted volume         |
| GET    | `/api/analytics/summary`   | Aggregate stats: counts, lines of business, brokers |
| GET    | `/api/analytics/losses`    | All loss records with submission context            |
| GET    | `/api/analytics/exposures` | All exposure data with submission context           |


---

## Docker Services


| Service   | Profile   | Purpose                             | Depends On |
| --------- | --------- | ----------------------------------- | ---------- |
| `db`      | (default) | PostgreSQL 16 with healthcheck      | —          |
| `server`  | (default) | Express API + auto-migrate on start | db         |
| `preview` | `preview` | Dry-run email parsing/extraction    | —          |


### Commands

```bash
# Full stack
docker compose up --build -d

# Preview: parse-only (no API key, no DB)
docker compose run --rm preview --parse-only /app/emails

# Preview: single email with LLM extraction
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm preview "/app/emails/Saint Michael Transportation LTD - New Submission - Eff 8_19.eml"

# Preview: all emails with LLM extraction
ANTHROPIC_API_KEY=sk-ant-... docker compose run --rm preview /app/emails
```

---

## Tech Stack


| Component        | Technology              |
| ---------------- | ----------------------- |
| Runtime          | Node.js 20 (Alpine)     |
| Language         | TypeScript 5            |
| Framework        | Express 4               |
| ORM              | Prisma 6                |
| Database         | PostgreSQL 16           |
| AI/LLM           | Anthropic Claude Sonnet |
| Email Parsing    | mailparser 3            |
| PDF Extraction   | pdf-parse 2             |
| Validation       | Zod 3                   |
| Containerization | Docker + Compose        |


---

## LLM Extraction Approach

1. **Parse** `.eml` files via `mailparser` → headers, body, MIME attachments
2. **Extract** PDF text via `pdf-parse` → ACORD forms, loss runs, supplements
3. **Assemble** all content into a single string, truncated at 180k chars
4. **Send** to Claude Sonnet with a domain-specific system prompt
5. **Validate** the JSON response against a Zod schema
6. **Store** validated data in PostgreSQL via Prisma with cascading relations

The Zod extraction schema (`extraction-schema.ts`) acts as the contract between the LLM output and the database models, ensuring type safety end-to-end.

---

## Extraction Results — Detailed Data Report

All 6 unique emails in `Emails Round/` were run through the preview pipeline (parse + Claude Sonnet extraction). Below is what the model extracted from each.

> The `ANON/` subfolder contains duplicates with anonymized headers but identical attachments — same underlying data.

---

### 1. Saint Michael Transportation LTD — New Submission (Eff 8/19)

| Category | Extracted Data |
|---|---|
| **Insured** | Saint Michael Transportation LTD, Contact: Abbey Tesfazin, 9062 E Calet Way, Engelwood, CO 80111-5323 |
| **Broker** | Research Underwriters — Heather Dezayas, hdezayas@researchunderwriters.com, 412-351-5800 ext. 112 |
| **Lines of Business** | Business Auto |
| **Limits** | Auto Liability CSL $500,000 · Comprehensive deductible $1,000 · Collision deductible $1,000 |
| **Target Pricing** | *(none found)* |
| **Exposures** | 10 drivers · Commodities: passengers · State: CO · Vehicles: Toyota Prius, Honda CR-V, Toyota Sienna, Nissan Rogue, Hyundai Tucson |
| **Losses** | 2023: 4 claims, $32,795 incurred/paid (collision, property damage, bodily injury, medical pay) |
| **Attachments parsed** | 5 PDFs extracted (MVRs, ACORD forms, loss runs, RU application) |

---

### 2. Marvel Medical Transport LLC — Renewal (Eff 08/26/2025)

| Category | Extracted Data |
|---|---|
| **Insured** | Marvel Medical Transport LLC, Contact: Richard Heid, 788 Shrewsbury Ave Su 2171, Tinton Falls, NJ 07725 |
| **Broker** | PA Post / Hilb Group of New Jersey — Cynthia Walsh, cwalsh@hilbgroup.com, (201) 252-3057 |
| **Lines of Business** | Business Auto · General Liability · Professional Liability |
| **Limits** | Auto CSL $1M · UM CSL $35K · GL Each Occurrence $1M · GL Aggregate $2M · GL Personal & Adv Injury $1M · GL Products $1M · GL Rented Premises $100K · Prof Liability $1M each/$2M agg (deductible $1K) |
| **Target Pricing** | *(none found)* |
| **Exposures** | 42 trucks · 37 drivers · Radius: 50 miles · Commodities: NEMT · State: NJ · Vehicles: Ford Transit, Dodge Grand Caravan, Chrysler Town & Country, Ford E-350, Ford Econoline, Wheelchair Vans, Ambulatory Vehicles |
| **Losses** | *(none extracted — likely in scanned PDFs with minimal text yield)* |
| **Attachments parsed** | 5 PDFs extracted (ACORD Auto, ACORD GL, Aon Supplemental, MVRs, Vehicle Summary) · 2 XLS skipped (driver/vehicle schedules) |

---

### 3. Dream Ride

| Category | Extracted Data |
|---|---|
| **Insured** | Dream Ride LLC, 3914 NW 73rd Terr, Coral Springs, FL 33065 |
| **Broker** | American Specialty Insurance Group — Matt Tamoney, mtamoney@robertsonryan.com, (561) 683-1220 |
| **Lines of Business** | Business Auto |
| **Limits** | Auto Liability CSL $1M · Comprehensive deductible $2,500 · Collision deductible $2,500 · Medical Payments $10K · PIP $10K |
| **Target Pricing** | *(none found)* |
| **Exposures** | 3 trucks · 8 drivers · Commodities: Passengers · State: FL · Vehicles: Sprinter Van, Turtletop Bus |
| **Losses** | 2022: 2 claims, $27,302 incurred/paid (collision $25,875, comprehensive/glass $1,427) · 2023: 0 claims |
| **Attachments parsed** | 7 PDFs (application, supplemental app, reports, loss runs — some scanned with minimal text) |

---

### 4. Jacksonville Airport Car Service (Exp 08/30/25)

| Category | Extracted Data |
|---|---|
| **Insured** | Jacksonville Airport Car Service, LLC, 14675 Tiki Lane, Jacksonville, FL 32226 |
| **Broker** | Acrisure Southeast Partners Insurance Services, LLC — Susan McCrea, smccrea@acrisure.com, 321-421-6828 |
| **Lines of Business** | Business Auto · Commercial General Liability · Motor Carrier Truckers |
| **Limits** | Auto CSL $300K · Auto Comprehensive deductible $1K · Auto Collision deductible $2.5K |
| **Target Pricing** | *(none found)* |
| **Exposures** | 11 drivers · Commodities: pre-arranged passenger for hire transportation · State: FL · Vehicles: Buses Otherwise Not Classified, SUVs |
| **Losses** | *(none extracted)* |
| **Attachments parsed** | 3 PDFs (submission forms, loss runs, officer detail) |

---

### 5. ARide LLC dba MNM Transportation — Rush Request

| Category | Extracted Data |
|---|---|
| **Insured** | ARide LLC DBA MNM Transportation, Contact: Jon Elston, 7710 Hill Ave Suite D, Holland, OH 43528 |
| **Broker** | Hilb Group Transportation — Katy Batista, kbatista@hilbgroup.com, 201-252-3052 |
| **Lines of Business** | Commercial Auto |
| **Limits** | Auto Liability CSL $1M · Physical Damage deductible $2K (collision + comprehensive) |
| **Target Pricing** | *(none found)* |
| **Exposures** | 15 trucks · 10 drivers · Radius: Holland and surrounding areas · Annual mileage: 10,000 · Commodities: NEMT passengers · State: OH · Vehicles: Dodge Caravan, Honda Civic, Honda CRV, Chrysler Caravan |
| **Losses** | 24-25: 0 claims · 23-24: 0 claims · 22-23: 0 claims · 21-22: 1 claim, $2,518 incurred/paid (rear-end) · 20-21: 1 claim, $35 incurred/$0 paid |
| **Attachments parsed** | 7 PDFs (ACORD form, NEMT questionnaire, 5 loss run PDFs — some scanned) |

---

### 6. VFF Transportation, LLC — New Business (Eff 8/24)

| Category | Extracted Data |
|---|---|
| **Insured** | VFF Transportation, LLC, Contact: Virna Philistin, 1768 Oak Hill Drive, Union, NJ 07083, 3 years in business |
| **Broker** | Hilb Group — Katy Batista, kbatista@hilbgroup.com, 201-252-3052 |
| **Lines of Business** | Business Auto · General Liability |
| **Limits** | GL $3M (required by Essex and Sussex BOE contracts) |
| **Target Pricing** | *(none found)* |
| **Exposures** | 3 trucks · 3 drivers · Radius: Local · Commodities: School Transportation · State: NJ · Vehicles: 2015/2016/2017 Dodge Grand Caravan |
| **Losses** | *(none extracted — loss run PDFs were scanned images with minimal text)* |
| **Attachments parsed** | 13 PDFs (ACORD app, supplemental, MVRs, vehicle schedule, resume, corp docs, loss runs — many scanned) · 2 JPGs skipped |

---

### Cross-Submission Summary

| Submission | State | Lines of Business | Fleet Size | Drivers | Loss History |
|---|---|---|---|---|---|
| Saint Michael Transportation | CO | Business Auto | — | 10 | 4 claims (2023) |
| Marvel Medical Transport | NJ | Auto, GL, Prof Liability | 42 trucks | 37 | Not extracted |
| Dream Ride | FL | Business Auto | 3 trucks | 8 | 2 claims (2022) |
| Jacksonville Airport Service | FL | Auto, GL, Motor Carrier | — | 11 | Not extracted |
| ARide / MNM Transportation | OH | Commercial Auto | 15 trucks | 10 | 2 claims (2020-22) |
| VFF Transportation | NJ | Auto, GL | 3 trucks | 3 | Not extracted |

### Data Coverage Observations

| Field | Coverage (of 6 emails) | Notes |
|---|---|---|
| Insured company name | 6/6 | Always extracted |
| Insured address/state | 6/6 | Always extracted |
| Insured contact name | 4/6 | Missing for Dream Ride, Jacksonville |
| DOT / MC number | 0/6 | Never present in these submissions |
| Broker name + contact | 6/6 | Always extracted |
| Lines of business | 6/6 | 1-3 lines per submission |
| Limits | 6/6 | 1-9 limit entries per submission |
| Target pricing | 0/6 | Never found — may live in XLS attachments or separate docs |
| Fleet size (trucks) | 4/6 | Ranges from 3 to 42 |
| Driver count | 6/6 | Ranges from 3 to 37 |
| Vehicle types | 6/6 | Detailed make/model lists |
| Operating states | 6/6 | Single-state operations (CO, NJ, FL, OH) |
| Commodities | 6/6 | Mostly NEMT / passenger transport |
| Loss history | 3/6 | Missing when loss run PDFs are scanned images |

### Schema Validation Results

After applying `coerceToString` transforms for fields where Claude returns numbers vs strings inconsistently:

| Email | Validation |
|---|---|
| Saint Michael Transportation | ✓ Pass |
| Marvel Medical Transport | ✓ Pass |
| Dream Ride | ✓ Pass (after coercion fixes) |
| Jacksonville Airport Service | ✓ Pass |
| ARide / MNM Transportation | ✓ Pass (after coercion fixes) |
| VFF Transportation | ✓ Pass |

### Schema Adjustments Made From Data

| Field | Original Type | Changed To | Reason |
|---|---|---|---|
| `ExposureInfo.commodities` | `String?` | `String[]` | Claude returns arrays: `["NEMT passengers"]` |
| `ExposureInfo.operatingStates` | `String?` | `String[]` | Claude returns arrays: `["CO"]`, `["NJ"]` |
| `ExposureInfo.vehicleTypes` | `String?` | `String[]` | Claude returns arrays: `["Ford Transit", ...]` |
| `ExposureInfo.radius` | `String?` | `String?` + coerce | Claude sometimes returns number (`50`) vs string (`"50 miles"`) |
| `ExposureInfo.annualMileage` | `String?` | `String?` + coerce | Claude returned `10000` (number) for MNM |
| `LossRecord.totalIncurred` | `String?` | `String?` + coerce | Claude returned `27302` (number) for Dream Ride |
| `LossRecord.totalPaid` | `String?` | `String?` + coerce | Same pattern as totalIncurred |
| `targetPricing` (top-level) | `array` | `array \| null` → `[]` | Claude returned `null` instead of `[]` for Dream Ride |

---

## Known Limitations

- **XLS/XLSX attachments** (driver schedules, vehicle schedules) are not parsed — binary content is skipped
- **Image attachments** (JPG/PNG) are not OCR'd
- **Large emails** are truncated at 180k characters to stay within context window limits
- Some scanned PDFs yield minimal text (e.g., 16-32 chars) — these likely need OCR
- **Target pricing** was not found in any of the 6 test emails — this data may be communicated separately or embedded in formats we don't yet extract

