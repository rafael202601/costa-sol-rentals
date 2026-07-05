import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, DollarSign, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import jsPDF from "jspdf";

const STATUS_LABELS = {
  pendente: "Pendente",
  parcial: "Parcialmente Pago",
  pago: "Pago",
  cancelado: "Cancelado",
};

const STATUS_COLORS = {
  pendente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  pago: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-700",
};

const FORMAS_PAGAMENTO = ["dinheiro", "pix", "cartao_debito", "cartao_credito", "boleto", "transferencia"];
const FORMAS_LABELS = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito", boleto: "Boleto", transferencia: "Transferência",
};

const TIPOS_DOC = ["nota", "nf", "nfe", "boleto", "cobranca"];
const TIPOS_DOC_LABELS = {
  nota: "Nota", nf: "NF", nfe: "NFe", boleto: "Boleto", cobranca: "Cobrança",
};

function inRange(dateStr, from, to) {
  if (!dateStr) return true;
  if (!from && !to) return true;
  try {
    const d = parseISO(dateStr.substring(0, 10));
    if (from && to) return isWithinInterval(d, { start: parseISO(from), end: parseISO(to) });
    if (from) return d >= parseISO(from);
    if (to) return d <= parseISO(to);
  } catch { return true; }
  return true;
}

export default function BillingNotesReport({ billingNotes }) {
  const [emissaoFrom, setEmissaoFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [emissaoTo, setEmissaoTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vencFrom, setVencFrom] = useState("");
  const [vencTo, setVencTo] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [formaPag, setFormaPag] = useState("todos");
  const [tipoDoc, setTipoDoc] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [contratoSearch, setContratoSearch] = useState("");
  const [osSearch, setOsSearch] = useState("");
  const [cidadeSearch, setCidadeSearch] = useState("");
  const [obraSearch, setObraSearch] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  const filtered = useMemo(() => {
    return (billingNotes || []).filter((n) => {
      if (!inRange(n.created_date, emissaoFrom, emissaoTo)) return false;
      if (!inRange(n.data_vencimento, vencFrom, vencTo)) return false;
      if (status !== "todos" && n.status !== status) return false;
      if (formaPag !== "todos" && n.forma_pagamento !== formaPag) return false;
      if (clienteSearch && !(n.client_nome || "").toLowerCase().includes(clienteSearch.toLowerCase())) return false;
      if (contratoSearch) {
        const nums = (n.contratos_numeros || []).join(" ") + (n.contratos_ids || []).join(" ");
        if (!nums.toLowerCase().includes(contratoSearch.toLowerCase())) return false;
      }
      if (osSearch) {
        const nums = (n.os_numeros || []).join(" ") + (n.os_ids || []).join(" ");
        if (!nums.toLowerCase().includes(osSearch.toLowerCase())) return false;
      }
      if (cidadeSearch) {
        const cidade = (n.dados_cliente_pdf?.endereco_entrega_cidade || "").toLowerCase();
        if (!cidade.includes(cidadeSearch.toLowerCase())) return false;
      }
      if (obraSearch) {
        const obras = (n.itens || []).map(i => (i.obra_nome || "")).join(" ").toLowerCase();
        if (!obras.includes(obraSearch.toLowerCase())) return false;
      }
      if (tipoDoc !== "todos") {
        const hasDoc = (n.documentos_financeiros || []).some(d => d.tipo === tipoDoc);
        if (!hasDoc) return false;
      }
      if (valorMin && (n.valor_final || 0) < Number(valorMin)) return false;
      if (valorMax && (n.valor_final || 0) > Number(valorMax)) return false;
      return true;
    });
  }, [billingNotes, emissaoFrom, emissaoTo, vencFrom, vencTo, clienteSearch, formaPag, tipoDoc, status,
      contratoSearch, osSearch, cidadeSearch, obraSearch, valorMin, valorMax]);

  const totalFinal = filtered.reduce((s, n) => s + (n.valor_final || 0), 0);
  const totalPago = filtered.reduce((s, n) => s + (n.valor_pago || 0), 0);
  const totalAberto = filtered.reduce((s, n) => s + (n.saldo_aberto || 0), 0);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Notas / Cobranças", w / 2, 15, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} — ${filtered.length} registro(s)`, w / 2, 21, { align: "center" });

    // Totais
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: R$ ${totalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}   Pago: R$ ${totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}   Em Aberto: R$ ${totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, w / 2, 28, { align: "center" });

    let y = 35;
    const cols = [14, 60, 110, 140, 185, 215, 245];
    const headers = ["Nota", "Cliente", "Contrato/OS", "Vencimento", "Valor", "Status", "Pagamento"];

    doc.setFillColor(41, 98, 168);
    doc.rect(14, y, w - 28, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    headers.forEach((h, i) => doc.text(h, cols[i] + 1, y + 5));
    y += 7;

    filtered.forEach((n, idx) => {
      if (y > 190) { doc.addPage(); y = 20; }
      const bg = idx % 2 === 0 ? [255, 255, 255] : [245, 248, 255];
      doc.setFillColor(...bg);
      doc.rect(14, y, w - 28, 6.5, "F");
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      const contratos = [...(n.contratos_numeros || []), ...(n.os_numeros || [])].join(", ") || "—";
      const venc = n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yyyy") : "—";
      const valor = `R$ ${(n.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

      doc.text((n.numero || "—").substring(0, 12), cols[0] + 1, y + 4.5);
      doc.text((n.client_nome || "—").substring(0, 22), cols[1] + 1, y + 4.5);
      doc.text(contratos.substring(0, 14), cols[2] + 1, y + 4.5);
      doc.text(venc, cols[3] + 1, y + 4.5);
      doc.text(valor, cols[4] + 1, y + 4.5);
      doc.text((STATUS_LABELS[n.status] || n.status || "—").substring(0, 14), cols[5] + 1, y + 4.5);
      doc.text((FORMAS_LABELS[n.forma_pagamento] || n.forma_pagamento || "—").substring(0, 14), cols[6] + 1, y + 4.5);
      y += 6.5;
    });

    doc.save(`notas_cobrancas_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const exportExcel = () => {
    const headers = ["Nota", "Cliente", "CPF/CNPJ", "Contratos", "OS", "Vencimento", "Valor Final", "Valor Pago", "Saldo Aberto", "Status", "Forma Pagamento"];
    const rows = filtered.map(n => [
      n.numero || "",
      n.client_nome || "",
      n.client_cpf_cnpj || "",
      (n.contratos_numeros || []).join(", "),
      (n.os_numeros || []).join(", "),
      n.data_vencimento || "",
      (n.valor_final || 0).toFixed(2),
      (n.valor_pago || 0).toFixed(2),
      (n.saldo_aberto || 0).toFixed(2),
      STATUS_LABELS[n.status] || n.status || "",
      FORMAS_LABELS[n.forma_pagamento] || n.forma_pagamento || "",
    ]);

    const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas_cobrancas_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Emissão — De</Label>
              <Input type="date" value={emissaoFrom} onChange={e => setEmissaoFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Emissão — Até</Label>
              <Input type="date" value={emissaoTo} onChange={e => setEmissaoTo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Vencimento — De</Label>
              <Input type="date" value={vencFrom} onChange={e => setVencFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Vencimento — Até</Label>
              <Input type="date" value={vencTo} onChange={e => setVencTo(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Input placeholder="Nome do cliente..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={formaPag} onValueChange={setFormaPag}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{FORMAS_LABELS[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Documento</Label>
              <Select value={tipoDoc} onValueChange={setTipoDoc}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{TIPOS_DOC_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Contrato</Label>
              <Input placeholder="Nº do contrato..." value={contratoSearch} onChange={e => setContratoSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">OS</Label>
              <Input placeholder="Nº da OS..." value={osSearch} onChange={e => setOsSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input placeholder="Cidade..." value={cidadeSearch} onChange={e => setCidadeSearch(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Obra</Label>
              <Input placeholder="Nome da obra..." value={obraSearch} onChange={e => setObraSearch(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Valor Mínimo (R$)</Label>
              <Input type="number" placeholder="0,00" value={valorMin} onChange={e => setValorMin(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Valor Máximo (R$)</Label>
              <Input type="number" placeholder="0,00" value={valorMax} onChange={e => setValorMax(e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2 flex items-center justify-between flex-wrap gap-2 pt-4">
              <span className="text-sm text-muted-foreground">{filtered.length} nota(s) encontrada(s)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
                  <FileText className="w-3.5 h-3.5" /> Excel/CSV
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Faturado", val: totalFinal, IconComp: DollarSign, color: "text-foreground" },
          { label: "Total Recebido", val: totalPago, IconComp: CheckCircle2, color: "text-emerald-600" },
          { label: "Em Aberto", val: totalAberto, IconComp: AlertTriangle, color: "text-amber-600" },
        ].map(({ label, val, IconComp, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <IconComp className="w-3.5 h-3.5" />{label}
              </div>
              <p className={`text-xl font-bold font-heading ${color}`}>
                R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-xs font-semibold">Nota</th>
                  <th className="text-left p-3 text-xs font-semibold">Cliente</th>
                  <th className="text-left p-3 text-xs font-semibold">Contrato/OS</th>
                  <th className="text-left p-3 text-xs font-semibold">Vencimento</th>
                  <th className="text-right p-3 text-xs font-semibold">Valor</th>
                  <th className="text-right p-3 text-xs font-semibold">Saldo</th>
                  <th className="text-left p-3 text-xs font-semibold">Status</th>
                  <th className="text-left p-3 text-xs font-semibold">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const contratos = [...(n.contratos_numeros || []).map(x => `C-${x}`), ...(n.os_numeros || []).map(x => `OS-${x}`)].join(", ") || "—";
                  return (
                    <tr key={n.id} className="border-b border-dashed hover:bg-muted/20">
                      <td className="p-3 font-medium">{n.numero || "—"}</td>
                      <td className="p-3 text-muted-foreground max-w-[160px] truncate">{n.client_nome}</td>
                      <td className="p-3 text-xs text-muted-foreground">{contratos}</td>
                      <td className="p-3 text-xs">{n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yyyy") : "—"}</td>
                      <td className="p-3 text-right font-medium">R$ {(n.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className={`p-3 text-right font-medium ${(n.saldo_aberto || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        R$ {(n.saldo_aberto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[n.status] || "bg-muted text-muted-foreground"}`}>
                          {STATUS_LABELS[n.status] || n.status || "—"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{FORMAS_LABELS[n.forma_pagamento] || n.forma_pagamento || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma nota encontrada com os filtros selecionados.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}