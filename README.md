# Opportunity Culture — Asana Goals Heatmap

An interactive 2D Heatmap application that visualizes **Opportunity Culture School Systems / Sites** down rows and **Asana Goals** across columns, with color-coded status badges for each site on each goal.

---

## 🌟 Features

* **Complete 2D Matrix View**:
  * **Rows**: 22+ school systems and CMOs (Thomasville, Columbus County, Asheboro, Warren County, etc.).
  * **Columns**: 12 Opportunity Culture Consulting Team goals grouped across 3 pillars:
    * **Reach**: District scaling commitments & staffing/budget plans.
    * **Results**: Certification levels, MCL protected time, tutoring quality, and reach metrics.
    * **Relationships**: Client touchpoints and Net Promoter Scores (OC, PI, MCL, Portal).
* **Precise Color Coding**:
  * 🟢 **Open - On track**: Light Green (`#bbf7d0`)
  * 🟡 **Open - At risk**: Light Yellow (`#fef08a`)
  * 🌸 **Open - Off track**: Pink (`#fecdd3`)
  * ⚪ **Open - No recent update**: Light Gray (`#f1f5f9`)
  * 🌲 **Closed - Achieved**: Dark Green (`#15803d`)
  * 🟠 **Closed - Partial**: Dark Yellow / Amber (`#b45309`)
  * 🔴 **Closed - Missed**: Dark Red (`#b91c1c`)
  * 🔘 **Closed - Dropped**: Slate Gray (`#4b5563`)
* **Interactive Tooling**:
  * **Sticky Headers & Columns**: School system names freeze on horizontal scroll; goal headers freeze on vertical scroll.
  * **Instant Live Search**: Filter school systems by name, state/region, or cohort.
  * **Pillar Filter Tabs**: Toggle between *All Goals*, *Reach*, *Results*, and *Relationships*.
  * **Status Quick Filters**: Filter for *Needs Attention (At Risk / Off Track)*, *Achieved*, *No Update*, etc.
  * **Interactive Legend**: Click any color in the legend to isolate those cells across all districts.
  * **Detail Inspection Modal**: Click any cell to view the full goal commentary, author, update timestamp, and a direct link to open the goal in Asana.
  * **Summary KPI Cards & Rollups**: Column health distribution mini-bars and site health % indicators.
  * **Export to CSV**: Download the matrix with one click for executive meetings or offline reporting.

---

## 🚀 Quick Start (Local Run)

### Method 1: Python Server (Recommended)
This requires **zero** external libraries (`pip install` not needed). Python's standard library is used.

1. Open PowerShell or Terminal in this folder:
   ```powershell
   python server.py
   ```
2. Open your browser to:
   ```
   http://localhost:8080
   ```

### Method 2: Standalone Double-Click Preview
You can also directly open `public/index.html` in Chrome, Edge, or Safari! The bundled mock data will load immediately.

---

## 🌐 Hosting for Team Members (Cloudflare Pages)

Since you already have a Cloudflare account, **Cloudflare Pages** is the ideal choice:
* **Cost**: 100% Free for unlimited team members.
* **Speed**: Fast global CDN distribution with zero cold starts.
* **Security & Authentication**: You can enable **Cloudflare Zero Trust / Access** (free for up to 50 team members) so only colleagues with your organization's email domain can access the dashboard!

### Deployment Steps:

#### Option A: Direct Upload via Cloudflare Dashboard
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages** > **Create application** > **Pages** > **Upload assets**.
3. Drag and drop the `public/` directory (or zip it).
4. Click **Deploy site**. Your heatmap is live instantly at `https://your-project.pages.dev`!

#### Option B: Via Git (GitHub / GitLab)
1. Push this repository to GitHub or GitLab.
2. In Cloudflare Dashboard, select **Pages** > **Connect to Git**.
3. Set the build configuration:
   * **Framework preset**: `None`
   * **Build output directory**: `public`
   * **Root directory**: `/`
4. In **Settings > Environment Variables**, add your secret:
   * `ASANA_ACCESS_TOKEN` = `your_asana_personal_access_token`
   * `ASANA_WORKSPACE_GID` = `(optional)`
5. Click **Save and Deploy**. Cloudflare Pages will automatically execute `functions/api/sync.js` and serve the site securely!

#### Protecting with Team Login (Cloudflare Zero Trust)
1. In Cloudflare Pages, go to the **Access** tab.
2. Click **Add Access Policy**.
3. Require email ending in `@your-organization.com` (or send one-time pin via email). Team members can now securely view the heatmap without creating complex accounts!

---

## 🔑 Connecting Real Asana API Data

1. In the top right of the application, click **Asana API Settings** (or create a `.env` file based on `.env.example`).
2. Enter your **Asana Personal Access Token (PAT)**.
3. Click **Save & Sync Now**.
4. The local Python server (or Cloudflare function) will query Asana's API, pull your parent goals and subgoals, map the statuses, and cache them locally in `data/asana_cache.json`.
