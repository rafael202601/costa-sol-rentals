import { useState, useEffect, useCallback } from 'react';

/**
 * Hook de cache localStorage com TTL configurável.
 * Persiste dados entre navegações e sessões.
 * 
 * @param {string} key - Chave no localStorage
 * @param {number} ttlMinutes - Tempo de vida em minutos (default: 5)
 */
export function useLocalCache(key, ttlMinutes = 5) {
  const getFromCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const age = Date.now() - (parsed._ts || 0);
      if (age > ttlMinutes * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }, [key, ttlMinutes]);

  const setToCache = useCallback((data) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, _ts: Date.now() }));
    } catch {
      // quota excedida — limpa entradas antigas
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('cache_')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify({ data, _ts: Date.now() }));
      } catch {}
    }
  }, [key]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { getFromCache, setToCache, clearCache };
}

/**
 * Hook completo: gerencia estado + cache automático.
 * 
 * @param {string} cacheKey - Chave de cache
 * @param {Function} fetchFn - Função async que busca os dados
 * @param {number} ttlMinutes - TTL em minutos
 */
export function useCachedData(cacheKey, fetchFn, ttlMinutes = 5) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getFromCache, setToCache } = useLocalCache(cacheKey, ttlMinutes);

  const load = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getFromCache();
      if (cached) {
        setData(cached);
        setLoading(false);
        return cached;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
      setToCache(result);
      return result;
    } catch (err) {
      setError(err);
      console.error(`[CACHE] Erro ao carregar ${cacheKey}:`, err?.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn, getFromCache, setToCache]);

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, error, reload: () => load(true) };
}