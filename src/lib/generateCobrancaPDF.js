import jsPDF from "jspdf";
import { format } from "date-fns";

// ── VALOR POR EXTENSO ─────────────────────────────────────────────────────────
function valorPorExtenso(valor) {
  if (!valor || valor === 0) return "Zero reais";
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const unidades = [
    "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
  ];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function grupo(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";
    let r = "";
    if (n >= 100) { r += centenas[Math.floor(n / 100)]; n = n % 100; if (n > 0) r += " e "; }
    if (n >= 20) { r += dezenas[Math.floor(n / 10)]; if (n % 10 > 0) r += " e " + unidades[n % 10]; }
    else if (n > 0) { r += unidades[n]; }
    return r;
  }

  function buildMil(n) {
    if (n >= 1000) {
      const mil = Math.floor(n / 1000);
      let r = mil === 1 ? "mil" : grupo(mil) + " mil";
      const resto = n % 1000;
      if (resto > 0) r += " e " + grupo(resto);
      return r;
    }
    return grupo(n);
  }

  let resultado = "";
  if (inteiro >= 1000000) {
    const mi = Math.floor(inteiro / 1000000);
    resultado += grupo(mi) + (mi === 1 ? " milhão" : " milhões");
    const resto = inteiro % 1000000;
    if (resto > 0) resultado += " e " + buildMil(resto);
  } else {
    resultado = buildMil(inteiro);
  }

  resultado += inteiro === 1 ? " real" : " reais";
  if (centavos > 0) resultado += " e " + grupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

// ── VALIDAÇÃO ─────────────────────────────────────────────────────────────────
export function validateCobrancaData({ client, settings }) {
  const erros = [];
  if (!settings?.nome_social && !settings?.nome_fantasia) erros.push("Nome da empresa não configurado");
  if (!settings?.cnpj) erros.push("CNPJ da empresa não configurado");
  if (!settings?.endereco) erros.push("Endereço da empresa não configurado");
  if (!client?.nome_razao_social) erros.push("Nome do cliente não preenchido");
  if (!client?.cpf_cnpj) erros.push("CPF/CNPJ do cliente não preenchido");
  return erros;
}

// ── GERAÇÃO DO PDF — NOVO PADRÃO VISUAL ──────────────────────────────────────
export function generateCobrancaPDF({
  client,
  contracts = [],
  orders = [],
  settings,
  itensDescricao = [],
  rodapePersonalizado = null,
  numeroNota = null,
  desconto = 0,
  valorFinalOverride = null,
}) {
  const erros = validateCobrancaData({ client, settings });
  if (erros.length > 0) {
    throw new Error("Não é possível gerar a cobrança. Existem dados obrigatórios não preenchidos:\n• " + erros.join("\n• "));
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const fantasia = settings?.nome_fantasia || settings?.nome_social || "";
  const social = settings?.nome_social || "";
  const cnpj = settings?.cnpj || "";
  const endereco = settings?.endereco || "";
  const telefone = settings?.telefone || "";
  const email = settings?.email || "";

  // ── Borda externa ──────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, w - 10, pageH - 10, "S");

  // ── Cabeçalho limpo ───────────────────────────────────────────────────────
  let logoW = 0;
  if (settings?.logo_url) {
    try { doc.addImage(settings.logo_url, "PNG", margin, 7, 22, 22); logoW = 26; } catch (_) {}
  }

  const hx = margin + logoW;
  const hRight = w - margin;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(fantasia, hx, 13);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  let hy = 18;
  const infoL1 = [social !== fantasia && social, cnpj && `CNPJ: ${cnpj}`].filter(Boolean);
  const infoL2 = [telefone && `Tel: ${telefone}`, email].filter(Boolean);
  if (infoL1.length) { doc.text(infoL1.join("   |   "), hx, hy); hy += 4; }
  if (infoL2.length) { doc.text(infoL2.join("   |   "), hx, hy); hy += 4; }
  if (endereco) { doc.text(endereco, hx, hy); hy += 4; }

  // Título — canto superior direito
  const tituloNota = numeroNota ? `Nº ${numeroNota}` : "";
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FATURA / COBRANÇA", hRight, 13, { align: "right" });
  if (tituloNota) {
    doc.setFontSize(11);
    doc.text(tituloNota, hRight, 20, { align: "right" });
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy")}`, hRight, tituloNota ? 26 : 19, { align: "right" });

  // Linha separadora
  const headerBottom = Math.max(hy + 2, 32);
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

  // ── Dados do cliente ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DESTINATÁRIO / CLIENTE:", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const enderecoCliente = [
    client.endereco_entrega_rua,
    client.endereco_entrega_numero ? `nº ${client.endereco_entrega_numero}` : null,
    client.endereco_entrega_complemento || null,
    client.endereco_entrega_bairro || null,
    client.endereco_entrega_cidade || null,
    client.endereco_entrega_uf ? `- ${client.endereco_entrega_uf}` : null,
    client.endereco_entrega_cep ? `CEP: ${client.endereco_entrega_cep}` : null,
  ].filter(Boolean).join(", ");

  doc.text(`Nome: ${client.nome_razao_social || "—"}`, margin, y);
  doc.text(`CPF/CNPJ: ${client.cpf_cnpj || "—"}`, w / 2, y);
  y += 3.8;
  if (client.telefone1 || client.email) {
    if (client.telefone1) doc.text(`Tel: ${client.telefone1}`, margin, y);
    if (client.email) doc.text(`E-mail: ${client.email}`, w / 2, y);
    y += 3.8;
  }
  if (enderecoCliente) {
    const addrLines = doc.splitTextToSize(`Endereço: ${enderecoCliente}`, w - margin * 2);
    addrLines.forEach(l => { doc.text(l, margin, y); y += 3.5; });
  }

  separator();

  // ── Tabela de itens ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DESCRIÇÃO DOS ITENS / SERVIÇOS:", margin, y);
  y += 3.5;

  // Header da tabela
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  doc.setFontSize(6.5);
  y += 3.5;
  const COL = { desc: margin + 2, qtd: w - margin - 50, unit: w - margin - 28, total: w - margin };
  doc.text("Descrição", COL.desc, y);
  doc.text("Qtd", COL.qtd, y, { align: "center" });
  doc.text("Vlr. Unit.", COL.unit, y, { align: "right" });
  doc.text("Total", COL.total, y, { align: "right" });
  y += 1.5;
  doc.line(margin, y, w - margin, y);
  y += 3;

  // Monta itens
  let itens = [];
  if (itensDescricao && itensDescricao.length > 0) {
    itens = itensDescricao;
  } else {
    for (const c of contracts) {
      if (c.itens && c.itens.length > 0) {
        for (const eq of c.itens) {
          itens.push({
            descricao: `${eq.equipamento_nome || "Equipamento"} — Contrato nº ${c.numero || "—"}${c.obra_nome ? ` (${c.obra_nome})` : ""}`,
            quantidade: eq.quantidade_retirada || 1,
            valor_unitario: eq.valor_unitario || eq.valor_diario || 0,
            total: (eq.valor_unitario || eq.valor_diario || 0) * (eq.quantidade_retirada || 1),
          });
        }
        if (itens.every(i => i.total === 0)) {
          itens = itens.filter(i => !i.descricao.includes(`Contrato nº ${c.numero}`));
          itens.push({
            descricao: `Locação de Equipamentos — Contrato nº ${c.numero || "—"}${c.obra_nome ? ` (${c.obra_nome})` : ""}`,
            quantidade: 1,
            valor_unitario: c.saldo_pagar || c.valor_total || 0,
            total: c.saldo_pagar || c.valor_total || 0,
          });
        }
      } else {
        itens.push({
          descricao: `Locação de Equipamentos — Contrato nº ${c.numero || "—"}${c.obra_nome ? ` (${c.obra_nome})` : ""}`,
          quantidade: 1,
          valor_unitario: c.saldo_pagar || c.valor_total || 0,
          total: c.saldo_pagar || c.valor_total || 0,
        });
      }
    }
    for (const o of orders) {
      itens.push({
        descricao: `Locação de Caçamba${o.tipo_cacamba ? ` (${o.tipo_cacamba})` : ""} — OS nº ${o.numero || "—"}${o.local_entrega ? ` — ${o.local_entrega}` : ""}`,
        quantidade: 1,
        valor_unitario: o.valor || 0,
        total: o.valor || 0,
      });
    }
  }

  const fmt = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  itens.forEach((item, i) => {
    if (y > pageH - 50) {
      doc.addPage();
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
      doc.rect(5, 5, w - 10, pageH - 10, "S");
      y = 12;
    }
    if (i > 0) {
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1);
      doc.line(margin, y - 1, w - margin, y - 1);
    }
    const descLines = doc.splitTextToSize(item.descricao || "—", COL.qtd - margin - 4);
    descLines.forEach((l, li) => { doc.text(l, COL.desc, y + li * 3.5); });
    const rowH = Math.max(descLines.length * 3.5, 4);
    doc.text(String(item.quantidade || 1), COL.qtd, y + rowH / 2 - 1, { align: "center" });
    doc.text(fmt(item.valor_unitario), COL.unit, y + rowH / 2 - 1, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmt(item.total), COL.total, y + rowH / 2 - 1, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowH + 2;
  });

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // ── Total ──────────────────────────────────────────────────────────────────
  const subtotal = itens.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const descontoVal = Number(desconto) || 0;
  const total = valorFinalOverride !== null ? Number(valorFinalOverride) : Math.max(0, subtotal - descontoVal);

  if (y > pageH - 60) {
    doc.addPage();
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
    doc.rect(5, 5, w - 10, pageH - 10, "S");
    y = 12;
  }

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // Subtotal (sempre visível quando há desconto)
  if (descontoVal > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Subtotal:", margin + 3, y);
    doc.text(fmt(subtotal), w - margin, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(20, 120, 60);
    doc.text(`Desconto:`, margin + 3, y);
    doc.text(`- ${fmt(descontoVal)}`, w - margin, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 5;

    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, w - margin, y);
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL A PAGAR:", margin + 3, y);
  doc.text(fmt(total), w - margin, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.4);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // Por extenso
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(`Por extenso: ${valorPorExtenso(total)}`, margin + 3, y);
  doc.setTextColor(0, 0, 0);
  y += 5;

  // ── Dados para pagamento ───────────────────────────────────────────────────
  if (settings?.chave_pix || settings?.banco) {
    separator();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("DADOS PARA PAGAMENTO:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    if (settings?.chave_pix) { doc.text(`PIX: ${settings.chave_pix}`, margin + 3, y); y += 3.8; }
    if (settings?.banco) {
      doc.text(`Banco: ${settings.banco}   Agência: ${settings.agencia || "—"}   Conta: ${settings.conta || "—"}`, margin + 3, y);
      y += 3.8;
    }
    if (social || fantasia) { doc.text(`Beneficiário: ${social || fantasia}`, margin + 3, y); y += 3.8; }
    y += 2;
  }

  // ── Rodapé legal ──────────────────────────────────────────────────────────
  const rodapeH = 28;
  if (y < pageH - rodapeH - 10) {
    y = pageH - rodapeH - 10;
  } else if (y > pageH - rodapeH - 5) {
    doc.addPage();
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
    doc.rect(5, 5, w - 10, pageH - 10, "S");
    y = pageH - rodapeH - 10;
  }

  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 4;

  const rodapeLinhas = Array.isArray(rodapePersonalizado) ? rodapePersonalizado :
    rodapePersonalizado ? [rodapePersonalizado] : [
      "FATURA DE LOCAÇÃO DE BENS MÓVEIS SEM OPERADOR E MONTAGEM",
      "Isento de I.S.S. - Lei complementar nº 116/2003 - Art. 3 - inciso II",
      "Não tipifica fato gerador de I.S.S. por se tratar de locação de equipamentos para construção civil.",
      "Empresa desobrigada de emissão de Nota Fiscal.",
    ];

  rodapeLinhas.forEach((linha, i) => {
    doc.setFontSize(i === 0 ? 7.5 : 7);
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(i === 0 ? 60 : 100, i === 0 ? 60 : 100, i === 0 ? 60 : 100);
    doc.text(linha, w / 2, y, { align: "center" });
    y += 4.5;
  });

  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `${fantasia}${cnpj ? ` · CNPJ ${cnpj}` : ""} · Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
    w / 2, y + 2, { align: "center" }
  );

  const nomeArquivo = `cobranca_${(client.nome_razao_social || "cliente").replace(/\s+/g, "_")}_${format(new Date(), "ddMMyyyy")}.pdf`;
  doc.save(nomeArquivo);
}