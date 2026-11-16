# Personalized Travel Itinerary Planner

An AI-assisted travel planner. You describe a trip (vibe, dates, budget, who is travelling, pace, interests) and get an editable, **day-by-day itinerary** with morning / lunch / afternoon / evening plans, stay ideas, and a budget in **INR** (plus local currency for trips abroad).

Built for the Skill Wallet *Generative AI with Google Cloud* capstone.

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Python + FastAPI (validated with Pydantic) |
| Database + login | Supabase (Postgres + Auth + Row Level Security) |
| Generative AI | Groq API (OpenAI-compatible) |
| Hosting | Vercel (frontend) and Render (backend) |
| Version control | Git + GitHub |

> **Important honesty note.** Prices, opening hours and distances in this app are **rough estimates or demo data**. They are never live, verified or bookable. Every itinerary shows a label saying so. Check real details before you travel.

---

## Contents

1. [What works with and without API keys](#1-what-works-with-and-without-api-keys)
2. [Project structure](#2-project-structure)
3. [Install the tools on Windows](#3-install-the-tools-on-windows-beginner-friendly)
4. [Run the project locally (Windows)](#4-run-the-project-locally-windows)
5. [Optional: turn on AI mode (Groq)](#5-optional-turn-on-ai-mode-groq)
6. [Optional: turn on accounts and cloud saving (Supabase)](#6-optional-turn-on-accounts-and-cloud-saving-supabase)
7. [Testing](#7-testing)
8. [Troubleshooting](#8-troubleshooting)
9. [Upload to GitHub](#9-upload-to-github)
10. [Free cloud deployment](#10-free-cloud-deployment-supabase--render--vercel)
11. [Skill Wallet submission](#11-skill-wallet-final-submission)
12. [API reference](#12-api-reference)
13. [How it works](#13-how-it-works)

---

## 1. What works with and without API keys

You can run and demo the **whole app with no keys and no accounts**.

| Feature | No keys (default) | Needs Groq key | Needs Supabase |
|---|:---:|:---:|:---:|
| Trip wizard, validation, itinerary view | Yes | | |
| Itinerary generation | **Demo mode** (hand-written sample data for 15 destinations) | AI mode (any destination) | |
| Destination recommendations (3 cards) | Demo mode | AI mode | |
| Regenerate one day / replace one activity | Yes | Yes (AI) | |
| Budget tracker, trip summary | Yes | Yes | |
| PDF and Markdown export | Yes | Yes | |
| Save and reopen trips, saved places, history | Yes, **in this browser only** | | **Cloud** (any device) |
| Sign up / sign in | No | | **Yes** |

**Demo destinations** (used when no AI key is set): Goa, Andaman Islands, Phuket, Manali, Darjeeling, Interlaken, Jaipur, Kyoto, Varanasi, Mumbai, Singapore, Dubai, Rishikesh, Leh-Ladakh, Queenstown. If you type a destination that is not in this list, demo mode picks a matching one and tells you.

**If the AI fails** (rate limit, network problem, bad key, broken answer) the app falls back to demo mode and shows *why* in a banner. Set `FALLBACK_TO_DEMO=false` in `backend/.env` to see the raw error instead.

A free example is bundled: click **See an example trip** on the home page, or open `docs/example-itinerary.pdf` / `docs/example-itinerary.json`.

---

## 2. Project structure

```text
personalized-travel-itinerary-planner/
├── README.md                    <- this guide
├── LICENSE                      <- MIT
├── .gitignore                   <- keeps .env, venv, node_modules, dist out of Git
├── .python-version              <- Python 3.13 hint for hosting
├── backend/
│   ├── main.py                  <- FastAPI app and all endpoints
│   ├── schemas.py               <- Pydantic models (request + response validation)
│   ├── planner.py               <- chooses AI vs demo, validates AI output, partial edits
│   ├── llm.py                   <- Groq client, prompts, error handling
│   ├── demo.py                  <- demo-mode engine (no key needed)
│   ├── demo_data/               <- hand-written sample destinations
│   ├── finalize.py              <- recomputes dates, totals, local currency, disclaimer
│   ├── pdf_export.py            <- PDF generation (ReportLab)
│   ├── requirements.txt         <- runtime packages
│   ├── requirements-dev.txt     <- runtime + pytest
│   ├── pytest.ini
│   ├── .env.example             <- copy to .env
│   └── tests/                   <- backend tests
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example             <- copy to .env
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx, App.jsx, ctx.jsx, styles.css
│       ├── api.js               <- talks to the backend
│       ├── store.js             <- saves trips (browser or Supabase)
│       ├── supabaseClient.js    <- optional Supabase connection
│       ├── constants.js, utils.js
│       ├── data/example-trip.json
│       ├── components/          <- Layout, small UI pieces, icons
│       └── pages/               <- Landing, Auth, Dashboard, PlanTrip, ItineraryView,
│                                   Explore, Places, History
├── supabase/
│   └── schema.sql               <- tables + Row Level Security + grants
└── docs/
    ├── example-itinerary.json
    └── example-itinerary.pdf
```

---

## 3. Install the tools on Windows (beginner-friendly)

You need **Python**, **Node.js** and **Git**. VS Code is optional but recommended. Do them one at a time. After each install, **close and reopen your terminal** before checking, otherwise Windows will not see the new program.

### How to open a terminal
Press the **Windows key**, type **PowerShell**, press **Enter**. (You can also use "Command Prompt" or the terminal inside VS Code. The commands below say when they differ.)

### 3.1 Python (version 3.12 or 3.13)

**Check if you already have it:**
```powershell
python --version
py --version
```
If either prints `Python 3.12.x` or `Python 3.13.x` you are fine. If it prints something older than 3.10, or says *"Python was not found"* / *"not recognized"*, install it.

**Install:**
1. Go to <https://www.python.org/downloads/windows/> and download a **Python 3.13** (or 3.12) *Windows installer (64-bit)*.
2. Run it. **Tick "Add python.exe to PATH"** on the first screen (very important), then click **Install Now**.
3. Close and reopen PowerShell, then run `python --version` again.

**"python is not recognized"?** You probably missed the PATH checkbox. Re-run the installer, choose **Modify**, then tick *Add Python to environment variables*, or uninstall and reinstall with the box ticked. Also try `py --version`: the `py` launcher often works even when `python` does not (then use `py` wherever this guide says `python`).

> A Microsoft Store pop-up opening when you type `python` means Python is *not* installed. Install it from python.org as above.

### 3.2 Node.js and npm

**Check:**
```powershell
node --version
npm --version
```
You want Node **20 or newer** (the current LTS is best).

**Install:** download the **LTS** installer from <https://nodejs.org/>, run it with the default options (it installs npm too), then reopen PowerShell and re-check both commands.

**"node is not recognized"?** Reopen the terminal; if it still fails, restart the laptop (PATH is only read at start-up), or reinstall Node.

### 3.3 Git for Windows

**Check:**
```powershell
git --version
```
**Install:** <https://git-scm.com/download/win>. The default options are fine. Reopen PowerShell and re-check. *Not recognized?* Reopen the terminal or restart the laptop.

**One-time identity setup** (use your own name and the email on your GitHub account):
```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 3.4 VS Code (optional, recommended)
Not required, but it makes editing `.env` files and viewing the code much easier. Download from <https://code.visualstudio.com/>, install with defaults, and optionally tick "Add to PATH" so the `code` command works.

### 3.5 Get the project onto your laptop
1. Download the ZIP, right-click it, choose **Extract All…**, and pick a simple location such as `C:\Projects\`. (Avoid paths with unusual characters; avoid running from inside the ZIP.)
2. You should now have `C:\Projects\personalized-travel-itinerary-planner\`. Windows sometimes creates the same folder name twice (one inside the other). Use the **inner** one: it is the folder that directly contains `backend`, `frontend` and `README.md`.

### 3.6 Open the project folder
**In VS Code:** *File → Open Folder…* and choose the extracted folder. Open a terminal with *Terminal → New Terminal*.

**In PowerShell:**
```powershell
cd C:\Projects\personalized-travel-itinerary-planner
dir
```
You should see `backend`, `frontend`, `supabase`, `README.md` and others. (Change the path if you extracted elsewhere.)

---

## 4. Run the project locally (Windows)

You will use **two terminals at the same time**: one for the backend, one for the frontend. Keep both open while you use the app.

### Terminal 1: the backend (FastAPI)

```powershell
cd C:\Projects\personalized-travel-itinerary-planner\backend
python -m venv venv
venv\Scripts\Activate.ps1
```
Your prompt now starts with `(venv)`. That means the virtual environment is active.

> **"running scripts is disabled on this system"?** Run this once, then activate again:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> Or use **Command Prompt** instead and activate with `venv\Scripts\activate.bat`.

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```
Leave it running. You should see `Uvicorn running on http://127.0.0.1:8000`.

- `copy .env.example .env` creates your private settings file. For a first run you do **not** need to edit it (demo mode works with an empty key).
- If you later edit `backend\.env`, **stop the backend (Ctrl+C) and start it again**. The file is only read at start-up.

### Terminal 2: the frontend (React + Vite)

Open a **new** PowerShell window (do not close the first one):
```powershell
cd C:\Projects\personalized-travel-itinerary-planner\frontend
npm install
copy .env.example .env
npm run dev
```
You should see `Local: http://localhost:5173/`.

- `frontend\.env` already points to the backend: `VITE_API_URL=http://localhost:8000`.
- If you edit `frontend\.env`, **stop and restart `npm run dev`**.

### Open it in your browser

| What | URL |
|---|---|
| The app | <http://localhost:5173> |
| API documentation (Swagger) | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/api/health> |
| Mode check (demo or AI) | <http://localhost:8000/api/status> |

### Check that the frontend and backend are talking

1. Open <http://localhost:5173> and click **Open app**.
2. Look at the **top-right pill**:
   - `Demo mode (no AI key)` (yellow) = connected, demo mode. 
   - `AI mode` (green) = connected, AI key detected.
   - `Backend offline · retry` (red) = the frontend cannot reach the backend. See [Troubleshooting](#8-troubleshooting).
3. Or open <http://localhost:8000/api/health> directly. You should see `{"status":"ok","version":"1.0.0"}`.

### Try itinerary generation in demo mode

1. Click **Start new trip**.
2. Step 1: type `Goa`, keep the date, set 4 days, click **Next step**.
3. Step 2: choose **Beach**, pick a budget, pace and a few interests, click **Next step**.
4. Step 3: choose who is travelling, optionally set a budget limit, click **Generate itinerary**.
5. You get a 4-day plan. Try **Regenerate day**, **Replace** on one activity, the **Budget tracker**, **Save trip**, **PDF** and **Markdown**.

### Try the Swagger page
Open <http://localhost:8000/docs>, expand **POST /api/itinerary/generate**, click **Try it out**, paste this, and click **Execute**:
```json
{
  "vibe": "Mountains",
  "destination": "Manali",
  "start_date": "2026-12-20",
  "duration_days": 3,
  "budget": "Budget",
  "party": "Friends",
  "travelers": 3,
  "pace": "Moderate",
  "interests": ["Adventure", "Nature"],
  "use_demo": true
}
```
The response is the validated JSON the frontend displays.

**To stop everything:** press **Ctrl+C** in each terminal. **Next time**, you only need: activate the venv (`venv\Scripts\Activate.ps1`) then `uvicorn main:app --reload --port 8000` in the backend folder, and `npm run dev` in the frontend folder.

---

## 5. Optional: turn on AI mode (Groq)

AI mode lets you plan **any** destination and use free-text notes. Groq offers a free tier with rate limits (check <https://console.groq.com> for current limits, which can change).

1. Create an account at <https://console.groq.com> and open **API Keys** (<https://console.groq.com/keys>).
2. Click **Create API Key**, name it, and **copy it now** (it is shown once).
3. Open `backend\.env` and paste it:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```
4. Stop the backend (Ctrl+C) and start it again. The top-right pill should now say **AI mode**.

`GROQ_MODEL` defaults to `llama-3.3-70b-versatile`. If Groq retires that model, pick a current one from <https://console.groq.com/docs/models> and put its exact name in `GROQ_MODEL`.

**Never** put this key in `frontend\.env` or commit it to GitHub. It belongs only in `backend\.env` (locally) and in Render's environment settings (online).

> The AI path has been tested in this project with simulated AI responses (including rate limits, bad formats and network errors). It has not been tested against a live Groq key, so the first real run is yours. If the AI answer is invalid, the app retries once and then falls back to demo mode with an explanation.

---

## 6. Optional: turn on accounts and cloud saving (Supabase)

Without Supabase, trips are saved **in your browser only**. With it you get sign-up / sign-in and trips saved to the cloud, protected so each user can only see their own.

### 6.1 Create a project
1. Make a free account at <https://supabase.com> and click **New project**.
2. Pick a name, a strong database password (save it somewhere safe; this app does not need it), and a nearby region. Wait for it to finish creating.

### 6.2 Create the tables
1. In the project, open **SQL Editor → New query**.
2. Open `supabase\schema.sql` from this project, copy **everything**, paste it in, and click **Run**. It should say *Success*. It is safe to run again.
3. Open **Table Editor**. You should see `trips`, `saved_places` and `history`, each marked with RLS enabled.

### 6.3 Get your two public values
Open the project's **Connect** dialog, or **Project Settings → API Keys**. You need:
- **Project URL** (looks like `https://abcdxyz.supabase.co`)
- **Publishable key** (starts with `sb_publishable_`). Older projects call this the **anon** key; either works here.

> **Never use the `secret` / `service_role` key in this app.** It bypasses all security. The frontend only needs the public key, and Row Level Security does the protecting.

### 6.4 Put them in the frontend
Edit `frontend\.env`:
```
VITE_SUPABASE_URL=https://abcdxyz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key_here
```
Restart `npm run dev`. The sidebar now shows **Sign in**.

### 6.5 Sign-up options
- By default Supabase emails a confirmation link when someone signs up. For quick testing you can turn it off under **Authentication → Sign In / Providers → Email → Confirm email** (menu names can shift slightly over time).
- For your deployed site, set **Authentication → URL Configuration → Site URL** to your Vercel address (see section 10) so email links open the right place.

### 6.6 What Row Level Security does here
Each table has policies that only allow `user_id = auth.uid()`: you can read, insert, update and delete only your **own** rows. Signed-out visitors have no table access at all. `history` is add-and-read only (a log). The SQL file explains each policy in comments.

> The SQL was syntax-checked with the PostgreSQL parser but has not been run against a live Supabase project by me. If **Run** shows an error, copy the red message and fix that line; do not skip it, because missing policies mean missing security.

Trips you saved in the browser *before* signing in can be copied into your account with the **Import to my account** button on the dashboard.

---

## 7. Testing

### Backend tests (automatic)
In **Terminal 1** (venv active), from the `backend` folder:
```powershell
pip install -r requirements-dev.txt
pytest
```
Expected: **36 passed**. They cover health/status, demo itineraries (structure, dates, budget maths, one-area-per-day), local-currency display, invalid input (friendly errors), regenerate-one-day, replace-one-activity, recommendations (3 cards, season-aware), PDF export, and simulated AI failures (rate limit, bad key, wrong shape, too few days) plus the successful AI path. Tests never call a real AI service.

### Frontend build check
From the `frontend` folder:
```powershell
npm run build
```
It must finish with `built in …` and no errors.

### Manual testing checklist
Tick these in the browser (backend + frontend running):

- [ ] Home page loads; **Open app** goes to the dashboard
- [ ] Top-right pill shows *Demo mode* (or *AI mode* if you added a key)
- [ ] Wizard: `0` days gives an error; no vibe gives an error; fixing them lets you continue
- [ ] Generate a Goa trip: 4 days, each with morning, lunch, afternoon, evening
- [ ] Each day sticks to one area (shown under the day title)
- [ ] Budget tracker totals add up; setting a low budget limit shows **Over your limit**
- [ ] **Regenerate day** changes only that day (check Day 1 stays the same)
- [ ] **Replace** changes only that one activity
- [ ] **Save place** (heart) adds it to *Saved Places*
- [ ] **Save trip**, refresh the page, open it again from the dashboard
- [ ] **Edit preferences → Regenerate itinerary** works
- [ ] **PDF** and **Markdown** download and open
- [ ] **Explore**: choose a vibe; 3 destination cards appear with the "illustrative" notice
- [ ] **Trip History** lists your actions
- [ ] Stop the backend and press Generate: you get a clear "Cannot reach the backend" message
- [ ] Resize the browser narrow (phone width): no sideways scrolling, bottom navigation appears
- [ ] (With Groq key) pill says *AI mode* and a non-demo destination such as `Lisbon` works
- [ ] (With Supabase) sign up, sign in, save a trip, sign out, sign in again: the trip is still there

---

## 8. Troubleshooting

| Problem | What to do |
|---|---|
| **`python` / `node` / `git` "is not recognized"** | Close and reopen the terminal. Still failing: restart the laptop, then reinstall with the PATH option ticked (see section 3). |
| **`running scripts is disabled`** when activating venv | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or use Command Prompt and `venv\Scripts\activate.bat`. |
| **`ModuleNotFoundError: No module named 'fastapi'`** (or `dotenv`, `reportlab`, …) | The venv is not active or packages were not installed. Your prompt must start with `(venv)`. Run `venv\Scripts\Activate.ps1` then `pip install -r requirements.txt`. |
| **`uvicorn is not recognized`** | Same cause: activate the venv first. Or run `python -m uvicorn main:app --reload --port 8000`. |
| **`Error loading ASGI app` / `Could not import module "main"`** | You are not inside the `backend` folder. `cd backend` first. |
| **Port 8000 already in use** | Find it: `netstat -ano \| findstr :8000`. Stop it: `taskkill /PID <number> /F`. Or use another port: `uvicorn main:app --reload --port 8001` **and** set `VITE_API_URL=http://localhost:8001` in `frontend\.env`, then restart the frontend. |
| **Port 5173 already in use** | Vite stops with an error (on purpose). Close the other Vite window. If you must use another port, also add it to `CORS_ORIGINS` in `backend\.env` and restart the backend. |
| **Red pill "Backend offline"** | Backend not running, wrong port, or wrong `VITE_API_URL`. Test <http://localhost:8000/api/health> in the browser. If that works but the pill is red, restart the frontend after editing `.env`. |
| **CORS error in the browser console** ("blocked by CORS policy") | The backend does not list your frontend's address. In `backend\.env` set `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` (no trailing slash, exact address in your browser bar) and **restart the backend**. |
| **"The AI API key was rejected"** | The `GROQ_API_KEY` is wrong, revoked, or has spaces/quotes. Re-copy it from the Groq console, paste it with no quotes, restart the backend. |
| **"The AI rate limit was reached"** | You hit Groq's free-tier limit. Wait a minute and retry. The app shows a demo itinerary meanwhile. |
| **"The AI model … was not found"** | Groq renamed/retired the model. Update `GROQ_MODEL` (see section 5). |
| **Everything is demo even with a key** | You did not restart the backend after editing `.env`, or the file is named `.env.txt`. In VS Code the file must be exactly `.env`. In File Explorer turn on *View → Show → File name extensions*. |
| **`npm install` fails / very slow** | Check your internet. Delete the `node_modules` folder and `package-lock.json` and run `npm install` again. Make sure Node is 20+. |
| **Sign-in says "Invalid login credentials"** | Wrong password, or you must click the confirmation email first (or disable *Confirm email* for testing). |
| **"Could not save this trip. The database tables are missing"** | You did not run `supabase\schema.sql` (section 6.2). |
| **"Permission denied" / "row-level security" error** | Re-run the whole `schema.sql`. It contains the `GRANT` and policy statements. |
| **PDF download fails** | Make sure the backend is running and `reportlab` installed (`pip install -r requirements.txt`). |

---

## 9. Upload to GitHub

You need a free account at <https://github.com>.

> **Security first.** Never upload API keys, your Supabase `service_role`/secret key, passwords or any `.env` file. The included `.gitignore` already excludes `.env` files, `venv`, `node_modules`, `dist`, logs and zips, **but only when you use Git (Method A)**. Browser uploads (Method B) ignore it, so be careful there.

### Create the empty repository (both methods)
1. Sign in to GitHub, click the **+** (top right) → **New repository**.
2. **Repository name:** e.g. `personalized-travel-itinerary-planner`.
3. Choose **Public**.
4. **Do not** tick *Add a README*, *.gitignore* or *license* (this project already has them; adding them again causes conflicts).
5. Click **Create repository**. Keep the page open: it shows your repo URL.

### Method A: Git commands (recommended)

Open PowerShell in the **project root** (the folder containing `backend`, `frontend` and `README.md`):

```powershell
cd C:\Projects\personalized-travel-itinerary-planner

git init
git add .
git status
```
Read the `git status` list. You should **not** see any `.env` file (only `.env.example`), nor `venv`, `node_modules` or `dist`. If you do, stop and check `.gitignore` is present.

```powershell
git commit -m "Initial commit: Personalized Travel Itinerary Planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

**Replace** `YOUR-USERNAME/YOUR-REPO-NAME` with the address GitHub showed you (copy it from the page, the HTTPS one that ends in `.git`). Do not use the example address.

- First push: a browser window (Git Credential Manager) asks you to sign in to GitHub. GitHub no longer accepts your account password on the command line, so use that browser sign-in.
- *"remote origin already exists"* → `git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git` then push again.
- *"Author identity unknown"* → run the `git config --global user.name/user.email` commands from section 3.3.

**Later changes:**
```powershell
git add .
git commit -m "Describe what you changed"
git push
```

### Method B: GitHub website upload
Use this only if Git is giving you trouble, or for a one-off upload. It is more error-prone because nothing filters out secrets for you.

1. On the new empty repository page, click **uploading an existing file**.
2. **Use a fresh copy:** extract the ZIP into a *new* folder and upload from there **before** you run `pip install` / `npm install`. A fresh extract has no `.env`, `venv`, `node_modules` or `dist`.
3. Drag the folders and files **inside** `personalized-travel-itinerary-planner` (`backend`, `frontend`, `supabase`, `docs`, `README.md`, `LICENSE`, `.gitignore`, `.python-version`) into the browser window. Folder drag-and-drop works in Chrome and Edge. GitHub limits how many files one upload can contain (currently about 100); if it complains, upload in two batches.
4. **Never drag in** any file named `.env` (without `.example`), or the folders `venv`, `node_modules`, `dist`.
5. Type a commit message and click **Commit changes**.

### Verify the repository
Open your repo page and check:
- [ ] You see `backend`, `frontend`, `supabase`, `docs`, `README.md`, `LICENSE`, `.gitignore`.
- [ ] `backend/main.py`, `backend/requirements.txt`, `frontend/package.json` and `supabase/schema.sql` exist.
- [ ] `backend/.env.example` and `frontend/.env.example` exist and contain **only placeholders**.
- [ ] There is **no** `.env` file, `venv` folder or `node_modules` folder. (On GitHub press **t** and search `.env` to list matching files; only `.env.example` files should appear.)
- [ ] The README renders on the front page.

**If you ever pushed a real key by mistake:** deleting the file is not enough. Treat the key as stolen: revoke it in Groq/Supabase and create a new one.

---

## 10. Free cloud deployment (Supabase + Render + Vercel)

**Do these in order.** You need a GitHub repo first (section 9). Everything below has a free option, but **free plans change and have limits. Nothing is guaranteed to stay free or always available.** Check each provider's current pricing page.

| Service | Account needed | Free option | Limits worth knowing (as of writing) |
|---|---|---|---|
| **GitHub** | Yes | Yes | |
| **Supabase** (optional) | Yes | Yes | Free projects pause after about 1 week of inactivity (you can resume them); about 500 MB database. |
| **Render** (backend) | Yes | Yes (free web service) | Spins down after 15 minutes without traffic; waking takes about a minute. 750 free instance-hours per month. Local files are lost on restart (this app does not need them). Not meant for serious production. |
| **Vercel** (frontend) | Yes | Yes (Hobby plan) | The free plan is intended for personal, non-commercial projects; check Vercel's current terms. |
| **Groq** (optional) | Yes | Yes | Rate limits apply; can change. |

### 10.1 Supabase (skip if you don't want accounts/cloud saving)
Follow section 6 completely. Keep your **Project URL** and **publishable key** handy for Vercel. Without Supabase, the deployed site still works; trips save in each visitor's own browser.

### 10.2 Deploy the backend on Render
1. Sign up at <https://render.com> (you can use your GitHub account).
2. Click **New → Web Service**, connect GitHub, and pick your repository.
3. Fill the form:

| Field | Value |
|---|---|
| Name | e.g. `travel-planner-api` |
| Language / Runtime | **Python 3** |
| Branch | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | **Free** |

4. Open **Advanced** (or the *Environment* tab) and add these variables:

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.13.5` (needs the full version number) |
| `CORS_ORIGINS` | `http://localhost:5173` for now (you will add your Vercel address in 10.4) |
| `GROQ_API_KEY` | your Groq key (optional; leave out for demo mode) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` (optional) |
| `FALLBACK_TO_DEMO` | `true` |

   Also set **Health Check Path** to `/api/health` if the form offers it.
5. Click **Create Web Service** and wait for the build to finish (a few minutes). Watch the **Logs** tab.
6. Copy your service address from the top of the page. It looks like `https://travel-planner-api.onrender.com`. **That is your production API URL.**
7. Test it: open `https://YOUR-SERVICE.onrender.com/api/health` (expect `{"status":"ok",…}`) and `https://YOUR-SERVICE.onrender.com/docs`. The **first** request after idle can take about a minute: that is the free plan waking up.

### 10.3 Deploy the frontend on Vercel
1. Sign up at <https://vercel.com> (GitHub login is easiest).
2. Click **Add New… → Project**, then **Import** your repository.
3. Set:

| Field | Value |
|---|---|
| **Root Directory** | `frontend` (click *Edit* and choose the folder) |
| Framework Preset | **Vite** (auto-detected) |
| Build Command | `npm run build` (auto-filled) |
| Output Directory | `dist` (auto-filled) |

4. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `VITE_API_URL` | your Render address, e.g. `https://travel-planner-api.onrender.com` (**no trailing slash**) |
| `VITE_SUPABASE_URL` | your Supabase Project URL (only if using Supabase) |
| `VITE_SUPABASE_ANON_KEY` | your Supabase **publishable/anon** key (only if using Supabase; never the secret key) |

5. Click **Deploy**. When it finishes, copy your site address, e.g. `https://your-project.vercel.app`.

> Vite bakes these variables into the site **at build time**. If you change one later, you must **redeploy** (*Deployments → … → Redeploy*) for it to take effect.
>
> This app uses `#/` style links, so refreshing any page works on Vercel without extra routing setup.

### 10.4 Connect the two (CORS) and finish Supabase
1. In **Render → your service → Environment**, edit `CORS_ORIGINS` to include your Vercel address, comma-separated, **no trailing slash, no path**:
   ```
   http://localhost:5173,https://your-project.vercel.app
   ```
   Save. Render redeploys automatically.
2. (If using Supabase) In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://your-project.vercel.app`.

### 10.5 Test the public deployment
- [ ] `https://YOUR-SERVICE.onrender.com/api/health` shows `ok`
- [ ] Open your Vercel address; the top-right pill turns to *Demo mode* or *AI mode* (allow a minute if the backend was asleep)
- [ ] Generate an itinerary, regenerate a day, download the PDF
- [ ] (Supabase) Sign up, save a trip, refresh, sign out and in again: the trip is still there
- [ ] Open the browser console (F12): no red CORS errors

### 10.6 Fixing deployment problems

| Problem | Fix |
|---|---|
| **Red "Backend offline" on the live site** | Check `VITE_API_URL` on Vercel (correct address, `https://`, no trailing slash) and **redeploy** the frontend. Then open `…/api/health` to confirm the backend is awake. |
| **CORS error in the browser console** | `CORS_ORIGINS` on Render must contain your exact Vercel address (with `https://`, no trailing slash). Save and wait for Render to redeploy. Note that Vercel **preview** deployments have different addresses and will be blocked unless you add them too; use your main production address. |
| **Mixed content blocked** | `VITE_API_URL` must be `https://…`, not `http://…`, on the live site. |
| **Very slow first load / timeouts** | Render's free service was asleep. Wait about a minute and retry. |
| **Render build fails: package install error** | Check the Logs. Make sure **Root Directory** is `backend` and `PYTHON_VERSION` is `3.13.5`. |
| **Render: `Could not import module "main"`** | Root Directory is not `backend`. |
| **Render: "Port scan timeout" / no open port** | Start Command must use `--host 0.0.0.0 --port $PORT` exactly. |
| **Vercel build fails** | Run `npm run build` in `frontend` on your laptop to see the real error. Confirm **Root Directory** is `frontend`. |
| **Vercel shows a blank page** | Open the console (F12). A wrong/missing env var is the usual cause; fix it and redeploy. |
| **Sign-in works locally but not online** | You did not add the `VITE_SUPABASE_*` variables on Vercel (or did not redeploy afterwards). |
| **Supabase queries stop working after a quiet week** | The free project paused. Open the Supabase dashboard and resume it. |

---

## 11. Skill Wallet final submission

Your Skill Wallet project page asks for two links. **Use your own real links after you have uploaded and deployed. Do not use example links.**

> I could not open the Skill Wallet page (it requires your login), so field names below are based on what you told me ("GitHub repository link" and "Live demo URL"). Look for those labels; they may differ slightly.

**1. GitHub repository link**
1. Open your repository on GitHub (the page showing your files).
2. Click the address bar and copy the URL. It looks like `https://github.com/<your-username>/<your-repo-name>`.
3. Make sure the repository is **Public** (*Settings → General → Danger Zone* shows the visibility) so reviewers can open it.

**2. Live demo URL**
1. Open your project in the Vercel dashboard and click **Visit** (or copy the address under **Domains**).
2. It looks like `https://<your-project>.vercel.app`. This is the **frontend** address, **not** the Render address.
3. Open it in a private/incognito window first to confirm anyone can use it.

**Where to paste them:** open your Skill Wallet project page (your link, `…?tab=3`), find the GitHub repository field and the Live demo field, paste each link, then press the page's **Submit** / **Save** button and re-open the page to check both links were stored.

Tip for reviewers: the first load of the live demo can take about a minute because the free Render backend sleeps. Mention this in your submission notes, and open the site yourself just before submitting so it is awake.

---

## 12. API reference

Interactive docs are at `/docs` (Swagger) when the backend is running.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Is the server alive? |
| GET | `/api/status` | `mode` is `ai` or `demo`; shows if a key is configured |
| POST | `/api/itinerary/generate` | Full itinerary from trip preferences |
| POST | `/api/itinerary/regenerate-day` | Re-plan one day; other days untouched |
| POST | `/api/itinerary/replace-activity` | Replace one slot (`morning`, `lunch`, `afternoon`, `evening`) |
| POST | `/api/recommendations` | Three destination cards for a vibe/budget/interests/season |
| POST | `/api/export/pdf` | Itinerary as a PDF file |

Errors always look like `{"detail": {"code": "...", "message": "..."}}` with a friendly message (e.g. `rate_limited`, `invalid_api_key`, `validation_error`).

---

## 13. How it works

- **Validation:** every request and every AI answer passes through Pydantic models (`backend/schemas.py`). Out-of-range days, unknown vibes, bad dates and so on return friendly 422 errors. AI answers are cleaned (costs like `"1,200"` become numbers, unknown categories become `sightseeing`).
- **The AI never controls the numbers that matter.** After any itinerary is produced (AI or demo), `finalize.py` recomputes dates, per-day totals, local-currency text, the budget summary and the disclaimer, so totals always add up and the label is always present.
- **Nearby stops:** the prompt asks the AI to keep each day in one area; demo data is split into three areas and each day uses one. Real distances are **not** calculated.
- **Budget maths:** accommodation (first suggested stay × nights) + food + activities + a rough 12% allowance for transport and extras. Demo prices are scaled by tier (Budget ×0.7, Moderate ×1, Luxury ×1.8).
- **Partial edits:** *regenerate day* and *replace activity* send the current itinerary to the backend and swap only the chosen part. In AI mode these call the AI; if it fails you get a clear error (no random demo content is swapped into an AI trip).
- **Storage:** `frontend/src/store.js` has two interchangeable stores: browser `localStorage`, or Supabase when you are signed in.
- **Secrets:** the Groq key lives only in `backend/.env` / Render. The browser only ever sees the public Supabase key and the API address.

---

Made as a learning project. MIT licensed (see `LICENSE`).

---

## Extra demo: Streamlit version

A single-file Streamlit app (`streamlit_app.py`) reuses the backend code and can be deployed for free on
Streamlit Community Cloud as a public link. Steps: see [DEPLOY_STREAMLIT.md](DEPLOY_STREAMLIT.md).

Live demo: `https://<your-app-name>.streamlit.app` (replace after deploying)
