import jsPDF from "jspdf";
import { format, parseISO, differenceInDays } from "date-fns";
import { calcItemOrcamento, calcTotalOrcamento, getMinimoDescricao } from "./quoteCalc";

export function generateQuotePDF({ quote, client, settings, equipment }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const fantasia = settings?.nome_fantasia || "Empresa";
  const social = settings?.nome_social || "";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";
  const email = settings?.email || "";
  const pixKey = settings?.chave_pix || "";

  const dias = (quote.data_inicio && quote.data_fim)
    ? Math.max(0, differenceInDays(parseISO(quote.data_fim), parseISO(quote.data_inicio)))
    : 0;

  const calcResult = calcTotalOrcamento({
    itens: quote.itens || [],
    equipamentos: equipment || [],
    diasPeriodo: dias,
    settings,
  });

  const notas = getMinimoDescricao(
    calcResult.itensPorItens,
    calcResult.minimoContratoAplicado,
    calcResult.valorMinimoContrato
  );

  // ─── BORDA ───────────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, w - 10, pageH - 10, "S");

  // ─── CABEÇALHO UNIFICADO ─────────────────────────────────────────────────
  let logoW = 0;
  if (settings?.logo_url) {
    try {
      doc.addImage(settings.logo_url, "PNG", margin, 7, 22, 22);
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
  const infoLine1Parts = [social, cnpj && `CNPJ: ${cnpj}`].filter(Boolean);
  const infoLine2Parts = [telefone && `Tel: ${telefone}`, email].filter(Boolean);
  let hy = 18;
  if (infoLine1Parts.length) { doc.text(infoLine1Parts.join("   |   "), hx, hy); hy += 4; }
  if (infoLine2Parts.length) { doc.text(infoLine2Parts.join("   |   "), hx, hy); hy += 4; }
  if (endereco) { doc.text(endereco, hx, hy); hy += 4; }

  // Título centralizado
  hy += 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO", w / 2, hy, { align: "center" });
  hy += 2;

  // Nº + Data — canto superior direito
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Orçamento Nº ${quote.numero || "—"}`, hRight, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const validStr = quote.data_validade ? `Válido até: ${format(parseISO(quote.data_validade), "dd/MM/yyyy")}` : `Data: ${format(new Date(), "dd/MM/yyyy")}`;
  doc.text(validStr, hRight, 18, { align: "right" });

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
  doc.text(`Nome: ${quote.client_nome || "—"}`, margin, y);
  if (client?.cpf_cnpj) doc.text(`CPF/CNPJ: ${client.cpf_cnpj}`, w / 2, y);
  y += 3.8;
  if (client?.telefone1) { doc.text(`Tel: ${client.telefone1}`, margin, y); y += 3.8; }
  if (quote.endereco_entrega) { doc.text(`Entrega: ${quote.endereco_entrega}`, margin, y); y += 3.8; }
  if (dias > 0) { doc.text(`Período: ${dias} dias${quote.data_inicio ? ` (${format(parseISO(quote.data_inicio), "dd/MM")} a ${format(parseISO(quote.data_fim), "dd/MM/yyyy")})` : ""}`, margin, y); y += 3.8; }

  strongSeparator();

  // ─── TABELA DE ITENS ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("EQUIPAMENTOS / SERVIÇOS:", margin, y);
  y += 3.5;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  y += 3.5;
  doc.text("Item / Descrição", margin + 2, y);
  doc.text("Qtd", 120, y);
  doc.text("Dias", 132, y);
  doc.text("Vlr Unit.", 145, y);
  doc.text("Desc.", 163, y);
  doc.text("Subtotal", 185, y);
  y += 1.5;
  doc.line(margin, y, w - margin, y);
  y += 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  let totalDescontos = 0;
  (calcResult.itensPorItens || []).forEach((item, i) => {
    totalDescontos += item.descontoTotal || 0;
    if (y > pageH - 45) {
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
    doc.text(String(item.equipamento_nome || "—").substring(0, 34), margin + 2, y);
    doc.text(String(item.quantidade || 0), 120, y);
    const diasLabel = item.minimoAplicado ? `${item.diasEfetivos}*` : `${item.diasEfetivos || dias || "—"}`;
    doc.text(diasLabel, 132, y);
    doc.text(`R$ ${(item.valor_unitario || 0).toFixed(2)}`, 145, y);
    doc.text(item.descontoTotal > 0 ? `R$ ${item.descontoTotal.toFixed(2)}` : "—", 163, y);
    doc.text(`R$ ${item.subtotal.toFixed(2)}`, 185, y);
    y += 4.5;

    // ─── Linha de diária e mínimo ────────────────────────────────────────────
    doc.setFontSize(6);
    doc.setTextColor(90, 90, 90);

    const eq = (equipment || []).find(e => e.id === item.equipamento_id);
    const valDiario = item.valor_unitario || 0;
    const diasMin = (eq?.aplica_valor_minimo !== false && eq?.dias_minimos_proprio > 0)
      ? eq.dias_minimos_proprio
      : (settings?.minimo_dias > 0 ? settings.minimo_dias : 0);

    const infoPartes = [`Diária: R$ ${valDiario.toFixed(2)}`];
    if (diasMin > 0) {
      const valorMinItem = valDiario * (item.quantidade || 1) * diasMin;
      infoPartes.push(`Mín. ${diasMin} dia${diasMin !== 1 ? "s" : ""}: R$ ${valorMinItem.toFixed(2)}`);
    }
    doc.text(`  ↳ ${infoPartes.join("   |   ")}`, margin + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    y += 3.8;

    if (item.descontoAuto > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(34, 139, 34);
      doc.text(`  ↳ Desconto automático: R$ ${item.descontoAuto.toFixed(2)}`, margin + 2, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      y += 3.8;
    }
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // ─── RESUMO ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("RESUMO:", margin, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const printRow = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, margin + 3, y);
    doc.text(value, w - margin, y, { align: "right" });
    y += 3.8;
  };

  const fmt2 = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  if (calcResult.totalDiaria > 0) printRow("Valor da diária da locação:", `${fmt2(calcResult.totalDiaria)}/dia`);
  printRow("Subtotal equipamentos:", fmt2(calcResult.totalEquipamentos));
  if (calcResult.minimoContratoAplicado) printRow("Valor mínimo de contrato:", fmt2(calcResult.valorMinimoContrato));
  if (totalDescontos > 0) printRow("Total de descontos:", `- ${fmt2(totalDescontos)}`);
  if ((quote.frete || 0) > 0) printRow("Frete:", fmt2(quote.frete || 0));

  if (y > pageH - 30) {
    doc.addPage();
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, w - 10, pageH - 10, "S");
    y = 12;
  }

  // VALOR TOTAL — sem tarja
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VALOR TOTAL:", margin + 3, y);
  doc.text(`R$ ${(quote.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, w - margin, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;

  if (pixKey) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Pagamento via PIX: ${pixKey}`, margin, y);
    y += 4;
  }

  // ─── NOTAS DE COBRANÇA MÍNIMA ────────────────────────────────────────────
  if (notas.length > 0) {
    if (y > pageH - 35) { doc.addPage(); y = 12; }
    separator();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 70, 0);
    doc.text("⚠ INFORMAÇÕES DE COBRANÇA MÍNIMA:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    notas.forEach(nota => {
      const lines = doc.splitTextToSize(nota, w - margin * 2);
      lines.forEach(l => { doc.text(l, margin, y); y += 3.5; });
    });
    doc.text("* Dias com asterisco indicam que o mínimo do equipamento foi aplicado.", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  if (quote.observacoes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(`Obs: ${quote.observacoes}`, w - margin * 2);
    lines.forEach(l => { doc.text(l, margin, y); y += 3.5; });
    doc.setTextColor(0, 0, 0);
    y += 2;
  }

  // ─── CLÁUSULAS E CONDIÇÕES ───────────────────────────────────────────────
  const fmtVar = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const valorMinimoLocacao = calcResult.minimoContratoAplicado
    ? calcResult.valorMinimoContrato
    : calcResult.totalEquipamentos;

  // Usa APENAS clausulas_orcamento das settings. quote.clausulas é ignorado para garantir separação total.
  let clausulas = settings?.clausulas_orcamento || "";
  if (clausulas) {
    clausulas = clausulas
      .replace(/\{\{valor_diaria\}\}/gi, `${fmtVar(calcResult.totalDiaria)}/dia`)
      .replace(/\{\{valor_minimo\}\}/gi, fmtVar(valorMinimoLocacao))
      .replace(/\{\{valor_frete\}\}/gi, fmtVar(quote.frete || 0))
      .replace(/\{\{valor_total\}\}/gi, fmtVar(quote.valor_total || 0))
      .replace(/\{\{cliente_nome\}\}/gi, quote.client_nome || "—")
      .replace(/\{\{nome_cliente\}\}/gi, quote.client_nome || "—")
      .replace(/\{\{numero_orcamento\}\}/gi, quote.numero || "—");
  }
  if (clausulas) {
    if (y > pageH - 30) {
      doc.addPage();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, w - 10, pageH - 10, "S");
      y = 12;
    }
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(margin, y, w - margin, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text("CLÁUSULAS E CONDIÇÕES", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);
    const clausulaLines = doc.splitTextToSize(clausulas, w - margin * 2);
    clausulaLines.forEach(line => {
      if (y > pageH - 14) {
        doc.addPage();
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(5, 5, w - 10, pageH - 10, "S");
        y = 12;
      }
      doc.text(line, margin, y);
      y += 3.5;
    });
    doc.setTextColor(0, 0, 0);
    y += 3;
  }

  y += 3;
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Orçamento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} — Válido conforme data informada`,
    w / 2, y, { align: "center" }
  );

  return doc;
}