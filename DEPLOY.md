# Guia de Deploy - Quase Nada Financas

## Pre-requisitos

- Servidor Linux com Docker e Docker Compose.
- PostgreSQL 16 acessivel pela API.
- Redis 7 acessivel pela API e pelo worker.
- Dominio HTTPS para a API.
- GitHub Container Registry habilitado.
- Secrets configurados no GitHub Actions.
- Conta Expo/EAS e Apple Developer Account para build iOS.

## Configuracao Inicial

```bash
sudo mkdir -p /opt/quase-nada-financas
sudo chown $USER:$USER /opt/quase-nada-financas
cd /opt/quase-nada-financas
```

Crie `.env` de producao com os valores de `backend/.env.example`. Gere segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Docker Compose de Producao

```yaml
services:
  api:
    image: ghcr.io/OWNER/REPO/quase-nada-financas-backend:latest
    env_file: .env
    ports:
      - "3000:3000"
    restart: unless-stopped

  worker:
    image: ghcr.io/OWNER/REPO/quase-nada-financas-backend:latest
    env_file: .env
    environment:
      RUN_WORKER: "true"
    restart: unless-stopped
```

## Primeiro Deploy

```bash
docker compose pull
docker compose up -d
docker compose logs --tail=100 api
curl http://127.0.0.1:3000/health
```

## Deploy via Pipeline

Todo push para `main` executa lint, typecheck, testes com PostgreSQL/Redis, build Docker, Trivy scan e deploy SSH no servidor.

## Deploy Manual

```bash
cd projetos/quase_nada_financas/backend
docker build -t ghcr.io/OWNER/REPO/quase-nada-financas-backend:manual-$(git rev-parse --short HEAD) .
docker push ghcr.io/OWNER/REPO/quase-nada-financas-backend:manual-$(git rev-parse --short HEAD)

ssh usuario@servidor
cd /opt/quase-nada-financas
docker compose pull
docker compose up -d --remove-orphans
curl http://127.0.0.1:3000/health
```

## Rollback

```bash
ssh usuario@servidor
cd /opt/quase-nada-financas
docker image ls ghcr.io/OWNER/REPO/quase-nada-financas-backend
IMAGE_TAG=sha_COMMIT_ANTERIOR docker compose up -d --remove-orphans
docker compose logs --tail=100 api
curl http://127.0.0.1:3000/health
```

## EAS Build iOS

```bash
cd mobile
npm ci
npx eas env:create --name EXPO_PUBLIC_API_URL --value https://api.quasenada.app/api/v1 --environment preview --visibility plaintext
npx eas build --profile preview --platform ios
```

## Monitoramento

```bash
curl https://api.quasenada.app/health
docker compose ps
docker compose logs -f api
docker compose logs -f worker
```
