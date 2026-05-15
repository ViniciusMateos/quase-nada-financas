import Constants from 'expo-constants';

const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_URL nao configurada. Rode npm run start:dev:tunnel ou configure a URL no eas.json.');
}

export const env = {
  apiBaseUrl,
  appVariant: Constants.expoConfig?.extra?.appVariant ?? process.env.APP_VARIANT ?? 'preview',
};
