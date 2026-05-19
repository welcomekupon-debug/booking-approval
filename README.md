# Booking Approval App

A mobile-friendly web app to review and approve or decline pending bookings, backed by a Google Sheet as the database.

Built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and the **Google Sheets API**.

---

## Features

- Reads pending bookings from a Google Sheet in real time
- Confirm or Decline each booking with one tap
- Updates `Status` and `DecisionTimestamp` columns in the sheet instantly
- Responsive card grid (1 column mobile → 2 columns tablet+)
- Deployable to Vercel in minutes

---

## Google Sheet Setup

### 1. Create the Sheet

Create a new Google Sheet with the following header row in **row 1**:

| A          | B            | C           | D           | E      | F                  |
|------------|--------------|-------------|-------------|--------|--------------------|
| BookingID  | CustomerName | BookingDate | BookingTime | Status | DecisionTimestamp  |

Add some sample rows with `Status = Pending` to test:

```
B001  Jane Smith   2026-05-20  10:00  Pending
B002  John Doe     2026-05-21  14:30  Pending
```

### 2. Note the Spreadsheet ID

Your Sheet URL looks like:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```
Copy the `SPREADSHEET_ID` — you'll need it in step 5.

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

### 7. Share the Sheet with the Service Account

1. Open your Google Sheet
2. Click **Share** (top right)
3. Paste the `client_email` value (e.g. `booking-sheets-sa@your-project.iam.gserviceaccount.com`)
4. Set permission to **Editor** → click **Send**

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
GOOGLE_SHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEET_NAME=Sheet1

GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nABC...XYZ\n-----END RSA PRIVATE KEY-----\n"
```

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
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SHEET_NAME`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` — paste the key with `\n` for newlines (Vercel handles this automatically when you paste multi-line values in the UI)
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
│   ├── components/
│   │   └── BookingCard.tsx           # Individual booking card
│   ├── lib/
│   │   └── sheets.ts                 # Google Sheets API helpers
│   └── types/
│       └── booking.ts                # Shared TypeScript types
├── .env.example
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## API Reference

### `GET /api/bookings`

Returns all rows where `Status === "Pending"`.

**Response**
```json
{
  "bookings": [
    {
      "rowIndex": 2,
      "bookingId": "B001",
      "customerName": "Jane Smith",
      "bookingDate": "2026-05-20",
      "bookingTime": "10:00",
      "status": "Pending",
      "decisionTimestamp": ""
    }
  ]
}
```

### `PATCH /api/bookings/:rowIndex`

Updates the `Status` and `DecisionTimestamp` for the given sheet row.

**Body**
```json
{ "status": "Confirmed" }
```
or
```json
{ "status": "Declined" }
```

**Response**
```json
{ "success": true, "status": "Confirmed" }
```
