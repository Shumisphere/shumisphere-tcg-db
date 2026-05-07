# Deployment Guide: TCG Intelligence Platform

This guide will walk you through deploying your application to **Supabase** (Database), **Railway** (Backend), and **Cloudflare Pages** (Frontend).

---

## Phase 1: Database (Supabase)

1. **Create Project**: Sign in to [Supabase](https://supabase.com/) and create a new project.
2. **Get Connection Strings**:
   - Go to **Project Settings > Database**.
   - Under **Connection string**, select **URI**.
   - **Transaction Mode (Pooled)**: Copy this as your `DATABASE_URL`. It will look like `postgres://...:6543/...`.
   - **Session Mode (Direct)**: Copy this as your `DIRECT_URL`. It will look like `postgres://...:5432/...`.
3. **Push Schema**:
   - In your local terminal, update your `.env` file with these strings.
   - Run: `npx prisma db push`
   - This will create the necessary tables in your Supabase database.

---

## Phase 2: Backend (Railway)

1. **Create Project**: Sign in to [Railway](https://railway.app/) and create a new project.
2. **Deploy from GitHub**:
   - Connect your GitHub repository.
   - Select the repository for this project.
3. **Set Environment Variables**:
   - Go to the **Variables** tab in your Railway service.
   - Add the following:
     - `DATABASE_URL`: (Your Supabase Pooled URL)
     - `DIRECT_URL`: (Your Supabase Direct URL)
     - `GEMINI_API_KEY`: (Your Google Gemini API key)
     - `SESSION_SECRET`: (A random string for session security)
     - `NODE_ENV`: `production`
4. **Deploy**: Railway will automatically detect the `package.json` and start the server using the `start` script we added.
5. **Copy App URL**: Once deployed, copy the provided URL (e.g., `https://your-app.up.railway.app`).

---

## Phase 3: Frontend (Cloudflare Pages)

1. **Create Project**: Sign in to [Cloudflare](https://dash.cloudflare.com/) and go to **Workers & Pages > Create > Pages**.
2. **Connect GitHub**: Select your repository.
3. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Set Environment Variables**:
   - Go to **Settings > Variables and Secrets**.
   - Add a new variable:
     - `VITE_API_BASE_URL`: (The Railway URL you copied in Phase 2).
5. **Deploy**: Click **Save and Deploy**.

---

## Phase 4: Final Configuration (CORS)

If you encounter errors where the frontend cannot talk to the backend, ensure your Railway backend allows requests from your Cloudflare domain.

1. In Railway, go to your **Variables**.
2. Add `ALLOWED_ORIGINS` and set it to your Cloudflare Pages URL (e.g., `https://tcg-intel.pages.dev`).
3. (Optional) We can update `server.ts` to use this variable if you want to be more restrictive, but current setup uses `app.use(cors())` which allows all by default.

---

## Verification Checklist

- [ ] Can you log in to the Admin Dashboard on the live site?
- [ ] Do statistics load on the home page?
- [ ] Does "Execute Neural Extraction" work?
- [ ] Are images showing up correctly in the Terminal?
