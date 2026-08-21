# BlueDental

Starter application for dental clinic management, built with ASP.NET Core 9, React, PostgreSQL, and Docker.

## Features

- Patient registration and listing
- Appointment domain model with dentist, status, and treatment reason
- Dashboard API for patient and appointment counts

## Run with Docker

```bash
docker compose up --build
```

Open the web app at `http://localhost:5173`. The API runs at `http://localhost:8080`.

## Project structure

- `backend/src/BlueDental.Api`: ASP.NET Core REST API and EF Core data model
- `frontend`: React + TypeScript dashboard
- `docker-compose.yml`: PostgreSQL, API, and web application containers
