/**
 * Lógica de cálculo de andaime fachadeiro
 *
 * Módulo base: 1,60m comprimento × 2,00m altura
 * Peças por módulo base (1ª torre):
 *   2 Andaimes, 1 Tesoura, 1 Elemento horizontal, 4 Bases
 * Expansão no comprimento (+1 módulo):
 *   +1 Andaime, +1 Tesoura, +1 Elemento horizontal, +2 Bases
 * Expansão na altura: multiplicar tudo por qtd_niveis
 */

export const MODULO_COMPRIMENTO = 1.6;  // metros
export const MODULO_ALTURA = 2.0;       // metros

// Códigos/nomes canônicos para busca no catálogo de equipamentos
export const ANDAIME_KEYS = {
  andaime: "andaime fachadeiro",
  piso: "piso metálico fachadeiro",
  tesoura: "tesoura fachadeiro",
  elemento: "elemento horizontal fachadeiro",
  base: "base fachadeiro",
};

/**
 * Calcula as quantidades de cada peça para um andaime fachadeiro
 * @param {number} comprimento - metros
 * @param {number} altura - metros
 * @returns {{ modulos, niveis, andaimes, pisos, tesouras, elementos, bases }}
 */
export function calcAndaime(comprimento, altura) {
  const modulos = Math.ceil(comprimento / MODULO_COMPRIMENTO);
  const niveis = Math.ceil(altura / MODULO_ALTURA);

  // Andaimes: 2 na primeira torre + 1 por módulo adicional, × níveis
  const andaimes = (2 + (modulos - 1)) * niveis;

  // Pisos: 1 por módulo × níveis (piso cobre cada vão de 1,60m)
  const pisos = modulos * niveis;

  // Tesouras: 1 por módulo × níveis
  const tesouras = modulos * niveis;

  // Elementos horizontais: 1 por módulo × níveis
  const elementos = modulos * niveis;

  // Bases: 4 na primeira torre + 2 por módulo adicional × níveis
  const bases = (4 + (modulos - 1) * 2) * niveis;

  return { modulos, niveis, andaimes, pisos, tesouras, elementos, bases };
}

/**
 * Dado o catálogo de equipamentos e as quantidades calculadas,
 * retorna a lista de itens para o orçamento/contrato
 * @param {object} qtds - resultado de calcAndaime
 * @param {Array} equipment - lista de equipamentos cadastrados
 * @param {number} diasMinimos - dias mínimos padrão do sistema
 * @param {number} diasPeriodo - dias do período da locação
 * @returns {Array} itens prontos para inserir no form
 */
export function buildAndaimeItens(qtds, equipment, diasMinimos = 5, diasPeriodo = 0) {
  const find = (key) => {
    const k = key.toLowerCase();
    return equipment.find((e) =>
      e.nome?.toLowerCase().includes(k) || e.codigo?.toLowerCase().includes(k)
    );
  };

  const makeItem = (eqKey, qty, label) => {
    const eq = find(eqKey);
    return {
      equipamento_id: eq?.id || "",
      equipamento_nome: eq?.nome || label,
      equipamento_foto: eq?.foto_url || "",
      equipamento_tipo: eq?.tipo || "",
      quantidade_retirada: qty,
      // Para contratos:
      valor_unitario: eq?.valor_diario || eq?.valor_mensal || "",
      valor_diario: eq?.valor_diario || 0,
      valor_mensal_ref: eq?.valor_mensal || 0,
      tipo_cobranca: "diario",
      desconto: "",
      quantidade_devolvida: 0,
      aplica_valor_minimo: eq?.aplica_valor_minimo !== false,
      dias_minimos_proprio: eq?.dias_minimos_proprio || 0,
      // Para orçamentos:
      quantidade: qty,
      valor_unitario_orcamento: eq?.valor_diario || eq?.valor_mensal || 0,
      desconto_orcamento: 0,
    };
  };

  return [
    makeItem(ANDAIME_KEYS.andaime, qtds.andaimes, "Andaime Fachadeiro"),
    makeItem(ANDAIME_KEYS.piso, qtds.pisos, "Piso Metálico Fachadeiro"),
    makeItem(ANDAIME_KEYS.tesoura, qtds.tesouras, "Tesoura Fachadeiro"),
    makeItem(ANDAIME_KEYS.elemento, qtds.elementos, "Elemento Horizontal Fachadeiro"),
    makeItem(ANDAIME_KEYS.base, qtds.bases, "Base Fachadeiro"),
  ].filter((i) => i.quantidade_retirada > 0);
}

/**
 * Calcula o valor total dos itens do andaime no contexto de orçamento
 */
export function calcAndaimeTotal(itens, diasPeriodo, diasMinimos) {
  return itens.reduce((sum, item) => {
    const valUnit = item.valor_unitario_orcamento || 0;
    const qtd = item.quantidade || item.quantidade_retirada || 0;
    const dias = Math.max(diasMinimos, diasPeriodo || diasMinimos);
    return sum + qtd * valUnit * dias;
  }, 0);
}