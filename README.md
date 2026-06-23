# Gressus — Gait Feedback System

<table>
<tr>
<td width="58%" valign="top">

**Gressus** (Latin *step*, *progress*) is the clinical feedback module of **P-GEAR** — a gait exoskeleton-assisted rehabilitation system for children with cerebral palsy.

The operator runs clinical sessions from a web client. The backend stores patients and session records. A ROS runtime on the same machine controls the P.GEAR exoskeleton, runs sensor stacks, and writes session data to disk.

Demonstrated at **KIHE-2026** (Almaty, 20–22 May 2026).

</td>
<td width="42%" valign="top" align="right">

<img src="docs/media/demo.gif" alt="Gressus clinical demo" width="240" />

</td>
</tr>
</table>

## Tech Stack

### Backend
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

### Frontend
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### Runtime & Deploy
![ROS 2](https://img.shields.io/badge/ROS_2-22314E?style=for-the-badge&logo=ros&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## Quick start

Prerequisites: Docker, Docker Compose, `.env` (see `.env.example` if present).

```bash
docker compose up -d --build
```

| URL | Service |
|-----|---------|
| http://localhost:5173 | Web client |
| http://localhost:8000/api/health | Backend API |
| http://127.0.0.1:9090/session/status | Session manager (ROS container) |

<p align="center">
  <img src="docs/media/web-control-panel-screenshot.png" alt="Web control panel" width="640" />
</p>

Production-style frontend build: set `IS_DEBUG=false` in `docker-compose.yml` or compose env.

Interactive shell inside the ROS container:

```bash
docker compose exec ros2 bash
```

Stop everything:

```bash
docker compose down
```

Local development without Docker is possible per component — see linked docs below.

## Documentation

| Document | Contents |
|----------|----------|
| [docs/architecture.md](docs/architecture.md) | Frontend ↔ backend ↔ ROS, session lifecycle |
| [docs/BACKEND.md](docs/BACKEND.md) | FastAPI modules, runtime API, backend layout |
| [docs/ROS.md](docs/ROS.md) | Launch files, session manager, P.GEAR node |
| [backend/README.md](backend/README.md) | Backend coding conventions |
| [ros2_ws/src/gressus_pgear/README.md](ros2_ws/src/gressus_pgear/README.md) | Exoskeleton node and ESP32 protocol |
| [docs/system-spec.md](docs/system-spec.md) | Hardware rig and RealSense pipeline |
| [docs/occlusion-and-treadmill.md](docs/occlusion-and-treadmill.md) | Projector tile game (optional visual feedback) |
| [docs/roadmap.md](docs/roadmap.md) | Development priorities |
| [third_party/README.md](third_party/README.md) | Vendored dependencies (`pgear_tools`) |
