import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { differenceInDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      let contracts = [];
      try {
        contracts = await base44.entities.Contract.list("-data_inicio", 200);
      } catch {
        return;
      }
      const found = [];

      contracts.forEach((c) => {
        if (["finalizado", "cancelado"].includes(c.status)) return;

        // Vencidos
        if (c.data_prevista_termino) {
          const dias = differenceInDays(new Date(), parseISO(c.data_prevista_termino));
          if (dias > 0) {
            found.push({
              type: "overdue",
              label: `Contrato #${c.numero || "—"} vencido há ${dias} dia(s)`,
              sub: c.client_nome,
              path: `/contratos/${c.id}`,
            });
          } else if (dias >= -2 && dias <= 0) {
            found.push({
              type: "expiring",
              label: `Contrato #${c.numero || "—"} vence em ${Math.abs(dias)} dia(s)`,
              sub: c.client_nome,
              path: `/contratos/${c.id}`,
            });
          }
        }

        // Pendência financeira + material devolvido
        if (c.status === "devolvido_pendente" && (c.saldo_pagar || 0) > 0) {
          found.push({
            type: "financial",
            label: `Contrato #${c.numero || "—"} — pagamento pendente`,
            sub: `R$ ${(c.saldo_pagar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            path: `/contratos/${c.id}`,
          });
        }

        // Aguardando recolha há mais de 2 dias
        if (c.status === "aguardando_recolha") {
          found.push({
            type: "pickup",
            label: `Contrato #${c.numero || "—"} aguardando recolha`,
            sub: c.client_nome,
            path: `/contratos/${c.id}`,
          });
        }
      });

      setAlerts(found.slice(0, 20));
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  const iconColor = {
    overdue: "text-red-500",
    expiring: "text-amber-500",
    financial: "text-emerald-600",
    pickup: "text-blue-500",
  };

  const bgColor = {
    overdue: "bg-red-50 border-red-100",
    expiring: "bg-amber-50 border-amber-100",
    financial: "bg-emerald-50 border-emerald-100",
    pickup: "bg-blue-50 border-blue-100",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {alerts.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-96 overflow-y-auto">
        <div className="p-3 border-b">
          <p className="font-semibold text-sm font-heading">Notificações</p>
          <p className="text-xs text-muted-foreground">{alerts.length} alerta(s) pendente(s)</p>
        </div>
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            ✓ Nenhuma pendência no momento
          </div>
        ) : (
          <div className="divide-y">
            {alerts.map((a, i) => (
              <Link
                key={i}
                to={a.path}
                onClick={() => setOpen(false)}
                className={`flex flex-col gap-0.5 px-3 py-2.5 hover:opacity-80 transition-opacity border-l-2 ${bgColor[a.type]} ${a.type === "overdue" ? "border-l-red-400" : a.type === "expiring" ? "border-l-amber-400" : a.type === "financial" ? "border-l-emerald-400" : "border-l-blue-400"}`}
              >
                <p className={`text-xs font-semibold ${iconColor[a.type]}`}>{a.label}</p>
                <p className="text-xs text-muted-foreground">{a.sub}</p>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}