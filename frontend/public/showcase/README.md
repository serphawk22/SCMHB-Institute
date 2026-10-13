# SCM Hub B2C Operations Portal — Powered by SERP Hawk CRM

A dedicated, production-quality digital operations platform for **SCM Hub**'s admissions, student acquisition, fee tracking, and institutional management, powered by **SERP Hawk CRM**.

---

## 🌟 Key Highlights & Design Architecture

1. **SCM Hub Brand Identity First**
   - **Primary Palette**: SCM Hub Forest Emerald Green (`#0C4F3E`), Deep Navy (`#051751`), Accent Blue (`#006AB3`), Emerald (`#10B981`), and Accent Green (`#32AD11`).
   - **Light Theme**: Pure white (`#FFFFFF`) application background with crisp cards, light gray borders (`#E2E8F0`), and high-contrast typography.
   - **Dark Theme**: Pure black (`#000000`) background with subtle surface separation (`#0A0A0A`, `#111111`) and emerald highlights.
   - **Logos & Attribution**: Official SCM Hub brand assets with secondary "Powered by SERP Hawk CRM" technology attribution.

2. **Admissions-Focused Information Architecture**
   - **Recreated from Reference CRM Dashboards**:
     - **Top Metric Cards (6 KPIs)**: Total Leads (`248`), Active Prospects (`126`), Enrollments (`42`), Pipeline Value (`₹18,75,000`), Fees Collected (`₹12,40,000`), Pending Follow-ups (`17`).
     - **Priority Action AI Assistant Pitch Card**: AI Counseling Assistant with candidate quote, program recommendation, phone, counselor assignment, call logging, and collapsible student background.
     - **Financial Overview**: Monthly area/line chart tracking Fees Collected vs. Outstanding Receivables in INR.
     - **Admissions Pipeline**: Horizontal stage breakdown from Inquiry to Enrolled.
     - **Company Command Center**: High-contrast operations banner with direct controls (*Assign Leads*, *Staff Task Sheet*, *Fees & Slips*, *Demos & Meets*, *Full Analytics*) and telemetry metrics strip.
     - **6 Analytics Visualizations (Donut Charts)**:
       1. *Lead Pipeline Stages* (Total Leads in center)
       2. *Lead Acquisition Sources* (Inquiries in center)
       3. *Course Admissions Share* (Admissions in center)
       4. *Fees Collection Health* (Total Value in center)
       5. *Counselors Team Workload* (Leads Handled in center)
       6. *Task Sheet Execution* (Daily Staff Delivery in center)
     - **Deals & Conversion Pipeline**: 4 KPI cards and a 5-stage student admissions funnel.
     - **Upcoming Admissions Follow-ups & Recent Enrollments**: Searchable and filterable data tables.

3. **Genuinely Functional Prototype**
   - **Theme Switching**: Light / Dark mode toggling with instant Chart.js palette adaptation and persistence in `localStorage`.
   - **Interactive Navigation**: The CRM serves the landing page at `/opening` (from `index.html`), and signed-out visits to the root redirect there. `login.html` authenticates against the FastAPI backend and then takes the user to the main CRM application dashboard at `/`. Logout (`logout.html` / `performLogout`) clears the session and returns to `index.html`.
   - **Authentication**: Validation, password reveal, 1-click demo profiles (*Admin*, *Employee*, *Demo Workspace*), route protection, and forgot password modal. The session is written to `localStorage` as `crm_user` so the main CRM recognises it.
   - **Live Interactions**: Add Lead modal, Schedule Counseling modal, Lead Distribution modal, call logging feedback, date range filtering, table search, and toast notifications.

---

## 📂 File Structure

```
showcase/                # source; published to frontend/public/showcase/
├── index.html          # Public B2C Operations landing page + Embedded Command Center
├── login.html          # Two-column enterprise authentication page
├── logout.html         # Session termination & confirmation page
├── css/
│   └── styles.css      # Core brand stylesheet & responsive design system
├── js/
│   ├── main.js         # Theme toggle, mobile drawer, toast manager
│   ├── auth.js         # Authentication, demo accounts, session guard, CRM handoff
│   └── charts.js       # Chart.js configs with dynamic theme re-rendering
└── assets/
    ├── scm-hub-logo-c.png   # Official SCM Hub color logo
    ├── scm-hub-logo.png     # Official SCM Hub white/transparent logo
    └── serp-hawk-logo.png   # Official SERP Hawk CRM logo
```

---

## 🚀 How to Run Locally

The showcase authenticates against the FastAPI backend and then hands off to the
main Next.js CRM. Because the CRM reads its session from `localStorage['crm_user']`
(which is **per-origin**), the showcase must be served from the **same origin** as
the CRM for the handoff to reach the dashboard directly.

### Option 1: Same origin as the CRM (Recommended)
The showcase is published inside the CRM's `public/` folder, so it is served by the
CRM dev server itself:

```bash
# From the frontend directory
cd frontend
npm run dev
```

With the FastAPI backend running on `http://127.0.0.1:8000`, open:
- **Landing Page**: `http://localhost:3000/showcase/index.html`
- **Login Page**: `http://localhost:3000/showcase/login.html`
- After login you are redirected to the CRM dashboard at `http://localhost:3000/`
- **Logout Page**: `http://localhost:3000/showcase/logout.html` (clears the session)

> Note: `frontend/public/showcase/` is a copy of this `showcase/` folder. Edit the
> source in `showcase/` and re-copy, or edit the served copy directly.

### Option 2: Standalone static server
Any local HTTP server works; the redirect defaults to the CRM at
`http://localhost:3000/` (override with `window.CRM_APP_URL`):

```bash
python -m http.server 3005
```
- **Landing Page**: `http://localhost:3005/index.html`
- **Login Page**: `http://localhost:3005/login.html`
- **Dashboard**: after login, redirected to the main CRM app (`http://localhost:3000/` by default; override with `window.CRM_APP_URL`)

> Cross-origin caveat: when the showcase runs on a different port (e.g. `:3005`),
> the CRM on `:3000` cannot read the `crm_user` session and will show its own login
> page. Use Option 1 for a seamless handoff.

---

## 🔑 Demo Login Accounts

On `login.html`, click a 1-click demo button or type credentials seeded in the
backend (`main.py`, `_ensure_user`). The backend must be running.
- **Admin**: `admin@serphawk.com` / `Admin123!`
- **Employee**: `varshit@gmail.com` / `Admin123!`
- **Demo Workspace**: `demo@serphawk.com` / `DemoPass123!`
