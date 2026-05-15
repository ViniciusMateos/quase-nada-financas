import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = { data: T; cachedAt: number };
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const cacheStorage = {
  async set<T>(key: string, data: T) {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  },
  async get<T>(key: string, ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.data;
  },
  remove: (key: string) => AsyncStorage.removeItem(`cache:${key}`)
};
