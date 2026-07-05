import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { GitBranch, ChevronDown, ChevronRight, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ContractVersionsTab({ contractId, onRestore, isAdmin }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    base44.entities.ActivityLog.filter({ referencia_id: contractId })
      .then((logs) => {
        const versionLogs = logs
          .filter((l) => l.acao?.includes("Versão") || l.acao?.includes("Edição") || l.acao?.includes("Criação"))
          .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
        setVersions(versionLogs);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [contractId]);

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Carregando versões...</div>;

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Nenhuma versão registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {versions.length} versão(ões) registrada(s) — do mais recente para o mais antigo.
      </p>
      {versions.map((v, i) => (
        <div key={v.id || i} className="border border-border rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-left"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                v{versions.length - i}
              </div>
              <div>
                <p className="text-sm font-medium">{v.acao || "—"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {v.usuario || "—"}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {v.data_hora ? new Date(v.data_hora).toLocaleString("pt-BR") : "—"}</span>
                </div>
              </div>
            </div>
            {expanded === i ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
          {expanded === i && v.detalhes && (
            <div className="px-4 pb-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{v.detalhes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}