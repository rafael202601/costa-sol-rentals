import { cn } from "@/lib/utils";

const statusConfig = {
  // Contract statuses
  rascunho: { label: "Lançado", color: "bg-muted text-muted-foreground" },
  em_transito: { label: "Em Rota", color: "bg-blue-100 text-blue-700" },
  na_obra: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
  aguardando_recolha: { label: "Recolha Solicitada", color: "bg-amber-100 text-amber-700 font-bold" },
  devolvido_parcial: { label: "Recolhido", color: "bg-indigo-100 text-indigo-700" },
  devolvido_pendente: { label: "Dev. Pend. Pgto", color: "bg-purple-100 text-purple-700" },
  recolhida: { label: "Recolhido", color: "bg-indigo-100 text-indigo-700" },
  finalizado: { label: "Finalizado", color: "bg-slate-100 text-slate-600" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  // OS statuses
  pendente: { label: "Lançada", color: "bg-muted text-muted-foreground" },
  entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
  finalizada: { label: "Finalizada", color: "bg-slate-100 text-slate-600" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
  // Financial
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  parcial: { label: "Parcial", color: "bg-amber-100 text-amber-700" },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, color: "bg-muted text-muted-foreground" };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}