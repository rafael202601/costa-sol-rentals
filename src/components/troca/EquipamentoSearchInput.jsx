import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

/**
 * Campo de busca rápida de equipamentos por código, nome, serial ou patrimônio.
 * Retorna o equipamento selecionado via onSelect(eq).
 */
export default function EquipamentoSearchInput({ equipamentos = [], value, onSelect, placeholder = "Buscar por código, nome ou serial..." }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim().length < 1
    ? []
    : equipamentos.filter(e => {
        const q = query.toLowerCase();
        return (
          (e.nome || "").toLowerCase().includes(q) ||
          (e.codigo || "").toLowerCase().includes(q) ||
          (e.codigo_barras || "").toLowerCase().includes(q) ||
          (e.marca || "").toLowerCase().includes(q) ||
          (e.modelo || "").toLowerCase().includes(q) ||
          // busca por seriais individuais
          (e.numeracoes || []).some(n => (n.serial || "").toLowerCase().includes(q))
        );
      }).slice(0, 20);

  const handleSelect = (eq) => {
    onSelect(eq);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
  };

  // Se já tem valor selecionado, mostra o nome
  if (value?.id) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-800">
        <span className="flex-1 truncate">{value.nome}{value.codigo ? ` (${value.codigo})` : ""}</span>
        <span className="text-emerald-600 shrink-0">{value.quantidade_disponivel ?? "—"} disp.</span>
        <button type="button" onClick={handleClear} className="text-emerald-600 hover:text-red-600 ml-1">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-8 text-xs pl-7"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(eq => (
            <button
              key={eq.id}
              type="button"
              onClick={() => handleSelect(eq)}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center gap-2 border-b last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{eq.nome}</p>
                <p className="text-[10px] text-muted-foreground flex gap-2 flex-wrap mt-0.5">
                  {eq.codigo && <span className="font-mono bg-slate-100 px-1 rounded">#{eq.codigo}</span>}
                  {eq.marca && <span>{eq.marca}</span>}
                  {eq.modelo && <span>{eq.modelo}</span>}
                  {(eq.numeracoes || []).filter(n => (n.serial || "").toLowerCase().includes(query.toLowerCase())).slice(0, 2).map(n => (
                    <span key={n.serial} className="font-mono bg-blue-50 text-blue-700 px-1 rounded">S: {n.serial}</span>
                  ))}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${(eq.quantidade_disponivel || 0) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {eq.quantidade_disponivel ?? 0} disp.
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 1 && filtered.length === 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg px-3 py-2 text-xs text-muted-foreground">
          Nenhum equipamento encontrado para "{query}"
        </div>
      )}
    </div>
  );
}