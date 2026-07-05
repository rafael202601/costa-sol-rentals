import { useState, useRef, useMemo, useEffect } from "react";
import { Search, ImageIcon } from "lucide-react";

/**
 * Inline equipment selector for contract/OS/quote item rows.
 * Full keyboard support: arrows navigate, Tab auto-selects if 1 result
 * or keeps list open for multi-result, Enter confirms.
 */
export default function EquipmentItemSearch({ equipment = [], onSelect, getAvailableQty }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const itemRefs = useRef([]);

  // Filter synchronously — no debounce, so Enter always sees current results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return equipment.filter((e) => {
      if (!q) return true;
      return (
        e.nome?.toLowerCase().includes(q) ||
        e.marca?.toLowerCase().includes(q) ||
        e.modelo?.toLowerCase().includes(q) ||
        e.codigo?.toLowerCase().includes(q)
      );
    }).slice(0, 25);
  }, [equipment, query]);

  // Reset highlight whenever results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [results]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function doSelect(eq) {
    if (getAvailableQty && getAvailableQty(eq.id) <= 0) return;
    onSelect(eq);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(highlightedIndex + 1, results.length - 1);
      setHighlightedIndex(next);
      itemRefs.current[next]?.scrollIntoView({ block: "nearest" });

    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(highlightedIndex - 1, 0);
      setHighlightedIndex(prev);
      itemRefs.current[prev]?.scrollIntoView({ block: "nearest" });

    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const eq = results[highlightedIndex];
      if (eq) doSelect(eq);

    } else if (e.key === "Tab") {
      if (results.length === 1) {
        // Single result → auto-select
        e.preventDefault();
        doSelect(results[0]);
      } else if (results.length > 1) {
        // Multiple → keep open, highlight index 0, user navigates with arrows + Enter
        e.preventDefault();
        setHighlightedIndex(0);
        setOpen(true);
      }
      // No results → natural Tab

    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        placeholder="Buscar por nome, marca, modelo ou código..."
        className="flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">Nenhum equipamento encontrado</p>
          ) : (
            <>
              <div className="px-2 py-1 text-[10px] text-muted-foreground border-b bg-muted/30 flex items-center justify-between">
                <span>{results.length} resultado(s)</span>
                <span className="hidden sm:inline opacity-70">↑↓ navegar · Enter/Tab para selecionar</span>
              </div>
              {results.map((e, idx) => {
                const availQty = getAvailableQty ? getAvailableQty(e.id) : 999;
                const unavailable = availQty <= 0;
                return (
                  <button
                    key={e.id}
                    ref={el => { itemRefs.current[idx] = el; }}
                    type="button"
                    tabIndex={-1}
                    disabled={unavailable}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      if (!unavailable) doSelect(e);
                    }}
                    className={[
                      "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors",
                      unavailable ? "opacity-40 cursor-not-allowed" : "",
                      !unavailable && highlightedIndex === idx ? "bg-primary/10" : "",
                      !unavailable && highlightedIndex !== idx ? "hover:bg-accent" : "",
                    ].join(" ")}
                  >
                    {e.foto_url
                      ? <img src={e.foto_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                      : <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-3 h-3 text-muted-foreground" /></div>
                    }
                    <span className="flex-1 truncate">
                      {e.nome}{e.marca ? ` — ${e.marca}` : ""}{e.codigo ? ` [${e.codigo}]` : ""}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${availQty > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {unavailable ? "Sem estoque" : `Disp: ${availQty}`}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}