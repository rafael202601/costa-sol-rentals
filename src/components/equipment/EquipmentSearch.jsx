import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "todos", label: "Todos os tipos" },
  { value: "andaime_tubular", label: "Andaime Tubular" },
  { value: "andaime_fachadeiro", label: "Andaime Fachadeiro" },
  { value: "andaime", label: "Andaime (legado)" },
  { value: "cacamba", label: "Caçamba" },
  { value: "escora", label: "Escora" },
  { value: "grade", label: "Grade" },
  { value: "equipamento", label: "Equipamento" },
  { value: "outro", label: "Outro" },
];

const tipoLabelMap = {
  andaime_tubular: "Andaime Tubular", andaime_fachadeiro: "Andaime Fachadeiro",
  andaime: "Andaime", cacamba: "Caçamba", escora: "Escora",
  grade: "Grade", equipamento: "Equipamento", outro: "Outro"
};

function getTipos(eq) {
  return Array.isArray(eq.tipos) ? eq.tipos
    : eq.tipo ? [eq.tipo] : ["equipamento"];
}

function filterEquipment(equipment, query, filterTipo, filterMarca, filterValorMin, filterValorMax) {
  const q = query.toLowerCase().trim();
  return equipment.filter((e) => {
    if (q) {
      const match =
        e.nome?.toLowerCase().includes(q) ||
        e.marca?.toLowerCase().includes(q) ||
        e.modelo?.toLowerCase().includes(q) ||
        e.tipo?.toLowerCase().includes(q) ||
        e.codigo?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterTipo !== "todos") {
      const eTipos = getTipos(e);
      if (!eTipos.includes(filterTipo) && e.tipo !== filterTipo) return false;
    }
    if (filterMarca && e.marca !== filterMarca) return false;
    const valor = e.valor_diario || 0;
    if (filterValorMin && valor < Number(filterValorMin)) return false;
    if (filterValorMax && valor > Number(filterValorMax)) return false;
    return true;
  }).slice(0, 20);
}

export default function EquipmentSearch({ equipment = [], onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const itemRefs = useRef([]);
  const skipBlurRef = useRef(false);

  // Compute results synchronously from current query — no debounce
  const results = useMemo(
    () => filterEquipment(equipment, query, filterTipo, filterMarca, filterValorMin, filterValorMax),
    [equipment, query, filterTipo, filterMarca, filterValorMin, filterValorMax]
  );

  const hasFilters = filterTipo !== "todos" || filterMarca || filterValorMin || filterValorMax;
  const marcasUnicas = useMemo(() => [...new Set(equipment.map(e => e.marca).filter(Boolean))].sort(), [equipment]);

  // Reset highlight when results change
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
    onSelect(eq);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
    // Return focus to input immediately for next entry
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e) {
    // Open on ArrowDown if closed
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
        // Exactly 1 result → auto-select immediately
        e.preventDefault();
        doSelect(results[0]);
      } else if (results.length > 1) {
        // Multiple results → keep dropdown open, keep focus on input, start navigation
        e.preventDefault();
        // Already at index 0 (reset on results change), so just ensure dropdown stays open
        setOpen(true);
      }
      // 0 results → let Tab behave normally

    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  function handleBlur(e) {
    // Don't close if focus moved to something inside the wrapper (e.g. filter buttons)
    if (wrapperRef.current?.contains(e.relatedTarget)) return;
    // Don't close if we're in the middle of a mousedown selection
    if (skipBlurRef.current) return;
    setOpen(false);
  }

  const showDropdown = open && (query.length > 0 || hasFilters);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.length > 0 || hasFilters) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Buscar por nome, marca, modelo, tipo ou código..."
          className="pl-9 pr-20"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <div className="absolute right-2 top-1.5 flex items-center gap-1">
          {(query || hasFilters) && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery("");
                setFilterTipo("todos");
                setFilterMarca("");
                setFilterValorMin("");
                setFilterValorMax("");
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all",
              hasFilters
                ? "bg-amber-100 text-amber-700 border-amber-300"
                : "border-border hover:border-primary/40 bg-background text-muted-foreground"
            )}
          >
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Filtros {hasFilters ? "●" : ""}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Tipo</p>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Marca</p>
            <Select value={filterMarca || "__todas__"} onValueChange={v => setFilterMarca(v === "__todas__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas as marcas</SelectItem>
                {marcasUnicas.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Diária mín. (R$)</p>
            <Input type="number" className="h-8 text-xs" placeholder="0" value={filterValorMin} onChange={e => setFilterValorMin(e.target.value)} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Diária máx. (R$)</p>
            <Input type="number" className="h-8 text-xs" placeholder="sem limite" value={filterValorMax} onChange={e => setFilterValorMax(e.target.value)} />
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Nenhum equipamento encontrado
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b bg-muted/30 flex items-center justify-between">
                <span>{results.length} resultado(s)</span>
                <span className="hidden sm:inline opacity-70">↑↓ navegar · Enter ou Tab para adicionar</span>
              </div>
              {results.map((eq, idx) => (
                <button
                  key={eq.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur on input
                    skipBlurRef.current = true;
                    doSelect(eq);
                    skipBlurRef.current = false;
                  }}
                  className={cn(
                    "flex items-start gap-3 w-full px-3 py-2.5 text-left transition-colors border-b last:border-0",
                    highlightedIndex === idx
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-accent"
                  )}
                >
                  {eq.foto_url ? (
                    <img src={eq.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{eq.nome}</p>
                      {eq.codigo && (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full shrink-0">
                          #{eq.codigo}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      {eq.marca && <span className="text-[11px] text-muted-foreground">Marca: {eq.marca}</span>}
                      {eq.modelo && <span className="text-[11px] text-muted-foreground">Modelo: {eq.modelo}</span>}
                      {getTipos(eq).map(t => (
                        <span key={t} className="text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                          {tipoLabelMap[t] || t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">
                      R$ {(eq.valor_diario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">por dia</p>
                    {eq.aplica_valor_minimo !== false && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1 rounded">mín. obrig.</span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}