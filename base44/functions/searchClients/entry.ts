import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── NORMALIZAÇÃO ─────────────────────────────────────────
const normalizeCpfCnpj = (v) => (v || "").replace(/[\.\-\/\s]/g, "");
const normalize = (s) => (s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const normalizeTel = (v) => (v || "").replace(/\D/g, "").replace(/^55/, "");
const formatCpf  = (d) => d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : null;
const formatCnpj = (d) => d.length === 14 ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` : null;
const tryFormatCpfCnpj = (q) => { const d = normalizeCpfCnpj(q); return formatCpf(d) || formatCnpj(d) || null; };

// ─── CACHE EM MEMÓRIA (isolate) ───────────────────────────
// Armazena resultados de buscas por nome (mais caras) por 60s
const _searchCache = new Map(); // key → { items, ts }
const SEARCH_CACHE_TTL = 60_000;

function getCachedSearch(key) {
  const e = _searchCache.get(key);
  if (!e || Date.now() - e.ts > SEARCH_CACHE_TTL) { _searchCache.delete(key); return null; }
  return e.items;
}
function setCachedSearch(key, items) {
  // Limita cache a 50 entradas — evita memory leak
  if (_searchCache.size >= 50) {
    const oldest = [..._searchCache.entries()].sort((a,b) => a[1].ts - b[1].ts)[0];
    if (oldest) _searchCache.delete(oldest[0]);
  }
  _searchCache.set(key, { items, ts: Date.now() });
}

// ─── MERGE SEM DUPLICATAS ─────────────────────────────────
function merge(candidates, seen, list) {
  for (const c of (list || [])) {
    if (c && !seen.has(c.id)) { seen.add(c.id); candidates.push(c); }
  }
}

// ─── BUSCA POR TELEFONE (sem full scan) ──────────────────
// Testa número exato → sem nono → com nono sequencialmente com early exit
async function buscarPorTelefone(entities, q, sortKey, LIMIT) {
  const limpo = normalizeTel(q);
  const semNono = limpo.replace(/^(\d{2})9(\d{8})$/, '$1$2');
  const comNono = semNono !== limpo ? limpo : `9${semNono}`;

  // Busca em telefone1, telefone2, telefone3 em paralelo para o número exato
  const [r1a, r1b, r1c] = await Promise.all([
    entities.Client.filter({ telefone1: limpo }, sortKey, LIMIT).catch(() => []),
    entities.Client.filter({ telefone2: limpo }, sortKey, LIMIT).catch(() => []),
    entities.Client.filter({ telefone3: limpo }, sortKey, LIMIT).catch(() => []),
  ]);
  const exactos = [...r1a, ...r1b, ...r1c];
  if (exactos.length > 0) return exactos;

  // Fallback: sem/com nono dígito
  const [r2a, r2b, r2c, r2d] = await Promise.all([
    semNono !== limpo ? entities.Client.filter({ telefone1: semNono }, sortKey, LIMIT).catch(() => []) : Promise.resolve([]),
    semNono !== limpo ? entities.Client.filter({ telefone2: semNono }, sortKey, LIMIT).catch(() => []) : Promise.resolve([]),
    entities.Client.filter({ telefone1: comNono }, sortKey, LIMIT).catch(() => []),
    entities.Client.filter({ telefone2: comNono }, sortKey, LIMIT).catch(() => []),
  ]);
  return [...r2a, ...r2b, ...r2c, ...r2d];
}

// ─── BUSCA POR NOME (paginada — sem full scan) ────────────
// Usa list com paginação e filtra substring em memória
// Mais eficiente que carregar 18k: carrega apenas até encontrar LIMIT resultados
async function buscarPorNome(entities, qNorm, sortKey, LIMIT) {
  const cacheKey = `nome:${qNorm}:${sortKey}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    console.log(`[SEARCH_CACHE] nome="${qNorm}" cache_hit=true itens=${cached.length}`);
    return cached;
  }

  const t0 = Date.now();
  const BATCH = 500; // lotes menores — para mais rápido quando achar suficiente
  const MAX_BATCHES = 20; // máx 10k registros varridos
  const results = [];
  const seen = new Set();

  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await entities.Client.list(sortKey, BATCH, i * BATCH).catch(() => []);
    if (!batch.length) break;

    for (const c of batch) {
      if (!c || seen.has(c.id)) continue;
      const nomeOk = normalize(c.nome_razao_social).includes(qNorm);
      const fantOk = normalize(c.fantasia).includes(qNorm);
      const codOk  = normalize(c.codigo_cliente).includes(qNorm);
      if (nomeOk || fantOk || codOk) {
        seen.add(c.id);
        results.push(c);
      }
    }

    // Early exit: já temos resultados suficientes
    if (results.length >= LIMIT * 3) break;
    if (batch.length < BATCH) break; // última página
  }

  const ms = Date.now() - t0;
  console.log(`[SEARCH_NOME] q="${qNorm}" resultados=${results.length} ms=${ms} cache_hit=false`);
  setCachedSearch(cacheKey, results);
  return results;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    query    = "",
    field    = "todos",
    tipo     = "todos",
    sort     = "recentes",
    page     = 1,
    page_size = 20,
    limit    = 20,
  } = body;

  const q     = query.trim();
  const LIMIT = Math.min(limit || page_size || 20, 100);
  const sortKey = sort === "az" ? "nome_razao_social" : "-updated_date";
  const entities = base44.asServiceRole.entities;

  // ── Sem query: retorna recentes ──────────────────────────
  if (!q || q.length < 2) {
    const items = await entities.Client.list(sortKey, LIMIT);
    return Response.json({ items, clients: items, total: items.length, totalPages: 1, page: 1, page_size: LIMIT });
  }

  const qNorm   = normalize(q);
  const qTel    = normalizeTel(q);
  const qCpf    = normalizeCpfCnpj(q);
  const isPhone = /^[\d\s\(\)\-\+]+$/.test(q) && qTel.length >= 8;
  const isCpf   = /^[\d.\-\/\s]+$/.test(q) && qCpf.length >= 6;

  const candidates = [];
  const seen = new Set();

  if (field === "telefone1" || field === "telefone" || (field === "todos" && isPhone)) {
    // ── TELEFONE: busca por filtro exato (rápida) ────────
    const t0q = Date.now();
    const items = await buscarPorTelefone(entities, q, sortKey, LIMIT);
    console.log(`[SEARCH_TEL] q="${q}" resultados=${items.length} ms=${Date.now()-t0q}`);
    merge(candidates, seen, items);

  } else if (field === "cpf_cnpj" || (field === "todos" && isCpf)) {
    // ── CPF/CNPJ: busca por filtro exato (rápida) ────────
    const t0q = Date.now();
    const formatted = tryFormatCpfCnpj(q);
    const searches = [
      entities.Client.filter({ cpf_cnpj: q },       sortKey, LIMIT).catch(() => []),
      entities.Client.filter({ cpf_cnpj: qCpf },    sortKey, LIMIT).catch(() => []),
    ];
    if (formatted && formatted !== q) {
      searches.push(entities.Client.filter({ cpf_cnpj: formatted }, sortKey, LIMIT).catch(() => []));
    }
    const results = await Promise.all(searches);
    results.forEach(r => merge(candidates, seen, r));
    console.log(`[SEARCH_CPF] q="${q}" resultados=${candidates.length} ms=${Date.now()-t0q}`);

  } else if (field === "email") {
    // ── EMAIL: filtro direto ──────────────────────────────
    const t0q = Date.now();
    const r = await entities.Client.filter({ email: q }, sortKey, LIMIT).catch(() => []);
    merge(candidates, seen, r);
    console.log(`[SEARCH_EMAIL] q="${q}" resultados=${r.length} ms=${Date.now()-t0q}`);

  } else if (field === "codigo_cliente" || field === "external_id") {
    // ── CÓDIGO: filtro direto ─────────────────────────────
    const t0q = Date.now();
    const [r1, r2] = await Promise.all([
      entities.Client.filter({ codigo_cliente: q }, sortKey, LIMIT).catch(() => []),
      entities.Client.filter({ external_id: q },   sortKey, LIMIT).catch(() => []),
    ]);
    merge(candidates, seen, r1);
    merge(candidates, seen, r2);
    console.log(`[SEARCH_COD] q="${q}" resultados=${candidates.length} ms=${Date.now()-t0q}`);

  } else {
    // ── NOME / FANTASIA / TODOS TEXTUAL: busca paginada ───
    // Para "todos" textual também tenta CPF/tel por filtro em paralelo
    const promises = [buscarPorNome(entities, qNorm, sortKey, LIMIT)];

    if (field === "todos") {
      // Tenta também telefone e CPF em paralelo para query mista
      if (qTel.length >= 8) promises.push(buscarPorTelefone(entities, q, sortKey, LIMIT));
      if (isCpf) {
        const fmt = tryFormatCpfCnpj(q);
        promises.push(
          Promise.all([
            entities.Client.filter({ cpf_cnpj: q },    sortKey, LIMIT).catch(() => []),
            entities.Client.filter({ cpf_cnpj: qCpf }, sortKey, LIMIT).catch(() => []),
            fmt ? entities.Client.filter({ cpf_cnpj: fmt }, sortKey, LIMIT).catch(() => []) : Promise.resolve([]),
          ]).then(rs => rs.flat())
        );
      }
    }

    const allResults = await Promise.all(promises);
    allResults.forEach(r => merge(candidates, seen, Array.isArray(r) ? r : []));
  }

  // Filtro por tipo de perfil
  let filtered = tipo !== "todos"
    ? candidates.filter(c => (c.tipo_perfil || "comum") === tipo)
    : candidates;

  const total      = filtered.length;
  const start      = (page - 1) * LIMIT;
  const items      = filtered.slice(start, start + LIMIT);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const msTotal    = Date.now() - t0;

  console.log(`[SEARCH_OK] field="${field}" q="${q}" total=${total} retornando=${items.length} ms=${msTotal}`);

  return Response.json({ items, clients: items, total, totalPages, page, page_size: LIMIT });
});