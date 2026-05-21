const fs = require('fs');
const path = require('path');

function loadLocalEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvFile();

const requestedVariant = process.env.APP_VARIANT || 'preview';
const variant = requestedVariant === 'development' ? 'development' : 'preview';
const isDevelopment = variant === 'development';

const variants = {
  development: {
    name: 'QNF Dev',
    scheme: 'qnf-dev',
    icon: './assets/icon-dev.png',
    bundleIdentifier: 'app.quasenada.financas.dev',
    androidPackage: 'app.quasenada.financas.dev'
  },
  preview: {
    name: 'Quase Nada Finanças',
    scheme: 'qnf',
    icon: './assets/icon-prod.png',
    bundleIdentifier: 'app.quasenada.financas.preview',
    androidPackage: 'app.quasenada.financas.preview'
  }
};

const current = variants[variant];

const extra = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL,
  appVariant: variant
};

if (process.env.EAS_PROJECT_ID) {
  extra.eas = { projectId: process.env.EAS_PROJECT_ID };
}

module.exports = {
  expo: {
    name: current.name,
    slug: 'quase-nada-financas',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: current.scheme,
    userInterfaceStyle: 'light',
    icon: current.icon,
    assetBundlePatterns: ['assets/**/*'],
    splash: {
      image: current.icon,
      resizeMode: 'contain',
      backgroundColor: '#22C55E'
    },
    ios: {
      bundleIdentifier: current.bundleIdentifier,
      supportsTablet: false,
      infoPlist: {
        NSFaceIDUsageDescription: 'Use o Face ID para confirmar ordens financeiras.',
        ITSAppUsesNonExemptEncryption: false,
        // Permite checar/abrir o app da Binance via deep link
        LSApplicationQueriesSchemes: ['bnc', 'binance'],
        ...(isDevelopment
          ? {
              NSAppTransportSecurity: {
                NSAllowsArbitraryLoads: true,
                NSAllowsLocalNetworking: true
              }
            }
          : {})
      }
    },
    android: {
      package: current.androidPackage,
      usesCleartextTraffic: isDevelopment,
      adaptiveIcon: {
        foregroundImage: current.icon,
        backgroundColor: '#22C55E'
      }
    },
    plugins: [
      'expo-secure-store',
      'expo-notifications',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Use o Face ID para confirmar ordens financeiras.'
        }
      ]
    ],
    extra
  }
};
