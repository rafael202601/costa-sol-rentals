import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit2, Trash2, ChevronRight, CheckCircle2, Circle } from "lucide-react";

const TIPO_COLORS = {
  andaime: "bg-blue-100 text-blue-700",
  escoramento: "bg-indigo-100 text-indigo-700",
  cacamba: "bg-orange-100 text-orange-700",
  ferramentas: "bg-yellow-100 text-yellow-700",
  financeiro: "bg-green-100 text-green-700",
  entrega: "bg-teal-100 text-teal-700",
  recolha: "bg-cyan-100 text-cyan-700",
  reclamacao: "bg-red-100 text-red-700",
  suporte: "bg-purple-100 text-purple-700",
  contratos: "bg-slate-100 text-slate-700",
  ordem_servico: "bg-pink-100 text-pink-700",
  personalizado: "bg-gray-100 text-gray-700",
};

const TIPO_LABELS = {
  andaime: "Andaime",
  escoramento: "Escoramento",
  cacamba: "Caçamba",
  ferramentas: "Ferramentas",
  financeiro: "Financeiro",
  entrega: "Entrega",
  recolha: "Recolha",
  reclamacao: "Reclamação",
  suporte: "Suporte",
  contratos: "Contratos",
  ordem_servico: "Ordem de Serviço",
  personalizado: "Personalizado",
};

export default function FluxoCard({ fluxo, onEdit, onDelete, onToggle }) {
  const etapasObrigatorias = (fluxo.etapas || []).filter(e => e.obrigatoria !== false).length;
  const regrasAtivas = (fluxo.regras_especificas || []).filter(r => r.ativa !== false).length;

  return (
    <div className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all ${!fluxo.ativo ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className={`text-xs shrink-0 ${TIPO_COLORS[fluxo.tipo] || TIPO_COLORS.personalizado}`}>
            {TIPO_LABELS[fluxo.tipo] || fluxo.tipo}
          </Badge>
          <h3 className="font-semibold text-sm truncate">{fluxo.nome}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={!!fluxo.ativo}
            onCheckedChange={(v) => onToggle(fluxo, v)}
            className="scale-75"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(fluxo)}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(fluxo)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {fluxo.objetivo && (
        <p className="text-xs text-muted-foreground line-clamp-2">{fluxo.objetivo}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          <strong className="text-foreground">{(fluxo.etapas || []).length}</strong> etapas
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <strong className="text-foreground">{etapasObrigatorias}</strong> obrigatórias
        </span>
        <span className="flex items-center gap-1">
          <Circle className="w-3 h-3 text-orange-400" />
          <strong className="text-foreground">{regrasAtivas}</strong> regras
        </span>
      </div>

      {(fluxo.palavras_chave || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(fluxo.palavras_chave || []).slice(0, 5).map((p, i) => (
            <span key={i} className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">
              {p}
            </span>
          ))}
          {(fluxo.palavras_chave || []).length > 5 && (
            <span className="text-[10px] text-muted-foreground">+{fluxo.palavras_chave.length - 5}</span>
          )}
        </div>
      )}
    </div>
  );
}