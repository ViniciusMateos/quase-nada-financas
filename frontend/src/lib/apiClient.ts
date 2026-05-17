import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { authEvents } from '@/lib/authEvents';
import { normalizeError } from '@/lib/errorMap';
import { tokenStorage } from '@/lib/tokenStorage';
import { debugLog } from '@/lib/debugLog';

type QueuedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let queue: QueuedRequest[] = [];

function flushQueue(error: unknown, token: string | null) {
  queue.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error);
    else resolve(token);
  });
  queue = [];
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': '1' }
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_ENDPOINT_PATTERN = /\/auth\/(login|register|refresh|biometric-challenge)/;

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const isAuthEndpoint = original?.url ? AUTH_ENDPOINT_PATTERN.test(original.url) : false;

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw error;

        const { data } = await axios.post(`${env.apiBaseUrl}/auth/refresh`, { refreshToken });
        await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
        flushQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        await tokenStorage.clearTokens();
        authEvents.forceLogout();
        throw normalizeError(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    debugLog.push({
      method: error.config?.method?.toUpperCase() ?? '?',
      url: error.config?.url ?? '?',
      status: error.response?.status ?? null,
      body: error.response?.data ?? null,
      message: error.message,
    });
    throw normalizeError(error);
  }
);
