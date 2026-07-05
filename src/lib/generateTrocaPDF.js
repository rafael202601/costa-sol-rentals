import { jsPDF } from "jspdf";
import { format } from "date-fns";

/**
 * Gera e baixa o PDF de Recibo de Troca de Equipamento.
 * @param {object} doc - contrato ou OS
 * @param {object} client - cliente
 * @param {object} settings - configurações da empresa
 * @param {object} registro - registro da troca (do historico_trocas)
 * @param {number} numeroTroca - número sequencial da troca
 */
export function gerarReciboDeTroca({ doc, client, settings, registro, numeroTroca = 1 }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const w = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = w - margin * 2;

  const fantasia = settings?.nome_fantasia || settings?.nome_social || "Empresa";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";

  let y = 6;

  // Borda
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.4);
  pdf.rect(4, 4, w - 8, pageH - 8, "S");

  // Logo
  let logoW = 0;
  if (settings?.logo_url) {
    try { pdf.addImage(settings.logo_url, "PNG", margin, 7, 20, 20); logoW = 24; } catch (_) {}
  }

  // Cabeçalho empresa
  const hx = margin + logoW;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(0, 0, 0);
  pdf.text(fantasia, hx, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(80, 80, 80);
  let hy = 19;
  if (cnpj) { pdf.text(`CNPJ: ${cnpj}`, hx, hy); hy += 3.5; }
  if (telefone) { pdf.text(`Tel: ${telefone}`, hx, hy); hy += 3.5; }
  if (endereco) { pdf.text(endereco, hx, hy); }

  // Título do documento — canto direito
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(180, 80, 0);
  pdf.text("RECIBO DE TROCA DE EQUIPAMENTO", w - margin, 13, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Troca Nº ${String(numeroTroca).padStart(3, "0")}`, w - margin, 18, { align: "right" });
  pdf.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w - margin, 23, { align: "right" });
  pdf.text(`Documento: ${doc?.numero || "—"}`, w - margin, 28, { align: "right" });

  // Linha separadora
  y = 34;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(4, y, w - 4, y);
  y += 6;

  // Helpers
  const sectionLabel = (text) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(text.toUpperCase(), margin, y);
    y += 2;
    pdf.setDrawColor(120, 120, 120);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, w - margin, y);
    y += 5;
    pdf.setTextColor(0, 0, 0);
  };

  const row = (label, value, x = margin, bold = false) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(label, x, y);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(String(value || "—"), x, y + 4.5);
    return y + 9;
  };

  // ── CLIENTE ──
  sectionLabel("Dados do Cliente");
  const third = contentW / 3;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(doc?.client_nome || "—", margin, y);
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(80, 80, 80);
  const clienteInfo = [
    client?.cpf_cnpj && `CPF/CNPJ: ${client.cpf_cnpj}`,
    client?.codigo_cliente && `Cód: ${client.codigo_cliente}`,
    client?.telefone1 && `Tel: ${client.telefone1}`,
  ].filter(Boolean).join("   |   ");
  if (clienteInfo) { pdf.text(clienteInfo, margin, y); y += 5; }
  pdf.setTextColor(0, 0, 0);
  y += 2;

  // ── DADOS DA TROCA ──
  sectionLabel("Dados da Troca");

  const col2 = margin + contentW / 2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text("DATA / HORA", margin, y);
  pdf.text("TIPO DA TROCA", col2, y);
  y += 4.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text(registro.data || "—", margin, y);
  pdf.text(registro.tipo === "em_campo" ? "Em Campo (Motorista)" : "Na Loja (Balcão)", col2, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text("MOTIVO DA TROCA", margin, y);
  if (registro.motorista) pdf.text("MOTORISTA", col2, y);
  y += 4.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(180, 80, 0);
  pdf.text(registro.motivo || "—", margin, y);
  pdf.setTextColor(0, 0, 0);
  if (registro.motorista) pdf.text(registro.motorista, col2, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text("RESPONSÁVEL", margin, y);
  y += 4.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text(registro.usuario || "—", margin, y);
  y += 8;

  // ── EQUIPAMENTOS QUE SAÍRAM ──
  sectionLabel("Equipamentos Retirados (Saindo)");

  // Header tabela
  pdf.setFillColor(255, 235, 220);
  pdf.rect(margin, y - 2, contentW, 6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(140, 50, 0);
  pdf.text("EQUIPAMENTO", margin + 2, y + 2.5);
  pdf.text("QTD", w - margin - 20, y + 2.5);
  y += 8;

  (registro.itens_saindo || []).forEach((item, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(255, 248, 245);
      pdf.rect(margin, y - 2, contentW, 7, "F");
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(String(item.nome || "—").substring(0, 45), margin + 2, y + 3);
    pdf.text(String(item.quantidade || 1), w - margin - 15, y + 3);
    y += 7;
  });

  pdf.setDrawColor(200, 140, 100);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, w - margin, y);
  y += 6;

  // ── EQUIPAMENTOS QUE ENTRARAM ──
  sectionLabel("Equipamentos Entregues (Entrando)");

  pdf.setFillColor(220, 255, 235);
  pdf.rect(margin, y - 2, contentW, 6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(10, 100, 50);
  pdf.text("EQUIPAMENTO", margin + 2, y + 2.5);
  pdf.text("QTD", w - margin - 20, y + 2.5);
  y += 8;

  (registro.itens_entrando || []).forEach((item, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(240, 255, 248);
      pdf.rect(margin, y - 2, contentW, 7, "F");
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(String(item.nome || "—").substring(0, 45), margin + 2, y + 3);
    pdf.text(String(item.quantidade || 1), w - margin - 15, y + 3);
    y += 7;
  });

  pdf.setDrawColor(100, 180, 130);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, w - margin, y);
  y += 6;

  // ── ALTERAÇÃO DE COBRANÇA ──
  if (registro.alteracao_cobranca) {
    const ac = registro.alteracao_cobranca;
    sectionLabel("Regra de Cobrança");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    if (ac.regra === "manter") {
      pdf.setTextColor(30, 80, 180);
      pdf.text("✓ Cobrança mantida — sem alteração de valor", margin, y);
      y += 6;
    } else {
      pdf.setTextColor(10, 120, 50);
      pdf.text("↻ Cobrança atualizada conforme novo equipamento", margin, y);
      y += 5.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      const fmt = (v) => v ? `R$ ${Number(v).toFixed(2).replace(".", ",")}` : "—";
      pdf.text(`Valor anterior: ${fmt(ac.valor_anterior_diario)}/dia  →  Novo valor: ${fmt(ac.valor_novo_diario)}/dia`, margin, y);
      y += 5;
    }
    pdf.setTextColor(0, 0, 0);
    y += 2;
  }

  // ── OBSERVAÇÕES ──
  if (registro.observacao) {
    sectionLabel("Observações");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const obsLines = pdf.splitTextToSize(registro.observacao, contentW);
    obsLines.forEach(l => { pdf.text(l, margin, y); y += 5; });
    y += 3;
  }

  // ── ASSINATURAS ──
  const spaceNeeded = 40;
  if (y + spaceNeeded > pageH - 12) {
    pdf.addPage();
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.4);
    pdf.rect(4, 4, w - 8, pageH - 8, "S");
    y = 14;
  } else {
    y += 6;
  }

  sectionLabel("Assinaturas");

  const sigW = 70;
  const sigY = y + 14;

  // Assinatura do responsável / operador
  pdf.setDrawColor(80, 80, 80);
  pdf.setLineWidth(0.4);
  pdf.line(margin, sigY, margin + sigW, sigY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(registro.usuario || "Responsável", margin + sigW / 2, sigY + 4.5, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text("(Responsável / Operador)", margin + sigW / 2, sigY + 8.5, { align: "center" });
  pdf.text(`Data: ${registro.data || "___/___/______"}`, margin, sigY + 13);

  // Assinatura do cliente
  const rX = w - margin - sigW;
  if (registro.assinatura_url) {
    try {
      pdf.addImage(registro.assinatura_url, "PNG", rX, sigY - 14, sigW, 13);
    } catch (_) {}
  }
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(80, 80, 80);
  pdf.line(rX, sigY, rX + sigW, sigY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(doc?.client_nome || "Cliente", rX + sigW / 2, sigY + 4.5, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  pdf.text("(Cliente / Locatário)", rX + sigW / 2, sigY + 8.5, { align: "center" });

  y = sigY + 18;

  // Rodapé
  pdf.setFontSize(6);
  pdf.setTextColor(180, 180, 180);
  pdf.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | ${fantasia} — Sistema de Gestão`,
    w / 2, y + 4, { align: "center" }
  );

  const docTipoLabel = doc?.numero ? (doc.itens ? "contrato" : "os") : "doc";
  pdf.save(`recibo_troca_${docTipoLabel}_${doc?.numero || doc?.id}_troca${numeroTroca}.pdf`);
}