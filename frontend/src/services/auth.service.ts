import { apiClient } from '@/lib/apiClient';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '@/types/api.types';

export const authService = {
  login: (data: LoginRequest) => apiClient.post<unknown, LoginResponse>('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post<unknown, RegisterResponse>('/auth/register', data),
  refresh: (refreshToken: string) =>
    apiClient.post<unknown, { accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }),
  me: () => apiClient.get<unknown, User>('/auth/me'),
  logout: async () => {
    const { tokenStorage } = await import('@/lib/tokenStorage');
    const refreshToken = await tokenStorage.getRefreshToken();
    return apiClient.delete<unknown, void>('/auth/logout', { data: { refreshToken } });
  },
  biometricChallenge: () => apiClient.post<unknown, { biometricToken: string; expiresInSeconds: number }>('/auth/biometric-challenge'),
  savePushToken: (pushToken: string | null) => apiClient.post<unknown, void>('/auth/push-token', { pushToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.patch<unknown, { accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/password',
      { currentPassword, newPassword }
    ),
  deleteAccount: (password: string) =>
    apiClient.delete<unknown, void>('/auth/account', { data: { password } })
};
