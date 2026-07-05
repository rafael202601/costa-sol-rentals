import { useState } from "react";
import { Ban, ShieldX, AlertTriangle, Unlock, CreditCard, X, Clock, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Dialog exibido quando o sistema bloqueia criação de contrato/OS por restrições do cliente.
 *
 * Props:
 *   open          – boolean
 *   onClose       – () => void  (cancelar)
 *   onLiberado    – (tipo, dados) => void  (prosseguir com liberação)
 *   cliente       – objeto Client
 *   tipoOperacao  – "contrato" | "os"
 *   currentUser   – objeto User
 */
export default function BloqueioClienteDialog({ open, onClose, onLiberado, cliente, tipoOperacao = "contrato", currentUser }) {
  const [modo, setModo] = useState(null); // null | "temporaria" | "pagamento"
  const [motivo, setMotivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!cliente) return null;

  const role = (currentUser?.role || "").toLowerCase();
  const podeLiberar = role === "admin" || role === "financeiro";

  const serasaRestrito = cliente.status_serasa === "restrito" || cliente.status_serasa === "negativado";
  const bloqueadoDireto = cliente.bloqueado === true && !serasaRestrito;
  const motivoBloqueio = cliente.motivo_bloqueio || "";

  // Monta lista de motivos ativos
  const motivos = [];
  if (serasaRestrito) {
    motivos.push({
      icon: <ShieldX className="w-5 h-5 text-red-600" />,
      titulo: cliente.status_serasa === "negativado" ? "Cliente Negativado no Serasa" : "Cliente com Restrição no Serasa",
      descricao: `Status Serasa: ${cliente.status_serasa.toUpperCase()}`,
      cor: "border-red-300 bg-red-50",
      corTitulo: "text-red-800",
    });
  }
  if (bloqueadoDireto) {
    motivos.push({
      icon: <Ban className="w-5 h-5 text-red-600" />,
      titulo: "Cliente Bloqueado",
      descricao: motivoBloqueio || "Cliente marcado como bloqueado no cadastro.",
      cor: "border-red-300 bg-red-50",
      corTitulo: "text-red-800",
    });
  }
  // Se nem um nem outro mas chegou aqui é bloqueado por serasa implícito
  if (motivos.length === 0) {
    motivos.push({
      icon: <Ban className="w-5 h-5 text-red-600" />,
      titulo: "Cliente Bloqueado",
      descricao: "Este cliente não está autorizado para novas operações.",
      cor: "border-red-300 bg-red-50",
      corTitulo: "text-red-800",
    });
  }

  const tipoLabel = tipoOperacao === "os" ? "Ordem de Serviço" : "Contrato";

  const handleLiberar = async (tipo) => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da liberação.");
      return;
    }
    if (tipo === "temporaria" && !prazo.trim()) {
      toast.error("Informe o prazo da liberação temporária.");
      return;
    }
    setSalvando(true);
    try {
      // Registra no ActivityLog para auditoria
      await base44.entities.ActivityLog.create({
        usuario: currentUser?.full_name || currentUser?.email || "—",
        acao: tipo === "temporaria" ? "Liberação temporária de cliente bloqueado" : "Liberação mediante pagamento adiantado",
        modulo: tipoOperacao,
        referencia_id: cliente.id,
        referencia_numero: cliente.codigo_cliente || cliente.nome_razao_social,
        detalhes: [
          `Cliente: ${cliente.nome_razao_social} (${cliente.codigo_cliente || cliente.id})`,
          `Tipo de liberação: ${tipo === "temporaria" ? "Temporária" : "Pagamento adiantado"}`,
          `Motivo: ${motivo}`,
          tipo === "temporaria" ? `Prazo: ${prazo}` : null,
          `Operação: ${tipoLabel}`,
          `Liberado por: ${currentUser?.full_name || currentUser?.email}`,
        ].filter(Boolean).join(" | "),
        data_hora: new Date().toISOString(),
      }).catch(() => {});

      toast.success(
        tipo === "temporaria"
          ? "Liberação temporária registrada. Prossiga com a operação."
          : "Liberação mediante pagamento adiantado registrada."
      );

      onLiberado(tipo, {
        motivo,
        prazo: tipo === "temporaria" ? prazo : null,
        liberado_por: currentUser?.full_name || currentUser?.email,
        liberado_em: new Date().toISOString(),
      });
    } catch {
      toast.error("Erro ao registrar liberação.");
    } finally {
      setSalvando(false);
    }
  };

  const handleClose = () => {
    setModo(null);
    setMotivo("");
    setPrazo("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Ban className="w-5 h-5" />
            Operação Bloqueada — {tipoLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Info do cliente */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">{cliente.nome_razao_social}</p>
          {cliente.codigo_cliente && <p className="text-xs text-muted-foreground">Código: #{cliente.codigo_cliente}</p>}
          {cliente.cpf_cnpj && <p className="text-xs text-muted-foreground font-mono">{cliente.cpf_cnpj}</p>}
        </div>

        {/* Motivos do bloqueio */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo(s) do Bloqueio</p>
          {motivos.map((m, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${m.cor}`}>
              <div className="shrink-0 mt-0.5">{m.icon}</div>
              <div>
                <p className={`font-semibold text-sm ${m.corTitulo}`}>{m.titulo}</p>
                {m.descricao && <p className="text-xs text-slate-600 mt-0.5">{m.descricao}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Usuário sem permissão */}
        {!podeLiberar && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-xs mt-0.5">Apenas <strong>administradores</strong> ou usuários do setor <strong>financeiro</strong> podem liberar esta operação. Entre em contato com o responsável.</p>
          </div>
        )}

        {/* Opções de liberação — visível apenas para admin/financeiro */}
        {podeLiberar && !modo && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opções de Liberação</p>
            <button
              onClick={() => setModo("temporaria")}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
            >
              <Unlock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Liberar Temporariamente</p>
                <p className="text-xs text-amber-700 mt-0.5">Permite prosseguir com esta operação específica. Requer justificativa e prazo. O bloqueio permanece no cadastro.</p>
              </div>
            </button>
            <button
              onClick={() => setModo("pagamento")}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
            >
              <CreditCard className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">Liberar Mediante Pagamento Adiantado</p>
                <p className="text-xs text-blue-700 mt-0.5">Permite prosseguir condicionado ao pagamento antecipado. O {tipoLabel.toLowerCase()} será marcado com exigência de pagamento adiantado.</p>
              </div>
            </button>
          </div>
        )}

        {/* Formulário de liberação temporária */}
        {podeLiberar && modo === "temporaria" && (
          <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <Unlock className="w-4 h-4" /> Liberação Temporária
              </p>
              <button onClick={() => setModo(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <Label className="text-xs">Motivo da Liberação *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Cliente apresentou comprovante de quitação pendente..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Prazo da Liberação *</Label>
              <Input
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder="Ex: 7 dias, até 30/06/2025..."
                className="mt-1 text-sm"
              />
            </div>
            <div className="text-xs text-amber-700 flex items-start gap-1.5">
              <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Esta liberação será registrada no histórico de auditoria com seu nome, data e hora.
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1">Voltar</Button>
              <Button
                size="sm"
                onClick={() => handleLiberar("temporaria")}
                disabled={salvando}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {salvando ? "Registrando..." : "Confirmar Liberação"}
              </Button>
            </div>
          </div>
        )}

        {/* Formulário de liberação por pagamento adiantado */}
        {podeLiberar && modo === "pagamento" && (
          <div className="space-y-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> Liberação — Pagamento Adiantado
              </p>
              <button onClick={() => setModo(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <Label className="text-xs">Motivo / Observação *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Cliente bloqueado por débito anterior. Liberado com exigência de pagamento antecipado..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
            <div className="text-xs text-blue-700 bg-blue-100 rounded-lg p-2 flex items-start gap-1.5">
              <CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              O {tipoLabel.toLowerCase()} será salvo com a observação <strong>"Liberado mediante pagamento adiantado"</strong> e registrado no log de auditoria.
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1">Voltar</Button>
              <Button
                size="sm"
                onClick={() => handleLiberar("pagamento")}
                disabled={salvando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {salvando ? "Registrando..." : "Confirmar Liberação"}
              </Button>
            </div>
          </div>
        )}

        {/* Rodapé — botão cancelar (sempre visível) */}
        {!modo && (
          <div className="flex justify-end pt-1">
            <Button variant="outline" onClick={handleClose} className="gap-2">
              <X className="w-4 h-4" /> Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}