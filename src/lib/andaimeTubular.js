/**
 * Lógica de cálculo de ANDAIME TUBULAR
 *
 * MONTAGEM PADRÃO:
 *   - Comprimento (metros) + tamanho da peça → módulos
 *   - Por módulo × altura: 2 andaimes/m + 1 piso/m
 *   - TRAVA: mesma medida da peça (1 trava a cada 6m por módulo)
 *
 * MONTAGEM INTERCALADA:
 *   - SEM comprimento. Usuário seleciona Peça 1 e Peça 2 diretamente.
 *   - Por metro de altura: 2 peças no total (1 peça1 + 1 peça2 alternadas)
 *   - Total de peças = altura × 2, dividido igualmente entre as duas peças
 *   - Piso: tamanho da MAIOR peça selecionada
 *   - TRAVAS: seguem as peças (maior e menor)
 *
 * BASES/RODAS: 4 por módulo (padrão) ou fixo 4 (intercalada)
 */

export const PECAS_DISPONIVEIS = [0.5, 0.8, 1.0, 1.5]; // metros

// Nomes canônicos para busca no catálogo
export const TUBULAR_KEYS = {
  andaime_a: "andaime tubular",
  andaime_b: "andaime tubular",
  piso: "piso",
  trava: "trava",
  base: "base regulável",
  roda: "roda",
};

/**
 * Calcula quantidades para andaime tubular — MONTAGEM PADRÃO
 */
export function calcAndaimeTubularPadrao({ altura, comprimento, tamanhoPeca, comBase, comRoda }) {
  const alturaEfetiva = Math.max(2, altura);
  const modulos = Math.ceil(comprimento / tamanhoPeca);
  const travasNiveis = Math.floor(alturaEfetiva / 6);

  const andaimes_a = modulos * alturaEfetiva * 2;
  const pisos = modulos * alturaEfetiva;
  const travas_a = travasNiveis * modulos;
  const bases = comBase ? modulos * 4 : 0;
  const rodas = comRoda ? modulos * 4 : 0;

  const resumo = `Andaime tubular padrão — ${alturaEfetiva}m altura × ${comprimento}m comprimento (${modulos} módulo(s) de ${tamanhoPeca}m) — Travas ${tamanhoPeca}m`;

  return {
    modulos,
    alturaEfetiva,
    andaimes_a,
    andaimes_b: 0,
    pisos,
    pisoTamanho: tamanhoPeca, // padrão: mesmo tamanho da peça
    travas_a,
    travas_b: 0,
    travas: travas_a,
    tamanhoPecaA: tamanhoPeca,
    tamanhoPecaB: tamanhoPeca,
    bases,
    rodas,
    resumo,
  };
}

/**
 * Calcula quantidades para andaime tubular — MONTAGEM INTERCALADA
 * Sem comprimento. Peças 1 e 2 selecionadas diretamente.
 *
 * Regra:
 * - Total de peças = altura × 2
 * - Metade peça1, metade peça2
 * - Piso = maior peça
 * - Travas = 1 por tipo a cada 6m (fixo 1 "módulo" de largura, pois não há comprimento)
 */
export function calcAndaimeTubularIntercalada({ altura, peca1, peca2, comBase, comRoda }) {
  const alturaEfetiva = Math.max(2, altura);
  const totalPecas = alturaEfetiva * 2;
  const andaimes_a = totalPecas / 2; // peça 1
  const andaimes_b = totalPecas / 2; // peça 2

  const pisoTamanho = Math.max(peca1, peca2);
  const pisos = alturaEfetiva; // 1 piso por metro de altura

  const travasNiveis = Math.floor(alturaEfetiva / 6);
  const travas_a = travasNiveis; // travas da peça maior
  const travas_b = travasNiveis; // travas da peça menor
  const travas = travas_a + travas_b;

  const bases = comBase ? 4 : 0;
  const rodas = comRoda ? 4 : 0;

  const tamanhoPecaA = Math.max(peca1, peca2);
  const tamanhoPecaB = Math.min(peca1, peca2);

  const resumo = `Montagem de andaime tubular intercalado com peças de ${tamanhoPecaA}m e ${tamanhoPecaB}m — ${alturaEfetiva}m altura`;

  return {
    modulos: 1,
    alturaEfetiva,
    andaimes_a,
    andaimes_b,
    pisos,
    pisoTamanho,
    travas_a,
    travas_b,
    travas,
    tamanhoPecaA,
    tamanhoPecaB,
    bases,
    rodas,
    resumo,
  };
}

/**
 * Função unificada (compatibilidade com código legado)
 */
export function calcAndaimeTubular({ altura, comprimento, tamanhoPeca, tipoMontagem, comBase, comRoda, peca1, peca2 }) {
  if (tipoMontagem === "intercalada") {
    return calcAndaimeTubularIntercalada({ altura, peca1: peca1 || tamanhoPeca, peca2: peca2 || tamanhoPeca, comBase, comRoda });
  }
  return calcAndaimeTubularPadrao({ altura, comprimento, tamanhoPeca, comBase, comRoda });
}

/**
 * Busca uma trava pelo tamanho da peça no catálogo.
 */
function findTrava(tamanhoPeca, equipment) {
  const metros = tamanhoPeca.toFixed(2);
  const cm = Math.round(tamanhoPeca * 100);
  const t = (s) => s?.toLowerCase() || "";
  return equipment.find((e) => {
    const n = t(e.nome);
    if (!n.includes("trava")) return false;
    return (
      n.includes(`${metros}`) ||
      n.includes(`${tamanhoPeca}`) ||
      n.includes(`${cm}`) ||
      n.includes(`${tamanhoPeca.toFixed(1)}`)
    );
  }) || equipment.find((e) => t(e.nome).includes("trava"));
}

/**
 * Busca o piso pelo tamanho da peça no catálogo.
 * Prioriza match exato no nome (ex: "piso 1.5m", "piso 1,5m", "piso 150cm")
 * Fallback: qualquer item com "piso" no nome.
 */
function findPiso(tamanhoPeca, equipment) {
  const metros = tamanhoPeca.toFixed(2);
  const metros1 = tamanhoPeca.toFixed(1);
  const cm = Math.round(tamanhoPeca * 100);
  const t = (s) => s?.toLowerCase() || "";
  // Busca piso com tamanho específico
  const exato = equipment.find((e) => {
    const n = t(e.nome);
    if (!n.includes("piso")) return false;
    return (
      n.includes(`${metros}`) ||
      n.includes(`${metros1}`) ||
      n.includes(`${tamanhoPeca}`) ||
      n.includes(`${cm}`)
    );
  });
  if (exato) return exato;
  // Fallback: qualquer piso (tubular, não fachadeiro)
  return equipment.find((e) => {
    const n = t(e.nome);
    return n.includes("piso") && !n.includes("fachadeiro");
  });
}

/**
 * Constrói itens para orçamento/contrato a partir do cálculo tubular
 */
export function buildAndaimeTubularItens(qtds, equipment, tipoMontagem) {
  const find = (termo) => {
    const t = termo.toLowerCase();
    return equipment.find((e) =>
      e.nome?.toLowerCase().includes(t) || e.codigo?.toLowerCase().includes(t)
    );
  };

  const makeItem = (eq, nome, qty) => {
    if (!qty || qty <= 0) return null;
    return {
      equipamento_id: eq?.id || "",
      equipamento_nome: eq?.nome || nome,
      equipamento_foto: eq?.foto_url || "",
      quantidade_retirada: qty,
      quantidade: qty,
      valor_unitario: eq?.valor_diario || eq?.valor_mensal || 0,
      valor_diario: eq?.valor_diario || 0,
      desconto: 0,
      desconto_orcamento: 0,
      aplica_valor_minimo: eq?.aplica_valor_minimo !== false,
      dias_minimos_proprio: eq?.dias_minimos_proprio || 0,
    };
  };

  const itens = [];

  if (tipoMontagem === "padrao") {
    const eqA = find("andaime tubular");
    const item = makeItem(eqA, "Andaime Tubular", qtds.andaimes_a);
    if (item) itens.push(item);
  } else {
    // Intercalada: peças A e B listadas separadamente
    const eqA = find("andaime tubular");
    const itemA = makeItem(eqA, `Andaime Tubular ${qtds.tamanhoPecaA}m`, qtds.andaimes_a);
    if (itemA) itens.push({ ...itemA, equipamento_nome: (eqA?.nome || "Andaime Tubular") + ` — ${qtds.tamanhoPecaA}m` });
    const itemB = makeItem(eqA, `Andaime Tubular ${qtds.tamanhoPecaB}m`, qtds.andaimes_b);
    if (itemB) itens.push({ ...itemB, equipamento_nome: (eqA?.nome || "Andaime Tubular") + ` — ${qtds.tamanhoPecaB}m` });
  }

  // Piso: usa tamanho correto
  // Padrão → tamanho da peça selecionada (tamanhoPecaA)
  // Intercalada → MAIOR peça (tamanhoPecaA já é o maior por calcAndaimeTubularIntercalada)
  const pisoTamanho = qtds.pisoTamanho || qtds.tamanhoPecaA;
  const eqPiso = findPiso(pisoTamanho, equipment);
  const itemPiso = makeItem(eqPiso, `Piso Metálico ${pisoTamanho}m`, qtds.pisos);
  if (itemPiso) itens.push({ ...itemPiso, equipamento_nome: eqPiso?.nome || `Piso Metálico ${pisoTamanho}m` });

  // Travas
  if (qtds.travas_a > 0) {
    const eqTravaA = findTrava(qtds.tamanhoPecaA, equipment);
    const itemTA = makeItem(eqTravaA, `Trava ${qtds.tamanhoPecaA}m`, qtds.travas_a);
    if (itemTA) itens.push({ ...itemTA, equipamento_nome: eqTravaA?.nome || `Trava ${qtds.tamanhoPecaA}m` });
  }

  if (tipoMontagem === "intercalada" && qtds.travas_b > 0 && qtds.tamanhoPecaB !== qtds.tamanhoPecaA) {
    const eqTravaB = findTrava(qtds.tamanhoPecaB, equipment);
    const itemTB = makeItem(eqTravaB, `Trava ${qtds.tamanhoPecaB}m`, qtds.travas_b);
    if (itemTB) itens.push({ ...itemTB, equipamento_nome: eqTravaB?.nome || `Trava ${qtds.tamanhoPecaB}m` });
  }

  // Bases / Rodas
  if (qtds.bases > 0) {
    const eqBase = find("base regulável");
    const itemBase = makeItem(eqBase, "Base Regulável", qtds.bases);
    if (itemBase) itens.push(itemBase);
  }

  if (qtds.rodas > 0) {
    const eqRoda = find("roda");
    const itemRoda = makeItem(eqRoda, "Roda", qtds.rodas);
    if (itemRoda) itens.push(itemRoda);
  }

  return itens.filter(Boolean);
}