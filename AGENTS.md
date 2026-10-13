# AGENTS.md — Development & Operational Handbook

> **Initial Version Created By:** Antigravity (Google DeepMind)  
> **Last Updated:** October 2026  
> **Target Audience:** Autonomous coding agents, LLM assistants, and human engineers maintaining or extending this codebase.

---

## 1. Project Overview & Core Mission

### 1.1 Organizational Purpose & Stack
The **Opportunity Culture Asana Goals Heatmap** is a single-page operational monitoring web application developed for **Public Impact** (specifically for Bryan Hassel and the Opportunity Culture leadership & consulting teams). 

The platform visualizes the strategic progress of **Opportunity Culture (OC) partner school systems / CMOs / districts** (rows) against the **12 Consulting Team strategic goals** (columns) across 3 core pillars: **Reach**, **Results**, and **Relationships**.

* **Frontend**: Vanilla ECMAScript 2020+ (No build framework, no React/Vue/Node bundle dependencies). Styled with Tailwind CSS via CDN and Lucide Icons via CDN.
* **Serverless Backend (Production)**: Cloudflare Pages + Cloudflare Pages Functions (`functions/api/sync.js`, `functions/api/matrix.js`).
* **Local Backend (Development)**: Python 3 standard library only (`server.py`, `sync_asana.py`). No `pip install` or external packages required.
* **External Integration**: Asana REST API v1.0 querying Parent Goal Relationships (`/goal_relationships?supported_goal={parent_gid}`).

### 1.2 Primary Capabilities & Views
* **2D Matrix Grid**:
  * **Rows**: 39 active Opportunity Culture school districts and CMOs.
  * **Columns**: 12 Opportunity Culture parent consulting goals grouped into 3 pillars (Reach: 2 goals, Results: 5 goals, Relationships: 5 goals).
  * **Sticky Headers & Columns**: Leftmost district name column remains pinned on horizontal scroll; three header rows (Pillar Groups, Goal Column Titles, Column Health Distribution Bars) remain pinned on vertical scroll.
* **Interactive Tooling & State Lenses**:
  * **Text Search**: Real-time filtering by district name, state/region, or cohort.
  * **Pillar Filter Tabs**: Toggle between *All Goals*, *Reach*, *Results*, and *Relationships*.
  * **Status Quick Filters**: Dropdown and interactive legend chips allowing single-click isolation of specific statuses (e.g., *On track*, *At risk*, *Off track*, *No update*, *Achieved*, *Needs Attention*).
  * **Hide Non-Matching Sites Toggle**: Switch between completely filtering out rows vs. dimming non-matching cells.
  * **Detail Inspection Modal**: Clicking any cell reveals the full Asana status update commentary, author name, timestamp, metric progress, and a direct link to the specific subgoal in Asana.
  * **Rollup KPIs**: Executive header metrics calculating *Total Sites*, *Active Goals*, *% Overall Health*, *Achieved Count*, *Needs Attention Count*, and *No Update Count*.
  * **Client-Side CSV Export**: Generates and downloads a clean UTF-8 CSV matrix of visible districts and goals for offline reporting.
  * **Live Asana Sync**: In-browser trigger (`POST /api/sync`) running parallel edge extractions against Asana with real-time UI toast feedback.

---

## 2. Domain & Business Rules (CRITICAL)

### 2.1 Entity Inclusion & Exclusion Rules
When ingesting data from the Asana API (`/goal_relationships?supported_goal={parent_gid}`):
* **District / Site Entity Identification**:
  * In Asana, each supporting subgoal belongs to a **Team**.
  * The site is identified by `subgoal.team.gid` and `subgoal.team.name`.
* **Explicit Exclusions (Internal Teams)**:
  Any team matching the following names represents internal administrative or consulting groups and **MUST BE EXCLUDED** from the heatmap rows:
  * `"OC Consulting Team"`
  * `"Specialty Teams"`
  * `"Exec Team"`
  * `"All OC Team (not comms or admin)"`
* **Subgoal Assignment**:
  * Each parent goal may have subgoals for 25–42 school systems.
  * Not every district has a subgoal under every parent goal. If a site lacks a subgoal for a given parent goal, the cell is classified as `not_set` (`—`).

### 2.2 Status Taxonomy & Classification Mappings
Statuses in Asana are mapped into an 8-state taxonomy split across two lifecycle groups (`open` vs. `closed`):

| Status Key | Status Label | Lifecycle Group | Heatmap Badge Color | `isHealthy` | Sort Weight | Derivation Condition |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `on_track` | On track | `open` | Light Green (`#bbf7d0`, text `#052e16`) | **`true`** | 2 | `status_type` is `"green"` or `"on_track"` |
| `at_risk` | At risk | `open` | Light Yellow (`#fef08a`, text `#451a03`) | **`false`** | 3 | `status_type` is `"yellow"` or `"at_risk"` |
| `off_track` | Off track | `open` | Pink/Rose (`#fecdd3`, text `#4c0519`) | **`false`** | 4 | `status_type` is `"red"` or `"off_track"` |
| `no_recent_update` | No update | `open` | Light Gray (`#f1f5f9`, text `#334155`) | **`false`** | 5 | Subgoal is open but has no recent status update |
| `achieved` | Achieved | `closed` | Dark Green (`#15803d`, text `#ffffff`) | **`true`** | 1 | Goal closed; status/update contains `"achieve"` |
| `partial` | Partial | `closed` | Dark Amber (`#b45309`, text `#ffffff`) | **`false`** | 6 | Goal closed; status/update contains `"partial"` |
| `missed` | Missed | `closed` | Dark Red (`#b91c1c`, text `#ffffff`) | **`false`** | 7 | Goal closed; status/update contains `"miss"` |
| `dropped` | Dropped | `closed` | Slate Gray (`#4b5563`, text `#ffffff`) | **`false`** | 8 | Goal closed; status/update contains `"drop"` |
| `not_set` | — | `none` | Dashed Gray (`#f8fafc`, text `#94a3b8`) | **`false`** | 9 | No supporting subgoal relationship exists |

* **"Needs Attention" Filter**: Evaluates to `true` if and only if `status_key === 'at_risk'` OR `status_key === 'off_track'`.

### 2.3 Mathematical Formulas & Denominators
Calculations must strictly adhere to these denominator definitions:

1. **Health Definition (`isHealthy`)**:
   * **Only two statuses are considered healthy**: `achieved` (closed) and `on_track` (open).
   * All other statuses—including `no_recent_update` and `partial`—are considered unhealthy (`isHealthy = false`).
2. **Site Health % (`s.healthPct`)**:
   $$\text{healthPct} = \begin{cases} \text{round}\left(\frac{\text{healthyCount}}{\text{totalAssigned}} \times 100\right) & \text{if } \text{totalAssigned} > 0 \\ 0 & \text{if } \text{totalAssigned} = 0 \end{cases}$$
   * **Denominator (`totalAssigned`)**: Number of cells where a supporting goal exists for the currently visible goals (respecting active pillar filters).
   * **Null/Unassigned Handling**: `not_set` cells (where no subgoal exists) **DO NOT count in the denominator**.
3. **Goal Column Health Summary % (`pct`)**:
   $$\text{pct} = \begin{cases} \text{round}\left(\frac{\text{healthy}}{\text{total}} \times 100\right) & \text{if } \text{total} > 0 \\ 0 & \text{if } \text{total} = 0 \end{cases}$$
   * **Denominator (`total`)**: Total number of visible sites that have an assigned subgoal under this specific goal.
   * **Summary Bar Color Thresholds**:
     * $\ge 70\%$: Emerald (`bg-emerald-500`)
     * $40\% - 69\%$: Amber (`bg-amber-500`)
     * $< 40\%$: Rose (`bg-rose-500`)
4. **Overall Dashboard Health % KPI**:
   $$\text{overallHealth} = \begin{cases} \text{round}\left(\frac{\text{healthyCells}}{\text{totalCells}} \times 100\right) & \text{if } \text{totalCells} > 0 \\ 0 & \text{if } \text{totalCells} = 0 \end{cases}$$
   * Calculated dynamically across all currently filtered sites and goals.
5. **Goal Metric Progress % (`progress_pct`)**:
   $$\text{progress\_pct} = \min\left(100, \text{round}\left(\frac{\text{current\_number\_value}}{\text{target\_number\_value}} \times 100\right)\right)$$
   * If `target_number_value` is `null`, `0`, or undefined, `progress_pct` is `null`.
   * Only rendered on open cells where `progress_pct > 0`.

### 2.4 Brand & Formatting Integrity
* **"Opportunity Culture" (OC)**: Always capitalize both words. Never lowercase as "opportunity culture". In abbreviated form, use "OC".
* **"Public Impact" (PI)**: The parent organization and Asana workspace name. Always capitalized.
* **Core Pillars**: Exactly three pillars: `"Reach"`, `"Results"`, `"Relationships"`.
* **Key Role Titles**: Multi-Classroom Leader (`MCL`), Team Reach Teacher (`TRT`), Principal Supervisor, Superintendent (`Supe`).
* **Timestamp Formatting**:
  * **STRICT RULE**: All user-facing timestamps must be explicitly rendered in **US Eastern Time** with the `"ET"` designation (e.g., `Sep 28, 2026, 5:36 PM ET`).
  * Cloudflare Pages Functions, GitHub Actions, and container runtimes execute in **UTC** by default. Any call to `new Date().toLocaleString()` must specify `{ timeZone: 'America/New_York' }` and append `" ET"`. Never display raw UTC timestamps.

### 2.5 Regional Inferences
When no explicit region attribute is provided in Asana, the region is determined by substring matching on the school system name:
* **North Carolina**: Contains `"(nc)"`, `"north carolina"`, or `"carolina"`.
* **Texas**: Contains `"isd"`, `"texas"`, `"ctor"`, `"midland"`, or `"manor"`.
* **New Mexico**: Contains `"new mexico"`, `"espanola"`, `"carlsbad"`, or `"monte del sol"`.
* **Oklahoma**: Contains `"oklahoma"`, `"hulbert"`, `"harding"`, `"millwood"`, or `"berryhill"`.
* **Maryland**: Contains `"baltimore"` or `"maryland"`.
* **Pennsylvania**: Contains `"philadelphia"` or `"pennsylvania"`.
* **Mississippi**: Contains `"jackson"`.
* **Default**: `"National"`.

---

## 3. Architecture & Data Flow

### 3.1 Architectural Diagram
```
                     +---------------------------------------+
                     |         Asana REST API v1.0           |
                     |  - GET /users/me                      |
                     |  - GET /goal_relationships?supported_goal=...
                     +-------------------+-------------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
 (Local Python Pipeline)                                 (Cloudflare Edge Runtime)
               v                                                   v
     +-------------------+                               +-------------------+
     |   sync_asana.py   |                               | functions/api/    |
     | (Python Std Lib)  |                               |      sync.js      |
     +---------+---------+                               +---------+---------+
               |                                                   |
      Writes to disk:                                              |
      - data/asana_cache.json                                      |
      - public/matrix_cache.json                                   |
      - public/mock_data.js                                        |
               |                                                   |
               v                                                   |
     +-------------------+                                         |
     |     server.py     |                                         |
     | (Python Port 8080)|                                         |
     | - GET  /api/matrix| <--- Serves matrix_cache.json           |
     | - POST /api/sync  | <--- Calls sync_asana.py                |
     +---------+---------+                                         |
               |                                                   |
               +-------------------------+-------------------------+
                                         |
                                         v  JSON Payload {sites, cells, pillars, goals}
                        +---------------------------------+
                        |        Browser Frontend         |
                        |        public/index.html        |
                        |        public/app.js            |
                        +----------------+----------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
         +----------------------+                  +----------------------+
         | Interactive Heatmap  |                  | Client-Side CSV      |
         | - DOM Matrix Grid    |                  | Export Generation    |
         | - Inspection Modal   |                  +----------------------+
         | - KPI Rollup Cards   |
         +----------------------+
```

### 3.2 Key Directories & Files Map
* [`functions/api/sync.js`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/functions/api/sync.js): Cloudflare Pages serverless function that performs parallel Asana API extraction across all 12 parent goals and returns the live matrix dataset.
* [`functions/api/matrix.js`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/functions/api/matrix.js): Cloudflare Pages serverless function that delivers cached matrix data from Cloudflare KV or static `matrix_cache.json`.
* [`public/matrix_cache.json`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/public/matrix_cache.json): Pre-compiled, pure JSON snapshot of the full dataset (39 sites, 440 cells) ensuring instantaneous initial page load without API latency.
* [`public/mock_data.js`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/public/mock_data.js): Standalone JavaScript file setting `window.EMBEDDED_MOCK_DATA` for double-click local browser viewing without a web server.
* [`public/app.js`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/public/app.js): Core frontend controller handling state, DOM rendering, KPI rollups, modal interaction, Asana deep links, and client-side CSV downloads.
* [`public/index.html`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/public/index.html): SPA markup with Tailwind CSS styling, responsive layout, sticky 2D headers, inspection modal, and toast notification container.
* [`sync_asana.py`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/sync_asana.py): Standalone Python CLI synchronization utility using only Python standard library modules to update local cache files.
* [`server.py`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/server.py): Zero-dependency Python development server implementing a static file server and local `/api/matrix` & `/api/sync` endpoints on port 8080.
* [`goals_structure.txt`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/goals_structure.txt): Asana parent goal IDs, naming taxonomy, and reference subgoal relationships extracted from production Asana workspaces.
* [`.env`](file:///C:/Users/Bryan/Coding/Asana%20Heatmap/.env): Local secret file storing `ASANA_ACCESS_TOKEN` (strictly gitignored).

---

## 4. Development & Operational Workflows

### 4.1 First-Time Setup
This repository was intentionally designed with **zero third-party dependencies**:
* **No `npm install`** (Tailwind CSS and Lucide Icons load via CDN).
* **No `pip install`** (Python scripts only use `urllib`, `json`, `pathlib`, `http.server`, and `zoneinfo`).

To configure local Asana synchronization:
```powershell
# Copy the example environment template
Copy-Item .env.example .env

# Edit .env and paste your Asana Personal Access Token
# ASANA_ACCESS_TOKEN=your_asana_pat_here
```

### 4.2 Running Locally in Development
Start the local Python server:
```powershell
python server.py
```
Open your browser to:
```
http://localhost:8080
```
* The server will serve assets from `public/`.
* `GET /api/matrix` returns the latest cached data.
* `POST /api/sync` executes `sync_asana.sync()` on demand.

### 4.3 Running Ingestion / Data Refresh Scripts
To manually refresh the local cache and public data files from Asana:
```powershell
python sync_asana.py
```
This updates:
1. `data/asana_cache.json` (local persistent cache)
2. `public/matrix_cache.json` (Cloudflare Pages static JSON)
3. `public/mock_data.js` (embedded browser fallback)

### 4.4 Cloudflare Pages Deployment Configuration
When linking this repository to Cloudflare Pages:
* **Framework preset**: `None`
* **Build command**: *Leave empty / blank*
* **Build output directory**: `public`
* **Root directory**: `/`
* **Environment Variables (Cloudflare Dashboard > Settings > Environment variables)**:
  * `ASANA_ACCESS_TOKEN`: The Asana Personal Access Token.
  * `ASANA_WORKSPACE_GID`: *(Optional)* The Asana workspace GID if the user belongs to multiple organizations.

---

## 5. Technical Gotchas & Best Practices

### 5.1 Cloudflare Edge Subrequest Limits
* Cloudflare Pages free tier enforces a strict limit of **50 subrequests per invocation**.
* The synchronization logic in `functions/api/sync.js` is engineered to make:
  1. `1` request to `/users/me` (Token verification)
  2. `12` parallel requests to `/goal_relationships?supported_goal={parent_gid}` (one for each parent goal)
  * **Total Subrequests: 13**. This is well within the 50-request threshold.
* **NEVER** refactor the sync logic to query individual subgoals or status updates one-by-one in a loop; doing so will exceed Cloudflare subrequest limits and result in HTTP 500 errors.

### 5.2 State Mutation & Safeguards in Frontend
* **Defensive Payload Check**: In `public/app.js`, `triggerAsanaSync()` must verify that incoming sync results contain `result.sites` (Array) and `result.cells` (Object) before assigning to `state.data`.
* **Zero KPI Regression**: If an API route returns a partial payload (e.g., `{ status: "success", count: 100 }`) without `sites` and `cells`, assigning it directly to `state.data` will collapse all KPI metrics (`total-sites`, `overall-health`, etc.) to `0` across the board. Always maintain existing state if the returned payload is invalid.

### 5.3 Pure JSON vs. JavaScript Files
* `public/matrix_cache.json` is pure JSON.
* `public/mock_data.js` contains a leading comment (`// Standalone live cache export...`) followed by `window.EMBEDDED_MOCK_DATA = {...};`.
* In `functions/api/matrix.js`, always serve `public/matrix_cache.json` directly. Do not attempt regex string surgery on `mock_data.js` without stripping leading multi-line comments, as invalid JSON parse errors will occur.

### 5.4 Git & Secrets Hygiene
* **GitHub Push Protection**: The remote GitHub repository (`bryanhassel/asana-goals-heatmap.git`) has active push protection rules. Any commit containing an Asana token (format `1/...` or `2/...`) will be instantly rejected by GitHub.
* **Never commit `.env` or `data/asana_cache.json`**. Verify `.gitignore` rules before staging files:
  ```gitignore
  .env
  .env*
  data/asana_cache.json
  __pycache__/
  *.pyc
  ```

### 5.5 Operating System & Path Conventions
* On Windows environments, file paths can contain spaces (e.g. `c:\Users\Bryan\Coding\Asana Heatmap`). Always wrap paths in double quotes in terminal commands.
* Node.js and Python scripts must use `Path(__file__).resolve().parent` or `path.resolve()` rather than hardcoded slashes or backslashes.
