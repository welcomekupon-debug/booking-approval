# Bookline — Premium Appointment Management

A **multi-tenant** SaaS platform where each of your business clients signs in (via Clerk) and manages *their own* appointments — backed entirely by Google Sheets (no database needed).

Built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, **Clerk Authentication**, and the **Google Sheets API**.

## What's inside (v2.0 redesign)

- **Premium dashboard** — 10 stat cards (today, upcoming, pending, confirmed, cancelled, revenue, new/repeat customers, occupancy, weekly trend) with trend indicators, an animated booking-volume area chart, status donut, peak-hours bars, today's schedule, and recent activity
- **Calendar** — day / week / month views, drag-and-drop rescheduling (saved straight to the sheet), color-coded statuses, hover details, click-to-edit, calendar search
- **Appointment management** — rich cards with phone, service, duration, notes, price and staff; confirm / decline / reschedule / contact quick actions; saved filters
- **Customers** — profiles derived automatically from bookings, appointment history, lifetime value, tags, VIP flags, private notes, search
- **Onboarding wizard** — 9-step guided setup for new clients (business info → logo → hours → staff → services → durations → booking settings → notifications → launch)
- **Notification center** — new requests, confirmations, cancellations, reminders, missed appointments
- **Analytics** — 12-month trends, monthly growth, revenue, retention, popular services, peak hours, staff performance, CSV export
- **Global search** — ⌘K command palette across customers, appointments, services and staff
- **Settings** — business profile, branding, working hours, holidays, staff, services, booking preferences, email/SMS notification switches, security (Clerk), billing
- **Extras** — dark mode, keyboard shortcuts (⌘K search, `G`+key navigation, `T` theme), loading skeletons, empty states, micro-animations, fully responsive

### New spreadsheet schema

Booking sheets gained optional columns **H–M** (old rows keep working — blanks are fine):

| H     | I       | J        | K     | L     | M     |
|-------|---------|----------|-------|-------|-------|
| Phone | Service | Duration | Notes | Price | Staff |

Four tabs are **auto-created** in each client's spreadsheet on first load: `Services`, `Staff`, `Settings`, `Customers`. You don't need to set these up manually.

---

## Features

- Each client logs in with Clerk and sees only **their own** bookings
- A master **"Clients" spreadsheet** (yours) maps each client's login email to their personal bookings spreadsheet
- Confirm or Decline each booking with one tap — instantly updates `Status` in the client's sheet
- Responsive card grid (1 column mobile → 2 columns tablet+)
- Deployable to Vercel in minutes

---

## How multi-tenancy works

This app uses **two kinds of spreadsheets**:

1. **Your master "Clients" spreadsheet** — one row per client (business) who logs into the app. It maps each client's login email to the spreadsheet that holds *their* bookings.
2. **Each client's own bookings spreadsheet** — a separate Google Sheet per client (e.g. the one your client uses to track their customers' appointments).

When a client signs in:
1. The app reads their email from Clerk
2. Looks up that email in your **Clients** spreadsheet
3. Finds the `SpreadsheetID` / `SheetName` for that client
4. Reads/writes bookings **only** in that client's own spreadsheet

This keeps every client's data completely isolated — they never see anyone else's bookings.

---

## Google Sheets Setup

### 1. Create the master "Clients" spreadsheet (yours)

Create a new Google Sheet — this is **your** spreadsheet, not a client's. Add this header row in **row 1**:

| A          | B            | C             | D         | E      | F      |
|------------|--------------|---------------|-----------|--------|--------|
| ClientName | ClientEmail  | SpreadsheetID | SheetName | Phone  | Notes  |

- **ClientName** — the business/person's name (for your reference)
- **ClientEmail** — the email address they use to log in (must match their Clerk account email)
- **SpreadsheetID** — the ID of *that client's* bookings spreadsheet (see step 3)
- **SheetName** — the tab name in that spreadsheet that holds their bookings (e.g. `Sheet1`)
- **Phone** / **Notes** — optional extra profile info

Example row:
```
Acme Salon   acme@example.com   1A2b3C4d5E...xyz   Sheet1   555-0100   VIP client
```

Note this spreadsheet's ID from its URL (`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`) — you'll set it as `GOOGLE_CLIENTS_SHEET_ID`.

### 2. Create (or reuse) each client's bookings spreadsheet

Each client needs their own spreadsheet with this header row in **row 1**:

| A   | B     | C     | D   | E      | F          |
|-----|-------|-------|-----|--------|------------|
| Ime | Gmail | Datum | Ura | Status | Bookingid  |

Add sample rows with `Status = Pending` to test:
```
Jane Smith   jane@example.com   2026-05-20   10:00   Pending   B001
John Doe     john@example.com   2026-05-21   14:30   Pending   B002
```

Copy this spreadsheet's ID from its URL and put it in the matching client's row in your **Clients** sheet (`SpreadsheetID` column).

> Repeat this step for every client — each gets their own spreadsheet and their own row in your Clients sheet.

---

## Google Cloud / Service Account Setup

### 3. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Give it a name (e.g. `booking-approval`) and create it

### 4. Enable the Google Sheets API

1. In your project, go to **APIs & Services → Library**
2. Search for **Google Sheets API**
3. Click **Enable**

### 5. Create a Service Account

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Fill in a name (e.g. `booking-sheets-sa`) and click **Create and Continue**
4. Skip the optional role/user steps → click **Done**

### 6. Generate a JSON Key

1. Click on your new service account in the list
2. Go to the **Keys** tab → **Add Key → Create new key → JSON**
3. A `.json` file will download — keep it safe, you need two fields from it:
   - `client_email`  → maps to `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key`   → maps to `GOOGLE_PRIVATE_KEY`

### 7. Share EVERY spreadsheet with the Service Account

The service account needs **Editor** access to:
- Your **master Clients spreadsheet**, AND
- **Every individual client's bookings spreadsheet**

For each spreadsheet:
1. Open it
2. Click **Share** (top right)
3. Paste the `client_email` value (e.g. `booking-sheets-sa@your-project.iam.gserviceaccount.com`)
4. Set permission to **Editor** → click **Send**

> Forgetting to share a client's spreadsheet is the most common cause of "Failed to fetch bookings" errors for that client.

---

## Local Development

### 8. Clone & Install

```bash
git clone <your-repo-url>
cd booking-approval
npm install
```

### 9. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Master Clients spreadsheet (yours) — maps login emails to each client's
# own bookings spreadsheet. See "Google Sheets Setup" step 1.
GOOGLE_CLIENTS_SHEET_ID=your_clients_spreadsheet_id_here
GOOGLE_CLIENTS_SHEET_NAME=Clients

GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nABC...XYZ\n-----END RSA PRIVATE KEY-----\n"

# Clerk Authentication (added by `clerk init` — already populated in your
# .env.local if you ran the setup script)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

> You do **not** need a single `GOOGLE_SHEET_ID` anymore — each client's spreadsheet ID/tab is looked up dynamically from your Clients sheet at request time.

> **Important:** The private key from the JSON file contains literal newline characters.
> When pasting into `.env.local`, replace each newline with `\n` so the entire key is on one line inside the quotes.

### 10. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

1. Push the project to a GitHub/GitLab repo
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. In **Environment Variables**, add:
   - `GOOGLE_CLIENTS_SHEET_ID`
   - `GOOGLE_CLIENTS_SHEET_NAME`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` — paste the key with `\n` for newlines (Vercel handles this automatically when you paste multi-line values in the UI)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Click **Deploy**

---

## Project Structure

```
booking-approval/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── bookings/
│   │   │       ├── route.ts          # GET  /api/bookings
│   │   │       └── [id]/
│   │   │           └── route.ts      # PATCH /api/bookings/:rowIndex
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Main UI (client component)
│   ├── 