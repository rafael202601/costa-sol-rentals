import jsPDF from "jspdf";
import { format } from "date-fns";

/**
 * Gera PDF de Recibo de Devolução para Contrato ou OS
 * @param {object} params
 * @param {object} params.doc - dados do contrato ou OS
 * @param {object} params.client - dados do cliente
 * @param {object} params.settings - configurações da empresa
 * @param {string} params.tipo - "contrato" | "os"
 * @param {string} params.tipoDevolucao - "parcial" | "total"
 * @param {Array}  params.itensDevolucao - [{nome, quantidade, observacao}]
 * @param {string} params.motorista - motorista responsável
 * @param {string} params.usuario - usuário que registrou
 * @param {string} params.observacoes - observações gerais
 * @param {string} params.assinaturaClienteUrl - base64 da assinatura do cliente (opcional)
 * @param {string} params.assinaturaResponsavelUrl - base64 da assinatura do responsável/usuário (opcional)
 * @param {number} params.numeroDevolucao - número sequencial da devolução (1, 2, 3...)
 * @returns {jsPDF}
 */
export function generateReciboDevolucaoPDF({
  doc,
  client,
  settings,
  tipo = "contrato",
  tipoDevolucao = "total",
  itensDevolucao = [],
  motorista = "",
  usuario = "",
  observacoes = "",
  assinaturaClienteUrl = null,
  assinaturaResponsavelUrl = null,
  numeroDevolucao = 1,
}) {
  const pdf = new jsPDF();
  const w = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const fantasia = settings?.nome_fantasia || settings?.nome_social || "Empresa";
  const social = settings?.nome_social || "";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";
  const email = settings?.email || "";

  const isContrato = tipo === "contrato";
  const isParcial = tipoDevolucao === "parcial";

  // ─── Header (fundo branco, padrão minimalista) ───────────────────────────────
  // Logo
  let logoW = 0;
  if (settings?.logo_url) {
    try {
      pdf.addImage(settings.logo_url, "PNG", 15, 7, 20, 20);
      logoW = 24;
    } catch (_) {}
  }

  const hx = 15 + logoW;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(fantasia, hx, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(60, 60, 60);
  let hy = 19;
  const parts1 = [social && social !== fantasia && social, cnpj && `CNPJ: ${cnpj}`].filter(Boolean);
  const parts2 = [telefone && `Tel: ${telefone}`, email && email].filter(Boolean);
  if (parts1.length) { pdf.text(parts1.join("   |   "), hx, hy); hy += 3.5; }
  if (parts2.length) { pdf.text(parts2.join("   |   "), hx, hy); hy += 3.5; }
  if (endereco) { pdf.text(endereco, hx, hy); hy += 3.5; }

  const docNum = isContrato ? (doc?.numero || doc?.id?.slice(-6)) : (doc?.numero || doc?.id?.slice(-6));
  const reciboId = `RD-${isContrato ? "C" : "OS"}${docNum}-${numeroDevolucao}`;

  // Número e data — canto direito
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Nº ${reciboId}`, w - 15, 13, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, w - 15, 18, { align: "right" });
  pdf.setTextColor(0, 0, 0);

  // Linha separadora
  const headerBottom = Math.max(hy + 1, 28);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(15, headerBottom, w - 15, headerBottom);

  let y = headerBottom + 6;

  // Título
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(0, 0, 0);
  const badgeText = isParcial ? "RECIBO DE DEVOLUÇÃO PARCIAL" : "RECIBO DE DEVOLUÇÃO TOTAL";
  pdf.text(badgeText, w / 2, y, { align: "center" });
  y += 2;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.line(30, y, w - 30, y);
  y += 8;

  // Divider
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);

  // ─── Dados do Cliente ────────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("DADOS DO CLIENTE", 15, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  const clientRows = [
    ["Nome:", doc?.client_nome || "—"],
    client?.codigo_cliente ? ["Código:", client.codigo_cliente] : null,
    (client?.cpf_cnpj || doc?.client_cpf_cnpj) ? ["CPF/CNPJ:", client?.cpf_cnpj || doc?.client_cpf_cnpj] : null,
    (client?.telefone1 || client?.telefone) ? ["Telefone:", client?.telefone1 || client?.telefone] : null,
  ].filter(Boolean);

  clientRows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 17, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(value), 45, y);
    y += 5;
  });

  y += 3;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, w - 15, y);
  y += 7;

  // ─── Dados do Contrato/OS ────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text(isContrato ? "DADOS DO CONTRATO" : "DADOS DA ORDEM DE SERVIÇO", 15, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  if (isContrato) {
    const contratoRows = [
      ["Contrato Nº:", doc?.numero || "—"],
      doc?.obra_nome ? ["Obra:", doc.obra_nome] : null,
      (doc?.endereco_entrega || doc?.obra_endereco) ? ["Endereço:", doc?.endereco_entrega || doc?.obra_endereco] : null,
      doc?.data_inicio ? ["Início:", doc.data_inicio.substring(0, 10).split("-").reverse().join("/")] : null,
      ["Tipo Devolução:", isParcial ? "Parcial" : "Total"],
      ["Data/Hora:", format(new Date(), "dd/MM/yyyy HH:mm")],
    ].filter(Boolean);
    contratoRows.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, 17, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(value), 55, y);
      y += 5;
    });
  } else {
    const osRows = [
      ["OS Nº:", doc?.numero || "—"],
      doc?.local_entrega ? ["Local:", doc.local_entrega] : null,
      doc?.tipo_cacamba ? ["Tipo Caçamba:", doc.tipo_cacamba] : null,
      ["Tipo Devolução:", isParcial ? "Parcial" : "Total"],
      ["Data/Hora:", format(new Date(), "dd/MM/yyyy HH:mm")],
    ].filter(Boolean);
    osRows.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, 17, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(value).slice(0, 80), 55, y);
      y += 5;
    });
  }

  y += 3;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, w - 15, y);
  y += 7;

  // ─── Dados Operacionais ──────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("DADOS OPERACIONAIS", 15, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  const opRows = [
    motorista ? ["Motorista:", motorista] : null,
    usuario ? ["Responsável:", usuario] : null,
    ["Data/Hora Registro:", format(new Date(), "dd/MM/yyyy HH:mm")],
  ].filter(Boolean);

  opRows.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 17, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(value), 52, y);
    y += 5;
  });

  y += 3;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, w - 15, y);
  y += 7;

  // ─── Equipamentos Devolvidos ──────────────────────────────────────────────────
  if (itensDevolucao.length > 0) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text("EQUIPAMENTOS DEVOLVIDOS", 15, y);
    y += 5;

    // Table header
    pdf.setFillColor(245, 245, 250);
    pdf.rect(15, y - 1, w - 30, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("Descrição", 17, y + 3.5);
    pdf.text("Qtd", 130, y + 3.5, { align: "right" });
    pdf.text("Un.", 148, y + 3.5, { align: "right" });
    pdf.text("Observação", 155, y + 3.5);
    y += 9;

    pdf.setFont("helvetica", "normal");
    itensDevolucao.forEach((item, i) => {
      if (y > pageH - 60) {
        pdf.addPage();
        y = 20;
      }
      const bg = i % 2 === 0 ? [252, 252, 254] : [255, 255, 255];
      pdf.setFillColor(...bg);
      pdf.rect(15, y - 1, w - 30, 6, "F");
      pdf.setFontSize(8);
      pdf.text(String(item.nome || "—").slice(0, 45), 17, y + 3);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(item.quantidade || 1), 130, y + 3, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.text(item.unidade || "un.", 148, y + 3, { align: "right" });
      if (item.observacao) pdf.text(String(item.observacao).slice(0, 30), 155, y + 3);
      y += 6;
    });

    // Total
    y += 2;
    pdf.setFillColor(245, 245, 250);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.4);
    pdf.rect(15, y - 2, w - 30, 8, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const totalQtd = itensDevolucao.reduce((s, i) => s + (i.quantidade || 1), 0);
    pdf.text(`Total de itens devolvidos: ${itensDevolucao.length} tipo(s) — ${totalQtd} unidade(s)`, 18, y + 3.5);
    y += 12;
  }

  // ─── Observações ────────────────────────────────────────────────────────────
  if (observacoes) {
    if (y > pageH - 60) { pdf.addPage(); y = 20; }
    pdf.setDrawColor(220, 220, 220);
    pdf.line(15, y, w - 15, y);
    y += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text("OBSERVAÇÕES", 15, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(observacoes, w - 30);
    lines.forEach(line => { pdf.text(line, 17, y); y += 5; });
    y += 3;
  }

  // ─── Assinaturas ─────────────────────────────────────────────────────────────
  if (y > pageH - 70) { pdf.addPage(); y = 20; }

  pdf.setDrawColor(220, 220, 220);
  pdf.line(15, y, w - 15, y);
  y += 8;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("ASSINATURAS", 15, y);
  y += 8;

  const sigY = y;
  const col1X = 17;
  const col2X = w / 2 + 5;
  const sigLineW = w / 2 - 22;

  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);

  // ── Col1: Responsável pela devolução (primeiro) ──
  if (assinaturaResponsavelUrl) {
    try {
      pdf.addImage(assinaturaResponsavelUrl, "PNG", col1X, sigY, 60, 20);
    } catch (_) {}
  }
  pdf.line(col1X, sigY + 22, col1X + sigLineW, sigY + 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(motorista || usuario || "Responsável", col1X + sigLineW / 2, sigY + 27, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text("(Responsável pela Devolução)", col1X + sigLineW / 2, sigY + 32, { align: "center" });

  // ── Col2: Cliente (segundo) ──
  if (assinaturaClienteUrl) {
    try {
      pdf.addImage(assinaturaClienteUrl, "PNG", col2X, sigY, 60, 20);
    } catch (_) {}
  }
  pdf.line(col2X, sigY + 22, col2X + sigLineW, sigY + 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(doc?.client_nome || "Cliente", col2X + sigLineW / 2, sigY + 27, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text("(Assinatura do Cliente)", col2X + sigLineW / 2, sigY + 32, { align: "center" });

  y = sigY + 40;

  // ─── Footer ──────────────────────────────────────────────────────────────────
  if (y > pageH - 20) { pdf.addPage(); y = 20; }
  pdf.setFontSize(7);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} — ${fantasia} — ${reciboId}`,
    w / 2,
    pageH - 8,
    { align: "center" }
  );

  return pdf;
}