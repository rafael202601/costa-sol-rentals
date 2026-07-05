import jsPDF from "jspdf";
import { format } from "date-fns";

const FORMA_LABEL = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
  cheque: "Cheque",
};

export function generateReciboPagamentoPDF({
  contract,
  client,
  settings,
  valorPago,
  formaPagamento,
  saldoRestante,
  dataPagamento,
  responsavel,
  numeroRecibo,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = w - margin * 2;

  const fantasia = settings?.nome_fantasia || "Empresa";
  const social = settings?.nome_social || "";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";
  const emailEmp = settings?.email || "";

  const formaLabel = FORMA_LABEL[formaPagamento] || formaPagamento || "—";
  const isPago = !saldoRestante || saldoRestante <= 0;
  const dataStr = dataPagamento || format(new Date(), "dd/MM/yyyy HH:mm");
  const reciboNum = numeroRecibo || `REC-${(contract?.numero || contract?.id?.slice(-6) || "000")}`;

  // ─── helpers ─────────────────────────────────────────────────────────────
  let y = 0;

  const checkPage = (needed = 16) => {
    if (y + needed > pageH - 12) {
      doc.addPage();
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.4);
      doc.rect(4, 4, w - 8, pageH - 8, "S");
      y = 12;
    }
  };

  const thinLine = (color = [210, 210, 210]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(margin, y, w - margin, y);
    y += 3;
  };

  const sectionLabel = (text) => {
    checkPage(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(text.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(margin, y, w - margin, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
  };

  const lbl = (text, x, yy) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(text, x, yy);
  };

  const val = (text, x, yy, size = 9) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(String(text || "—"), x, yy);
  };

  const finRow = (label, value, bold = false) => {
    checkPage(7);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(value, w - margin, y, { align: "right" });
    y += 6;
  };

  const fmt = (v) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── BORDA ───────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(4, 4, w - 8, pageH - 8, "S");

  // ─── CABEÇALHO ───────────────────────────────────────────────────────────
  let logoW = 0;
  if (settings?.logo_url) {
    try {
      doc.addImage(settings.logo_url, "PNG", margin, 7, 20, 20);
      logoW = 24;
    } catch (_) {}
  }

  const hx = margin + logoW;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(fantasia, hx, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  let hy = 19;
  const parts1 = [social && social, cnpj && `CNPJ: ${cnpj}`].filter(Boolean);
  const parts2 = [telefone && `Tel: ${telefone}`, emailEmp && emailEmp].filter(Boolean);
  if (parts1.length) { doc.text(parts1.join("   |   "), hx, hy); hy += 3.5; }
  if (parts2.length) { doc.text(parts2.join("   |   "), hx, hy); hy += 3.5; }
  if (endereco) { doc.text(endereco, hx, hy); hy += 3.5; }

  // Recibo Nº — canto direito
  const hRight = w - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Recibo Nº ${reciboNum}`, hRight, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, hRight, 18, { align: "right" });
  if (contract?.numero) doc.text(`Contrato: ${contract.numero}`, hRight, 23, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Linha separadora header
  const headerBottom = Math.max(hy + 1, 31);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(4, headerBottom, w - 4, headerBottom);

  y = headerBottom + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("RECIBO DE PAGAMENTO", w / 2, y, { align: "center" });
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + 25, y, w - margin - 25, y);
  y += 6;

  // ─── DADOS DO CLIENTE ────────────────────────────────────────────────────
  sectionLabel("Dados do Cliente / Locatário");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(contract?.client_nome || "—", margin, y);
  y += 5;

  const third = contentW / 3;
  lbl("CPF / CNPJ", margin, y);
  lbl("CÓDIGO DO CLIENTE", margin + third, y);
  lbl("TELEFONE", margin + third * 2, y);
  y += 4;
  val(client?.cpf_cnpj || "—", margin, y, 9);
  val(client?.codigo_cliente || "—", margin + third, y, 9);
  val(client?.telefone1 || "—", margin + third * 2, y, 9);
  y += 6;

  // ─── DADOS DO CONTRATO ────────────────────────────────────────────────────
  sectionLabel("Dados do Contrato");

  const half = contentW / 2;
  lbl("Nº DO CONTRATO", margin, y);
  if (contract?.data_inicio) lbl("INÍCIO", margin + half, y);
  y += 4;
  val(contract?.numero || "—", margin, y, 9);
  if (contract?.data_inicio) val(contract.data_inicio.slice(0, 10).split("-").reverse().join("/"), margin + half, y, 9);
  y += 5;

  if (contract?.endereco_entrega || contract?.obra_endereco) {
    lbl("ENDEREÇO DE ENTREGA / OBRA", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const endLines = doc.splitTextToSize(contract.endereco_entrega || contract.obra_endereco, contentW);
    endLines.forEach(l => { doc.text(l, margin, y); y += 4; });
  }
  y += 1;

  // ─── RESUMO DO PAGAMENTO ─────────────────────────────────────────────────
  sectionLabel("Resumo do Pagamento");

  finRow("Data do pagamento:", dataStr);
  finRow("Forma de pagamento:", formaLabel);
  finRow("Valor total do contrato:", fmt(contract?.valor_total));
  const pagoAnteriormente = Math.max(0, (contract?.valor_pago || 0) - valorPago);
  if (pagoAnteriormente > 0) finRow("Pago anteriormente:", fmt(pagoAnteriormente));
  if (responsavel) finRow("Responsável:", responsavel);

  y += 3;

  // ── Valor pago em destaque ──────────────────────────────────────────────
  checkPage(16);
  doc.setFillColor(235, 253, 245);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentW, 13, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text("✓  VALOR PAGO NESTA OPERAÇÃO:", margin + 4, y + 8.5);
  doc.setFontSize(12);
  doc.text(fmt(valorPago), w - margin - 4, y + 8.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 17;

  // ── Saldo restante ──────────────────────────────────────────────────────
  checkPage(16);
  if (!isPago && saldoRestante > 0) {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentW, 13, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(194, 65, 12);
    doc.text("SALDO RESTANTE A PAGAR:", margin + 4, y + 8.5);
    doc.text(fmt(saldoRestante), w - margin - 4, y + 8.5, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 17;
  } else {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentW, 11, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(21, 128, 61);
    doc.text("✅  CONTRATO QUITADO — PAGAMENTO INTEGRAL", w / 2, y + 7, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 15;
  }

  // ─── ASSINATURAS ─────────────────────────────────────────────────────────
  checkPage(34);
  y += 8;

  const sigW = 74;
  const rX = w - margin - sigW;

  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + sigW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(fantasia, margin + sigW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Empresa / Locador)", margin + sigW / 2, y + 8, { align: "center" });
  doc.text(`Data: ${format(new Date(), "dd/MM/yyyy")}`, margin, y + 12);

  doc.line(rX, y, rX + sigW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(contract?.client_nome || "Cliente", rX + sigW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Cliente / Locatário)", rX + sigW / 2, y + 8, { align: "center" });
  doc.text("Data: ___/___/______", rX, y + 12);

  y += 20;
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · ${fantasia}`,
    w / 2, y, { align: "center" }
  );

  return doc;
}