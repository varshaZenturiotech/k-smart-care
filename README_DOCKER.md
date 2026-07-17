# K-SMART CARE Docker Deployment Guide

This guide provides instructions for deploying the K-SMART CARE platform inside Docker containers using Docker Compose. The setup is configured for production and supports easy deployment on any Linux server (AWS EC2, Oracle Cloud, Azure VM, DigitalOcean, GCP, etc.).

## Prerequisites

Ensure you have the following installed on your target server:
- Docker (v20.10+)
- Docker Compose (v2.0+)

---

## Configuration

1. Copy the example environment file:
   ```bash
   cp backend/.env.example .env
   ```
2. Open the `.env` file and set the credentials:
   - `GROQ_API_KEY`: Required for AI Daily Briefings.
   - `JWT_SECRET`: A long, random string to secure authentication.
   - `MONGO_ROOT_USER` & `MONGO_ROOT_PASSWORD`: Credentials for the Mongo container (optional, defaults to `admin` / `adminpassword`).

---

## Commands Reference

### 1. Build Containers
Build the frontend, backend, and configuration images:
```bash
docker compose build
```

### 2. Start Services
Run the containers in the background (detached mode):
```bash
docker compose up -d
```
After running this, the application will be accessible at `http://SERVER_IP` (port 80).

### 3. Stop Services
Stop and remove all running containers and networks (preserving volumes):
```bash
docker compose down
```

### 4. View Logs
View real-time, aggregated logs for all services:
```bash
docker compose logs -f
```
Or for a specific service (e.g., `backend`):
```bash
docker compose logs -f backend
```

### 5. Restart Services
Restart the entire stack or a single container:
```bash
docker compose restart
```

### 6. View Running Status
Check the health status of all containers:
```bash
docker compose ps
```
Or list all docker processes:
```bash
docker ps
```

---

## Volumes & Data Persistence

To prevent data loss, the following volumes are declared in `docker-compose.yml`:
- `mongodb_data`: Persists all user accounts, tasks, meetings, wellness logs, and cached briefings.
- `circular_uploads`: Persists uploaded Government Circular PDFs in `/app/uploads`.
- `embedding_cache`: Caches downloaded Hugging Face embedding models to prevent repeated downloads on restart.

---

## Troubleshooting

- **Check Mongo Connection**: If the backend fails to connect, ensure that `MONGO_URI` in `.env` matches the `mongodb` service host and ports configured in `docker-compose.yml`.
- **Rebuilding after frontend edits**: If you make any frontend changes, rebuild the image:
  ```bash
  docker compose build frontend
  docker compose up -d --no-deps frontend
  ```
