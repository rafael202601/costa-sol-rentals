import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart } from "lucide-react";
import { format } from "date-fns";

const PGTO_LABEL = {
  pago: "Pago", parcial: "Parcial", nao_pago: "Não Pago", pendente: "Pendente"
};
const PGTO_COLOR = {
  pago: "text-emerald-600", parcial: "text-blue-600", nao_pago: "text-red-600", pendente: "text-muted-foreground"
};

/**
 * Componente que lista vendas em aberto do cliente para vinculação em nota de cobrança.
 * Props: clientId, onSelectionChange(selectedSaleIds)
 */
export default function SalesVincularNota({ clientId, onSelectionChange }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    base44.entities.Sale.filter({ client_id: clientId }).then((all) => {
      const open = (all || []).filter(s =>
        s.status === "aprovado" &&
        s.status_pagamento !== "pago" &&
        !s.nota_vinculada_id
      );
      setSales(open);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clientId]);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(next);
    onSelectionChange?.(next, sales.filter(s => next.includes(s.id)));
  };

  if (loading) return null;
  if (sales.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
        <ShoppingCart className="w-3 h-3" /> Vendas Balcão em Aberto
      </p>
      <div className="space-y-1.5">
        {sales.map((s) => {
          const saldo = s.saldo_pendente || Math.max(0, (s.total || 0) - (s.valor_pago || 0));
          const pgto = s.status_pagamento || "pendente";
          return (
            <label key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60">
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Venda #{s.numero || "—"}</span>
                    <span className={`text-xs font-medium ${PGTO_COLOR[pgto] || ""}`}>{PGTO_LABEL[pgto] || pgto}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.created_date ? format(new Date(s.created_date), "dd/MM/yyyy") : "—"}
                    {s.forma_pagamento ? ` · ${s.forma_pagamento}` : ""}
                  </p>
                  {(s.itens || []).slice(0, 2).map((it, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {it.quantidade}x {it.produto_nome}
                    </p>
                  ))}
                </div>
              </div>
              <span className="text-sm font-bold text-destructive shrink-0 ml-2">
                R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}