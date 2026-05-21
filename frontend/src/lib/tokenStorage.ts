import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN = 'qnf_access_token';
const REFRESH_TOKEN = 'qnf_refresh_token';
const ACTIVE_EMAIL = 'qnf_active_email';

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN, refreshToken);
  },
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN),
  // Email da conta logada — usado pra manter o refresh token da conta salva
  // sincronizado quando o apiClient rotaciona os tokens.
  setActiveEmail: (email: string) => SecureStore.setItemAsync(ACTIVE_EMAIL, email),
  getActiveEmail: () => SecureStore.getItemAsync(ACTIVE_EMAIL),
  async clearTokens() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(ACTIVE_EMAIL);
  }
};
