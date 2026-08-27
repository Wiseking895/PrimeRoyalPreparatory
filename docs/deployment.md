# PRPS — Production Deployment Guide

**Phase:** 9 (complete)

## Overview

PRPS consists of two independent applications deployed to Vercel:

| Service | Vercel project root | Framework | Purpose |
| --- | --- | --- | --- |
| Frontend | `frontend/` | Vite | Public website + PWA + portal UI |
| Backend | `backend/` | Express | REST API + Prisma + PostgreSQL |

The frontend and backend are deployed as **separate Vercel projects** that communicate over HTTPS.

## Prerequisites

- Vercel account (Hobby, Pro or Enterprise)
- PostgreSQL database (Vercel Postgres, Neon, Supabase, Railway, or any PostgreSQL host)
- The repository pushed to GitHub

---

## Step 1 — Deploy the Backend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. **Root Directory:** Set to `backend`
4. **Framework Preset:** Express
5. **Build Command:** (leave default — Vercel auto-detects)
6. **Output Directory:** (leave default)
7. Click **Deploy** (it will fail on first deploy — that is expected because env vars are missing)

### Backend Environment Variables

In the Vercel backend project, go to **Settings → Environment Variables** and add:

| Name | Value | Environment |
| --- | --- | --- |
| `NODE_ENV` | `production` | Production, Preview |
| `DATABASE_URL` | `<your PostgreSQL connection string>` | Production, Preview |
| `JWT_SECRET` | `<a secure random string, 32+ characters>` | Production, Preview |
| `CLIENT_URL` | `https://<your-frontend-vercel-url>` | Production, Preview |

**Important:**

- `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname?schema=public`
- `JWT_SECRET` — generate a strong random string (e.g. `openssl rand -base64 48`)
- `CLIENT_URL` — the exact frontend URL (used for CORS). Must include `https://` and no trailing slash.
- `CLIENT_URL` can be comma-separated for multiple origins if needed.

### Run Database Migrations

Before the backend can serve traffic, the database must be migrated:

```bash
# From the repository root
cd backend
npx prisma migrate deploy
```

Or if using the workspace:

```bash
npm run db:deploy
```

This applies all migrations (including Phase 8 GPS attendance and Phase 9 notifications).

### Redeploy

After setting environment variables, trigger a redeploy in the Vercel dashboard.

### Verify Backend

Visit: `https://<your-backend-vercel-url>/api/health`

Expected response:

```json
{
  "success": true,
  "message": "PRPS API is running",
  "data": {
    "name": "PRPS API",
    "version": "0.1.0",
    "uptime": ...,
    "timestamp": "..."
  }
}
```

---

## Step 2 — Deploy the Frontend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the **same** GitHub repository
3. **Root Directory:** Set to `frontend`
4. **Framework Preset:** Vite
5. Click **Deploy**

### Frontend Environment Variables

In the Vercel frontend project, go to **Settings → Environment Variables** and add:

| Name | Value | Environment |
| --- | --- | --- |
| `VITE_API_URL` | `https://<your-backend-vercel-url>` | Production, Preview |

**Important:**

- `VITE_API_URL` must be the backend **origin only** (e.g. `https://prps-backend-xxxxx.vercel.app`)
- Do NOT include `/api` at the end — the frontend already prepends `/api` to every request
- Do NOT use `http://` — always use `https://`
- Do NOT use `localhost` in production

### Redeploy Frontend

After adding `VITE_API_URL`, the frontend **must be redeployed** because Vite embeds environment variables at build time.

### Verify Frontend → Backend Connectivity

Visit: `https://<your-frontend-vercel-url>/setup/owner`

The page should load without "Something went wrong" and either:
- Show the Owner setup form (if no Owner exists yet), or
- Show "Setup is already complete" (if an Owner has been created)

---

## Step 3 — Create the First Owner

1. Open `https://<your-frontend-vercel-url>/setup/owner`
2. Fill in the form:
   - Full name
   - Email (this becomes the Owner login)
   - Phone (optional)
   - Password (at least 8 characters, including a letter and a number)
3. Click **Create Owner account**
4. You will be redirected to the login page

---

## Step 4 — Login

1. Open `https://<your-frontend-vercel-url>/login`
2. Enter the email and password created in Step 3
3. Click **Sign In**
4. You should be redirected to the Owner dashboard at `/owner/dashboard`

---

## Step 5 — Verify Owner Dashboard

After login, verify:
- Owner dashboard loads with summary statistics
- Headteacher management is accessible (`/owner/headteacher`)
- All portal navigation works

---

## Owner → Headteacher Flow

After the Owner is logged in:

1. Navigate to **Headteacher** in the sidebar
2. Click **Create Headteacher**
3. Fill in the headteacher details
4. The system creates the account with a temporary password and emails the invitation
5. The Headteacher logs in with the temporary password and is prompted to change it

**Note:** Email functionality requires `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD` and `EMAIL_FROM` to be configured on the backend. Without these, the invitation is logged to the server console instead of being emailed.

---

## CORS Configuration

The backend CORS is controlled by the `CLIENT_URL` environment variable:

- In **production** (`NODE_ENV=production`): only origins listed in `CLIENT_URL` are allowed
- In **development**: all origins are allowed (CORS is permissive)

If the frontend is blocked by CORS, verify:
1. `CLIENT_URL` is set on the backend
2. The value exactly matches the frontend URL (including `https://` and no trailing slash)
3. Multiple origins can be comma-separated

---

## Environment Variable Reference

### Backend (Vercel project)

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | Must be `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Strong random string for JWT signing |
| `CLIENT_URL` | Yes | Frontend origin(s) for CORS (comma-separated) |
| `PORT` | No | Defaults to 4000 (ignored in Vercel serverless) |
| `EMAIL_ENABLED` | No | Set to `true` to enable real email delivery |
| `EMAIL_HOST` | No | SMTP server hostname |
| `EMAIL_PORT` | No | SMTP port (default: 587) |
| `EMAIL_USER` | No | SMTP username |
| `EMAIL_PASSWORD` | No | SMTP password |
| `EMAIL_FROM` | No | Sender address (e.g. `PRPS <no-reply@school.com>`) |

### Frontend (Vercel project)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Backend origin URL (e.g. `https://prps-backend.vercel.app`) |

**Never put secrets in `VITE_*` variables** — they are embedded in the browser bundle.

---

## Troubleshooting

### "Something went wrong. Please try again."

**Cause:** The frontend cannot reach the backend.

**Fix:**
1. Verify `VITE_API_URL` is set in the frontend Vercel project
2. Redeploy the frontend after setting the variable (Vite embeds it at build time)
3. Verify the backend is deployed and reachable: visit `<backend-url>/api/health`
4. Check that `NODE_ENV=production` is set on the backend

### CORS errors in browser console

**Cause:** The backend does not allow the frontend origin.

**Fix:**
1. Verify `CLIENT_URL` is set on the backend
2. Ensure it exactly matches the frontend URL (e.g. `https://prime-royal-preparatory-frontend-six.vercel.app`)
3. Redeploy the backend after setting the variable

### Backend returns 500 on /api/setup/status

**Cause:** Database not migrated or DATABASE_URL incorrect.

**Fix:**
1. Verify `DATABASE_URL` is set correctly on the backend
2. Run `npx prisma migrate deploy` from the `backend/` directory
3. Check the Vercel function logs for error details

### "Initial owner setup has already been completed."

**Cause:** An Owner account already exists in the database.

**Fix:** This is expected if the Owner was already created. Use the login page instead.

### "Owner role is not configured."

**Cause:** The RBAC catalog has not been seeded.

**Fix:** The Owner setup flow calls `ensureInitialRbac()` automatically. If this fails, run the database seed:
```bash
cd backend && npm run db:seed
```
