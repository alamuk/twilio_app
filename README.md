# Twilio Dialer Frontend (Vite + React)

Minimal UI for your FastAPI/Lambda dialer.

## Quick start

```bash
cd frontend
npm i
cp .env.example .env     # optional; you can also set values in the UI
npm run dev
```

Then open http://localhost:5173 and set **API Base** if not pre-filled.

## Production notes
- Add your site origin to `AllowedOrigins` in SAM and deploy the backend.
- Host this folder on S3 + CloudFront or any static host.
- The app stores small bits (API base, from pool, agent) in `localStorage` per browser.
- Export call history as CSV from the UI.
