import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle, History, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG = {
  disponivel:  { label: "Disponível",  className: "bg-emerald-100 text-emerald-700" },
  alugado:     { label: "Alugado",     className: "bg-blue-100 text-blue-700" },
  manutencao:  { label: "Manutenção",  className: "bg-amber-100 text-amber-700" },
  avariado:    { label: "Avariado",    className: "bg-red-100 text-red-700" },
  perdido:     { label: "Perdido",     className: "bg-gray-100 text-gray-700" },
  reservado:   { label: "Reservado",   className: "bg-purple-100 text-purple-700" },
};

export default function SerialManager({ numeracoes = [], onChange, quantidadeTotal = 1 }) {
  const [novoSerial, setNovoSerial] = useState("");
  const [expandedIdx, setExpandedIdx] = useState(null);

  const addSerial = () => {
    const serial = novoSerial.trim().toUpperCase();
    if (!serial) return;
    if (numeracoes.some(n => n.serial === serial)) {
      toast.error(`Serial "${serial}" já cadastrado!`);
      return;
    }
    onChange([...numeracoes, { serial, status: "disponivel", contrato_id: "", contrato_numero: "", historico: [] }]);
    setNovoSerial("");
  };

  const removeSerial = (idx) => {
    if (numeracoes[idx].status === "alugado") {
      toast.error("Não é possível remover um serial que está alugado.");
      return;
    }
    onChange(numeracoes.filter((_, i) => i !== idx));
  };

  const updateStatus = (idx, status) => {
    const updated = numeracoes.map((n, i) => i === idx ? { ...n, status } : n);
    onChange(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addSerial(); }
  };

  // Auto-gerar seriais em sequência
  const autoGenerate = () => {
    const faltam = quantidadeTotal - numeracoes.length;
    if (faltam <= 0) { toast.info("Quantidade já atingida"); return; }
    const prefix = novoSerial.trim().toUpperCase() || "SER";
    const lastNum = numeracoes.reduce((max, n) => {
      const m = n.serial.match(/(\d+)$/);
      return m ? Math.max(max, parseInt(m[1])) : max;
    }, 0);
    const novos = [];
    for (let i = 1; i <= faltam; i++) {
      const num = String(lastNum + i).padStart(3, "0");
      const serial = `${prefix}-${num}`;
      if (!numeracoes.some(n => n.serial === serial)) {
        novos.push({ serial, status: "disponivel", contrato_id: "", contrato_numero: "", historico: [] });
      }
    }
    onChange([...numeracoes, ...novos]);
    setNovoSerial("");
    toast.success(`${novos.length} seriais gerados!`);
  };

  const disponivel = numeracoes.filter(n => n.status === "disponivel").length;
  const alugado = numeracoes.filter(n => n.status === "alugado").length;
  const manutencao = numeracoes.filter(n => n.status === "manutencao").length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{disponivel} disponíveis</span>
        {alugado > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{alugado} alugados</span>}
        {manutencao > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{manutencao} em manutenção</span>}
        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{numeracoes.length}/{quantidadeTotal} cadastrados</span>
      </div>

      {/* Add serial */}
      <div className="flex gap-2">
        <Input
          placeholder="Ex: BET-001"
          value={novoSerial}
          onChange={(e) => setNovoSerial(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          className="font-mono flex-1"
        />
        <Button type="button" onClick={addSerial} size="sm" variant="outline" className="gap-1 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
        {numeracoes.length < quantidadeTotal && (
          <Button type="button" onClick={autoGenerate} size="sm" variant="outline" className="gap-1 shrink-0 text-blue-700 border-blue-200 hover:bg-blue-50">
            Auto-gerar {quantidadeTotal - numeracoes.length}
          </Button>
        )}
      </div>

      {/* List */}
      {numeracoes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 border-2 border-dashed rounded-xl">
          Nenhum serial cadastrado. Adicione acima ou use "Auto-gerar".
        </p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {numeracoes.map((n, idx) => (
            <div key={idx} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-2 p-2.5">
                <span className="font-mono font-bold text-sm flex-1">{n.serial}</span>
                <Select value={n.status} onValueChange={(v) => updateStatus(idx, v)} disabled={n.status === "alugado"}>
                  <SelectTrigger className="h-7 w-32 text-xs border-0 bg-transparent p-0">
                    <Badge className={cn("text-[10px] font-semibold cursor-pointer", STATUS_CONFIG[n.status]?.className)}>
                      {STATUS_CONFIG[n.status]?.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "alugado").map(([k, v]) => (
                      <SelectItem key={k} value={k}><span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", v.className)}>{v.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {n.historico?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Ver histórico"
                  >
                    {expandedIdx === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeSerial(idx)}
                  className={cn("p-1 rounded hover:bg-red-50 transition-colors", n.status === "alugado" ? "opacity-30 cursor-not-allowed" : "text-red-400")}
                  disabled={n.status === "alugado"}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {n.contrato_numero && (
                <div className="px-2.5 pb-1.5 text-[10px] text-blue-600">
                  📄 Contrato #{n.contrato_numero}
                </div>
              )}
              {expandedIdx === idx && n.historico?.length > 0 && (
                <div className="border-t bg-muted/30 p-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <History className="w-3 h-3" /> Histórico
                  </p>
                  {[...n.historico].reverse().map((h, hi) => (
                    <div key={hi} className="text-[10px] text-muted-foreground flex gap-2">
                      <span className="shrink-0 text-foreground font-medium">{h.data}</span>
                      <span>{h.evento}</span>
                      {h.contrato_numero && <span>— Contrato #{h.contrato_numero}</span>}
                      {h.motorista && <span>— {h.motorista}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {numeracoes.length > 0 && numeracoes.length < quantidadeTotal && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5" />
          {quantidadeTotal - numeracoes.length} unidade(s) sem serial cadastrado
        </div>
      )}
    </div>
  );
}