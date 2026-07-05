import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";

/**
 * Generates a professional payment receipt PDF
 * @param {object} contract - Contract data
 * @param {object} client - Client data
 * @param {object} settings - Company settings
 * @param {number} valorPago - Amount paid in this transaction
 * @param {string} formaPagamento - Payment method
 * @param {number} novoSaldo - Remaining balance after payment
 * @returns {jsPDF} doc instance
 */
export function generateReciboPDF({ contract, client, settings, valorPago, formaPagamento, novoSaldo, numeroRecibo }) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const fantasia = settings?.nome_fantasia || "Empresa";
  const social = settings?.nome_social || "";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";
  const email = settings?.email || "";

  // Header
  doc.setFillColor(30, 60, 140);
  doc.rect(0, 0, w, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(fantasia, w / 2, 16, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (social) doc.text(social, w / 2, 23, { align: "center" });
  const infoLine = [cnpj && `CNPJ: ${cnpj}`, telefone && `Tel: ${telefone}`, email].filter(Boolean).join("  |  ");
  if (infoLine) doc.text(infoLine, w / 2, 29, { align: "center" });
  if (endereco) doc.text(endereco, w / 2, 35, { align: "center" });

  doc.setTextColor(0, 0, 0);

  // Title
  let y = 52;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE PAGAMENTO", w / 2, y, { align: "center" });
  y += 6;

  // Receipt number & date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const reciboNum = numeroRecibo || `REC-${contract.numero || contract.id?.slice(-6)}`;
  doc.text(`Recibo Nº: ${reciboNum}   |   Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w / 2, y + 2, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, y, w - 15, y);
  y += 8;

  // Client info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${contract.client_nome || "—"}`, 15, y); y += 5;
  if (client?.cpf_cnpj) { doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, 15, y); y += 5; }
  if (client?.telefone1) { doc.text(`Telefone: ${client.telefone1}`, 15, y); y += 5; }
  y += 5;

  doc.line(15, y, w - 15, y);
  y += 8;

  // Contract info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CONTRATO", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Contrato Nº: ${contract.numero || "—"}`, 15, y);
  doc.text(`Endereço: ${contract.endereco_entrega || "—"}`, w / 2, y);
  y += 5;
  if (contract.data_inicio) {
    doc.text(`Início: ${format(parseISO(contract.data_inicio), "dd/MM/yyyy")}`, 15, y);
  }
  if (contract.data_prevista_termino) {
    doc.text(`Prev. Término: ${format(parseISO(contract.data_prevista_termino), "dd/MM/yyyy")}`, w / 2, y);
  }
  y += 8;

  // Items
  if (contract.itens?.length > 0) {
    doc.line(15, y, w - 15, y); y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EQUIPAMENTOS", 15, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.setFillColor(245, 245, 250);
    doc.rect(15, y - 1, w - 30, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Equipamento", 17, y + 3);
    doc.text("Qtd", 120, y + 3);
    doc.text("Vlr Unit.", 135, y + 3);
    doc.text("Subtotal", 163, y + 3);
    y += 8;
    doc.setFont("helvetica", "normal");

    contract.itens.forEach((item) => {
      const subtotal = (item.quantidade_retirada || 0) * (item.valor_unitario || 0) - (item.desconto || 0);
      doc.text(String(item.equipamento_nome || "—").slice(0, 40), 17, y);
      doc.text(String(item.quantidade_retirada || 0), 120, y);
      doc.text(`R$ ${(item.valor_unitario || 0).toFixed(2)}`, 135, y);
      doc.text(`R$ ${subtotal.toFixed(2)}`, 163, y);
      y += 5;
    });
    y += 3;
  }

  doc.line(15, y, w - 15, y); y += 8;

  // Financial summary
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO FINANCEIRO", 15, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const rows = [
    ["Valor Total do Contrato:", `R$ ${(contract.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ["Forma de Pagamento:", formaPagamento || "—"],
  ];
  if ((contract.desconto || 0) > 0) {
    rows.push(["Desconto aplicado:", `R$ ${(contract.desconto || 0).toFixed(2)}`]);
  }

  rows.forEach(([label, value]) => {
    doc.text(label, 15, y);
    doc.text(value, w - 15, y, { align: "right" });
    y += 5;
  });

  y += 3;
  // Highlight paid value
  doc.setFillColor(235, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.rect(15, y - 3, w - 30, 10, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text("VALOR PAGO NESTA OPERAÇÃO:", 18, y + 4);
  doc.text(`R$ ${valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, w - 18, y + 4, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 14;

  if (novoSaldo > 0) {
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(251, 146, 60);
    doc.rect(15, y - 3, w - 30, 10, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(194, 65, 12);
    doc.text("SALDO RESTANTE:", 18, y + 4);
    doc.text(`R$ ${novoSaldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, w - 18, y + 4, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 14;
  } else {
    doc.setFillColor(235, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.rect(15, y - 3, w - 30, 10, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text("✓ PAGAMENTO TOTAL — CONTRATO QUITADO", w / 2, y + 4, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  // Signatures
  y += 10;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setDrawColor(150, 150, 150);
  doc.line(15, y, 85, y);
  doc.text(`${fantasia}`, 50, y + 5, { align: "center" });
  doc.text("(Locador)", 50, y + 10, { align: "center" });

  doc.line(w - 85, y, w - 15, y);
  doc.text(contract.client_nome || "Cliente", w - 50, y + 5, { align: "center" });
  doc.text("(Locatário)", w - 50, y + 10, { align: "center" });

  y += 20;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, w / 2, y, { align: "center" });

  return doc;
}