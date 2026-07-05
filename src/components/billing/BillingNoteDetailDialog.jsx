import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Paperclip, XCircle, CheckCircle, Download, MessageCircle, Clock, Edit2, AlertCircle } from "lucide-react";
import FinancialDocumentsTab from "./FinancialDocumentsTab";
import NFeBoletoPainel from "./NFeBoletoPainel";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { generateCobrancaPDF, validateCobrancaData } from "../../lib/generateCobrancaPDF";
import { logActivity } from "../../lib/activityLog";

const log = (acao, modulo, ref_id, ref_num, detalhes) =>
  logActivity({ acao, modulo, referencia_id: ref_id || "", referencia_numero: ref_num || "", detalhes: detalhes || "" });

const statusConfig = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  parcial: { label: "Parcial", cls: "bg-blue-100 text-blue-700" },
  pago: { label: "Pago", cls: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-700" },
};

const pagStatusConfig = {
  aguardando_confirmacao: { label: "🟡 Aguardando aprovação", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  confirmado: { label: "🟢 Aprovado", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  rejeitado: { label: "🔴 Rejeitado", cls: "bg-red-50 border-red-200 text-red-700" },
};

// Modal de edição manual dos dados do cliente para o PDF
function ClientePDFEditModal({ open, clienteOriginal, onClose, onConfirm }) {
  const [dados, setDados] = useState({
    nome_razao_social: clienteOriginal?.nome_razao_social || "",
    cpf_cnpj: clienteOriginal?.cpf_cnpj || "",
    inscricao_estadual: clienteOriginal?.inscricao_estadual || "",
    inscricao_municipal: clienteOriginal?.inscricao_municipal || "",
    endereco_entrega_rua: clienteOriginal?.endereco_entrega_rua || "",
    endereco_entrega_bairro: clienteOriginal?.endereco_entrega_bairro || "",
    endereco_entrega_cidade: clienteOriginal?.endereco_entrega_cidade || "",
    endereco_entrega_uf: clienteOriginal?.endereco_entrega_uf || "",
    endereco_entrega_numero: clienteOriginal?.endereco_entrega_numero || "",
    telefone1: clienteOriginal?.telefone1 || "",
    email: clienteOriginal?.email || "",
  });
  const [salvarNaNota, setSalvarNaNota] = useState(false);

  const camposAlterados = Object.keys(dados).filter(
    k => dados[k] !== (clienteOriginal?.[k] || "")
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Dados do Cliente no PDF
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Edite apenas para este PDF. <strong>Não altera o cadastro do cliente.</strong>
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome / Razão Social</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.nome_razao_social} onChange={e => setDados(p => ({ ...p, nome_razao_social: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">CPF / CNPJ</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.cpf_cnpj} onChange={e => setDados(p => ({ ...p, cpf_cnpj: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Inscrição Estadual</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.inscricao_estadual} onChange={e => setDados(p => ({ ...p, inscricao_estadual: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Inscrição Municipal</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.inscricao_municipal} onChange={e => setDados(p => ({ ...p, inscricao_municipal: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.telefone1} onChange={e => setDados(p => ({ ...p, telefone1: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">E-mail</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.email} onChange={e => setDados(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Rua / Endereço</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.endereco_entrega_rua} onChange={e => setDados(p => ({ ...p, endereco_entrega_rua: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Número</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.endereco_entrega_numero} onChange={e => setDados(p => ({ ...p, endereco_entrega_numero: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Bairro</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.endereco_entrega_bairro} onChange={e => setDados(p => ({ ...p, endereco_entrega_bairro: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input className="mt-1 h-8 text-sm" value={dados.endereco_entrega_cidade} onChange={e => setDados(p => ({ ...p, endereco_entrega_cidade: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input className="mt-1 h-8 text-sm" maxLength={2} value={dados.endereco_entrega_uf} onChange={e => setDados(p => ({ ...p, endereco_entrega_uf: e.target.value.toUpperCase() }))} />
            </div>
          </div>

          {camposAlterados.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              ⚠️ {camposAlterados.length} campo(s) alterado(s) em relação ao cadastro original.
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={salvarNaNota} onChange={e => setSalvarNaNota(e.target.checked)} className="rounded" />
            Salvar dados alternativos vinculados a esta nota
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(dados, salvarNaNota, camposAlterados)}>
            <Download className="w-4 h-4 mr-1" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingNoteDetailDialog({ open, note, client, settings, onClose, onUpdated }) {
  const [tab, setTab] = useState("dados");
  const [pagValor, setPagValor] = useState("");
  const [pagForma, setPagForma] = useState("pix");
  const [pagObs, setPagObs] = useState("");
  const [pagValorRecebido, setPagValorRecebido] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPDFEdit, setShowPDFEdit] = useState(false);
  const [novaObs, setNovaObs] = useState("");
  const [savingObs, setSavingObs] = useState(false);

  const st = statusConfig[note.status] || statusConfig.pendente;

  // ── REGISTRAR PAGAMENTO → vai para Solicitações Pendentes ───────────────
  const handleRegistrarPagamento = async () => {
    const val = parseFloat(pagValor);
    if (!val || val <= 0) { toast.error("Informe um valor válido"); return; }
    if (val > (note.saldo_aberto || 0)) { toast.error("Valor maior que saldo em aberto"); return; }

    setSaving(true);
    const me = await base44.auth.me().catch(() => null);
    const hoje = new Date().toISOString().split("T")[0];

    // Monta itens da solicitação com base nos itens da nota (para baixa posterior nos contratos)
    const itensSolicitacao = (note.itens || []).map(item => ({
      tipo: item.tipo || "contrato",
      numero: item.numero || "",
      id: item.id || "",
      descricao: item.descricao || "",
      valor_original: item.valor_original || item.valor_final || 0,
      desconto: item.desconto || 0,
      valor_final: item.valor_final || 0,
      forma_pagamento: pagForma,
    }));

    // Cria PaymentRequest (Solicitação Pendente) — NÃO lança no caixa ainda
    await base44.entities.PaymentRequest.create({
      client_id: client.id || note.client_id || "",
      client_nome: note.client_nome,
      itens: itensSolicitacao,
      valor_total: val,
      data: hoje,
      observacoes: `Pagamento via Nota #${note.numero}${pagObs ? ` — ${pagObs}` : ""}`,
      nota_id: note.id,   // vínculo direto — evita busca por regex nas observações
      nota_numero: note.numero,
      registrado_por: me?.email || me?.full_name || "",
      status: "aguardando_confirmacao",
    });

    // Registra o pagamento na nota com status "aguardando_confirmacao"
    const newPag = {
      data: hoje,
      valor: val,
      forma: pagForma,
      registrado_por: me?.email || me?.full_name || "",
      observacao: pagObs,
      status: "aguardando_confirmacao",
    };

    const pagamentos = [...(note.pagamentos || []), newPag];
    // Saldo NÃO é abatido ainda — só após aprovação
    const updated = await base44.entities.BillingNote.update(note.id, { pagamentos });

    await log(
      "Pagamento registrado — aguardando aprovação",
      "financeiro",
      note.id,
      note.numero,
      `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} via ${pagForma} — enviado para Solicitações Pendentes`
    );

    toast.success("Pagamento enviado para aprovação no Fluxo de Caixa!");
    setPagValor(""); setPagObs(""); setPagValorRecebido("");
    setSaving(false);
    onUpdated(updated);
  };

  const handleCancelar = async () => {
    if (!cancelMotivo) { toast.error("Informe o motivo do cancelamento"); return; }
    setSaving(true);
    const me = await base44.auth.me().catch(() => null);
    const updated = await base44.entities.BillingNote.update(note.id, {
      status: "cancelado",
      cancelado_por: me?.email || me?.full_name || "",
      motivo_cancelamento: cancelMotivo,
    });
    await log("Nota cancelada", "financeiro", note.id, note.numero, cancelMotivo);
    toast.success("Nota cancelada");
    setSaving(false);
    setShowCancelConfirm(false);
    onUpdated(updated);
  };

  const handleAnexar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const meu = await base44.auth.me().catch(() => null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const anexo = {
      nome: file.name,
      url: file_url,
      tipo: file.type,
      data: new Date().toISOString().split("T")[0],
      usuario: meu?.email || meu?.full_name || "",
    };
    const anexos = [...(note.anexos || []), anexo];
    const updated = await base44.entities.BillingNote.update(note.id, { anexos });
    toast.success("Anexo adicionado!");
    setUploading(false);
    onUpdated(updated);
    e.target.value = "";
  };

  // ── PDF — abre modal de edição de dados do cliente ───────────────────────
  const handleGerarPDF = () => setShowPDFEdit(true);

  const handleConfirmarPDF = async (dadosCliente, salvarNaNota, camposAlterados) => {
    try {
      // Valida com os dados editados
      const erros = validateCobrancaData({ client: dadosCliente, settings });
      if (erros.length > 0) {
        toast.error("Dados incompletos: " + erros.join(", "));
        return;
      }

      const itensDescricao = (note.itens || []).map(item => ({
        descricao: item.descricao || (item.tipo === "contrato"
          ? `Locação de Equipamentos — Contrato nº ${item.numero || "—"}${item.obra_nome ? ` (${item.obra_nome})` : ""}`
          : `Locação de Caçamba — OS nº ${item.numero || "—"}${item.endereco ? ` — ${item.endereco}` : ""}`),
        quantidade: 1,
        valor_unitario: item.valor_final || 0,
        total: item.valor_final || 0,
      }));

      // Aviso de dados alterados no rodapé
      const rodapePersonalizado = camposAlterados.length > 0 ? [
        "FATURA DE LOCAÇÃO DE BENS MÓVEIS SEM OPERADOR E MONTAGEM",
        "Isento de I.S.S. - Lei complementar nº 116/2003 - Art. 3 - inciso II",
        "Não tipifica fato gerador de I.S.S. por se tratar de locação de equipamentos para construção civil.",
        "Empresa desobrigada de emissão de Nota Fiscal.",
        "* Dados do destinatário informados manualmente para esta cobrança.",
      ] : null;

      generateCobrancaPDF({
        client: dadosCliente,
        contracts: [],
        orders: [],
        settings,
        itensDescricao,
        rodapePersonalizado,
        numeroNota: note.numero || null,
        desconto: note.desconto || 0,
        valorFinalOverride: note.valor_final || null,
      });

      // Salva dados alternativos na nota se solicitado
      if (salvarNaNota && camposAlterados.length > 0) {
        const me = await base44.auth.me().catch(() => null);
        await base44.entities.BillingNote.update(note.id, {
          dados_cliente_pdf: dadosCliente,
          dados_cliente_pdf_alterado_por: me?.email || me?.full_name || "",
          dados_cliente_pdf_alterado_em: new Date().toISOString(),
          dados_cliente_pdf_campos: camposAlterados,
        });
      }

      toast.success("PDF gerado com sucesso!");
      setShowPDFEdit(false);
    } catch (err) {
      toast.error(err.message || "Erro ao gerar PDF");
    }
  };

  const handleSalvarObs = async () => {
    if (!novaObs.trim()) return;
    setSavingObs(true);
    const me = await base44.auth.me().catch(() => null);
    const novoItem = {
      data: new Date().toISOString(),
      usuario: me?.full_name || me?.email || "—",
      texto: novaObs.trim(),
    };
    const historico = [...(note.historico_observacoes || []), novoItem];
    const updated = await base44.entities.BillingNote.update(note.id, { historico_observacoes: historico });
    setNovaObs("");
    setSavingObs(false);
    onUpdated(updated);
    toast.success("Observação salva!");
  };

  const handleWhatsApp = () => {
    const phone = client.telefone1?.replace(/\D/g, "");
    if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
    const msg = encodeURIComponent(
      `Olá ${client.nome_razao_social}, segue sua cobrança:\n\nNota #${note.numero}\nValor: R$ ${(note.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\nSaldo: R$ ${(note.saldo_aberto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\nAndaimes Costa do Sol`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  // Pagamento salvo na nota usa dados do cliente cadastrado, priorizando dados_cliente_pdf se salvos
  const clienteParaPDF = note.dados_cliente_pdf || client;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <DialogTitle className="font-heading">Nota #{note.numero}</DialogTitle>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{note.client_nome} · {note.client_cpf_cnpj}</p>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b pb-0 -mx-1 overflow-x-auto">
            {[
              { key: "dados", label: "Dados" },
              { key: "observacoes", label: `Observações (${(note.historico_observacoes || []).length})` },
              { key: "pagamentos", label: `Pagamentos (${(note.pagamentos || []).length})` },
              { key: "documentos", label: `Documentos Fin. (${(note.documentos_financeiros || []).length})` },
              { key: "nf_boleto", label: "NF / Boleto" },
              { key: "anexos", label: `Anexos (${(note.anexos || []).length})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── ABA DADOS ── */}
          {tab === "dados" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Valor Bruto", val: note.valor_bruto, cls: "" },
                  { label: "Desconto", val: note.desconto, cls: "text-emerald-600" },
                  { label: "Valor Final", val: note.valor_final, cls: "text-primary font-bold" },
                  { label: "Saldo Aberto", val: note.saldo_aberto, cls: note.saldo_aberto > 0 ? "text-destructive font-bold" : "text-emerald-600" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-muted/40 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-sm font-semibold ${item.cls}`}>R$ {(item.val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Itens Cobrados</p>
                <div className="space-y-1.5">
                  {(note.itens || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                      <div>
                        <p className="font-medium">{item.descricao}</p>
                        {item.obra_nome && <p className="text-xs text-muted-foreground">🏗 {item.obra_nome}</p>}
                      </div>
                      <span className="font-bold text-sm">R$ {(item.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {note.created_date && (
                <p className="text-xs text-muted-foreground">
                  Criado em {format(parseISO(note.created_date), "dd/MM/yyyy 'às' HH:mm")} por {note.criado_por || "—"}
                </p>
              )}

              {/* Aviso de dados alternativos salvos */}
              {note.dados_cliente_pdf && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  PDF usa dados alternativos salvos — alterado por {note.dados_cliente_pdf_alterado_por || "—"}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" onClick={handleGerarPDF} className="gap-2 flex-1 sm:flex-none">
                  <Download className="w-4 h-4" /> Gerar PDF
                </Button>
                <Button variant="outline" onClick={handleWhatsApp} className="gap-2 flex-1 sm:flex-none">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
                {note.status !== "cancelado" && note.status !== "pago" && (
                  <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(true)} className="gap-2 flex-1 sm:flex-none">
                    <XCircle className="w-4 h-4" /> Cancelar Nota
                  </Button>
                )}
              </div>

              {showCancelConfirm && (
                <div className="p-3 rounded-xl border border-destructive/30 bg-red-50 space-y-2">
                  <p className="text-sm font-semibold text-destructive">Confirmar cancelamento</p>
                  <Textarea placeholder="Motivo do cancelamento..." value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} rows={2} className="text-sm" />
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={handleCancelar} disabled={saving}>Confirmar</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)}>Voltar</Button>
                  </div>
                </div>
              )}

              {note.status === "cancelado" && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm">
                  <p className="font-semibold text-destructive">Nota cancelada</p>
                  {note.motivo_cancelamento && <p className="text-muted-foreground">Motivo: {note.motivo_cancelamento}</p>}
                  {note.cancelado_por && <p className="text-xs text-muted-foreground">Por: {note.cancelado_por}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── ABA OBSERVAÇÕES ── */}
          {tab === "observacoes" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                Use para registrar histórico de cobrança, acordos, previsões de pagamento e observações internas.
              </div>
              {/* Nova observação */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Nova Observação</Label>
                <Textarea
                  value={novaObs}
                  onChange={e => setNovaObs(e.target.value)}
                  rows={3}
                  placeholder='Ex: "Cobrança enviada em 05/05", "Cliente informou pagamento dia 12", "Aguardando liberação financeira"...'
                  className="text-sm"
                />
                <Button onClick={handleSalvarObs} disabled={savingObs || !novaObs.trim()} size="sm" className="gap-2 w-full">
                  <MessageCircle className="w-3.5 h-3.5" /> {savingObs ? "Salvando..." : "Salvar Observação"}
                </Button>
              </div>
              {/* Histórico */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</Label>
                {(note.historico_observacoes || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma observação registrada</p>
                )}
                {[...(note.historico_observacoes || [])].reverse().map((o, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/40 border border-border/50 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">
                        {o.data ? format(new Date(o.data), "dd/MM/yyyy 'às' HH:mm") : "—"} · {o.usuario}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{o.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ABA PAGAMENTOS ── */}
          {tab === "pagamentos" && (
            <div className="space-y-4">
              {/* Aviso do novo fluxo */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Pagamentos registrados aqui vão para <strong>Fluxo de Caixa → Solicitações</strong> aguardando aprovação.
                  A baixa no contrato ocorre após aprovação.
                </span>
              </div>

              {note.status !== "cancelado" && note.status !== "pago" && (
                <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                  <p className="text-sm font-semibold">Registrar Pagamento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        placeholder={`Máx: ${(note.saldo_aberto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                        value={pagValor}
                        onChange={(e) => setPagValor(e.target.value)}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Forma</Label>
                      <Select value={pagForma} onValueChange={setPagForma}>
                        <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                          <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {pagForma === "dinheiro" && (
                      <div className="col-span-2">
                        <Label className="text-xs">Valor Recebido (R$)</Label>
                        <Input
                          type="number"
                          value={pagValorRecebido}
                          onChange={(e) => setPagValorRecebido(e.target.value)}
                          className="mt-1 h-9"
                          placeholder="Quanto o cliente entregou..."
                        />
                        {pagValorRecebido && parseFloat(pagValorRecebido) > 0 && parseFloat(pagValor) > 0 && (
                          <p className={`text-xs mt-1 font-semibold ${parseFloat(pagValorRecebido) - parseFloat(pagValor) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {parseFloat(pagValorRecebido) - parseFloat(pagValor) >= 0
                              ? `Troco: R$ ${(parseFloat(pagValorRecebido) - parseFloat(pagValor)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : `⚠ Valor insuficiente — faltam R$ ${(parseFloat(pagValor) - parseFloat(pagValorRecebido)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            }
                          </p>
                        )}
                      </div>
                    )}
                    <div className="col-span-2">
                      <Label className="text-xs">Observação</Label>
                      <Input value={pagObs} onChange={(e) => setPagObs(e.target.value)} className="mt-1 h-9" placeholder="Opcional..." />
                    </div>
                  </div>
                  <Button onClick={handleRegistrarPagamento} disabled={saving || !pagValor} className="gap-2 w-full">
                    <Clock className="w-4 h-4" />
                    {saving ? "Enviando..." : "Enviar para Aprovação"}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {(note.pagamentos || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado</p>
                )}
                {(note.pagamentos || []).map((p, i) => {
                  const pst = pagStatusConfig[p.status] || pagStatusConfig.aguardando_confirmacao;
                  return (
                    <div key={i} className={`p-3 rounded-xl border text-sm ${pst.cls}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">R$ {(p.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <span className="text-xs font-medium">{pst.label}</span>
                      </div>
                      <p className="text-xs mt-1 opacity-80">
                        {p.data ? format(parseISO(p.data), "dd/MM/yyyy") : "—"} · {p.forma} · {p.registrado_por}
                      </p>
                      {p.observacao && <p className="text-xs opacity-70">{p.observacao}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ABA DOCUMENTOS FINANCEIROS ── */}
          {tab === "documentos" && (
            <FinancialDocumentsTab note={note} onUpdated={onUpdated} />
          )}

          {/* ── ABA NF / BOLETO ── */}
          {tab === "nf_boleto" && (
            <NFeBoletoPainel note={note} client={client} settings={settings} onUpdated={onUpdated} />
          )}

          {/* ── ABA ANEXOS ── */}
          {tab === "anexos" && (
            <div className="space-y-4">
              {note.status !== "cancelado" && (
                <label className="block w-full cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium">{uploading ? "Enviando..." : "Clique para anexar arquivo"}</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, imagem, etc.</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleAnexar} disabled={uploading} />
                </label>
              )}
              <div className="space-y-2">
                {(note.anexos || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum anexo</p>
                )}
                {(note.anexos || []).map((a, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">{a.data} · {a.usuario}</p>
                      </div>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal edição de dados do cliente para o PDF */}
      {showPDFEdit && (
        <ClientePDFEditModal
          open={showPDFEdit}
          clienteOriginal={clienteParaPDF}
          onClose={() => setShowPDFEdit(false)}
          onConfirm={handleConfirmarPDF}
        />
      )}
    </>
  );
}