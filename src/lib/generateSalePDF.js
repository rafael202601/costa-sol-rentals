import jsPDF from "jspdf";
import { format } from "date-fns";

export function generateSalePDF(sale, company = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const fantasia = company.nome_fantasia || company.nome_social || "Empresa";
  const social = company.nome_social || "";
  const cnpj = company.cnpj || "";
  const endereco = company.endereco || "";
  const telefone = company.telefone || "";
  const email = company.email || "";

  // ─── BORDA ───────────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, w - 10, pageH - 10, "S");

  // ─── CABEÇALHO UNIFICADO ─────────────────────────────────────────────────
  let logoW = 0;
  if (company.logo_url) {
    try {
      doc.addImage(company.logo_url, "PNG", margin, 7, 22, 22);
      logoW = 26;
    } catch (_) {}
  }

  const hx = margin + logoW;
  const hRight = w - margin;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(fantasia, hx, 13);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const infoLine1Parts = [social !== fantasia && social, cnpj && `CNPJ: ${cnpj}`].filter(Boolean);
  const infoLine2Parts = [telefone && `Tel: ${telefone}`, email].filter(Boolean);
  let hy = 18;
  if (infoLine1Parts.length) { doc.text(infoLine1Parts.join("   |   "), hx, hy); hy += 4; }
  if (infoLine2Parts.length) { doc.text(infoLine2Parts.join("   |   "), hx, hy); hy += 4; }
  if (endereco) { doc.text(endereco, hx, hy); hy += 4; }

  // Título centralizado
  hy += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("COMPROVANTE DE VENDA", w / 2, hy, { align: "center" });
  hy += 2;

  // Nº + Data — canto superior direito
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Venda Nº ${sale.numero || "—"}`, hRight, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Data: ${format(new Date(), "dd/MM/yyyy")}`, hRight, 18, { align: "right" });

  const headerBottom = Math.max(hy + 3, 32);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(5, headerBottom, w - 5, headerBottom);

  let y = headerBottom + 4;

  const separator = () => {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(margin, y, w - margin, y);
    y += 3;
  };

  const strongSeparator = () => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, y, w - margin, y);
    y += 3;
  };

  // ─── CLIENTE ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CLIENTE:", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${sale.client_nome || "—"}`, margin, y);
  if (sale.client_cpf_cnpj) doc.text(`CPF/CNPJ: ${sale.client_cpf_cnpj}`, w / 2, y);
  y += 3.8;

  strongSeparator();

  // ─── PRODUTOS ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PRODUTOS:", margin, y);
  y += 3.5;

  // Cabeçalho da tabela — sem fundo, linhas
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  y += 3.5;
  doc.text("Produto", margin + 2, y);
  doc.text("Qtd", 120, y);
  doc.text("Unit.", 138, y);
  doc.text("Total", 160, y);
  y += 1.5;
  doc.line(margin, y, w - margin, y);
  y += 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  (sale.itens || []).forEach((item, i) => {
    if (y > pageH - 35) {
      doc.addPage();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, w - 10, pageH - 10, "S");
      y = 12;
    }
    if (i > 0) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(margin, y - 1, w - margin, y - 1);
    }
    doc.setTextColor(0, 0, 0);
    doc.text(String(item.produto_nome || "—").substring(0, 42), margin + 2, y);
    doc.text(String(item.quantidade || 1), 120, y);
    doc.text(`R$ ${Number(item.valor_unitario || 0).toFixed(2)}`, 135, y);
    doc.text(`R$ ${Number(item.total || 0).toFixed(2)}`, 158, y);
    y += 5;
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // ─── TOTAIS ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TOTAIS:", margin, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  // Subtotal = soma dos itens (sem duplicar)
  const subtotalReal = (sale.itens || []).reduce((s, i) => s + Number(i.total || 0), 0);

  doc.text("Subtotal:", margin + 3, y);
  doc.text(`R$ ${subtotalReal.toFixed(2)}`, w - margin, y, { align: "right" });
  y += 3.8;

  if (sale.desconto_valor > 0) {
    const descontoExibicao = sale.desconto_tipo === "percentual"
      ? `${sale.desconto_valor}%`
      : `R$ ${Number(sale.desconto_valor).toFixed(2)}`;
    const valorDesconto = subtotalReal - Number(sale.total || 0);
    doc.text(`Desconto (${descontoExibicao}):`, margin + 3, y);
    doc.text(`- R$ ${Math.max(0, valorDesconto).toFixed(2)}`, w - margin, y, { align: "right" });
    y += 3.8;
  }

  // TOTAL — sem tarja
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL:", margin + 3, y);
  doc.text(`R$ ${Number(sale.total || 0).toFixed(2)}`, w - margin, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // ─── PAGAMENTO ────────────────────────────────────────────────────────────
  const formaMap = {
    dinheiro: "Dinheiro", pix: "PIX", cartao_debito: "Cartão Débito",
    cartao_credito: "Cartão Crédito", boleto: "Boleto"
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`Forma de pagamento: ${formaMap[sale.forma_pagamento] || sale.forma_pagamento || "—"}`, margin, y);
  y += 4;
  if (sale.forma_pagamento === "dinheiro" && sale.troco > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Valor pago: R$ ${Number(sale.valor_pago || 0).toFixed(2)}  |  Troco: R$ ${Number(sale.troco || 0).toFixed(2)}`, margin, y);
    y += 4;
  }

  separator();

  // ─── RODAPÉ FISCAL ────────────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  const rodape = [
    "FATURA DE LOCAÇÃO DE BENS MÓVEIS SEM OPERADOR E MONTAGEM",
    "Isento de I.S.S. - Lei complementar nº 116/2003 - Art. 3 - inciso II",
    "Não tipifica fato gerador de I.S.S. por se tratar de locação de equipamentos para construção civil.",
    "Empresa desobrigada de emissão de Nota Fiscal.",
  ];
  rodape.forEach(l => { doc.text(l, w / 2, y, { align: "center" }); y += 3.5; });

  doc.save(`venda-${sale.numero || "balcao"}.pdf`);
}