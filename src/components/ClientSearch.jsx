import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, AlertCircle, Ban, Loader2, X, Clock } from "lucide-react";
import { getRecentClients, saveRecentClient } from "@/lib/recentClients";

const SEARCH_FIELDS = [
  { value: "todos", label: "Todos" },
  { value: "nome_razao_social", label: "Nome" },
  { value: "cpf_cnpj", label: "CPF/CNPJ" },
  { value: "codigo_cliente", label: "Código" },
  { value: "telefone1", label: "Telefone" },
  { value: "endereco_entrega_cidade", label: "Cidade" },
  { value: "etiquetas", label: "Etiqueta" },
];

export default function ClientSearch({ value, onSelect, placeholder = "Buscar cliente...", userEmail }) {
  const [query, setQuery] = useState(value || "");
  const [field, setField] = useState("todos");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [recentClients, setRecentClients] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  const inputWrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setRecentClients(getRecentClients(userEmail));
  }, [userEmail]);

  // Recalcula posição do dropdown (para portal fixo na viewport)
  const calcPos = useCallback(() => {
    if (!inputWrapRef.current) return;
    const rect = inputWrapRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  // Recalcula ao abrir e ao redimensionar (teclado mobile)
  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("resize", calcPos);
    window.addEventListener("scroll", calcPos, true);
    return () => {
      window.removeEventListener("resize", calcPos);
      window.removeEventListener("scroll", calcPos, true);
    };
  }, [open, calcPos]);

  // Fechar ao clicar/tocar fora — suporte a mouse e touch
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const target = e.target || e.touches?.[0]?.target;
      if (!target) return;
      if (inputWrapRef.current?.contains(target)) return;
      // Verifica se tocou no dropdown (portal fora do ref)
      const dropdown = document.getElementById("client-search-dropdown");
      if (dropdown?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const runSearch = async (q, f) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("searchClients", {
        query: q.trim().slice(0, 200),
        field: f || "todos",
        limit: 20,
      });
      const items = Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data?.clients)
        ? res.data.clients
        : [];
      setResults(items);
      if (items.length > 0) {
        calcPos();
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowRecent(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(val, field), 300);
  };

  const handleFieldChange = (f) => {
    setField(f);
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(query, f), 300);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    setShowRecent(false);
  };

  const handleSelect = (client) => {
    if (!client) return;
    setQuery(client.nome_razao_social || "");
    setOpen(false);
    setResults([]);
    setShowRecent(false);
    saveRecentClient(userEmail, client);
    setRecentClients(getRecentClients(userEmail));
    onSelect(client);
  };

  const recentDropdown = showRecent && !open && recentClients.length > 0 && createPortal(
    <div
      id="client-search-dropdown"
      style={{
        position: "absolute",
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        zIndex: 99999,
      }}
    >
      <div className="bg-card rounded-xl shadow-2xl border border-border overflow-hidden max-h-64 overflow-y-auto">
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Clientes recentes</span>
        </div>
        {recentClients.map((client) => (
          <button
            key={client.id}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(client); }}
            onTouchEnd={(e) => { e.preventDefault(); handleSelect(client); }}
            className="w-full text-left px-4 py-3 hover:bg-muted/60 active:bg-muted transition-colors border-b border-border/40 last:border-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {client.codigo_cliente && <span className="text-primary/70 font-mono mr-1">#{client.codigo_cliente}</span>}
                  {client.nome_razao_social || "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[client.cpf_cnpj, client.endereco_entrega_cidade].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {client.bloqueado && <Ban className="w-3.5 h-3.5 text-red-500" />}
                {client.pendencia_financeira && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );

  const dropdown = open && results.length > 0 && createPortal(
    <div
      id="client-search-dropdown"
      style={{
        position: "absolute",
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        zIndex: 99999,
      }}
    >
      <div className="bg-card rounded-xl shadow-2xl border border-border overflow-hidden max-h-64 overflow-y-auto">
        {results.map((client) => {
          if (!client) return null;
          return (
            <button
              key={client.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(client); }}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(client); }}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 active:bg-muted transition-colors border-b border-border/40 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {client.codigo_cliente && (
                      <span className="text-primary/70 font-mono mr-1">#{client.codigo_cliente}</span>
                    )}
                    {client.nome_razao_social || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[client.cpf_cnpj, client.endereco_entrega_cidade].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {client.bloqueado && <Ban className="w-3.5 h-3.5 text-red-500" />}
                  {client.pendencia_financeira && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2" ref={inputWrapRef}>
        {/* Filtro de campo */}
        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value)}
          className="w-28 shrink-0 h-9 text-xs border border-input rounded-md bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {SEARCH_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Campo de busca */}
        <div className="relative flex-1">
          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          )}
          <Input
            className="pl-9 pr-8 h-9"
            placeholder={placeholder}
            value={query}
            onChange={handleChange}
            onFocus={() => {
              calcPos();
              if (query.length >= 2 && results.length > 0) {
                setOpen(true);
              } else if (!query && recentClients.length > 0) {
                setShowRecent(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowRecent(false), 200)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleClear(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {recentDropdown}
      {dropdown}
    </div>
  );
}