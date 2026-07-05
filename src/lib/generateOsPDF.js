import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";

export function generateOsPDF({ order, client, settings, signatureDataUrl = null }) {
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
  const email = settings?.email || "";

  // ─── helpers ─────────────────────────────────────────────────────────────
  let y = 0;

  const newPage = () => {
    doc.addPage();
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.rect(4, 4, w - 8, pageH - 8, "S");
    y = 12;
  };

  const checkPage = (needed = 16) => {
    if (y + needed > pageH - 12) newPage();
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
  const parts2 = [telefone && `Tel: ${telefone}`, email && email].filter(Boolean);
  if (parts1.length) { doc.text(parts1.join("   |   "), hx, hy); hy += 3.5; }
  if (parts2.length) { doc.text(parts2.join("   |   "), hx, hy); hy += 3.5; }
  if (endereco) { doc.text(endereco, hx, hy); hy += 3.5; }

  // OS Nº — canto direito
  const hRight = w - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`OS Nº ${order.numero || "—"}`, hRight, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy")}`, hRight, 18, { align: "right" });
  doc.text(`Status: ${order.status || "—"}`, hRight, 23, { align: "right" });
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
  doc.text("ORDEM DE SERVIÇO", w / 2, y, { align: "center" });
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + 25, y, w - margin - 25, y);
  y += 6;

  // ─── DADOS DO CLIENTE ────────────────────────────────────────────────────
  sectionLabel("Dados do Cliente");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(order.client_nome || "—", margin, y);
  y += 5;

  const half = contentW / 2;
  const third = contentW / 3;
  lbl("CPF / CNPJ", margin, y);
  lbl("CÓDIGO DO CLIENTE", margin + third, y);
  lbl("TELEFONE", margin + third * 2, y);
  y += 4;
  val(client?.cpf_cnpj || "—", margin, y, 9);
  val(client?.codigo_cliente || "—", margin + third, y, 9);
  val(client?.telefone1 || "—", margin + third * 2, y, 9);
  y += 5;

  const endCliente = [
    client?.endereco_entrega_rua,
    client?.endereco_entrega_numero && `Nº ${client.endereco_entrega_numero}`,
    client?.endereco_entrega_bairro,
    client?.endereco_entrega_cidade,
    client?.endereco_entrega_uf,
  ].filter(Boolean).join(", ");

  if (endCliente) {
    lbl("ENDEREÇO DO CLIENTE", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const el = doc.splitTextToSize(endCliente, contentW);
    el.forEach(l => { doc.text(l, margin, y); y += 4; });
  }
  y += 1;

  // ─── LOCAL DE ENTREGA / DADOS OPERACIONAIS ───────────────────────────────
  sectionLabel("Local de Entrega / Dados Operacionais");

  if (order.local_entrega) {
    lbl("ENDEREÇO DE ENTREGA", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const locLines = doc.splitTextToSize(order.local_entrega, contentW);
    locLines.forEach(l => { doc.text(l, margin, y); y += 4.5; });
    y += 1;
  }

  // Datas
  if (order.data_entrega || order.data_recolhimento) {
    thinLine();
    lbl("DATA / HORA DE ENTREGA", margin, y);
    if (order.data_recolhimento) lbl("DATA / HORA DE RECOLHIMENTO", margin + half, y);
    y += 4;
    if (order.data_entrega) {
      try { val(format(parseISO(order.data_entrega), "dd/MM/yyyy HH:mm"), margin, y, 9); }
      catch (_) { val(order.data_entrega.slice(0, 16), margin, y, 9); }
    }
    if (order.data_recolhimento) {
      try { val(format(parseISO(order.data_recolhimento), "dd/MM/yyyy HH:mm"), margin + half, y, 9); }
      catch (_) { val(order.data_recolhimento.slice(0, 16), margin + half, y, 9); }
    }
    y += 5;
  }

  // Motorista(s)
  if (order.motorista_entrega || order.motorista_recolhimento || order.veiculo_entrega) {
    thinLine();
    if (order.motorista_entrega) {
      lbl("MOTORISTA (ENTREGA)", margin, y);
      if (order.veiculo_entrega) lbl("VEÍCULO", margin + half, y);
      y += 4;
      val(order.motorista_entrega, margin, y, 9);
      if (order.veiculo_entrega) val(order.veiculo_entrega, margin + half, y, 9);
      y += 5;
      // Timestamp real da entrega
      if (order.data_entrega_real) {
        lbl("ENTREGA REALIZADA EM", margin, y);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 120, 60);
        doc.text(`✓ ${order.data_entrega_real}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    }
    if (order.motorista_recolhimento) {
      lbl("MOTORISTA (RECOLHIMENTO)", margin, y);
      y += 4;
      val(order.motorista_recolhimento, margin, y, 9);
      y += 5;
      // Timestamp real da recolha
      if (order.data_recolha_real) {
        lbl("RECOLHA REALIZADA EM", margin, y);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(160, 100, 0);
        doc.text(`✓ ${order.data_recolha_real}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    }
  }

  // Observações — em negrito
  if (order.observacoes) {
    checkPage(14);
    thinLine();
    lbl("OBSERVAÇÕES", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const obsLines = doc.splitTextToSize(order.observacoes, contentW);
    obsLines.forEach(l => { checkPage(5); doc.text(l, margin, y); y += 4.5; });
  }

  y += 2;

  // ─── SERVIÇO / EQUIPAMENTO ───────────────────────────────────────────────
  checkPage(22);
  sectionLabel("Serviço / Equipamento");

  // Cabeçalho da tabela — sem coluna código
  const COL = {
    desc: margin,
    qtd: margin + 100,
    inden: margin + 118,
    valor: margin + 150,
  };

  doc.setFillColor(238, 238, 238);
  doc.rect(margin, y - 1, contentW, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text("DESCRIÇÃO", COL.desc, y + 3.5);
  doc.text("QTD", COL.qtd, y + 3.5);
  doc.text("INDENIZAÇÃO", COL.inden, y + 3.5);
  doc.text("VALOR TOTAL", COL.valor, y + 3.5);
  y += 8;

  doc.setFillColor(250, 250, 250);
  doc.rect(margin, y - 2, contentW, 8, "F");

  const qtd = order.quantidade_cacambas || 1;
  const valorUnit = order.valor_unitario || order.valor || 0;
  const desc = order.tipo_cacamba
    ? `Locação de Caçamba — ${order.tipo_cacamba}`
    : "Serviço de Locação de Equipamentos";
  const indenOS = (order.valor_indenizacao || 0) * qtd;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(desc, COL.desc, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(String(qtd), COL.qtd, y + 4);
  doc.text(indenOS > 0 ? `R$ ${indenOS.toFixed(2)}` : "—", COL.inden, y + 4);
  doc.setFont("helvetica", "bold");
  doc.text(`R$ ${(order.valor || 0).toFixed(2)}`, w - margin, y + 4, { align: "right" });
  y += 10;

  if (qtd > 1 && valorUnit > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`(${qtd} un. × R$ ${valorUnit.toFixed(2)} cada)`, margin + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

  if (order.tipo_cacamba) {
    const qtdAtiva = order.quantidade_ativa ?? qtd;
    const qtdRec = order.quantidade_recolhida || 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    let cacInfo = `Tipo: ${order.tipo_cacamba}   |   Total: ${qtd} unid.`;
    if (qtdRec > 0) cacInfo += `   |   Ativas: ${qtdAtiva}   |   Recolhidas: ${qtdRec}`;
    doc.text(cacInfo, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 5;

  // ─── RESUMO FINANCEIRO ────────────────────────────────────────────────────
  checkPage(32);
  sectionLabel("Resumo Financeiro");

  const finRow = (label, value) => {
    checkPage(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(value, w - margin, y, { align: "right" });
    y += 6;
  };

  // Valor diário puro da OS
  const osDiaria = order.valor_unitario || 0;
  const osQtd = order.quantidade_cacambas || 1;
  const osDiariaTotal = osDiaria * osQtd;

  // Valor mínimo: OS não tem grupo A/B — a OS já representa cobrança mínima por si só
  // O tipo_cacamba determina se é caçamba (tem mínimo configurável) — valor total é o cobrado
  const osValorTotal = order.valor || 0;
  const osFreteVal = 0; // OS não tem frete separado; já está incluído no valor

  if (osDiariaTotal > 0) {
    finRow("Valor da locação diária:",
      `R$ ${osDiariaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }

  // Frete: só exibe se existir valor > 0
  const osFreteValReal = order.frete || 0;
  if (osFreteValReal > 0) {
    finRow("Frete:", `R$ ${osFreteValReal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  thinLine([180, 180, 180]);

  // Nota
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.text("* Valor pode ser ajustado conforme dias efetivos de uso.", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  // VALOR TOTAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("VALOR TOTAL:", margin, y);
  doc.text(`R$ ${osValorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w - margin, y, { align: "right" });
  y += 7;

  // ─── HISTÓRICO DE RECOLHAS ────────────────────────────────────────────────
  if ((order.historico_recolhas || []).length > 0) {
    checkPage(20);
    sectionLabel("Histórico de Recolhas");
    order.historico_recolhas.forEach((r, i) => {
      checkPage(8);
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(margin, y - 2, contentW, 7, "F"); }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`• ${r.data || "—"}`, margin, y + 3);
      doc.setFont("helvetica", "normal");
      doc.text(`${r.quantidade || 0} caçamba(s)`, margin + 28, y + 3);
      if (r.motorista && r.motorista !== "—") doc.text(`Motorista: ${r.motorista}`, w / 2, y + 3);
      y += 7;
      if (r.observacao) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        doc.text(`Obs: ${r.observacao}`, margin + 4, y);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Saldo ativo: ${order.quantidade_ativa ?? 0} caçamba(s)`, margin, y);
    y += 5;
  }

  // ─── CLÁUSULAS ────────────────────────────────────────────────────────────
  const clausulas = settings?.clausulas_os || "";
  if (clausulas) {
    checkPage(18);
    sectionLabel("Condições Gerais");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(clausulas, contentW);
    lines.forEach(line => {
      checkPage(5);
      doc.text(line, margin, y);
      y += 4;
    });
    doc.setTextColor(0, 0, 0);
    y += 2;
  }

  // ─── RESPONSÁVEL PELA OS ──────────────────────────────────────────────────
  if (order.locador_assinatura || order.locador_nome) {
    checkPage(22);
    sectionLabel("Responsável pela OS");
    if (order.locador_assinatura) {
      try { doc.addImage(order.locador_assinatura, "PNG", margin, y, 50, 12); } catch (_) {}
      y += 14;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const locInfo = [order.locador_nome, order.locador_data].filter(Boolean).join("   |   ");
    if (locInfo) { doc.text(locInfo, margin, y); y += 5; }
  }

  // ─── CRIADO POR / DATA DE CRIAÇÃO ─────────────────────────────────────────
  if (order.created_date || order.locador_nome) {
    checkPage(14);
    thinLine();
    const criadoPor = order.locador_nome || "—";
    const criadoEmRaw = order.created_date || order.locador_data || "";
    let criadoEmStr = "—";
    if (criadoEmRaw) {
      try {
        const d = new Date(criadoEmRaw);
        criadoEmStr = format(d, "dd/MM/yyyy 'às' HH:mm");
      } catch (_) { criadoEmStr = criadoEmRaw; }
    }
    const half = contentW / 2;
    lbl("CRIADO POR", margin, y);
    lbl("CRIADO EM", margin + half, y);
    y += 4;
    val(criadoPor, margin, y, 8.5);
    val(criadoEmStr, margin + half, y, 8.5);
    y += 5;
  }

  // ─── ASSINATURAS ─────────────────────────────────────────────────────────
  checkPage(34);
  y += 3;

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
  doc.text("(Empresa)", margin + sigW / 2, y + 8, { align: "center" });
  doc.text(`Data: ${format(new Date(), "dd/MM/yyyy")}`, margin, y + 12);

  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, "PNG", rX, y - 14, sigW, 13); } catch (_) {}
  }
  doc.line(rX, y, rX + sigW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(order.client_nome || "Cliente", rX + sigW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Cliente)", rX + sigW / 2, y + 8, { align: "center" });
  doc.text(
    order.assinatura_data ? `Assinado em: ${order.assinatura_data}` : "Data: ___/___/______",
    rX, y + 12
  );

  y += 18;
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | Sistema de Gestão`,
    w / 2, y, { align: "center" }
  );

  return doc;
}