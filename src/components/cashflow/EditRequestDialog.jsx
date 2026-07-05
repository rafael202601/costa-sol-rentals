import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PenLine, CheckCircle, XCircle, Clock, Pencil } from "lucide-react";

const FORMAS_PGTO = [
  { key: "dinheiro", label: "Dinheiro" }, { key: "pix", label: "PIX" },
  { key: "cartao_debito", label: "Cartão Débito" }, { key: "cartao_credito", label: "Cartão Crédito" },
  { key: "transferencia", label: "Transferência" }, { key: "boleto", label: "Boleto" },
];

const CATEGORIAS_RECEITA = ["Aluguel de Equipamento", "Andaime", "Máquina", "Caçamba", "Escora", "Venda", "Escada", "Grade", "Frete", "Serviços", "Outros"];
const CATEGORIAS_DESPESA = ["Combustível", "Manutenção", "Salários", "Aluguel", "Fornecedores", "Impostos", "Material", "Andaime", "Máquina", "Caçamba", "Escora", "Escada", "Grade", "Outros"];

// Solicitar edição (usuário comum)
export function RequestEditDialog({ open, onClose, entry, currentUser, onRequested }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!motivo.trim()) { toast.error("Informe o motivo da alteração"); return; }
    setSaving(true);
    const solicitacoes = entry.solicitacoes_edicao || [];
    await base44.entities.CashEntry.update(entry.id, {
      solicitacoes_edicao: [
        ...solicitacoes,
        {
          status: "aguardando",
          motivo,
          solicitado_por: currentUser?.email || "",
          solicitado_por_nome: currentUser?.full_name || "",
          solicitado_em: new Date().toISOString(),
          aprovado_por: "",
          aprovado_em: "",
        }
      ]
    });
    setSaving(false);
    toast.success("Solicitação enviada! Aguardando aprovação do administrador.");
    onRequested?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-amber-600" /> Solicitar Edição
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            Sua solicitação será enviada ao administrador para aprovação. Somente após aprovação o lançamento poderá ser editado.
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lançamento:</p>
            <p className="text-sm font-medium">{entry?.descricao || entry?.motivo || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {entry?.data ? format(parseISO(entry.data), "dd/MM/yyyy") : ""} — R$ {(entry?.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <Label className="text-xs">Motivo da alteração *</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o que precisa ser alterado e por quê..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Aprovar/Rejeitar + Editar (admin)
export function ApproveEditDialog({ open, onClose, entry, currentUser, onDone }) {
  const pendingSolicitation = (entry?.solicitacoes_edicao || []).find(s => s.status === "aguardando");
  const [editForm, setEditForm] = useState({
    descricao: entry?.descricao || "",
    valor: entry?.valor || "",
    data: entry?.data || "",
    categoria: entry?.categoria || "",
    forma_pagamento: entry?.forma_pagamento || "",
    observacoes: entry?.observacoes || "",
  });
  const [rejMotivo, setRejMotivo] = useState("");
  const [mode, setMode] = useState("review"); // review | edit | reject
  const [saving, setSaving] = useState(false);

  const updateSolicitacao = async (novoStatus, extras = {}) => {
    const solicitacoes = (entry.solicitacoes_edicao || []).map(s =>
      s.status === "aguardando"
        ? { ...s, status: novoStatus, aprovado_por: currentUser?.email || "", aprovado_em: new Date().toISOString(), ...extras }
        : s
    );
    return solicitacoes;
  };

  const handleApproveAndEdit = async () => {
    if (!editForm.valor || !editForm.data) { toast.error("Preencha valor e data"); return; }
    setSaving(true);
    const solicitacoes = await updateSolicitacao("aprovado");
    await base44.entities.CashEntry.update(entry.id, {
      descricao: editForm.descricao,
      valor: parseFloat(editForm.valor),
      data: editForm.data,
      categoria: editForm.categoria,
      forma_pagamento: editForm.forma_pagamento,
      observacoes: editForm.observacoes,
      solicitacoes_edicao: solicitacoes,
    });
    setSaving(false);
    toast.success("Lançamento editado e solicitação aprovada!");
    onDone?.();
    onClose();
  };

  const handleReject = async () => {
    setSaving(true);
    const solicitacoes = await updateSolicitacao("rejeitado", { motivo_rejeicao: rejMotivo });
    await base44.entities.CashEntry.update(entry.id, { solicitacoes_edicao: solicitacoes });
    setSaving(false);
    toast.success("Solicitação rejeitada.");
    onDone?.();
    onClose();
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" /> Solicitação de Edição
          </DialogTitle>
        </DialogHeader>

        {pendingSolicitation && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
            <p className="font-semibold text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Solicitação Pendente</p>
            <p className="text-amber-700">Por: <strong>{pendingSolicitation.solicitado_por_nome || pendingSolicitation.solicitado_por}</strong></p>
            <p className="text-amber-700">Em: {pendingSolicitation.solicitado_em ? format(new Date(pendingSolicitation.solicitado_em), "dd/MM/yyyy HH:mm") : "—"}</p>
            <p className="text-amber-700">Motivo: <em>{pendingSolicitation.motivo}</em></p>
          </div>
        )}

        {mode === "review" && (
          <>
            <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
              <p className="font-medium text-sm">{entry.descricao || entry.motivo || "—"}</p>
              <p className="text-muted-foreground">{entry.data ? format(parseISO(entry.data), "dd/MM/yyyy") : ""} — R$ {(entry.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              {entry.categoria && <p className="text-muted-foreground">Categoria: {entry.categoria}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setMode("edit")}>
                <Pencil className="w-3.5 h-3.5" /> Aprovar e Editar
              </Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => setMode("reject")}>
                <XCircle className="w-3.5 h-3.5" /> Rejeitar
              </Button>
            </div>
          </>
        )}

        {mode === "edit" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Editar lançamento</p>
            <div><Label className="text-xs">Descrição</Label><Input className="mt-1" value={editForm.descricao} onChange={e => setEditForm(p => ({ ...p, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" className="mt-1" value={editForm.valor} onChange={e => setEditForm(p => ({ ...p, valor: e.target.value }))} /></div>
              <div><Label className="text-xs">Data *</Label><Input type="date" className="mt-1" value={editForm.data} onChange={e => setEditForm(p => ({ ...p, data: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={editForm.categoria} onValueChange={v => setEditForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(entry.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={editForm.forma_pagamento} onValueChange={v => setEditForm(p => ({ ...p, forma_pagamento: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PGTO.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea className="mt-1" rows={2} value={editForm.observacoes} onChange={e => setEditForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("review")}>Voltar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={handleApproveAndEdit} disabled={saving}>
                <CheckCircle className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar Edição"}
              </Button>
            </div>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-3">
            <div><Label className="text-xs">Motivo da rejeição</Label><Textarea className="mt-1" rows={3} value={rejMotivo} onChange={e => setRejMotivo(e.target.value)} placeholder="Explique por que está rejeitando..." /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("review")}>Voltar</Button>
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={saving}>{saving ? "..." : "Confirmar Rejeição"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Badge de status da solicitação
export function EditRequestBadge({ entry }) {
  const solicitacoes = entry?.solicitacoes_edicao || [];
  const pending = solicitacoes.find(s => s.status === "aguardando");
  const approved = solicitacoes.find(s => s.status === "aprovado");
  const rejected = solicitacoes.find(s => s.status === "rejeitado");

  if (pending) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-0.5 w-fit">
      <Clock className="w-2.5 h-2.5" /> Edição pendente
    </span>
  );
  if (approved) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center gap-0.5 w-fit">
      <CheckCircle className="w-2.5 h-2.5" /> Editado
    </span>
  );
  if (rejected) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex items-center gap-0.5 w-fit">
      <XCircle className="w-2.5 h-2.5" /> Edição rejeitada
    </span>
  );
  return null;
}