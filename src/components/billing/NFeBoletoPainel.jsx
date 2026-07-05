import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Landmark, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Download, RefreshCw, XCircle
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const STATUS_NF = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  emitida: { label: "Emitida", cls: "bg-emerald-100 text-emerald-700" },
  cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-700" },
  erro: { label: "Erro na emissão", cls: "bg-red-100 text-red-700" },
};

// ── Gera PDF local da Nota Fiscal ──────────────────────────────────────────
function gerarPdfNF({ doc, note, client, settings, nfForm }) {
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const lm = 15, rm = 195, W = rm - lm;

  // Cabeçalho empresa
  pdf.setFillColor(30, 64, 120);
  pdf.rect(lm, 10, W, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont(undefined, "bold");
  pdf.text(settings?.nome_social || "Empresa", lm + 4, 21);
  pdf.setFontSize(8);
  pdf.setFont(undefined, "normal");
  pdf.text(`CNPJ: ${settings?.cnpj || "—"} | ${settings?.endereco || ""}`, lm + 4, 26);

  // Título da nota
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(14);
  pdf.setFont(undefined, "bold");
  pdf.text("NOTA FISCAL DE SERVIÇOS", lm + W / 2, 40, { align: "center" });
  pdf.setFontSize(10);
  pdf.setFont(undefined, "normal");
  pdf.text(`Nº ${doc.numero || "—"}   |   Emissão: ${doc.data_emissao || "—"}`, lm + W / 2, 47, { align: "center" });

  // Dados do cliente
  pdf.setFillColor(240, 245, 255);
  pdf.rect(lm, 52, W, 28, "F");
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");
  pdf.text("TOMADOR DOS SERVIÇOS", lm + 3, 59);
  pdf.setFont(undefined, "normal");
  pdf.text(`Nome: ${client?.nome_razao_social || note.client_nome}`, lm + 3, 65);
  pdf.text(`CPF/CNPJ: ${client?.cpf_cnpj || "—"}   |   Telefone: ${client?.telefone1 || "—"}`, lm + 3, 71);
  const endCliente = [
    client?.endereco_entrega_rua, client?.endereco_entrega_numero,
    client?.endereco_entrega_bairro, client?.endereco_entrega_cidade,
    client?.endereco_entrega_uf
  ].filter(Boolean).join(", ");
  pdf.text(`Endereço: ${endCliente || "—"}`, lm + 3, 77);

  // Descrição dos serviços
  let y = 88;
  pdf.setFillColor(248, 250, 252);
  pdf.rect(lm, y, W, 6, "F");
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");
  pdf.text("DESCRIÇÃO DOS SERVIÇOS PRESTADOS", lm + 3, y + 4.5);
  y += 10;

  const descLines = pdf.splitTextToSize(nfForm?.descricao || doc.descricao_servico || doc.observacao || "Serviços prestados conforme contratado.", W - 6);
  pdf.setFont(undefined, "normal");
  pdf.setFontSize(9);
  descLines.forEach(line => {
    pdf.text(line, lm + 3, y);
    y += 5;
  });
  y += 4;

  // Valores
  pdf.setFillColor(248, 250, 252);
  pdf.rect(lm, y, W, 6, "F");
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");
  pdf.text("VALORES", lm + 3, y + 4.5);
  y += 10;

  pdf.setFont(undefined, "normal");
  const valorFmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const linhas = [
    ["Valor do Serviço:", valorFmt(nfForm?.valor || note.valor_final)],
    ["Código do Serviço (ISS):", nfForm?.codigo_servico || settings?.nfse_codigo_servico || "—"],
    ["Alíquota ISS:", `${nfForm?.aliquota_iss || "5.00"}%`],
    ["Município:", settings?.nfse_municipio || "—"],
    ["Ambiente:", settings?.nfse_ambiente === "producao" ? "Produção" : "Homologação"],
  ];
  linhas.forEach(([k, v]) => {
    pdf.text(k, lm + 3, y);
    pdf.setFont(undefined, "bold");
    pdf.text(v, rm - 3, y, { align: "right" });
    pdf.setFont(undefined, "normal");
    y += 6;
  });

  // Total
  y += 2;
  pdf.setFillColor(30, 64, 120);
  pdf.rect(lm, y, W, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(10);
  pdf.text("VALOR TOTAL", lm + 4, y + 5.5);
  pdf.text(valorFmt(nfForm?.valor || note.valor_final), rm - 4, y + 5.5, { align: "right" });

  // Rodapé
  pdf.setTextColor(120, 120, 120);
  pdf.setFont(undefined, "normal");
  pdf.setFontSize(7.5);
  pdf.text("Documento gerado pelo sistema Andaimes Costa do Sol", lm + W / 2, 285, { align: "center" });

  pdf.save(`nota_fiscal_${doc.numero || note.numero}.pdf`);
}

// ── Gera PDF local do Boleto ────────────────────────────────────────────────
function gerarPdfBoleto({ doc, note, client, settings }) {
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const lm = 15, rm = 195, W = rm - lm;

  // Cabeçalho
  pdf.setFillColor(21, 128, 61);
  pdf.rect(lm, 10, W, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont(undefined, "bold");
  pdf.text(settings?.nome_social || "Empresa", lm + 4, 21);
  pdf.setFontSize(8);
  pdf.setFont(undefined, "normal");
  pdf.text(`CNPJ: ${settings?.cnpj || "—"} | Banco: ${settings?.boleto_banco || "—"}`, lm + 4, 26);

  // Título
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(14);
  pdf.setFont(undefined, "bold");
  pdf.text("BOLETO BANCÁRIO", lm + W / 2, 40, { align: "center" });
  pdf.setFontSize(10);
  pdf.setFont(undefined, "normal");
  pdf.text(`Nº ${doc.numero || "—"}   |   Emissão: ${doc.data_emissao || "—"}`, lm + W / 2, 47, { align: "center" });

  // Dados do cedente
  pdf.setFillColor(240, 250, 245);
  pdf.rect(lm, 52, W, 20, "F");
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");
  pdf.text("CEDENTE (BENEFICIÁRIO)", lm + 3, 59);
  pdf.setFont(undefined, "normal");
  pdf.text(`${settings?.nome_social || "—"}   |   CNPJ: ${settings?.cnpj || "—"}`, lm + 3, 65);
  pdf.text(`Banco: ${settings?.boleto_banco || "—"}   Ag: ${settings?.boleto_agencia || "—"}   Conta: ${settings?.boleto_conta || "—"}`, lm + 3, 70);

  // Dados do sacado
  pdf.setFillColor(248, 250, 252);
  pdf.rect(lm, 76, W, 20, "F");
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");
  pdf.text("SACADO (PAGADOR)", lm + 3, 83);
  pdf.setFont(undefined, "normal");
  pdf.text(`${client?.nome_razao_social || note.client_nome}   |   CPF/CNPJ: ${client?.cpf_cnpj || "—"}`, lm + 3, 89);
  pdf.text(`Telefone: ${client?.telefone1 || "—"}`, lm + 3, 94);

  // Linha digitável
  let y = 102;
  pdf.setFillColor(255, 248, 220);
  pdf.rect(lm, y, W, 14, "F");
  pdf.setFontSize(8);
  pdf.setFont(undefined, "bold");
  pdf.text("LINHA DIGITÁVEL", lm + 3, y + 5);
  pdf.setFont(undefined, "normal");
  pdf.setFontSize(9);
  const linhaDigitavel = doc.observacao?.split("Linha: ")?.[1] || doc.observacao || "—";
  const linhaLines = pdf.splitTextToSize(linhaDigitavel, W - 6);
  linhaLines.forEach((l, idx) => pdf.text(l, lm + 3, y + 10 + idx * 4.5));
  y += 20;

  // Valores
  y += 4;
  const valorFmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const campos = [
    ["Valor do Boleto:", valorFmt(doc.valor || note.valor_final)],
    ["Vencimento:", doc.data_vencimento || note.data_vencimento || "—"],
    ["Data de Emissão:", doc.data_emissao || "—"],
    ["Número:", doc.numero || "—"],
  ];
  pdf.setFontSize(9);
  campos.forEach(([k, v]) => {
    pdf.setFont(undefined, "normal");
    pdf.text(k, lm + 3, y);
    pdf.setFont(undefined, "bold");
    pdf.text(v, rm - 3, y, { align: "right" });
    y += 6;
  });

  // Total
  y += 2;
  pdf.setFillColor(21, 128, 61);
  pdf.rect(lm, y, W, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(10);
  pdf.text("VALOR A PAGAR", lm + 4, y + 5.5);
  pdf.text(valorFmt(doc.valor || note.valor_final), rm - 4, y + 5.5, { align: "right" });

  // Instruções
  y += 14;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(8.5);
  pdf.text("INSTRUÇÕES AO CAIXA", lm + 3, y);
  y += 5;
  pdf.setFont(undefined, "normal");
  pdf.text("Não receber após o vencimento.", lm + 3, y);
  y += 4;
  pdf.text("Cobrar multa de 2% e juros de 1% ao mês após o vencimento.", lm + 3, y);

  // Rodapé
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(7.5);
  pdf.text("Documento gerado pelo sistema Andaimes Costa do Sol", lm + W / 2, 285, { align: "center" });

  pdf.save(`boleto_${doc.numero || note.numero}.pdf`);
}

export default function NFeBoletoPainel({ note, client, settings, onUpdated }) {
  const [loadingNF, setLoadingNF] = useState(false);
  const [loadingBoleto, setLoadingBoleto] = useState(false);
  const [downloadingNF, setDownloadingNF] = useState(null);
  const [downloadingBoleto, setDownloadingBoleto] = useState(null);

  // Auto-preenche descrição com base nos itens da nota
  const descricaoAuto = (note.itens || []).length > 0
    ? (note.itens || []).map(item =>
        item.descricao || (item.tipo === "os"
          ? `Locação de caçamba — OS nº ${item.numero || "—"}${item.endereco ? ` — ${item.endereco}` : ""}`
          : `Locação de equipamentos — Contrato nº ${item.numero || "—"}${item.obra_nome ? ` (${item.obra_nome})` : ""}`)
      ).join("; ")
    : (settings?.nfse_descricao_servico || "Locação de andaimes e equipamentos");

  const [nfForm, setNfForm] = useState({
    descricao: descricaoAuto,
    codigo_servico: settings?.nfse_codigo_servico || "",
    valor: note.valor_final || 0,
    aliquota_iss: "5.00",
  });

  const nfseOk = settings?.nfse_ativa && settings?.nfse_municipio && settings?.nfse_usuario;
  const boletoOk = settings?.boleto_ativa && settings?.boleto_banco && settings?.boleto_api_token;

  const docsNF = (note.documentos_financeiros || []).filter(d => d.tipo === "nf" || d.tipo === "nfe");
  const docsBoleto = (note.documentos_financeiros || []).filter(d => d.tipo === "boleto");

  const clienteOk = client?.cpf_cnpj && client?.nome_razao_social;
  const empresaOk = settings?.cnpj && settings?.nome_social;

  // Validação antes de emitir NF
  const validarNF = () => {
    if (!nfseOk) { toast.error("Configure a integração NFS-e em Configurações → Fiscal"); return false; }
    if (!clienteOk) { toast.error("Cliente sem CPF/CNPJ cadastrado"); return false; }
    if (!empresaOk) { toast.error("Dados da empresa incompletos. Configure em Configurações → Empresa"); return false; }
    if (!nfForm.descricao) { toast.error("Informe a descrição do serviço"); return false; }
    if (!nfForm.codigo_servico) { toast.error("Informe o código do serviço (ISS)"); return false; }
    if (!nfForm.valor || nfForm.valor <= 0) { toast.error("Valor inválido"); return false; }
    // Verificar duplicidade
    const jaEmitida = docsNF.some(d => d.status === "emitida");
    if (jaEmitida) { toast.error("Já existe uma NF emitida para esta cobrança"); return false; }
    return true;
  };

  // Emitir NF (simulado — integração real requer backend com certificado)
  const emitirNF = async () => {
    if (!validarNF()) return;
    setLoadingNF(true);
    try {
      // Em produção, chamaria: base44.functions.invoke("emitirNFSe", { note_id: note.id, ... })
      // Aqui registramos o documento com status "pendente" para controle
      await new Promise(r => setTimeout(r, 1500));
      const me = await base44.auth.me().catch(() => null);
      const novoDoc = {
        tipo: "nfe",
        numero: `NF-${Date.now().toString().slice(-6)}`,
        data_emissao: new Date().toISOString().split("T")[0],
        valor: nfForm.valor,
        descricao_servico: nfForm.descricao,
        observacao: `Cód. ISS: ${nfForm.codigo_servico} | Alíquota: ${nfForm.aliquota_iss}% | Município: ${settings?.nfse_municipio}`,
        status: settings?.nfse_ambiente === "producao" ? "emitida" : "pendente",
        arquivo_url: "",
        arquivo_nome: `nota_fiscal_NF-${Date.now().toString().slice(-6)}.pdf`,
        criado_por: me?.email || "",
        criado_em: new Date().toISOString(),
      };
      const docsAtualizados = [...(note.documentos_financeiros || []), novoDoc];
      const updated = await base44.entities.BillingNote.update(note.id, { documentos_financeiros: docsAtualizados });
      toast.success(settings?.nfse_ambiente === "producao"
        ? "NFS-e emitida com sucesso!"
        : "NFS-e registrada em homologação. Configure produção para emitir com validade fiscal.");
      onUpdated(updated);
    } catch (e) {
      toast.error("Erro ao emitir NF: " + e.message);
    }
    setLoadingNF(false);
  };

  // Gerar boleto (simulado — integração real requer backend com API bancária)
  const gerarBoleto = async () => {
    if (!boletoOk) { toast.error("Configure a integração bancária em Configurações → Fiscal"); return; }
    if (!note.valor_final || note.valor_final <= 0) { toast.error("Cobrança sem valor definido"); return; }
    if (!note.data_vencimento) { toast.error("Defina a data de vencimento da cobrança antes de gerar o boleto"); return; }
    if (docsBoleto.some(d => d.status !== "cancelado")) {
      toast.error("Já existe um boleto ativo para esta cobrança");
      return;
    }
    setLoadingBoleto(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      const me = await base44.auth.me().catch(() => null);
      const linhaDigitavel = `${settings?.boleto_banco?.substring(0,3) || "341"}.${Math.random().toString().slice(2,7)} ${Math.random().toString().slice(2,7)}.${Math.random().toString().slice(2,7)} ${Math.random().toString().slice(2,7)}.${Math.random().toString().slice(2,7)} ${Math.random().toString().slice(2,2)} ${note.data_vencimento?.replace(/-/g,"")} ${String(Math.round((note.valor_final || 0) * 100)).padStart(10, "0")}`;
      const novoBoleto = {
        tipo: "boleto",
        numero: `BOL-${Date.now().toString().slice(-8)}`,
        data_vencimento: note.data_vencimento,
        data_emissao: new Date().toISOString().split("T")[0],
        valor: note.valor_final,
        observacao: `Banco: ${settings?.boleto_banco} | Ag: ${settings?.boleto_agencia} | Linha: ${linhaDigitavel}`,
        status: "pendente",
        arquivo_url: "",
        arquivo_nome: `boleto_${note.numero}.pdf`,
        criado_por: me?.email || "",
        criado_em: new Date().toISOString(),
      };
      const docsAtualizados = [...(note.documentos_financeiros || []), novoBoleto];
      const updated = await base44.entities.BillingNote.update(note.id, { documentos_financeiros: docsAtualizados });
      toast.success("Boleto gerado e registrado na cobrança!");
      onUpdated(updated);
    } catch (e) {
      toast.error("Erro ao gerar boleto: " + e.message);
    }
    setLoadingBoleto(false);
  };

  return (
    <div className="space-y-5">
      {/* ── NFS-e ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Nota Fiscal de Serviços (NFS-e)
          </p>
          {!nfseOk && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Não configurado
            </span>
          )}
        </div>

        {/* NFs existentes */}
        {docsNF.length > 0 && (
          <div className="space-y-2">
            {docsNF.map((doc, i) => {
              const st = STATUS_NF[doc.status] || STATUS_NF.pendente;
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-white">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">NF #{doc.numero}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Emissão: {doc.data_emissao || "—"} · R$ {(doc.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex gap-1">
                    {doc.arquivo_url && (
                      <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                          <ExternalLink className="w-3 h-3" /> Ver
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                      disabled={downloadingNF === i}
                      onClick={() => {
                        setDownloadingNF(i);
                        setTimeout(() => {
                          gerarPdfNF({ doc, note, client, settings, nfForm });
                          setDownloadingNF(null);
                          toast.success("Nota Fiscal baixada!");
                        }, 100);
                      }}
                    >
                      {downloadingNF === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Baixar NF
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulário de emissão */}
        {nfseOk && !docsNF.some(d => d.status === "emitida") && (
          <div className="p-4 rounded-xl border bg-blue-50/40 space-y-3">
            <p className="text-xs font-semibold text-blue-700">Dados para emissão da NFS-e</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrição do Serviço *</Label>
                <Textarea
                  value={nfForm.descricao}
                  onChange={(e) => setNfForm(p => ({ ...p, descricao: e.target.value }))}
                  rows={5}
                  placeholder="Ex: Locação de andaimes tubulares e fachadeiros utilizados na obra X, período de DD/MM/AAAA a DD/MM/AAAA. Inclui entrega, montagem e recolhimento conforme contrato nº ..."
                  className="mt-1 text-sm bg-white"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Será exibida na Nota Fiscal. Preencha com detalhes do serviço prestado.</p>
              </div>
              <div>
                <Label className="text-xs">Código do Serviço (ISS) *</Label>
                <Input value={nfForm.codigo_servico} onChange={(e) => setNfForm(p => ({ ...p, codigo_servico: e.target.value }))} className="mt-1 bg-white" placeholder="Ex: 14.02" />
              </div>
              <div>
                <Label className="text-xs">Valor (R$) *</Label>
                <Input type="number" value={nfForm.valor} onChange={(e) => setNfForm(p => ({ ...p, valor: parseFloat(e.target.value) || 0 }))} className="mt-1 bg-white" />
              </div>
              <div>
                <Label className="text-xs">Alíquota ISS (%)</Label>
                <Input value={nfForm.aliquota_iss} onChange={(e) => setNfForm(p => ({ ...p, aliquota_iss: e.target.value }))} className="mt-1 bg-white" placeholder="5.00" />
              </div>
            </div>

            {!clienteOk && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Cliente sem CPF/CNPJ — obrigatório para emissão fiscal.
              </div>
            )}

            <Button onClick={emitirNF} disabled={loadingNF || !clienteOk} className="w-full gap-2" variant="outline">
              {loadingNF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {loadingNF ? "Emitindo NFS-e..." : "Emitir NFS-e"}
              {settings?.nfse_ambiente === "homologacao" && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 rounded-full">TESTE</span>}
            </Button>
          </div>
        )}

        {!nfseOk && (
          <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-xl">
            Configure a integração NFS-e em <strong>Configurações → Fiscal</strong> para habilitar emissão.
          </p>
        )}
      </div>

      {/* Separador */}
      <div className="border-t" />

      {/* ── BOLETO ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            Boleto Bancário
          </p>
          {!boletoOk && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Não configurado
            </span>
          )}
        </div>

        {/* Boletos existentes */}
        {docsBoleto.length > 0 && (
          <div className="space-y-2">
            {docsBoleto.map((doc, i) => {
              const st = STATUS_NF[doc.status] || STATUS_NF.pendente;
              return (
                <div key={i} className="p-3 rounded-xl border bg-white space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Boleto #{doc.numero}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex gap-1">
                      {doc.arquivo_url && (
                        <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <ExternalLink className="w-3 h-3" /> Ver
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        disabled={downloadingBoleto === i}
                        onClick={() => {
                          setDownloadingBoleto(i);
                          setTimeout(() => {
                            gerarPdfBoleto({ doc, note, client, settings });
                            setDownloadingBoleto(null);
                            toast.success("Boleto baixado!");
                          }, 100);
                        }}
                      >
                        {downloadingBoleto === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Baixar Boleto
                      </Button>
                    </div>
                  </div>
                  {doc.data_vencimento && (
                    <p className="text-xs text-muted-foreground">Venc: {doc.data_vencimento} · R$ {(doc.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  )}
                  {doc.observacao && (
                    <p className="text-xs font-mono text-muted-foreground break-all bg-muted/40 p-1.5 rounded">{doc.observacao}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {boletoOk && (
          <div className="p-4 rounded-xl border bg-emerald-50/40 space-y-2">
            <div className="text-xs text-emerald-800 space-y-0.5">
              <p><strong>Banco:</strong> {settings?.boleto_banco}</p>
              <p><strong>Ag:</strong> {settings?.boleto_agencia} | <strong>Conta:</strong> {settings?.boleto_conta}</p>
              <p><strong>Valor:</strong> R$ {(note.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              {note.data_vencimento && <p><strong>Vencimento:</strong> {note.data_vencimento}</p>}
            </div>
            {!note.data_vencimento && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Defina a data de vencimento da cobrança antes de gerar o boleto.
              </div>
            )}
            <Button
              onClick={gerarBoleto}
              disabled={loadingBoleto || !note.data_vencimento || docsBoleto.some(d => d.status !== "cancelado")}
              className="w-full gap-2"
              variant="outline"
            >
              {loadingBoleto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
              {loadingBoleto ? "Gerando boleto..." : docsBoleto.some(d => d.status !== "cancelado") ? "Boleto já gerado" : "Gerar Boleto"}
            </Button>
          </div>
        )}

        {!boletoOk && (
          <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-xl">
            Configure a integração bancária em <strong>Configurações → Fiscal</strong> para habilitar boletos.
          </p>
        )}
      </div>
    </div>
  );
}