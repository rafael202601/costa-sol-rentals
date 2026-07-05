import jsPDF from "jspdf";
import { format, parseISO } from "date-fns";
import { calcContractTotal, getDiasContrato, calcValorMinimoLocacao } from "./contractCalc";

function resolveVariables(text = "", vars = {}) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== null && vars[key] !== "" ? vars[key] : `{{${key}}}`;
  });
}

export function generateContractPDF({ contract, client, settings, signatureDataUrl = null }) {
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
  const cidade = (settings?.endereco || "").split(",").pop()?.trim() || "";

  const diasContratoPDF = contract.prazo_tipo === "dias"
    ? (contract.prazo_valor || 30)
    : (contract.prazo_valor || 1) * 30;

  const calcResult = calcContractTotal({
    itens: contract.itens || [],
    diasContrato: diasContratoPDF,
    diasMinimos: settings?.minimo_dias || 5,
    valorMinimoContrato: settings?.valor_minimo_contrato || 0,
    frete: contract.frete || 0,
    sinal: contract.sinal || 0,
    valorPago: contract.valor_pago || 0,
    regrasDesconto: settings?.regras_desconto_tempo || [],
  });

  const subtotalFinal = calcResult.valorBaseTotal || 0;
  const freteVal = contract.frete || 0;
  const valorTotalFinal = contract.valor_total || (subtotalFinal + freteVal);

  const diasMinimoGlobal = settings?.minimo_dias || 5;

  // ── RESUMO FINANCEIRO: 3 valores ──────────────────────────────────────────

  // 1. Valor da locação DIÁRIA pura: soma de (diária × qtd) de todos os itens, sem mínimo/frete
  const valorLocacaoDiaria = (contract.itens || []).reduce((s, item) => {
    const qty = item.quantidade_retirada || 1;
    const diaria = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
    return s + diaria * qty;
  }, 0);

  // 2. Valor mínimo de locação: só existe se há itens do Grupo A (aplica_valor_minimo=true)
  //    Calcula diária × diasMin × qtd por item, depois compara com valorMinimoContrato global.
  const grupoAParaMinimo = calcResult.grupoA || [];
  const temMinimoAplicavel = grupoAParaMinimo.length > 0;
  const valorMinimoConfig = settings?.valor_minimo_contrato || 0;

  const valorLocacaoMinima = temMinimoAplicavel
    ? (() => {
        const valorCalculado = grupoAParaMinimo.reduce((s, item) => {
          const qty = item.quantidade_retirada || 1;
          const diaria = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
          const diasMin = item._diasMinUsados > 0
            ? item._diasMinUsados
            : (item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : diasMinimoGlobal);
          return s + diaria * diasMin * qty;
        }, 0);
        return Math.max(valorCalculado, valorMinimoConfig);
      })()
    : 0;

  // Label de dias mínimos para exibição: se todos iguais mostra o valor; senão "variável"
  const diasMinimoLabel = (() => {
    if (!temMinimoAplicavel) return diasMinimoGlobal;
    const diasList = grupoAParaMinimo.map(i =>
      i._diasMinUsados > 0 ? i._diasMinUsados
      : (i.dias_minimos_proprio > 0 ? i.dias_minimos_proprio : diasMinimoGlobal)
    );
    const unicos = [...new Set(diasList)];
    return unicos.length === 1 ? unicos[0] : "variável";
  })();

  const vars = {
    nome_empresa: fantasia, cnpj_empresa: cnpj, endereco_empresa: endereco,
    telefone_empresa: telefone, cidade_empresa: cidade, estado_empresa: "SP",
    nome_cliente: contract.client_nome || "—", cpf_cnpj: client?.cpf_cnpj || "—",
    codigo_cliente: client?.codigo_cliente || "—", numero_contrato: contract.numero || "—",
    data_inicio: contract.data_inicio ? format(parseISO(contract.data_inicio), "dd/MM/yyyy") : "—",
    data_fim: contract.data_prevista_termino ? format(parseISO(contract.data_prevista_termino), "dd/MM/yyyy") : "—",
    usuario_criador: contract.criado_por || "—",
    valor_diaria: `R$ ${valorLocacaoDiaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    valor_minimo: temMinimoAplicavel ? `R$ ${valorLocacaoMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não se aplica",
    valor_frete: `R$ ${freteVal.toFixed(2)}`,
    valor_subtotal: `R$ ${subtotalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    valor_total: `R$ ${valorTotalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    dias_minimos: diasMinimoGlobal,
    dias_fechamento: settings?.intervalo_cobranca || 30,
  };

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

  // Section label — sem fundo escuro, apenas texto bold maiúsculo com linha abaixo
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

  const lbl = (text, x, yy, size = 7) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(100, 100, 100);
    doc.text(text, x, yy);
  };

  const val = (text, x, yy, size = 9, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(String(text || "—"), x, yy);
  };

  // ─── BORDA PÁGINA ────────────────────────────────────────────────────────
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

  // Nº contrato — canto direito
  const hRight = w - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Nº ${contract.numero || "—"}`, hRight, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy")}`, hRight, 18, { align: "right" });
  doc.text(`Status: ${contract.status || "—"}`, hRight, 23, { align: "right" });
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
  doc.text("CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS", w / 2, y, { align: "center" });
  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + 15, y, w - margin - 15, y);
  y += 6;

  // ─── LOCADORA ────────────────────────────────────────────────────────────
  sectionLabel("Locadora");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(fantasia, margin, y);
  y += 4.5;

  const locParts = [cnpj && `CNPJ: ${cnpj}`, telefone && `Tel: ${telefone}`, email && email].filter(Boolean).join("   |   ");
  if (locParts) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);
    doc.text(locParts, margin, y);
    y += 4;
  }
  if (endereco) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(endereco, margin, y);
    y += 4;
  }
  y += 1;

  // ─── DADOS DO CLIENTE ────────────────────────────────────────────────────
  sectionLabel("Locatário (Cliente)");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(contract.client_nome || "—", margin, y);
  y += 5;

  // CPF/CNPJ | Código | Telefone (3 colunas)
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
    lbl("ENDEREÇO", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const el = doc.splitTextToSize(endCliente, contentW);
    el.forEach(l => { doc.text(l, margin, y); y += 4; });
  }
  y += 1;

  // ─── DADOS DO CONTRATO ───────────────────────────────────────────────────
  sectionLabel("Dados do Contrato");

  // Data início | Data fim | Prazo — em linha
  const dataIni = contract.data_inicio ? format(parseISO(contract.data_inicio), "dd/MM/yyyy") : "—";
  const dataFim = contract.sem_prazo ? "Sem prazo" :
    (contract.data_prevista_termino ? format(parseISO(contract.data_prevista_termino), "dd/MM/yyyy") : "—");
  const prazoStr = contract.sem_prazo ? "Contínuo" :
    (contract.prazo_valor ? `${contract.prazo_valor} ${contract.prazo_tipo === "meses" ? "meses" : "dias"}` : "—");

  lbl("DATA DE INÍCIO", margin, y);
  lbl("DATA DE TÉRMINO", margin + third, y);
  lbl("PRAZO", margin + third * 2, y);
  y += 4;
  val(dataIni, margin, y, 9);
  val(dataFim, margin + third, y, 9);
  val(prazoStr, margin + third * 2, y, 9);
  y += 5;

  // Endereço de entrega / obra
  const endEntrega = contract.endereco_entrega || contract.obra_endereco || "";
  const obraNome = contract.obra_nome || "";

  if (obraNome || endEntrega || contract.solicitante_nome) {
    thinLine();
    if (obraNome) {
      lbl("OBRA", margin, y);
      y += 4;
      val(obraNome, margin, y, 9);
      y += 4;
    }
    if (endEntrega) {
      lbl("ENDEREÇO DE ENTREGA", margin, y);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const el = doc.splitTextToSize(endEntrega, contentW);
      el.forEach(l => { doc.text(l, margin, y); y += 4; });
    }
    if (contract.solicitante_nome) {
      lbl("SOLICITANTE", margin, y);
      if (contract.motorista_entrega) lbl("MOTORISTA ENTREGA", margin + half, y);
      y += 4;
      val(contract.solicitante_nome, margin, y, 8.5);
      if (contract.motorista_entrega) {
        val(contract.motorista_entrega + (contract.veiculo_entrega ? `  |  ${contract.veiculo_entrega}` : ""), margin + half, y, 8.5);
      }
      y += 4;
    }
    // Timestamps reais de entrega e recolha
    if (contract.data_entrega_real || contract.data_recolha_real) {
      thinLine();
      if (contract.data_entrega_real) {
        lbl("ENTREGA REALIZADA EM", margin, y);
        if (contract.data_recolha_real) lbl("RECOLHA REALIZADA EM", margin + half, y);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 120, 60);
        doc.text(`✓ ${contract.data_entrega_real}`, margin, y);
        if (contract.data_recolha_real) {
          doc.setTextColor(160, 100, 0);
          doc.text(`✓ ${contract.data_recolha_real}`, margin + half, y);
        }
        doc.setTextColor(0, 0, 0);
        y += 5;
      } else if (contract.data_recolha_real) {
        lbl("RECOLHA REALIZADA EM", margin, y);
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(160, 100, 0);
        doc.text(`✓ ${contract.data_recolha_real}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    }
  }

  // ─── CRIADO POR / DATA DE CRIAÇÃO ─────────────────────────────────────────
  if (contract.criado_por || contract.created_date) {
    thinLine();
    const criadoPor = contract.criado_por || "—";
    const criadoEmRaw = contract.created_date || contract.locador_data || "";
    let criadoEmStr = "—";
    if (criadoEmRaw) {
      try {
        const d = new Date(criadoEmRaw);
        criadoEmStr = format(d, "dd/MM/yyyy 'às' HH:mm");
      } catch (_) { criadoEmStr = criadoEmRaw; }
    }
    lbl("CRIADO POR", margin, y);
    lbl("CRIADO EM", margin + half, y);
    y += 4;
    val(criadoPor, margin, y, 8.5);
    val(criadoEmStr, margin + half, y, 8.5);
    y += 4;
  }

  // Observações — em negrito
  if (contract.observacoes) {
    checkPage(14);
    thinLine();
    lbl("OBSERVAÇÕES", margin, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const obsLines = doc.splitTextToSize(contract.observacoes, contentW);
    obsLines.forEach(l => { checkPage(5); doc.text(l, margin, y); y += 4.5; });
  }

  y += 2;

  // ─── TABELA DE EQUIPAMENTOS ───────────────────────────────────────────────
  const renderEquipTable = (itens, titulo) => {
    if (itens.length === 0) return;
    checkPage(22);
    sectionLabel(titulo);

    // Colunas: EQUIPAMENTO | QTD | VLR/UN | INDENIZAÇÃO | SUBTOTAL
    const COL = {
      nome: margin,
      qtd: margin + 90,
      vunit: margin + 103,
      inden: margin + 128,
      sub: margin + 155,
    };

    // Cabeçalho
    doc.setFillColor(238, 238, 238);
    doc.rect(margin, y - 1, contentW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(40, 40, 40);
    doc.text("EQUIPAMENTO", COL.nome, y + 3.5);
    doc.text("QTD", COL.qtd, y + 3.5);
    doc.text("VLR MÍN.", COL.vunit, y + 3.5);
    doc.text("INDENIZAÇÃO", COL.inden, y + 3.5);
    doc.text("SUBTOTAL", COL.sub, y + 3.5);
    y += 8;
    doc.setTextColor(0, 0, 0);

    itens.forEach((item, i) => {
      checkPage(8);
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 2, contentW, 7, "F");
      }

      const qty = item.quantidade_retirada || 1;
      const diaria = item.valor_diario > 0 ? item.valor_diario : (item.valor_unitario || 0);
      const diasMin = item.dias_minimos_proprio > 0 ? item.dias_minimos_proprio : diasMinimoGlobal;
      const vlrMin = item._temMinimo !== false ? diaria * diasMin * qty : diaria * qty;
      const indenizacao = (item.valor_indenizacao || 0) * qty;
      const subtotal = item._subtotal ?? (qty * (item.valor_unitario || 0) - (item.desconto || 0));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(String(item.equipamento_nome || "—").substring(0, 32), COL.nome, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(String(qty), COL.qtd, y + 3);
      doc.text(`R$ ${vlrMin.toFixed(2)}`, COL.vunit, y + 3);
      doc.text(indenizacao > 0 ? `R$ ${indenizacao.toFixed(2)}` : "—", COL.inden, y + 3);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${subtotal.toFixed(2)}`, COL.sub, y + 3);
      y += 7;
    });

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(margin, y, w - margin, y);
    y += 4;
  };

  const temGrupoA = calcResult.grupoA.length > 0;
  const todosItens = [...calcResult.grupoA, ...calcResult.grupoB];

  // Exibe em tabela única se não há mistura de grupos complexa, ou em separado
  if (temGrupoA && calcResult.grupoB.length > 0) {
    renderEquipTable(calcResult.grupoA, "Equipamentos — Cobrança Mínima");
    renderEquipTable(calcResult.grupoB, "Equipamentos — Dias Reais de Uso");
  } else {
    renderEquipTable(todosItens, "Equipamentos");
  }

  // ─── RESUMO FINANCEIRO ────────────────────────────────────────────────────
  checkPage(36);
  sectionLabel("Resumo Financeiro");

  // Helper: linha label (esquerda) + valor (direita)
  const finRow = (label, value, bold = false) => {
    checkPage(7);
    // label
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(label, margin, y);
    // valor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(value, w - margin, y, { align: "right" });
    y += 6;
  };

  // ── Linha 1: Valor da locação diária ──
  finRow(
    "Valor da locação diária:",
    `R$ ${valorLocacaoDiaria.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  // ── Linha 2: Valor mínimo de locação ──
  if (temMinimoAplicavel) {
    finRow(
      `Valor mínimo de locação (${diasMinimoLabel} dias mín.):`,
      `R$ ${valorLocacaoMinima.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  } else {
    finRow("Valor mínimo de locação:", "Não se aplica");
  }

  // ── Linha 3: Frete ──
  finRow(
    "Frete:",
    freteVal > 0
      ? `R$ ${freteVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—"
  );

  thinLine([180, 180, 180]);

  // Nota de ajuste
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.text("* Valor pode ser ajustado conforme dias efetivos entre entrega e devolução.", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  // VALOR TOTAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("VALOR TOTAL:", margin, y);
  doc.text(
    `R$ ${(contract.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    w - margin, y, { align: "right" }
  );
  y += 7;

  // ─── CLÁUSULAS ────────────────────────────────────────────────────────────
  const clausulas = settings?.clausulas_contrato || "";
  if (clausulas) {
    checkPage(20);
    sectionLabel(`Cláusulas do Contrato — Nº ${contract.numero || "—"}`);
    const resolved = resolveVariables(clausulas, vars);
    const lines = doc.splitTextToSize(resolved, contentW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 20, 20);
    lines.forEach((line) => {
      checkPage(6);
      doc.text(line, margin, y);
      y += 4;
    });
    doc.setTextColor(0, 0, 0);
    y += 3;
  }

  // ─── ASSINATURAS ─────────────────────────────────────────────────────────
  checkPage(36);
  y += 3;

  const sigW = 74;
  const locadorNome = contract.locador_nome || fantasia;
  const locadorData = contract.locador_data || "";

  if (contract.locador_assinatura) {
    try { doc.addImage(contract.locador_assinatura, "PNG", margin, y - 14, sigW, 13); } catch (_) {}
  }
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + sigW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(locadorNome, margin + sigW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Locador / Empresa)", margin + sigW / 2, y + 8, { align: "center" });
  doc.text(locadorData ? `Criado em: ${locadorData}` : "Data: ___/___/______", margin, y + 12);

  const rX = w - margin - sigW;
  if (signatureDataUrl) {
    try { doc.addImage(signatureDataUrl, "PNG", rX, y - 14, sigW, 13); } catch (_) {}
  }
  doc.line(rX, y, rX + sigW, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(contract.client_nome || "Locatário", rX + sigW / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("(Locatário)", rX + sigW / 2, y + 8, { align: "center" });
  doc.text(
    contract.assinatura_data ? `Assinado em: ${contract.assinatura_data}` : "Data: ___/___/______",
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