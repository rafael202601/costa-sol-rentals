/**
 * Gera um PDF de quitação para Contratos ou OS
 * Chama o gerador original e adiciona stamp de QUITADO
 */
import { generateContractPDF } from "./generateContractPDF";
import { generateOsPDF } from "./generateOsPDF";
import { format } from "date-fns";

/**
 * Adiciona um stamp "QUITADO" em diagonal no PDF e uma seção de quitação
 */
function addQuitadoStamp(doc, valorPago, formaPagamento, dataQuitacao) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Stamp diagonal em cada página
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.setFontSize(60);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 160, 60);
    doc.text("QUITADO", w / 2, h / 2, {
      align: "center",
      angle: 45,
    });
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // Última página — adicionar seção de quitação
  doc.setPage(totalPages);
  const pageH = doc.internal.pageSize.getHeight();
  let y = pageH - 55;
  if (y < 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 120, 50);
  doc.setDrawColor(0, 120, 50);
  doc.setLineWidth(0.5);
  doc.line(15, y, w - 15, y);
  y += 7;
  doc.text("DECLARAÇÃO DE QUITAÇÃO", w / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  const formLabel = {
    pix: "PIX", dinheiro: "Dinheiro", transferencia: "Transferência Bancária",
    cartao_debito: "Cartão de Débito", cartao_credito: "Cartão de Crédito",
    boleto: "Boleto", cartao: "Cartão",
  }[formaPagamento] || formaPagamento || "—";

  doc.text(`Declaramos para os devidos fins que o cliente quitou integralmente o valor deste documento.`, 15, y);
  y += 6;
  doc.text(`Valor quitado: R$ ${(valorPago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 15, y);
  doc.text(`Forma de pagamento: ${formLabel}`, w / 2, y);
  y += 6;
  doc.text(`Data da quitação: ${dataQuitacao || format(new Date(), "dd/MM/yyyy")}`, 15, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, w / 2, y + 4, { align: "center" });

  return doc;
}

/**
 * Gera PDF de quitação de contrato
 */
export function generateContractQuitadoPDF({ contract, client, settings, signatureDataUrl }) {
  const doc = generateContractPDF({ contract, client, settings, signatureDataUrl });
  const valorPago = contract.valor_pago || contract.valor_total || 0;
  const formaPagamento = contract.forma_pagamento || "pix";
  const data = contract.updated_date
    ? format(new Date(contract.updated_date), "dd/MM/yyyy")
    : format(new Date(), "dd/MM/yyyy");
  return addQuitadoStamp(doc, valorPago, formaPagamento, data);
}

/**
 * Gera PDF de quitação de OS
 */
export function generateOsQuitadoPDF({ order, client, settings, signatureDataUrl }) {
  const doc = generateOsPDF({ order, client, settings, signatureDataUrl });
  const valorPago = order.valor || 0;
  const formaPagamento = order.forma_pagamento || "pix";
  const data = order.updated_date
    ? format(new Date(order.updated_date), "dd/MM/yyyy")
    : format(new Date(), "dd/MM/yyyy");
  return addQuitadoStamp(doc, valorPago, formaPagamento, data);
}