# Frontend Mobile — Quase Nada Finanças

Estrutura Expo + React Native pronta para ficar dentro da pasta `frontend` do projeto e buildar pelo EAS Build em Windows.

## Perfis de build

- `development`: build interno com Expo Dev Client e ícone `assets/icon-dev.png`.
- `preview`: build interno com comportamento de produção e ícone `assets/icon-prod.png`.

A troca de ícone, nome do app, scheme e bundle identifier é feita em `app.config.js` usando `APP_VARIANT`.

## Desenvolvimento com backend local no Windows

O app não deve usar `localhost` para falar com o backend quando estiver instalado no iPhone. O script abaixo detecta o IPv4 da sua máquina Windows, cria/atualiza o `.env.local` e inicia o Metro com tunnel:

```powershell
cd frontend
npm install
npm run start:dev:tunnel
```

Ele gera algo assim:

```env
APP_VARIANT=development
EXPO_PUBLIC_API_URL=http://192.168.0.50:3000/api/v1
```

Depois ele roda:

```bash
npx expo start --dev-client --tunnel
```

Esse tunnel é para o Metro/Expo. A API continua sendo acessada pelo IP da sua máquina na porta `3000`.

Antes de abrir o app, deixe o backend rodando em outro terminal:

```powershell
cd ..\backend
npm run dev
```

Se o celular não conseguir acessar a API pelo IP, confira:

1. O backend precisa escutar em `0.0.0.0`, não apenas em `localhost`.
2. O Firewall do Windows precisa liberar a porta `3000`.
3. O iPhone precisa conseguir acessar `http://SEU_IP_LOCAL:3000`.

## Build EAS

```bash
cd frontend
npx eas login
npx eas build --profile development --platform ios
npx eas build --profile preview --platform ios
```

Atalhos já incluídos:

```bash
npm run build:ios:dev
npm run build:ios:preview
```

Para Android:

```bash
npm run build:development:android
npm run build:preview:android
```

## Preview

O profile `preview` deve usar uma URL pública HTTPS. Edite o `frontend/eas.json`:

```json
"EXPO_PUBLIC_API_URL": "https://sua-api-publica.com/api/v1"
```

Evite usar IP local em `preview`, porque esse build não depende do Metro e deve funcionar como app quase final.

## Estrutura principal

```text
frontend/
  app.config.js
  eas.json
  package.json
  babel.config.js
  tsconfig.json
  .env.example
  scripts/
    start-dev-tunnel-local-api.ps1
    start-dev-tunnel-local-api.bat
  assets/
    icon-dev.png
    icon-prod.png
  src/
    App.tsx
    config/
    contexts/
    hooks/
    lib/
    navigation/
    screens/
    services/
    theme/
    types/
    ui/
```
