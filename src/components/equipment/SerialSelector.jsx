import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLOR = {
  disponivel: "bg-emerald-100 text-emerald-700",
  alugado:    "bg-blue-100 text-blue-700",
  manutencao: "bg-amber-100 text-amber-700",
  avariado:   "bg-red-100 text-red-700",
  perdido:    "bg-gray-100 text-gray-700",
  reservado:  "bg-purple-100 text-purple-700",
};

/**
 * SerialSelector — usado no ContractForm para selecionar seriais ao locar
 * Props:
 *  - numeracoes: array de seriais do equipamento (do banco)
 *  - selected: array de seriais selecionados (strings)
 *  - onChange: (selected: string[]) => void
 *  - max: quantidade máxima a selecionar (quantidade_retirada)
 *  - isEditing: se estamos editando (libera seriais já no contrato)
 *  - serialsJaNaContrato: seriais já neste contrato (para edição)
 */
export default function SerialSelector({ numeracoes = [], selected = [], onChange, max = 1, serialsJaNaContrato = [] }) {
  const disponiveis = numeracoes.filter(n =>
    n.status === "disponivel" || serialsJaNaContrato.includes(n.serial)
  );

  const toggle = (serial) => {
    if (selected.includes(serial)) {
      onChange(selected.filter(s => s !== serial));
    } else {
      if (selected.length >= max) return; // limite atingido
      onChange([...selected, serial]);
    }
  };

  if (disponiveis.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhum serial disponível para seleção.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">
        Selecione {max} serial(is) — {selected.length}/{max} selecionado(s)
      </p>
      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
        {disponiveis.map((n) => {
          const isSelected = selected.includes(n.serial);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={n.serial}
              type="button"
              onClick={() => !isDisabled && toggle(n.serial)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-sm",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : isDisabled
                  ? "opacity-40 cursor-not-allowed border-border"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <Checkbox checked={isSelected} className="shrink-0" />
              <span className="font-mono font-semibold text-xs flex-1">{n.serial}</span>
              {n.status !== "disponivel" && (
                <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded-full", STATUS_COLOR[n.status])}>
                  {n.status === "manutencao" ? "Manut." : n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}