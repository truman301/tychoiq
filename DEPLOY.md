# Deploying TychoIQ to tychoiq.com

This guide takes the app from your machine to a live, HTTPS website at **tychoiq.com** with PostgreSQL and multi-user accounts.

The recommended host is **Railway** (persistent Node server + managed Postgres in one place — the right shape for a real prospecting product that will eventually run long, nationwide background scans). A **Render** alternative and a **VPS** outline follow.

---

## 0. One-time prep (5 min)

You'll need accounts (free tiers are fine to start):
- **GitHub** — to hold the code (Railway/Render deploy from a repo).
- **Railway** (railway.app) — hosting + Postgres.

### Push the code to GitHub

From the project folder (`C:\Users\TRUMAN\Desktop\TMA`):

```bash
git init
git add .
git commit -m "TychoIQ initial"
# create an EMPTY repo named tychoiq on github.com first, then:
git branch -M main
git remote add origin https://github.com/<your-username>/tychoiq.git
git push -u origin main
```

> `.env`, `node_modules`, and `*.db` are gitignored — secrets are **not** committed. You'll set them in the host dashboard instead.

---

## 1. Deploy on Railway (recommended)

1. **New Project → Deploy from GitHub repo →** pick `tychoiq`. Railway detects the `Dockerfile` and `railway.json` and builds the image.
2. **Add Postgres:** in the project, **+ New → Database → PostgreSQL**. Railway creates it and exposes a `DATABASE_URL`.
3. **Set environment variables** on the web service (Variables tab):
   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Reference the Postgres plugin: `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | A long random string — run `openssl rand -base64 48` locally and paste it |
   | `APP_URL` | `https://tychoiq.com` |
   | `MOCK_MODE` | `true` (until you wire real API keys — see README) |
   | `NODE_ENV` | `production` |
   | `DISABLE_SIGNUP` | `false` (or `true` to lock it to invited users) |
4. **Deploy.** On boot, `docker-entrypoint.sh` runs `prisma db push` to create the tables, then starts the server. Watch the deploy logs until it's live on the temporary `*.up.railway.app` URL.
5. **Create your account:** open the temporary URL → **Create one** → sign up. That first account gets its own workspace. (Optionally then set `DISABLE_SIGNUP=true` to make it invite-only.)

### Attach tychoiq.com

1. Railway service → **Settings → Networking → Custom Domain → add `tychoiq.com`** (and `www.tychoiq.com`). Railway shows you a **CNAME target** (e.g. `xxxx.up.railway.app`).
2. At your **domain registrar's DNS** settings for tychoiq.com, add:
   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `www` | the Railway target |
   | ALIAS/ANAME (or CNAME) | `@` (root) | the Railway target |
   - If your registrar doesn't support ALIAS/ANAME on the root, use their **forwarding** to send `tychoiq.com` → `www.tychoiq.com`, or move DNS to Cloudflare (free) which supports CNAME flattening on the root.
3. Wait for DNS to propagate (minutes to ~an hour). Railway auto-provisions a **Let's Encrypt HTTPS certificate**. Done — `https://tychoiq.com` is live.

> After the domain is attached, make sure `APP_URL=https://tychoiq.com` so session cookies are issued with the `Secure` flag.

---

## 2. Render (alternative)

The repo includes `render.yaml` (a Blueprint).
1. Render Dashboard → **New → Blueprint → connect the repo.** It provisions the Docker web service + a Postgres database and wires `DATABASE_URL` automatically.
2. Set `APP_URL=https://tychoiq.com` and confirm `AUTH_SECRET` (the blueprint auto-generates one).
3. **Settings → Custom Domains → add tychoiq.com**, then create the CNAME/ALIAS records Render shows at your registrar. HTTPS is automatic.

---

## 3. VPS (full control, optional)

On an Ubuntu box with Docker:
```bash
git clone https://github.com/<you>/tychoiq.git && cd tychoiq
docker compose up -d                # starts Postgres (+ Redis)
# build & run the app image
docker build -t tychoiq .
docker run -d --name tychoiq --env-file .env -p 3000:3000 tychoiq
```
Put **nginx** (or Caddy) in front for TLS: point `tychoiq.com`'s A record at the server IP, then terminate HTTPS with Caddy (`tychoiq.com { reverse_proxy localhost:3000 }`) or certbot + nginx. Set `APP_URL=https://tychoiq.com`.

---

## 4. Going beyond mock data (nationwide scanning)

The site is live in **mock mode** — fully functional for demos and for users to build ICPs and train. To do real nationwide discovery:

1. Add provider keys as env vars (`BRAVE_SEARCH_API_KEY`, `GOOGLE_PLACES_API_KEY`, etc.) and set `MOCK_MODE=false`. CMS/NPPES are public (no key).
2. Implement the `TODO(real-api)` branch in each connector (`src/lib/connectors/sourceConnectors.ts`).
3. For large US-wide scans, move scanning off the request path: add **Redis** (Railway plugin) and a **BullMQ worker** service that consumes a `scans` queue and calls `runScan(scanId)`. The `runScan()` function is already the single seam to hand off to a worker. Run the worker as a second Railway service from the same image with a different start command.

---

## Operational notes

- **Migrations:** the container runs `prisma db push` on boot (idempotent). For versioned history, switch to `prisma migrate deploy` and commit a migration with `npx prisma migrate dev --name init`.
- **Secrets:** rotate `AUTH_SECRET` only when you intend to log everyone out (it invalidates all sessions).
- **Backups:** enable automated Postgres backups in the host dashboard before real data lands.
- **Seed (optional):** to load the demo project on a fresh prod DB, run `npm run db:seed` against the prod `DATABASE_URL` once (creates `demo@tychoiq.com / demo12345` — delete or change it for production).
