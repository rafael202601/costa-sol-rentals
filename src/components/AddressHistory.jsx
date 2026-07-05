import { useState } from "react";
import { MapPin, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Exibe histórico de endereços anteriores do cliente para seleção rápida.
 * Props:
 *   addresses: string[]  — lista de endereços únicos já usados
 *   onSelect: (addr: string) => void
 *   loading: boolean
 */
export default function AddressHistory({ addresses = [], onSelect, loading = false }) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        <Clock className="w-3 h-3 animate-spin" /> Carregando endereços anteriores...
      </p>
    );
  }

  if (!addresses.length) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium"
      >
        <Clock className="w-3 h-3" />
        {open ? "Ocultar" : `${addresses.length} endereço${addresses.length > 1 ? "s" : ""} anterior${addresses.length > 1 ? "es" : ""}`}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          {addresses.map((addr, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(addr); setOpen(false); }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10 active:bg-primary/20 transition-colors border-b border-primary/10 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <span className="text-foreground leading-snug">{addr}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}