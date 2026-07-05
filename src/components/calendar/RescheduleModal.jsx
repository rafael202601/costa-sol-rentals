import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Truck, User, Car, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RescheduleModal({ open, event, drivers, vehicles, onConfirm, onCancel }) {
  const [novaData, setNovaData] = useState("");
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");

  useEffect(() => {
    if (!open || !event) return;
    setMotorista("");
    setVeiculo("");

    // Pré-preenche com a data atual do evento
    const d = event.data;
    let dataAtual = "";
    if (event.draggableType === "contract_end") {
      dataAtual = d?.data_recolha || d?.data_prevista_termino || "";
    } else if (event.draggableType === "os_recolha") {
      const raw = d?.data_recolhimento || "";
      dataAtual = raw ? raw.split("T")[0] : "";
    } else if (event.draggableType === "os_entrega") {
      const raw = d?.data_entrega || "";
      dataAtual = raw ? raw.split("T")[0] : "";
    } else if (event.draggableType === "contract_start") {
      dataAtual = d?.data_inicio || "";
    }

    // Normaliza para yyyy-MM-dd
    if (dataAtual && dataAtual.includes("T")) dataAtual = dataAtual.split("T")[0];
    setNovaData(dataAtual);
  }, [open, event]);

  if (!event) return null;

  const isRecolha = event.draggableType === "contract_end" || event.draggableType === "os_recolha";
  const titulo = isRecolha ? "Reagendar Recolha" : "Reagendar Entrega";

  const labelTipo = {
    contract_start: "Entrega do Contrato",
    contract_end: "Recolha do Contrato",
    os_entrega: "Entrega da OS",
    os_recolha: "Recolha da OS",
  }[event.draggableType] || "Reagendar";

  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base">
            <Calendar className="w-5 h-5 text-primary" />
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Info do evento */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-0.5">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">{labelTipo}</p>
            <p className="font-bold">{event.label}</p>
            <p className="text-xs text-muted-foreground">{event.client}</p>
          </div>

          {/* Nova data */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Nova Data *
            </Label>
            <Input
              type="date"
              value={novaData}
              onChange={e => setNovaData(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          {/* Motorista */}
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1 mb-1.5">
              <User className="w-3.5 h-3.5" /> Motorista
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={motorista} onValueChange={setMotorista}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Definir depois pela logística..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_motorista__">— Definir depois —</SelectItem>
                {drivers.filter(d => d.status === "ativo").map(d => (
                  <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Veículo */}
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1 mb-1.5">
              <Car className="w-3.5 h-3.5" /> Veículo
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={veiculo} onValueChange={setVeiculo}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Definir depois pela logística..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem_veiculo__">— Definir depois —</SelectItem>
                {vehicles.filter(v => v.status === "ativo").map(v => (
                  <SelectItem key={v.id} value={v.placa}>
                    {v.modelo} — {v.placa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!novaData && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Selecione uma nova data para continuar.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm({
              novaData,
              motorista: motorista === "__sem_motorista__" ? "" : motorista,
              veiculo: veiculo === "__sem_veiculo__" ? "" : veiculo,
            })}
            disabled={!novaData}
            className="gap-2 w-full sm:w-auto"
          >
            <CheckCircle2 className="w-4 h-4" /> Salvar Reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}