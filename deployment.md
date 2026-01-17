# Deployment Guide: GoalPulse

This guide explains how to deploy GoalPulse to Vercel with a PostgreSQL database.

## Prerequisites
- A GitHub repository with the GoalPulse code pushed.
- A Vercel account.
- An OpenAI API key.

---

## Step 1: Prepare the Code
Ensure all changes are pushed to your GitHub repository:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin master
```

---

## Step 2: Deploy the Backend
1. Log in to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your **GoalPulse** repository.
4. **Configure Project:**
   - **Project Name:** `goalpulse-backend`
   - **Root Directory:** Select `backend`.
   - **Framework Preset:** FastAPI.
   - **Environment Variables:**
     - `OPENAI_API_KEY`: Your OpenAI API key.
5. Click **Deploy**.
6. Note your backend URL (e.g., `https://goalpulse-backend.vercel.app`).

---

## Step 3: Set up Vercel Postgres
1. In your `goalpulse-backend` project on Vercel, go to the **Storage** tab.
2. Click **Connect Store** -> **Postgres** -> **Create**.
3. Once created, go to **Settings** -> **Environment Variables**.
4. Copy the value of `POSTGRES_URL_NON_POOLING`.
5. Create a new environment variable:
   - **Name:** `DATABASE_URL`
   - **Value:** Paste the copied URL, but **change the prefix** from `postgres://` to `postgresql+asyncpg://`.
6. Go to **Deployments** -> **Redeploy** to apply the new database connection.

---

## Step 4: Initialize the Database (Run Migrations)
To create the tables in your production database, run this command from your local `backend/` directory:

```bash
# Replace <PROD_DB_URL> with your DATABASE_URL from Vercel
# Ensure it uses the postgresql+asyncpg:// prefix

# Windows PowerShell:
$env:DATABASE_URL="<PROD_DB_URL>"; .\venv\Scripts\python -m alembic upgrade head

# Mac/Linux:
DATABASE_URL="<PROD_DB_URL>" ./venv/bin/python -m alembic upgrade head
```

---

## Step 5: Deploy the Frontend
1. Go back to the Vercel Dashboard home.
2. Click **Add New...** -> **Project**.
3. Import the **GoalPulse** repository again.
4. **Configure Project:**
   - **Project Name:** `goalpulse-frontend`
   - **Root Directory:** Select `frontend`.
   - **Framework Preset:** Next.js.
   - **Environment Variables:**
     - `NEXT_PUBLIC_API_URL`: Your backend URL from Step 2 (e.g., `https://goalpulse-backend.vercel.app`).
5. Click **Deploy**.

---

## Verified Architecture
- **Frontend**: Next.js (App Router) -> Vercel
- **Backend**: FastAPI -> Vercel Functions
- **Database**: Vercel Postgres (Serverless)
- **Migrations**: Alembic (SQLAlchemy 2.0)
