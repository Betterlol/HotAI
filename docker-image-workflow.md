# Docker Image Workflow

This project uses separate Docker Compose files for local development, image publishing, and server deployment.

## Files

- `docker-compose.dev.yml`: local development. It builds `Dockerfile.dev`, starts PostgreSQL and Redis, and is intended for coding/debugging.
- `Dockerfile.dev`: backend-only development image. It skips the frontend build and should not be pushed as a production image.
- `Dockerfile`: full production image build. It builds frontend assets and the Go binary.
- `docker-compose.build.yml`: build/push helper for the full production image.
- `docker-compose.yml`: deployment compose file. It pulls `APP_IMAGE` and runs PostgreSQL, Redis, and the app.

## Local Development

Start the development backend and dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Run the frontend development server separately:

```bash
cd web
bun install
bun run dev
```

After Go backend changes, rebuild only the app service:

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

Stop local development services:

```bash
docker compose -f docker-compose.dev.yml down
```

## Build And Push A Production Image

Log in to your registry first:

```bash
docker login registry.example.com
```

Choose an immutable image tag. Use your own registry, namespace, and version:

```bash
export APP_IMAGE=registry.example.com/namespace/new-api:2026-07-01-001
```

Build the full production image:

```bash
docker compose -f docker-compose.build.yml build
```

Push it:

```bash
docker compose -f docker-compose.build.yml push
```

If your build machine cannot access Docker Hub directly, set a registry prefix before building:

```bash
export IMAGE_REGISTRY=your-mirror.example.com/
docker compose -f docker-compose.build.yml build
docker compose -f docker-compose.build.yml push
```

## Server Deployment

On the server, create a `.env` file next to `docker-compose.yml`:

```env
APP_IMAGE=registry.example.com/namespace/new-api:2026-07-01-001
POSTGRES_PASSWORD=change-this-postgres-password
REDIS_PASSWORD=change-this-redis-password
SESSION_SECRET=change-this-long-random-secret
```

Then deploy:

```bash
docker compose pull
docker compose up -d
```

To upgrade, change `APP_IMAGE` in `.env`, then run:

```bash
docker compose pull
docker compose up -d
```

To roll back, change `APP_IMAGE` back to the previous tag and run the same two commands.

## Important Notes

- Do not deploy images built from `Dockerfile.dev`; they intentionally skip the frontend build.
- Do not use `latest` for production if you need reliable rollback. Prefer versioned tags.
- Keep `.env` out of Git. This repository already ignores `.env`.
- Production servers only need `docker-compose.yml` and `.env`; they do not need the full source repository if the image is already pushed.
