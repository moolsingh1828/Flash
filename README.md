# Telegram Course Library

A local-first, free-first MERN stack video course management catalog and streaming player connected to authorized Telegram channels.

## Setup Instructions

1. Configure environment:
   ```bash
   cp .env.example server/.env
   ```
   Edit `server/.env` with your `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `MONGODB_URI`.

2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Run MongoDB:
   ```bash
   docker compose up -d
   ```

4. Start both client and server:
   ```bash
   npm run dev
   ```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
