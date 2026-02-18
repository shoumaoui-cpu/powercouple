# PowerCouple Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Docker and Docker Compose (for PostgreSQL + PostGIS)
- An EIA API key (free: https://www.eia.gov/opendata/register.php)

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
npm install

# Prisma client generation
npx prisma generate

# Python backend (in a virtual environment)
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cd ..
```

### 2. Set Up Environment

```bash
cp env.example .env
# Edit .env and add your EIA_API_KEY
```

### 3. Start Database

```bash
docker compose up db -d
```

Wait for PostgreSQL to be healthy, then run migrations:

```bash
npx prisma db push
```

### 4. Run Data Pipeline

```bash
cd backend
python -m data_pipeline.run_pipeline --skip-pvgis  # skip PVGIS for fast first run
cd ..
```

This will:
- Download EIA-860 and EIA-923 data
- Parse and load ~1,000+ US gas plants
- Load cost assumptions
- Load data center locations and run spatial join
- Compute preliminary LCOE estimates

To also fetch solar profiles (slower, ~200 API calls):

```bash
cd backend
python -m data_pipeline.run_pipeline
cd ..
```

### 5. Start the Application

```bash
# Terminal 1: Start FastAPI backend
docker compose up fastapi -d
# Or run directly:
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2: Start Next.js frontend
npm run dev
```

Open http://localhost:3000

### 6. Verify

- Map should show gas plant bubbles across the US
- Sidebar filters should be functional
- Clicking a plant should open the detail panel
- "Run Optimization" should call the Python backend

## Architecture

```
Browser (localhost:3000)
    |
    v
Next.js (App Router)
    |-- /api/plants    -> Prisma -> PostgreSQL + PostGIS
    |-- /api/regions   -> Prisma -> PostgreSQL
    |-- /api/optimize  -> FastAPI (localhost:8000) -> HiGHS solver
    |
    v
MapLibre GL (Carto dark tiles)
```

## Project Structure

- `src/` - Next.js frontend (TypeScript, React, Tailwind)
- `backend/` - Python backend (FastAPI, PuLP/HiGHS optimization)
- `prisma/` - Database schema and migrations
- `data/` - Raw EIA data and processed files
- `docker-compose.yml` - PostgreSQL + PostGIS + FastAPI services
