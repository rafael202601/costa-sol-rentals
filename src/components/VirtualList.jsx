import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Virtualização de lista: renderiza apenas os itens visíveis.
 * Ideal para listas com 100+ itens (contratos, OS, clientes).
 * 
 * Props:
 * - items: array de dados
 * - renderItem: (item, index) => ReactNode
 * - itemHeight: altura estimada de cada item em px (default: 120)
 * - overscan: número de itens extras acima/abaixo (default: 3)
 * - className: classe do container externo
 */
export default function VirtualList({
  items,
  renderItem,
  itemHeight = 120,
  overscan = 3,
  className = '',
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Observa resize do container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height;
      if (h) setContainerHeight(h);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight || 600);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { visibleItems, totalHeight, offsetY } = useMemo(() => {
    const total = items.length * itemHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIdx = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    const visible = items.slice(startIdx, endIdx + 1).map((item, i) => ({
      item,
      index: startIdx + i,
    }));
    return {
      visibleItems: visible,
      totalHeight: total,
      offsetY: startIdx * itemHeight,
    };
  }, [items, scrollTop, containerHeight, itemHeight, overscan]);

  // Se lista pequena, renderiza diretamente sem overhead de virtualização
  if (items.length <= 50) {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-auto ${className}`}
      style={{ height: Math.min(containerHeight, window.innerHeight * 0.75) }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }} className="space-y-3">
          {visibleItems.map(({ item, index }) => renderItem(item, index))}
        </div>
      </div>
    </div>
  );
}