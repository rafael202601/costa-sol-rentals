import { jsPDF } from "jspdf";
import { format } from "date-fns";

function addHeader(doc, settings, pageWidth, pageHeight) {
  // Borda da página
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(5, 5, pageWidth - 10, (pageHeight || 297) - 10, "S");

  // Header sem cor — linha separadora
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(5, 30, pageWidth - 5, 30);

  if (settings?.logo_url) {
    try { doc.addImage(settings.logo_url, "PNG", 10, 6, 18, 18); } catch (_) {}
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(settings?.nome_fantasia || settings?.nome_social || "Empresa", settings?.logo_url ? 32 : 10, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (settings?.telefone) doc.text(`Tel: ${settings.telefone}`, settings?.logo_url ? 32 : 10, 20);
  if (settings?.endereco) doc.text(settings.endereco, settings?.logo_url ? 32 : 10, 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA CADASTRAL DO CLIENTE", pageWidth - 10, 14, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth - 10, 20, { align: "right" });
}

function section(doc, title, y, pageWidth) {
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 7, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(title.toUpperCase(), 13, y + 5);
  return y + 10;
}

function row(doc, label, value, x, y, w = 85) {
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text(label + ":", x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(value || "—"), x, y + 4.5);
  return y;
}

export function generateClienteFichaPDF({ client, settings, clausula = "", signatureDataUrl = null }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 36;

  addHeader(doc, settings, pw, ph);

  // ── Dados Cadastrais
  y = section(doc, "Dados Cadastrais", y, pw);
  row(doc, "Nome / Razão Social", client.nome_razao_social, 13, y);
  row(doc, "Fantasia", client.fantasia, pw / 2 + 5, y);
  y += 12;
  row(doc, "CPF / CNPJ", client.cpf_cnpj, 13, y);
  row(doc, "RG", client.rg, pw / 2 + 5, y);
  y += 12;
  row(doc, "Inscrição Estadual", client.inscricao_estadual, 13, y);
  row(doc, "Inscrição Municipal", client.inscricao_municipal, pw / 2 + 5, y);
  y += 12;
  const nascDate = client.data_nascimento ? new Date(client.data_nascimento) : null;
  const nascStr = nascDate && !isNaN(nascDate.getTime()) ? format(nascDate, "dd/MM/yyyy") : "—";
  row(doc, "Data de Nascimento", nascStr, 13, y);
  row(doc, "Código do Cliente", client.codigo_cliente, pw / 2 + 5, y);
  y += 14;

  // ── Contatos
  y = section(doc, "Contatos", y, pw);
  row(doc, "Telefone 1", client.telefone1, 13, y);
  row(doc, "Telefone 2", client.telefone2, pw / 2 + 5, y);
  y += 12;
  row(doc, "Telefone 3", client.telefone3, 13, y);
  row(doc, "E-mail", client.email, pw / 2 + 5, y);
  y += 12;
  row(doc, "Cônjuge / Contato", client.conjuge_contato, 13, y);
  row(doc, "Sócio", client.socio, pw / 2 + 5, y);
  y += 14;

  // ── Endereço
  y = section(doc, "Endereço Principal", y, pw);
  const endFull = [
    client.endereco_entrega_rua,
    client.endereco_entrega_numero,
    client.endereco_entrega_complemento,
  ].filter(Boolean).join(", ");
  row(doc, "Logradouro", endFull || "—", 13, y);
  y += 12;
  row(doc, "Bairro", client.endereco_entrega_bairro, 13, y);
  row(doc, "Cidade / UF", `${client.endereco_entrega_cidade || ""}${client.endereco_entrega_uf ? " - " + client.endereco_entrega_uf : ""}`, pw / 2 + 5, y);
  y += 12;
  row(doc, "CEP", client.endereco_entrega_cep, 13, y);
  y += 14;

  // ── Pessoas Autorizadas
  if ((client.pessoas_liberadas || []).length > 0) {
    y = section(doc, "Pessoas Autorizadas", y, pw);
    for (const p of client.pessoas_liberadas) {
      // Verificar nova página
      if (y > 250) { doc.addPage(); addHeader(doc, settings, pw, ph); y = 36; }
      let statusValidade = "—";
      let vencStr = "";
      if (p.data_vencimento) {
        const vencDate = new Date(p.data_vencimento);
        if (!isNaN(vencDate.getTime())) {
          statusValidade = vencDate < new Date() ? "VENCIDO" : "ATIVO";
          vencStr = ` (venc. ${format(vencDate, "dd/MM/yyyy")})`;
        }
      }
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${p.nome || "—"}`, 13, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`CPF: ${p.cpf || "—"} | Tel: ${p.telefone || "—"} | Status: ${statusValidade}${vencStr}`, 13, y + 4);
      y += 9;
    }
    y += 5;
  }

  // ── Validade do Cadastro
  if (y > 240) { doc.addPage(); addHeader(doc, settings, pw, ph); y = 36; }
  y = section(doc, "Validade do Cadastro", y, pw);
  const validadeDate = client.data_validade_cadastro ? new Date(client.data_validade_cadastro) : null;
  const validadeStr = validadeDate && !isNaN(validadeDate.getTime()) ? format(validadeDate, "dd/MM/yyyy") : "—";
  row(doc, "Data de Validade", validadeStr, 13, y);
  row(doc, "Status Cadastral", client.bloqueado ? "BLOQUEADO" : "Ativo", pw / 2 + 5, y);
  y += 14;

  // ── Observações
  if (client.observacoes) {
    if (y > 230) { doc.addPage(); addHeader(doc, settings, pw, ph); y = 36; }
    y = section(doc, "Observações", y, pw);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(client.observacoes, pw - 26);
    doc.text(lines, 13, y);
    y += lines.length * 4.5 + 6;
  }

  // ── Cláusula / Termo
  if (clausula) {
    if (y > 220) { doc.addPage(); addHeader(doc, settings, pw, ph); y = 36; }
    y = section(doc, "Termo de Responsabilidade", y, pw);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(71, 85, 105);
    const clausulaLines = doc.splitTextToSize(clausula, pw - 26);
    if (y + clausulaLines.length * 4 > 255) { doc.addPage(); addHeader(doc, settings, pw); y = 34; }
    doc.text(clausulaLines, 13, y);
    y += clausulaLines.length * 4 + 8;
  }

  // ── Assinatura
  if (y > 240) { doc.addPage(); addHeader(doc, settings, pw, ph); y = 36; }
  y += 6;
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);

  // Se assinatura fornecida, renderizar acima da linha
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", 13, y, 70, 18);
    } catch (_) {}
    y += 18;
  } else {
    y += 18;
  }

  doc.line(13, y, pw / 2 - 5, y);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Assinatura do Cliente", 13, y + 5);
  doc.text(`${client.nome_razao_social || ""}`, 13, y + 9.5);

  doc.line(pw / 2 + 5, y, pw - 13, y);
  doc.text("Data e Local", pw / 2 + 5, y + 5);
  if (signatureDataUrl) {
    doc.text(`Assinado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pw / 2 + 5, y + 9.5);
  } else {
    doc.text(`____/____/______`, pw / 2 + 5, y + 9.5);
  }
  y += 14;

  // ── Footer com paginação
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages}`, pw - 10, 295, { align: "right" });
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 10, 295);
  }

  return doc;
}