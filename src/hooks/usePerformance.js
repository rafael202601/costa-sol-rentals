import { useEffect, useRef } from 'react';

/**
 * Hook para medir e logar o tempo de carregamento de uma página/componente.
 * 
 * Uso: usePerformance('NomeDaPagina')
 * 
 * Loga no console: [PERF] NomeDaPagina montado em 45ms
 */
export function usePerformance(name) {
  const startRef = useRef(performance.now());

  useEffect(() => {
    const ms = Math.round(performance.now() - startRef.current);
    // Só loga se demorar mais de 100ms (ignora componentes rápidos)
    if (ms > 100) {
      console.log(`[PERF] ${name} montado em ${ms}ms`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Mede e loga o tempo de uma operação assíncrona.
 * 
 * Uso: const result = await measureAsync('fetchContracts', () => api.list())
 */
export async function measureAsync(name, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    console.log(`[PERF] ${name}: ${ms}ms`);
    return result;
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    console.error(`[PERF] ${name} ERRO: ${ms}ms`, err?.message);
    throw err;
  }
}