import { apiClient } from '@/lib/apiClient';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '@/types/api.types';

export const authService = {
  login: (data: LoginRequest) => apiClient.post<unknown, LoginResponse>('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post<unknown, RegisterResponse>('/auth/register', data),
  me: () => apiClient.get<unknown, User>('/auth/me'),
  logout: async () => {
    const { tokenStorage } = await import('@/lib/tokenStorage');
    const refreshToken = await tokenStorage.getRefreshToken();
    return apiClient.delete<unknown, void>('/auth/logout', { data: { refreshToken } });
  },
  biometricChallenge: () => apiClient.post<unknown, { challengeToken: string; expiresAt: string }>('/auth/biometric-challenge')
};
