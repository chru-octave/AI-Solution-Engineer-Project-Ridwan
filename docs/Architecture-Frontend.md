# Frontend Architecture

## Overview

The frontend is a **React SPA** built with Vite, running as static files behind an nginx reverse proxy inside Docker. It consumes the Express REST API to display insurance submission data through a dashboard, detail views, and an ingestion control panel.

**Framework:** React 19 + Vite 8  
**Language:** TypeScript  
**Styling:** Tailwind CSS v4  
**Serving:** nginx:alpine  
**Port:** 3000 (container) → 3002 (host)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              nginx (port 3000)               │
│                                             │
│   /api/*  ──proxy──►  Express API (:3000)   │
│   /*      ──serve──►  dist/index.html       │
│                       (Vite build output)   │
└─────────────────────────────────────────────┘
         ▲
         │ HTTP
         │
    ┌────┴────┐
    │ Browser │
    └─────────┘
```

In development, Vite's dev server (`port 5173`) proxies `/api` requests to `localhost:3001` (the Express container). In production, nginx serves the static build and proxies API requests to the `server` container on the Docker network.

---

## Directory Structure

```
client/
├── Dockerfile                     # Multi-stage: node build → nginx serve
├── nginx.conf                     # SPA routing + API proxy config
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── postcss.config.js
├── index.html                     # HTML entry point (Google Fonts)
└── src/
    ├── main.tsx                   # React root, QueryClient, BrowserRouter
    ├── App.tsx                    # Route definitions
    ├── index.css                  # Tailwind v4 @theme + scrollbar styles
    ├── api/
    │   ├── types.ts               # TypeScript interfaces (mirrors Prisma models)
    │   ├── client.ts              # Fetch wrapper for all API endpoints
    │   └── hooks.ts               # TanStack Query hooks
    ├── components/
    │   ├── StatCard.tsx            # Reusable metric card with accent colors
    │   ├── SourceBadge.tsx         # EML/PDF badge indicator
    │   ├── FleetChart.tsx          # Recharts bar chart (trucks + drivers)
    │   ├── LobChart.tsx            # Recharts doughnut + legend grid
    │   └── SubmissionsTable.tsx    # Searchable, paginated data table
    ├── layouts/
    │   └── AppLayout.tsx           # Sidebar nav + main content outlet
    └── pages/
        ├── Dashboard.tsx           # Stats, charts, submissions table
        ├── SubmissionDetail.tsx    # Full submission view with all sections
        └── IngestPage.tsx          # Ingestion trigger UI with results
```

---

## Routing

React Router v7 with a shared layout:

| Route | Page | Description |
|-------|------|-------------|
| `/` | `Dashboard` | Stat cards, fleet bar chart, LOB doughnut chart, paginated submissions table |
| `/submissions/:id` | `SubmissionDetail` | Full view: source info, insured, broker, exposures, limits, pricing, losses |
| `/ingest` | `IngestPage` | File upload (drag-and-drop), directory ingestion trigger, results display |

All routes are nested under `AppLayout`, which provides the persistent sidebar navigation and scrollable main content area.

---

## Data Layer

### API Client (`api/client.ts`)

A thin `fetch` wrapper over the backend REST API. All calls go through `/api/*` which nginx proxies to the Express server.

| Function | Method | Endpoint |
|----------|--------|----------|
| `api.getSubmissions(params)` | GET | `/api/submissions?search=&page=&limit=` |
| `api.getSubmission(id)` | GET | `/api/submissions/:id` |
| `api.getSummary()` | GET | `/api/analytics/summary` |
| `api.getExposures()` | GET | `/api/analytics/exposures` |
| `api.getLosses()` | GET | `/api/analytics/losses` |
| `api.triggerIngest(dir, mode)` | POST | `/api/ingest/trigger` |
| `api.uploadFiles(files)` | POST | `/api/ingest/upload` (multipart `FormData`) |

### TanStack Query Hooks (`api/hooks.ts`)

Each API call is wrapped in a TanStack Query hook for automatic caching, background refetching, and loading/error states:

| Hook | Type | Cache Key |
|------|------|-----------|
| `useSubmissions(params)` | `useQuery` | `["submissions", params]` |
| `useSubmission(id)` | `useQuery` | `["submission", id]` |
| `useSummary()` | `useQuery` | `["summary"]` |
| `useExposures()` | `useQuery` | `["exposures"]` |
| `useLosses()` | `useQuery` | `["losses"]` |
| `useIngest()` | `useMutation` | Invalidates submissions, summary, exposures, losses on success |
| `useUpload()` | `useMutation` | Sends files via `api.uploadFiles` |

Default stale time is 30 seconds (`retry: 1`). The `useIngest` mutation automatically invalidates cached data after a successful ingestion so the dashboard refreshes.

### TypeScript Types (`api/types.ts`)

Mirrors the Prisma schema exactly — `Submission`, `InsuredInfo`, `BrokerInfo`, `ExposureInfo`, `LimitRequested`, `TargetPricing`, `LossRecord`, `LineOfBusiness`. Also includes response wrappers (`PaginatedResponse<T>`, `SummaryData`, `IngestResponse`).

---

## Component Architecture

### Layout

**`AppLayout`** — Fixed 224px sidebar with gold "Octave Insurance" branding, navigation links (Dashboard, Ingest) using `NavLink` with active state highlighting, and a scrollable main content area via `<Outlet />`.

### Dashboard Components

**`StatCard`** — Displays a single metric with a label, large display value, optional detail text, and a colored left-edge accent bar. Five color variants: gold, sky, success, danger, violet.

**`FleetChart`** — Recharts `BarChart` showing trucks and drivers per submission. Filters out entries with zero values. Dark-themed with custom axis/grid/tooltip colors matching the app palette.

**`LobChart`** — Recharts `PieChart` (doughnut) with the chart centered above a 2-column scrollable legend grid showing color swatch, truncated type name, and count. Handles 20+ entries cleanly.

**`SubmissionsTable`** — Full-featured data table with:
- Search input (filters by insured, broker, subject via API)
- 8 columns: Source (EML/PDF badge), Insured/File, Broker, State, Lines of Business (tag chips), Fleet, Losses, Date
- Row click navigates to `/submissions/:id`
- Pagination controls with page numbers, prev/next buttons, and range display

### Detail Components

**`SubmissionDetail`** — Rendered as a vertical stack of `Section` cards:
- Source Info (file, from, to, subject, date)
- Insured (company, contact, address, state, DOT, MC, years)
- Broker (agency, contact, email, phone)
- Exposure Details (trucks, drivers, trailers, radius, revenue, mileage, states, vehicles, commodities)
- Lines of Business (tag chips)
- Limits Requested (table)
- Target Pricing (table)
- Loss History (table with year, claims, incurred, paid, description)

### Ingest Components

**`IngestPage`** — Two-panel ingestion interface:

1. **Upload Zone** — Drag-and-drop area (or file picker) accepting `.eml` and `.pdf` files. Shows a file list with type badges, sizes, and per-file remove buttons. Two actions: "Upload & Ingest" (uploads files then immediately triggers ingestion on the upload directory) and "Upload Only" (uploads without ingesting).

2. **Directory Trigger** — Manual directory path input (defaults to `/app/emails`), standard/thorough mode toggle buttons, and a trigger button with loading spinner.

On success, displays three summary cards (processed/failed/skipped counts) and a detailed results table with per-file status badges.

---

## Styling

### Tailwind CSS v4

Uses the new CSS-based configuration via `@theme` in `index.css` (no `tailwind.config.js`):

| Token | Value | Usage |
|-------|-------|-------|
| `--color-dark-bg` | `#0c0f14` | Page background |
| `--color-dark-card` | `#161b24` | Card/panel backgrounds |
| `--color-dark-hover` | `#1c2230` | Hover states, nested surfaces |
| `--color-dark-border` | `#2a3142` | All borders |
| `--color-light` | `#e4e8ef` | Primary text |
| `--color-muted` | `#8893a7` | Secondary text, labels |
| `--color-gold` | `#e8a838` | Primary accent (headings, active nav, buttons) |
| `--color-sky` | `#38b2e8` | EML badges, LOB tags, secondary accent |
| `--color-danger` | `#e84a5f` | Errors, failure states |
| `--color-success` | `#4ae88a` | Success states |
| `--color-violet` | `#a87ee8` | PDF badges |

### Typography

| Font | Usage |
|------|-------|
| **DM Serif Display** (serif) | `font-display` — headings, stat values, page titles |
| **IBM Plex Sans** (sans-serif) | `font-body` — body text, labels, table content |

Loaded from Google Fonts via `<link>` in `index.html`.

---

## Docker Configuration

**Build stage:** `node:20-alpine` — `npm install` → `tsc -b` → `vite build` → produces `dist/` with static HTML/CSS/JS  
**Production stage:** `nginx:alpine` — copies `dist/` to `/usr/share/nginx/html` and `nginx.conf` for routing

### nginx Routing

- `client_max_body_size 50m` — allows large file uploads to pass through to the API
- `GET /api/*` → proxied to `http://server:3000/api/` (Express container on Docker network)
- `GET /*` → serves static files, falls back to `index.html` for SPA client-side routing
- gzip enabled for text, CSS, JSON, and JS responses
- 600s proxy read timeout (accommodates long-running ingestion requests)

### Production Image Size

~25MB (nginx:alpine + static build output) — significantly lighter than a Node.js-based frontend.

---

## Development Workflow

```bash
# Local dev (outside Docker, proxies API to localhost:3001)
cd client
npm install
npm run dev        # Vite dev server on http://localhost:5173

# Production build
npm run build      # TypeScript check + Vite build → dist/

# Docker (from project root)
docker compose build client
docker compose up -d client    # http://localhost:3002
```

The Vite dev server (`vite.config.ts`) proxies `/api` requests to `http://localhost:3001`, so you can run the frontend locally while the API runs in Docker.

---

## Key Design Decisions

1. **Vite over Next.js** — Pure client-side SPA is the right fit for an internal dashboard. No SEO needed, no server-side rendering benefit. Vite delivers sub-second HMR and a 25MB production image vs 180MB+ for a Node-based Next.js container.

2. **TanStack Query for data fetching** — Provides caching, automatic refetching, loading/error states, and mutation-based cache invalidation out of the box. Eliminates manual `useEffect` + `useState` patterns.

3. **nginx as the production server** — Serves static files efficiently, handles SPA routing via `try_files` fallback, and proxies API requests to the backend on the Docker network. No Node.js runtime needed in production.

4. **Tailwind CSS v4 with @theme** — CSS-based configuration keeps the design system in one place (`index.css`). Custom color tokens match the original static dashboard's dark theme exactly.

5. **Table row click → detail page** — Instead of inline expansion (like the legacy dashboard), submissions link to a dedicated detail page. Better UX for the amount of data per submission, and enables direct URL sharing/bookmarking.
