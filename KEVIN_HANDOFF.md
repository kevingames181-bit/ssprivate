# SeaScope V1 Handoff

Prepared for Kevin.

## What is included

- Full SeaScope source code.
- Public map and movement data assets.
- Latest built `dist` output.
- `package.json` and `package-lock.json` for exact dependency installation.
- Project config files needed for local development and production builds.

## What is intentionally not included

- `node_modules`
- `.git`
- `.env`
- `.env.production`
- `backend/.env`
- local editor/cache folders
- old backup folders

Private environment values should be shared separately if Kevin needs them.

## Start locally

Install frontend dependencies from the project root:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create runtime env files from the examples:

```bash
copy .env.example .env
cd ..
copy .env.example .env
```

The movement tab needs the backend proxy running because the official movement
data key is server-side. In `backend/.env`, set:

```text
PORT=3001
RMIS_API_KEY=<private key>
```

In the root `.env`, keep:

```text
VITE_API_URL=/api
```

Run the backend in one terminal:

```bash
cd backend
npm run dev
```

Run the frontend in a second terminal from the project root:

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173/map
```

## Build check

```bash
npm run build
```

The V1 handoff build passed before packaging.
