import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN = 'qnf_access_token';
const REFRESH_TOKEN = 'qnf_refresh_token';

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(ACCESS_TOKEN, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN, refreshToken);
  },
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN),
  async clearTokens() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN);
  }
};
