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

## Phase 5: Cloudflare Zero Trust / Access Protection

Secure your live Railway-deployed TCG Intelligence Platform behind Cloudflare Access using Google Workspace / Google Login authentication. This blocks unauthorized external traffic before it ever reaches your frontend routes or server.

### 1. DNS & Custom Domain Setup
Cloudflare Access operates on proxied custom domains. You must route your application through a custom domain hosted on Cloudflare with **Proxied (Orange Cloud)** enabled.

1. **Cloudflare DNS Setup**:
   - Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - Select your domain and go to **DNS > Records**.
   - Add a new record:
     - **Type**: `CNAME`
     - **Name**: `tcg` (for `tcg.yourdomain.com`) or `@` (for root)
     - **Target**: Your raw Railway app domain (e.g., `lotteryiq-production.up.railway.app`)
     - **Proxy status**: **Proxied (Orange Cloud)** (Critical!)
     - **TTL**: `Auto`
   - Click **Save**.

2. **Railway Networking Setup**:
   - Log in to your [Railway Dashboard](https://railway.app/).
   - Go to your service and click **Settings > Networking**.
   - Under **Domains**, click **Custom Domain**.
   - Enter your domain (e.g., `tcg.yourdomain.com`).
   - Railway will automatically detect the CNAME and provision a Let's Encrypt SSL certificate.

---

### 2. Cloudflare Zero Trust Application Setup
Create a secure access gateway that wraps your custom domain.

1. Navigate to the **Cloudflare Zero Trust Console** ([dash.teams.cloudflare.com](https://dash.teams.cloudflare.com/)).
2. Go to **Access > Applications** and click **Add an application**.
3. Select **Self-hosted**.
4. Configure **Application Configuration**:
   - **Application Name**: `TCG Intelligence Platform`
   - **Session Duration**: `24 Hours` (or your choice of duration)
   - **Application Domain**:
     - **Subdomain**: `tcg`
     - **Domain**: `yourdomain.com` (Select your domain from the dropdown)
     - **Path**: Leave blank (protects all paths/routes)
5. Under **App Launcher Appearance**, you can leave defaults. Click **Next**.

---

### 3. Identity Provider Setup (Google Login)
Integrate Google login authentication without touching any backend code or database tables.

1. In the Zero Trust Console, go to **Settings > Authentication**.
2. Under **Login methods**, click **Add new** and select **Google**.
3. To fill in the **Client ID** and **Client Secret**, go to the [Google Cloud Console](https://console.cloud.google.com/):
   - Create a project (or select an existing one).
   - Go to **APIs & Services > OAuth consent screen**. Configure it as **External** or **Internal**, fill in the required fields, and save.
   - Go to **APIs & Services > Credentials** and click **Create Credentials > OAuth client ID**.
   - Select **Web application** as the application type.
   - In **Authorized redirect URIs**, add the callback URI displayed in your Cloudflare Zero Trust Google provider configuration. It looks like:
     `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
   - Click **Create** and copy the generated **Client ID** and **Client Secret**.
4. Paste the credentials into the Cloudflare Zero Trust setup page and click **Save**.

---

### 4. Access Policy Setup
Restrict access strictly to approved email addresses.

1. On the **Access Policy** tab (Step 2 of application configuration):
   - **Policy Name**: `Allow Approved Administrators`
   - **Action**: `Allow`
   - **Session Duration**: Same as application (`24 Hours`).
2. Under **Create a rule**:
   - **Rule Type**: `Include`
   - **Selector**: `Emails`
   - **Value**: Enter your approved emails (e.g., `dwain@shumisphere.com`, `admin@example.com`).
   - *(Optional)* If you want to allow a whole domain:
     - **Selector**: `Emails ending in`
     - **Value**: `shumisphere.com`
3. Click **Next** to proceed to the final page (Setup), leave additional headers blank, and click **Add Application**.

---

### 5. Recommended Security Notes

> [!IMPORTANT]
> **Securing the Raw Railway URL**
> Cloudflare Zero Trust only protects requests that arrive via your custom domain (`tcg.yourdomain.com`). The raw Railway domain (`*.up.railway.app`) remains publicly accessible! To completely lock down your application, follow one of these practices:

1. **Option A: Header Validation in Express Backend (Recommended)**:
   - When a user passes through Cloudflare Access, Cloudflare signs and forwards a JSON Web Token (JWT) in the header `Cf-Access-Jwt-Assertion`.
   - You can update `server.ts` to reject any incoming request that does not have a valid `Cf-Access-Jwt-Assertion` header. This completely blocks direct access to `*.up.railway.app` without needing complex setup.
   
2. **Option B: Cloudflare Transform Rules**:
   - In Cloudflare, create an HTTP Request Header modification rule that injects a secret token header (e.g., `X-From-Cloudflare: some-long-random-secret`).
   - In Railway environment variables, configure this token as `SHUMI_GATEWAY_TOKEN`.
   - In `server.ts`, reject requests where the header does not match the secret token.
   
3. **Option C: Remove Raw Railway Public Domain**:
   - If your setup routes all assets perfectly, you can simply unbind the public Railway domain so only your custom domain is bound to the port.

---

## Verification Checklist

- [ ] Can you log in to the Admin Dashboard on the live site?
- [ ] Do statistics load on the home page?
- [ ] Does "Execute Neural Extraction" work?
- [ ] Are images showing up correctly in the Terminal?
- [ ] Does accessing `https://tcg.yourdomain.com` present the Cloudflare Access Google Login page?
- [ ] Are unauthorized emails correctly blocked from accessing the site?
- [ ] Does the Terminal homepage properly hide closed lotteries and order active states chronologically?
