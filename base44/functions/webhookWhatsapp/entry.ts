import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import OpenAI from 'npm:openai';

// =========================================================
//  WEBHOOK WhatsApp — Arquitetura Operacional v21.0
//
//  v21 — FASE 2: INTELIGÊNCIA + ESCALABILIDADE:
//  ✔ Detector avançado de intenção (irritação, urgência, escalamento imediato)
//  ✔ Sistema anti-loop: detecta respostas repetidas e escala p/ humano
//  ✔ Roteamento inteligente de modelos (lite p/ simples, flash p/ comercial)
//  ✔ Resumo automático de conversa (compacta histórico após 8 trocas)
//  ✔ Respostas informativas determinísticas (horário, endereço, cidades)
//  ✔ Métricas de tokens/custos: log [METRICS] por atendimento
//  ✔ Detector de cliente irritado → escalamento imediato com prioridade
//  ✔ Instruções por prioridade: CRÍTICO > IMPORTANTE > CONTEXTO
//
//  v20 — Prompt modular, contexto sob demanda, parallelismo
//  v19 — Provider Health + fallback imediato
// =========================================================

// ─── MENSAGENS DE ERRO ESPECÍFICAS ──────────────────────
const MSG_TIMEOUT   = 'Estou demorando mais que o normal. Tente novamente em instantes. 🙏';
const MSG_RATELIMIT = 'O serviço de IA está sobrecarregado. Tente novamente em instantes. 🙏';
const MSG_APIERRO   = 'Problema técnico momentâneo. Tente novamente. 🔧';
const MSG_ERRO      = 'Tive um problema técnico. Tente novamente em instantes. 🙏';

// ─── LIMITES v20 ─────────────────────────────────────────
const MAX_PROMPT_CHARS   = 1800;  // ↓ 2800→1800 — alvo ~450 tokens input
const MAX_HIST_MSGS      = 2;     // apenas última troca
const MAX_TEXTO_CHARS    = 400;   // ↓ 600→400
const MAX_TOKENS_OUT     = 160;   // ↓ 220→160 — respostas curtas e objetivas
const MAX_IA_CONCURRENT  = 6;
const DEBOUNCE_MS        = 1200;
const QUEUE_MAX_SIZE     = 300;
const SLOT_TIMEOUT_MS    = 45000;
const LOCK_TIMEOUT_MS    = 60000;
const USER_COOLDOWN_MS       = 8000;
const PROVIDER_COOLDOWN_MS   = 10 * 60 * 1000;

// ─── RESPOSTAS DETERMINÍSTICAS v21 ───────────────────────
// Expandido com: horário, endereço, cidades, prazo mínimo (sem chamar IA)
const RESPOSTAS_RAPIDAS = [
  // Confirmações simples
  { regex: /^(ok|okay|certo|entendi|compreendi|combinado|tá|ta|blz|beleza|perfeito|ótimo|otimo|show|legal)[\s!.]*$/i, resposta: '👍 Ótimo! Posso ajudar com mais alguma coisa?' },
  { regex: /^(obrigad[oa]|vlw|valew|valeu|grato|grata|muito obrigad[oa])[\s!.]*$/i, resposta: 'De nada! 😊 Estou à disposição se precisar de mais alguma coisa.' },
  { regex: /^(bom dia|boa tarde|boa noite|oi|olá|ola|opa|eae|e ai|e aí|oii|oiii)[\s!.,]*$/i, resposta: null }, // null = usa IA (precisa de apresentação personalizada)
  { regex: /^(tchau|até|ate mais|até mais|flw|até logo|ate logo|fui)[\s!.]*$/i, resposta: 'Até mais! 👋 Qualquer coisa é só chamar.' },
  { regex: /^(tudo bem|tudo bom|como vai|tudo certo|tudo ótimo)[\s!?]*$/i, resposta: 'Tudo ótimo por aqui! 😊 Em que posso te ajudar?' },
  // Perguntas informativas frequentes — evitam chamada IA
  { regex: /hor[aá]rio.*(funciona|atend|abre|fecha|trabalh)/i, resposta: '🕐 Atendemos de segunda a sexta das 7h às 18h, e sábados das 7h às 13h. Posso te ajudar com alguma coisa?' },
  { regex: /endere[cç]o|como cheg[ao]|localiz/i, resposta: '📍 Estamos em Cabo Frio/RJ. Para localização exata, entre em contato pelo WhatsApp ou solicite o endereço ao atendente. Posso ajudar com mais alguma coisa?' },
  { regex: /cidades?.*(atend|entrega|regiã)/i, resposta: '🗺️ Atendemos toda a Região dos Lagos: Cabo Frio, Arraial do Cabo, Búzios, São Pedro da Aldeia, Iguaba Grande, Araruama e cidades vizinhas. Posso ajudar?' },
  { regex: /prazo.*(m[ií]nimo|m[ií]n|menor|m[eê]nimo)/i, resposta: '📋 O prazo mínimo de locação é de 7 dias. Me conta o que você precisa?' },
  { regex: /telefone|contato|falar com (voc[eê]|humano|pessoa|atendente)/i, resposta: null }, // usa IA → pode escalar
];

function verificarRespostaRapida(texto) {
  const t = texto.trim();
  for (const r of RESPOSTAS_RAPIDAS) {
    if (r.regex.test(t)) return r.resposta; // null = precisa IA
  }
  return undefined; // undefined = não matched, chamar IA normalmente
}

// ─── DETECTOR AVANÇADO DE INTENÇÃO v21 ───────────────────
// Detecta irritação, urgência elevada, escalamento crítico
function analisarSinalEmocional(texto) {
  const t = texto;
  const tl = t.toLowerCase();
  const capsRatio = (t.match(/[A-ZÁÉÍÓÚÀÃÕ]/g) || []).length / Math.max(t.length, 1);
  const temCaps   = capsRatio > 0.4 && t.length > 8; // mais de 40% maiúsculas
  const temExcl   = (t.match(/!/g) || []).length >= 2;
  const irritado  = /absurdo|inaceit[aá]vel|vergonha|horrív|pessim|lamentáv|descaso|proces[sç]|advogado|procon|gerente|responsável|nunca mais|péssimo serviço|me cobr[ao]/i.test(tl);
  const urgente   = /urg[eê]nte|emergência|socorro|urgente mesmo|preciso agora|hoje mesmo|não pode esperar/i.test(tl);
  const querGerente = /gerente|responsável|dono|supervisor|chefe|quem manda/i.test(tl);
  const escalarImediato = querGerente || (irritado && (temCaps || temExcl));
  const score = (temCaps ? 2 : 0) + (temExcl ? 1 : 0) + (irritado ? 3 : 0) + (urgente ? 2 : 0);
  return { irritado, urgente, querGerente, escalarImediato, score, temCaps };
}

// ─── ANTI-LOOP v21 ───────────────────────────────────────
// Detecta perguntas/respostas repetidas para evitar loop de IA
const _loopTracker = new Map(); // tel → { ultimasRespostas: string[], count: number, ts: number }
const LOOP_TTL = 10 * 60 * 1000;
const LOOP_MAX_REPETICOES = 3;

function verificarLoop(telefone, respostaIA) {
  const now = Date.now();
  const entry = _loopTracker.get(telefone);
  if (!entry || now - entry.ts > LOOP_TTL) {
    _loopTracker.set(telefone, { ultimas: [respostaIA.slice(0,80)], count: 1, ts: now });
    return false;
  }
  // Verifica se resposta é similar a alguma anterior (70%+ sobreposição de palavras-chave)
  const palavras = new Set(respostaIA.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const similar = entry.ultimas.some(ant => {
    const palavrasAnt = new Set(ant.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    const inter = [...palavras].filter(w => palavrasAnt.has(w)).length;
    return inter / Math.max(palavras.size, 1) > 0.6;
  });
  if (similar) {
    entry.count++;
    entry.ts = now;
    if (entry.count >= LOOP_MAX_REPETICOES) {
      console.warn(`[ANTI_LOOP] tel=${telefone} repeticoes=${entry.count} — escalando`);
      return true; // loop detectado → escalar
    }
  } else {
    entry.ultimas = [...entry.ultimas.slice(-4), respostaIA.slice(0,80)];
    entry.count = 1;
    entry.ts = now;
  }
  return false;
}

// ─── ROTEAMENTO INTELIGENTE DE MODELOS v21 ───────────────
// Seleciona modelo com base na complexidade da mensagem
// lite  → mensagens simples (cumprimentos, sim/não, números)
// flash → mensagens comerciais padrão
// openai → financeiro, reclamação, complexo
function rotearModelo(texto, intent, flow, settings) {
  const geminiKey = settings.gemini_api_key;
  const openaiKey = settings.openai_api_key;
  const primaryIsGemini = (settings.ai_provider_primary||'gemini').includes('gemini');

  // Financeiro/reclamação → OpenAI primeiro se disponível (mais preciso)
  if ((intent === 'financeiro' || intent === 'reclamacao') && openaiKey) {
    return { order: ['openai','gemini'], reason: 'financeiro_preciso' };
  }

  // Mensagem curta e simples → Gemini Flash Lite (mais barato)
  const textoSimples = texto.trim().length < 50 && !/orçamento|contrato|valor|quanto|preço/i.test(texto);
  if (textoSimples && geminiKey) {
    return { order: primaryIsGemini ? ['gemini','openai'] : ['openai','gemini'], reason: 'simples_lite' };
  }

  // Default: ordem configurada
  return { order: primaryIsGemini ? ['gemini','openai'] : ['openai','gemini'], reason: 'padrao' };
}

// ─── MÉTRICAS DE CUSTO v21 ───────────────────────────────
// Custo estimado por token (USD) — valores aproximados
const CUSTO_POR_TOKEN = {
  'gemini/gemini-2.0-flash':      { in: 0.000_000_075, out: 0.000_000_300 },
  'gemini/gemini-2.0-flash-lite': { in: 0.000_000_037, out: 0.000_000_150 },
  'openai/gpt-4o-mini':           { in: 0.000_000_150, out: 0.000_000_600 },
};
// Acumulador de métricas (por isolate — reinicia em restart)
const _metricas = { totalTokensIn: 0, totalTokensOut: 0, totalChamadas: 0, totalCustoUSD: 0, cacheHits: 0, respostasRapidas: 0, fallbacks: 0, loops: 0, escalamentos: 0 };

function registrarMetrica(modelInfo, tokensIn, tokensOut, tipo = 'ia') {
  _metricas.totalChamadas++;
  _metricas.totalTokensIn  += tokensIn  || 0;
  _metricas.totalTokensOut += tokensOut || 0;
  const custo = CUSTO_POR_TOKEN[modelInfo];
  if (custo) {
    _metricas.totalCustoUSD += (tokensIn||0) * custo.in + (tokensOut||0) * custo.out;
  }
  if (tipo === 'cache')  _metricas.cacheHits++;
  if (tipo === 'rapida') _metricas.respostasRapidas++;
  if (tipo === 'loop')   _metricas.loops++;
  if (tipo === 'escal')  _metricas.escalamentos++;
}

// ─── RESUMO AUTOMÁTICO DE CONVERSA v21 ───────────────────
// Após N trocas, compacta dados coletados em resumo estruturado
// Substitui histórico longo por bloco de memória compacta
const RESUMO_APOS_TROCAS = 8; // compacta a partir de 8 trocas

function gerarResumoCompacto(dados, flow, step, intent, ultimaResposta) {
  const linhas = [];
  if (dados.equipamento) linhas.push(`• Equipamento: ${dados.equipamento}`);
  if (dados.quantidade)  linhas.push(`• Quantidade: ${dados.quantidade}`);
  if (dados.metragem)    linhas.push(`• Metragem: ${dados.metragem}`);
  if (dados.altura)      linhas.push(`• Altura: ${dados.altura}`);
  if (dados.bairro)      linhas.push(`• Bairro: ${dados.bairro}`);
  if (dados.cidade)      linhas.push(`• Cidade: ${dados.cidade}`);
  if (dados.periodo)     linhas.push(`• Prazo: ${dados.periodo}`);
  if (dados.endereco)    linhas.push(`• Endereço: ${dados.endereco}`);
  if (dados.nome_cliente) linhas.push(`• Cliente: ${dados.nome_cliente}`);
  linhas.push(`• Fluxo: ${flow} | Etapa: ${step} | Intent: ${intent}`);
  if (ultimaResposta) linhas.push(`• Último enviado: "${ultimaResposta.slice(0,80)}"`);
  return linhas.join('\n');
}

// Retorna histórico compactado: se muitas trocas, usa resumo ao invés de msgs
function obterHistoricoOtimizado(estadoAtual, historicoIA) {
  const trocas = estadoAtual?.total_trocas || 0;
  if (trocas >= RESUMO_APOS_TROCAS && estadoAtual?.dados_coletados) {
    // Compacta: apenas resumo estruturado + última mensagem do assistente
    const resumo = gerarResumoCompacto(
      estadoAtual.dados_coletados, estadoAtual.flow||'geral',
      estadoAtual.step||'?', estadoAtual.intent||'orcamento',
      estadoAtual.ultima_resposta
    );
    console.log(`[HIST_COMPACT] trocas=${trocas} → resumo estruturado (sem histórico longo)`);
    return { compactado: true, resumo, hist: [] };
  }
  return { compactado: false, resumo: null, hist: historicoIA };
}

// ─── CONTROLE DE CONCORRÊNCIA IA — CONTADOR SIMPLES COM TIMEOUT ──────
// NÃO usa fila de Promises para evitar slots presos em restarts do isolate
let _iaConcurrent = 0;
const _slotTimers = new Map(); // slotId → timerId (para auto-release)
let _slotIdSeq = 0;

function acquireIASlot(telefone) {
  if (_iaConcurrent >= MAX_IA_CONCURRENT) {
    console.warn(`[SLOT_CHEIO] tel=${telefone} concurrent=${_iaConcurrent} max=${MAX_IA_CONCURRENT} — processando sem slot`);
    // NÃO bloqueia — processa mesmo acima do limite (evita rejeição)
    // Apenas loga para diagnóstico
  }
  _iaConcurrent++;
  const slotId = ++_slotIdSeq;
  // Auto-release com timeout — garante que slot nunca fica preso
  const timer = setTimeout(() => {
    if (_slotTimers.has(slotId)) {
      console.error(`[SLOT_TIMEOUT] tel=${telefone} slotId=${slotId} forçando_release após ${SLOT_TIMEOUT_MS}ms`);
      _slotTimers.delete(slotId);
      _iaConcurrent = Math.max(0, _iaConcurrent - 1);
    }
  }, SLOT_TIMEOUT_MS);
  _slotTimers.set(slotId, timer);
  console.log(`[SLOT_ACQUIRE] tel=${telefone} slotId=${slotId} concurrent=${_iaConcurrent}`);
  return slotId;
}

function releaseIASlot(slotId, telefone) {
  const timer = _slotTimers.get(slotId);
  if (timer) { clearTimeout(timer); _slotTimers.delete(slotId); }
  _iaConcurrent = Math.max(0, _iaConcurrent - 1);
  console.log(`[SLOT_RELEASE] tel=${telefone} slotId=${slotId} concurrent=${_iaConcurrent}`);
}

// ─── CLEANUP PERIÓDICO (a cada 5min) ─────────────────────
// Limpa slots órfãos, locks presos, caches expirados
function runCleanup() {
  const now = Date.now();
  // Limpa locks que ultrapassaram LOCK_TIMEOUT_MS (failsafe — normalmente o finally cuida)
  for (const [tel, ts] of _lockTimestamps) {
    if (now - ts > LOCK_TIMEOUT_MS) {
      console.error(`[LOCK_CLEANUP] tel=${tel} preso há ${Math.round((now-ts)/1000)}s — forçando liberação`);
      userLocks.delete(tel); _lockTimestamps.delete(tel);
    }
  }
  // Limpa debounce timers muito antigos
  for (const [tel, ts] of _debounceTimestamps) {
    if (now - ts > 30000) { _debounceTimers.delete(tel); _pendingMessages.delete(tel); _debounceTimestamps.delete(tel); }
  }
  // Log de saúde do sistema
  console.log(`[CLEANUP] locks=${userLocks.size} slots=${_iaConcurrent} slot_timers=${_slotTimers.size} queue=${_queueSize.value} debounce=${_debounceTimers.size}`);
}
setInterval(runCleanup, 5 * 60 * 1000);

// ─── FILA DE PROCESSAMENTO COM DEBOUNCE ──────────────────
const _debounceTimers      = new Map(); // tel → timerId
const _debounceTimestamps  = new Map(); // tel → ts (para cleanup)
const _pendingMessages     = new Map(); // tel → última mensagem pendente
const _lockTimestamps      = new Map(); // tel → ts de quando lock foi adquirido
const _queueSize           = { value: 0 };

function enqueueDebounce(telefone, texto, messageId, settings, origem) {
  if (_debounceTimers.has(telefone)) {
    clearTimeout(_debounceTimers.get(telefone));
    _queueSize.value = Math.max(0, _queueSize.value - 1);
    console.log(`[DEBOUNCE] tel=${telefone} descartou_anterior=true queue=${_queueSize.value}`);
  }
  _pendingMessages.set(telefone, { texto, messageId, settings, origem });

  // Nunca descarta — só loga quando fila está alta
  if (_queueSize.value >= QUEUE_MAX_SIZE) {
    console.warn(`[FILA_ALTA] tel=${telefone} queue_size=${_queueSize.value} — processando mesmo assim`);
  }

  _queueSize.value++;
  _debounceTimestamps.set(telefone, Date.now());
  const timer = setTimeout(async () => {
    _debounceTimers.delete(telefone);
    _debounceTimestamps.delete(telefone);
    const msg = _pendingMessages.get(telefone);
    _pendingMessages.delete(telefone);
    _queueSize.value = Math.max(0, _queueSize.value - 1);
    if (!msg) return;
    console.log(`[FILA_EXEC] tel=${telefone} queue=${_queueSize.value} slots=${_iaConcurrent}`);
    try {
      await processarMensagem(msg.telefone || telefone, msg.texto, msg.messageId, msg.settings, msg.origem);
    } catch (e) {
      console.error(`[FILA_ERRO] tel=${telefone} erro="${e?.message}" stack="${(e?.stack||'').slice(0,200)}"`);
    }
  }, DEBOUNCE_MS);
  _debounceTimers.set(telefone, timer);
}

// ─── MULTI-PROVIDER COM FALLBACK + PROVIDER HEALTH ───────
const PROVIDERS = {
  gemini: { models: ['gemini-2.0-flash','gemini-2.0-flash-lite'] },
  openai: { models: ['gpt-4o-mini'] },
};

// Provider Health: controla degradação a nível de provider (não só modelo)
const _providerHealth = {
  gemini: { failures: 0, cooldownUntil: 0, lastError: null },
  openai: { failures: 0, cooldownUntil: 0, lastError: null },
};

function providerEmCooldown(pid) {
  const h = _providerHealth[pid];
  if (!h) return false;
  if (Date.now() < h.cooldownUntil) {
    const restMs = h.cooldownUntil - Date.now();
    console.warn(`[PROVIDER_COOLDOWN] provider=${pid} restante=${Math.round(restMs/1000)}s falhas=${h.failures}`);
    return true;
  }
  return false;
}

function registrarFalhaProvider(pid, motivo) {
  const h = _providerHealth[pid];
  if (!h) return;
  h.failures++;
  h.lastError = motivo;
  h.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
  console.error(`[PROVIDER_DEGRADADO] provider=${pid} motivo=${motivo} failures=${h.failures} cooldown=${PROVIDER_COOLDOWN_MS/60000}min`);
}

function registrarSucessoProvider(pid) {
  const h = _providerHealth[pid];
  if (!h) return;
  if (h.failures > 0) {
    console.log(`[PROVIDER_RECUPERADO] provider=${pid} após ${h.failures} falhas`);
    h.failures = 0; h.cooldownUntil = 0; h.lastError = null;
  }
}

function ehQuota(s, msg) {
  return s === 429 || ['quota','RESOURCE_EXHAUSTED','rate_limit','rate limit','insufficient_quota','overloaded','insufficient_balance'].some(k => msg.includes(k));
}
function ehIndisponivel(s, msg) {
  return s === 404 || ['not found','model_not_found','unavailable','model not found'].some(k => msg.includes(k));
}
function ehTimeout(msg) {
  return ['timeout','timed out','ETIMEDOUT','ECONNRESET','deadline'].some(k => msg.toLowerCase().includes(k));
}


// ─── CHAMADAS IA ─────────────────────────────────────────
async function chamarGemini(model, prompt, apiKey) {
  const t0 = Date.now();
  const genAI = new GoogleGenerativeAI(apiKey);
  const result = await genAI.getGenerativeModel({ model }).generateContent(prompt);
  const texto = result.response.text();
  return { texto, ms: Date.now() - t0, tokensIn: Math.ceil(prompt.length / 4), tokensOut: Math.ceil(texto.length / 4) };
}

// ─── EXTRAÇÃO DE DIAGNÓSTICO DE ERRO OPENAI ──────────────
function extrairDiagnosticoOpenAI(err, responseHeaders) {
  const s = err?.status || err?.httpErrorCode || 0;
  const body = err?.error || {};
  const errorCode    = body?.code    || err?.code    || null;
  const errorType    = body?.type    || err?.type    || null;
  const errorParam   = body?.param   || null;
  const errorMessage = body?.message || err?.message || String(err);
  const em = errorMessage.toLowerCase();

  // Rate limit headers (OpenAI retorna em x-ratelimit-*)
  const rpmLimit     = responseHeaders?.get?.('x-ratelimit-limit-requests')     || null;
  const rpmRemaining = responseHeaders?.get?.('x-ratelimit-remaining-requests') || null;
  const tpmLimit     = responseHeaders?.get?.('x-ratelimit-limit-tokens')       || null;
  const tpmRemaining = responseHeaders?.get?.('x-ratelimit-remaining-tokens')   || null;
  const retryAfter   = responseHeaders?.get?.('retry-after')                    || null;

  // Categorização precisa
  let categoria = 'unknown';
  if (s === 429) {
    if (errorCode === 'rate_limit_exceeded' || em.includes('rate_limit')) {
      categoria = em.includes('token') ? 'rate_limit_tpm' : 'rate_limit_rpm';
    } else if (errorCode === 'insufficient_quota' || em.includes('insufficient_quota')) {
      categoria = 'insufficient_quota';
    } else if (em.includes('overload') || em.includes('overloaded')) {
      categoria = 'overloaded';
    } else {
      categoria = 'rate_limit_429';
    }
  } else if (s === 503 || em.includes('service unavailable') || em.includes('overloaded')) {
    categoria = 'service_overloaded';
  } else if (s === 500 || em.includes('internal server error')) {
    categoria = 'openai_server_error';
  } else if (s === 401) {
    categoria = 'auth_error';
  } else if (s === 404 || em.includes('model_not_found') || em.includes('not found')) {
    categoria = 'model_not_found';
  } else if (em.includes('timeout') || em.includes('timed out') || em.includes('etimedout')) {
    categoria = 'timeout';
  } else if (em.includes('context_length') || em.includes('maximum context')) {
    categoria = 'context_length_exceeded';
  }

  return { s, errorCode, errorType, errorParam, errorMessage, categoria, rpmLimit, rpmRemaining, tpmLimit, tpmRemaining, retryAfter };
}

async function chamarOpenAI(model, systemPrompt, mensagem, apiKey, historico, telefone, tentativa) {
  const t0 = Date.now();
  const client = new OpenAI({ apiKey });
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of (historico || []).slice(-MAX_HIST_MSGS)) {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content.slice(0, 300) });
  }
  messages.push({ role: 'user', content: mensagem });

  const totalTokensEst = Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4);
  console.log(`[OPENAI_REQ] tel=${telefone} model=${model} tentativa=${tentativa||1} msgs=${messages.length} tokens_est=${totalTokensEst}`);

  const r = await client.chat.completions.create({ model, messages, max_tokens: MAX_TOKENS_OUT, temperature: 0.7 });
  const texto = r.choices[0].message.content;
  const tIn   = r.usage?.prompt_tokens     || totalTokensEst;
  const tOut  = r.usage?.completion_tokens || Math.ceil(texto.length / 4);
  const ms    = Date.now() - t0;
  console.log(`[OPENAI_OK] tel=${telefone} model=${model} tentativa=${tentativa||1} t_in=${tIn} t_out=${tOut} ms=${ms}`);
  return { texto, ms, tokensIn: tIn, tokensOut: tOut };
}

async function chamarIA(telefone, mensagem, systemPrompt, geminiKey, openaiKey, ordemProviders, historico) {
  const msg = mensagem.slice(0, MAX_TEXTO_CHARS);
  const promptFinal = systemPrompt.length > MAX_PROMPT_CHARS
    ? systemPrompt.slice(0, MAX_PROMPT_CHARS) + '\n[TRUNCADO]'
    : systemPrompt;
  const histStr = (historico?.length > 0)
    ? '\n\nHISTÓRICO:\n' + historico.slice(-MAX_HIST_MSGS).map(h => `${h.role === 'user' ? 'C' : 'A'}: ${h.content.slice(0,150)}`).join('\n')
    : '';
  const promptGemini = `${promptFinal}${histStr}\n\nCliente: ${msg}`;

  const t0Total = Date.now();
  const fallbacks = [];
  let tipoErroFinal = 'desconhecido';

  // Verifica rapidamente se TODOS os providers estão em cooldown — evita tentativas desnecessárias
  const todosCooldown = ordemProviders.filter(p => {
    const key = p === 'gemini' ? geminiKey : openaiKey;
    return !key || providerEmCooldown(p);
  });
  if (todosCooldown.length === ordemProviders.length) {
    const healthStr = Object.entries(_providerHealth).map(([p,h]) => `${p}:cooldown=${h.cooldownUntil > Date.now() ? Math.round((h.cooldownUntil-Date.now())/1000)+'s' : 'ok'}`).join(' | ');
    console.error(`[IA_TODOS_DEGRADADOS] tel=${telefone} todos_providers_em_cooldown health=[${healthStr}]`);
    return { ok: false, resposta: MSG_RATELIMIT, providerUsado: null, modelUsado: null, fallbacks: ['todos:cooldown'], tipoErro: 'rate_limit' };
  }

  const slotId = acquireIASlot(telefone);
  try {
    for (const pid of ordemProviders) {
      const apiKey = pid === 'gemini' ? geminiKey : openaiKey;
      if (!apiKey) { fallbacks.push(`${pid}:sem_key`); continue; }

      // v19: pula provider inteiro se estiver em cooldown
      if (providerEmCooldown(pid)) {
        fallbacks.push(`${pid}:provider_cooldown`);
        continue;
      }

      for (const model of PROVIDERS[pid].models) {
        const t0 = Date.now();
        try {
          const r = pid === 'gemini'
            ? await chamarGemini(model, promptGemini, apiKey)
            : await chamarOpenAI(model, promptFinal, msg, apiKey, historico, telefone, 1);
          const msTotal = Date.now() - t0Total;
          registrarSucessoProvider(pid);
          console.log(`[IA_OK] tel=${telefone} provider=${pid} model=${model} t_in=${r.tokensIn} t_out=${r.tokensOut} ms_api=${r.ms} ms_total=${msTotal}`);
          return { ok: true, resposta: r.texto, providerUsado: pid, modelUsado: model, fallbacks, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
        } catch (err) {
          const ms = Date.now() - t0;
          const s  = err?.status || err?.httpErrorCode || 0;
          const em = (err?.message || '').toLowerCase();

          // Log diagnóstico OpenAI
          if (pid === 'openai') {
            const diag = extrairDiagnosticoOpenAI(err, err?.__headers);
            console.error(`[OPENAI_DIAG] tel=${telefone} model=${model} http=${diag.s} categoria=${diag.categoria} code=${diag.errorCode} msg="${diag.errorMessage.slice(0,150)}" rpm_rem=${diag.rpmRemaining} tpm_rem=${diag.tpmRemaining} ms=${ms}`);
          }

          // QUOTA/RATE LIMIT: falha imediata do provider inteiro — sem retry
          if (ehQuota(s, em)) {
            tipoErroFinal = 'rate_limit';
            registrarFalhaProvider(pid, `quota/${s}`);
            fallbacks.push(`${pid}/${model}:quota_fallback_imediato`);
            console.error(`[QUOTA_FALLBACK] tel=${telefone} ${pid}/${model} s=${s} ms=${ms} → próximo provider`);
            break; // sai do loop de modelos deste provider — vai para o próximo
          }
          if (ehIndisponivel(s, em)) {
            tipoErroFinal = 'model_unavail';
            console.error(`[IA_UNAVAIL] tel=${telefone} ${pid}/${model} s=${s} ms=${ms}`);
            fallbacks.push(`${pid}/${model}:unavail`);
            continue; // tenta próximo modelo do mesmo provider
          }
          if (ehTimeout(em)) {
            tipoErroFinal = 'timeout';
            registrarFalhaProvider(pid, `timeout/${ms}ms`);
            console.error(`[IA_TIMEOUT] tel=${telefone} ${pid}/${model} ms=${ms}`);
            fallbacks.push(`${pid}/${model}:timeout`);
            break; // timeout → próximo provider
          }
          tipoErroFinal = 'api_erro';
          console.error(`[IA_ERRO] tel=${telefone} ${pid}/${model} s=${s} ms=${ms} e="${err?.message}"`);
          fallbacks.push(`${pid}/${model}:erro`);
          // erro desconhecido → tenta próximo modelo
        }
      } // end for model
    } // end for provider
  } finally {
    releaseIASlot(slotId, telefone);
  }

  const msTotal = Date.now() - t0Total;
  // Log do estado atual de saúde dos providers
  const healthStr = Object.entries(_providerHealth).map(([p,h]) => `${p}:failures=${h.failures},cooldown=${h.cooldownUntil > Date.now() ? Math.round((h.cooldownUntil-Date.now())/1000)+'s' : 'ok'}`).join(' | ');
  console.error(`[IA_FALHA_TOTAL] tel=${telefone} tipo=${tipoErroFinal} ms=${msTotal} fallbacks="${fallbacks.join('→')}" health=[${healthStr}]`);
  const msgFallback = tipoErroFinal === 'rate_limit' ? MSG_RATELIMIT
    : tipoErroFinal === 'timeout' ? MSG_TIMEOUT
    : tipoErroFinal === 'api_erro' ? MSG_APIERRO
    : MSG_ERRO;
  return { ok: false, resposta: msgFallback, providerUsado: null, modelUsado: null, fallbacks, tipoErro: tipoErroFinal };
}

// ─── DEDUP + COOLDOWN + LOCK ──────────────────────────────
const processedMessages = new Map();
const DEDUP_TTL = 10 * 60 * 1000;
function jaProcessado(id) {
  if (!id) return false;
  const ts = processedMessages.get(id);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL) { processedMessages.delete(id); return false; }
  return true;
}
function marcarProcessado(id) {
  if (!id) return;
  processedMessages.set(id, Date.now());
  if (processedMessages.size > 500) {
    const now = Date.now();
    for (const [k, v] of processedMessages) { if (now - v > DEDUP_TTL) processedMessages.delete(k); }
  }
}
const userCooldown = new Map();
function passouCooldown(tel) {
  const last = userCooldown.get(tel);
  if (last && Date.now() - last < USER_COOLDOWN_MS) {
    console.log(`[COOLDOWN] tel=${tel} age=${Date.now()-last}ms < ${USER_COOLDOWN_MS}ms`);
    return false;
  }
  userCooldown.set(tel, Date.now()); return true;
}
const userLocks = new Set();

// ─── CACHE DE RESPOSTA ────────────────────────────────────
const responseCache = new Map();
function cacheKey(tel, txt) { return `${tel}|${txt.slice(0, 80)}`; }
function getCached(tel, txt) {
  const e = responseCache.get(cacheKey(tel, txt));
  if (!e || Date.now() - e.ts > 120000) { responseCache.delete(cacheKey(tel, txt)); return null; }
  return e.resposta;
}
function setCache(tel, txt, resposta) { responseCache.set(cacheKey(tel, txt), { resposta, ts: Date.now() }); }

// ─── CACHE DE CLIENTE POR TELEFONE (TTL 10min) ───────────
// v19: busca por filtro de telefone (sem list 500) — elimina latência SQL
const _clienteCache = new Map(); // tel → { cliente, ts }
const CLIENTE_CACHE_TTL = 10 * 60 * 1000; // ↑ de 5min para 10min
async function buscarClientePorTelefone(telefone, base44) {
  const cached = _clienteCache.get(telefone);
  if (cached && Date.now() - cached.ts < CLIENTE_CACHE_TTL) {
    return cached.cliente;
  }
  const t0 = Date.now();
  try {
    const limpo = telefone.replace(/\D/g, '').replace(/^55/, '');
    const semNono = limpo.replace(/^(\d{2})9(\d{8})$/, '$1$2');
    const comNono = semNono !== limpo ? limpo : `9${semNono}`;

    // 1ª tentativa: número exato em tel1/tel2/tel3 em paralelo
    let encontrado = null;
    const [r1a, r1b, r1c] = await Promise.all([
      base44.entities.Client.filter({ telefone1: limpo }).catch(() => []),
      base44.entities.Client.filter({ telefone2: limpo }).catch(() => []),
      base44.entities.Client.filter({ telefone3: limpo }).catch(() => []),
    ]);
    const exactos = [...r1a, ...r1b, ...r1c];
    if (exactos.length > 0) {
      encontrado = exactos[0];
    } else {
      // 2ª: variações nono dígito
      const [r2a, r2b, r2c, r2d] = await Promise.all([
        semNono !== limpo ? base44.entities.Client.filter({ telefone1: semNono }).catch(() => []) : Promise.resolve([]),
        semNono !== limpo ? base44.entities.Client.filter({ telefone2: semNono }).catch(() => []) : Promise.resolve([]),
        base44.entities.Client.filter({ telefone1: comNono }).catch(() => []),
        base44.entities.Client.filter({ telefone2: comNono }).catch(() => []),
      ]);
      encontrado = r2a[0] || r2b[0] || r2c[0] || r2d[0] || null;
    }

    const ms = Date.now() - t0;
    _clienteCache.set(telefone, { cliente: encontrado, ts: Date.now() });
    console.log(`[CLIENTE] tel=${telefone} encontrado=${!!encontrado} ms=${ms} cache_hit=false`);
    return encontrado;
  } catch (e) {
    console.error(`[CLIENTE_ERRO] tel=${telefone} ms=${Date.now()-t0} erro="${e?.message}"`);
    return null;
  }
}

// ─── CACHE DE CONTEXTO (TTL 5min) — SOB DEMANDA ──────────
// v20: contexto (contratos/OS) só é carregado quando o intent exige
// Intents que PRECISAM de contexto: financeiro, entrega, recolha, suporte
const INTENTS_COM_CONTEXTO = new Set(['financeiro', 'entrega', 'recolha', 'suporte', 'reclamacao', 'cancelamento']);
const _contextoCache = new Map();
const CONTEXTO_CACHE_TTL = 5 * 60 * 1000;

async function montarContexto(cliente, base44, intent) {
  // v20: para orçamentos simples, retorna só dados básicos do cliente — sem SQL extra
  if (!INTENTS_COM_CONTEXTO.has(intent)) {
    return { cli: { nome: cliente.nome_razao_social, bloq: cliente.bloqueado || false, deve: 0 }, cts: [], os: [] };
  }

  const cached = _contextoCache.get(cliente.id);
  if (cached && Date.now() - cached.ts < CONTEXTO_CACHE_TTL) {
    console.log(`[CONTEXTO] cliente=${cliente.id} intent=${intent} cache_hit=true`);
    return cached.ctx;
  }
  const t0 = Date.now();
  try {
    const [contratos, ordens] = await Promise.all([
      base44.entities.Contract.filter({ client_id: cliente.id }),
      base44.entities.ServiceOrder.filter({ client_id: cliente.id }),
    ]);
    const ms = Date.now() - t0;
    const ativos = contratos.filter(c => !['finalizado', 'cancelado'].includes(c.status));
    const deve = contratos.filter(c => c.status_financeiro !== 'pago').reduce((s, c) => s + (c.saldo_pagar || 0), 0)
      + ordens.filter(o => o.status_pagamento !== 'pago').reduce((s, o) => s + (o.valor || 0), 0);
    const ctx = {
      cli: { nome: cliente.nome_razao_social, bloq: cliente.bloqueado || false, deve },
      cts: ativos.slice(0, 2).map(c => ({ n: c.numero, s: c.status, eq: (c.itens||[]).map(i => `${i.equipamento_nome}(${i.quantidade_retirada||1}x)`).join(','), sal: c.saldo_pagar })),
      os: ordens.filter(o => !['finalizada','cancelada'].includes(o.status)).slice(0,2).map(o => ({ n: o.numero, s: o.status })),
    };
    _contextoCache.set(cliente.id, { ctx, ts: Date.now() });
    console.log(`[CONTEXTO] cliente=${cliente.id} intent=${intent} contratos=${contratos.length} ms=${ms}`);
    return ctx;
  } catch (e) {
    console.error(`[CONTEXTO_ERRO] cliente=${cliente.id} ms=${Date.now()-t0} erro="${e?.message}"`);
    return null;
  }
}

// ─── CACHE DE SETTINGS (TTL 60s) ─────────────────────────
let _settingsCache = null, _settingsCacheTs = 0;
async function carregarSettings() {
  if (_settingsCache && Date.now() - _settingsCacheTs < 60000) return _settingsCache;
  const t0 = Date.now();
  try {
    const list = await sr().entities.AgentSettings.list();
    _settingsCache = list[0] || {}; _settingsCacheTs = Date.now();
    console.log(`[SETTINGS] ms=${Date.now()-t0} cache_hit=false`);
    return _settingsCache;
  } catch (e) {
    console.error(`[SETTINGS_ERRO] ms=${Date.now()-t0} erro="${e?.message}"`);
    return _settingsCache || {};
  }
}
function mesclarSettings(banco) {
  return {
    ...banco,
    gemini_api_key:           Deno.env.get('WA_GEMINI_KEY')      || banco.gemini_api_key          || '',
    openai_api_key:           Deno.env.get('WA_OPENAI_KEY')      || banco.openai_api_key           || '',
    whatsapp_access_token:    Deno.env.get('WA_ACCESS_TOKEN')    || banco.whatsapp_access_token    || '',
    whatsapp_phone_number_id: Deno.env.get('WA_PHONE_NUMBER_ID') || banco.whatsapp_phone_number_id || '',
    whatsapp_verify_token:    Deno.env.get('WA_VERIFY_TOKEN')    || banco.whatsapp_verify_token    || '',
  };
}

// ─── CACHE DE FLUXO DINÂMICO (TTL 90s por tipo) ──────────
const _fluxosCache = new Map();
async function carregarFluxoDinamicoContextual(fluxoTipo) {
  const cached = _fluxosCache.get(fluxoTipo);
  if (cached && Date.now() - cached.ts < 90000) return cached.dados;
  const t0 = Date.now();
  try {
    const lista = await sr().entities.FluxoIA.filter({ tipo: fluxoTipo });
    const ativo = (lista || []).filter(f => f.ativo !== false).sort((a,b) => (a.prioridade||10)-(b.prioridade||10))[0] || null;
    _fluxosCache.set(fluxoTipo, { dados: ativo, ts: Date.now() });
    console.log(`[FLUXO] tipo=${fluxoTipo} encontrado=${!!ativo} ms=${Date.now()-t0}`);
    return ativo;
  } catch (e) {
    console.warn(`[FLUXO_ERRO] tipo=${fluxoTipo} ms=${Date.now()-t0} erro="${e?.message}"`);
    return null;
  }
}

// ─── FLUXOS HARDCODED ────────────────────────────────────
const FLUXOS = {
  andaime:           { steps: ['quantidade','altura','bairro','cidade','periodo','endereco','orcamento'],     perguntas: { quantidade:'Quantas peças de andaime você precisa?',   altura:'Qual a altura necessária? (metros)', bairro:'Em qual bairro será a obra?', cidade:'Em qual cidade?', periodo:'Por quantos dias precisará?', endereco:'Qual o endereço completo?' }, campos: { quantidade:'quantidade',altura:'altura',bairro:'bairro',cidade:'cidade',periodo:'periodo',endereco:'endereco' } },
  andaime_fachadeiro:{ steps: ['metragem','bairro','cidade','periodo','endereco','orcamento'],                perguntas: { metragem:'Qual a metragem da fachada? (m lineares ou m²)',              bairro:'Em qual bairro será a obra?', cidade:'Em qual cidade?', periodo:'Por quantos dias precisará?', endereco:'Qual o endereço completo?' }, campos: { metragem:'metragem',bairro:'bairro',cidade:'cidade',periodo:'periodo',endereco:'endereco' } },
  escoramento:       { steps: ['quantidade','altura','bairro','cidade','periodo','endereco','orcamento'],     perguntas: { quantidade:'Quantas escoras você precisa?',               altura:'Qual a altura necessária? (metros)', bairro:'Em qual bairro?', cidade:'Em qual cidade?', periodo:'Por quantos dias?', endereco:'Qual o endereço completo?' }, campos: { quantidade:'quantidade',altura:'altura',bairro:'bairro',cidade:'cidade',periodo:'periodo',endereco:'endereco' } },
  cacamba:           { steps: ['quantidade','metragem','bairro','cidade','periodo','endereco','orcamento'],   perguntas: { quantidade:'Quantas caçambas você precisa?', metragem:'Qual o tamanho? (3m³, 5m³, 7m³)',    bairro:'Em qual bairro ficará?', cidade:'Em qual cidade?', periodo:'Por quantos dias?', endereco:'Qual o endereço completo?' }, campos: { quantidade:'quantidade',metragem:'metragem',bairro:'bairro',cidade:'cidade',periodo:'periodo',endereco:'endereco' } },
  ferramentas:       { steps: ['equipamento','periodo','bairro','cidade','orcamento'],                       perguntas: { equipamento:'Qual ferramenta você precisa?', periodo:'Por quantos dias?', bairro:'Em qual bairro?', cidade:'Em qual cidade?' }, campos: { periodo:'periodo',bairro:'bairro',cidade:'cidade' } },
  financeiro:        { steps: [], perguntas: {}, campos: {} },
  entrega:           { steps: [], perguntas: {}, campos: {} },
  recolha:           { steps: [], perguntas: {}, campos: {} },
  suporte:           { steps: [], perguntas: {}, campos: {} },
  geral:             { steps: [], perguntas: {}, campos: {} },
};

// ─── DETECTOR DE FLUXO COM SCORE + PROTEÇÃO ───────────────
// Protege contra troca indevida: precisa de score >= 2 para mudar fluxo ativo
function scoreFluxo(texto, intent) {
  const t = texto.toLowerCase();
  const scores = {};
  // Financeiro — alta prioridade, isolado
  if (/boleto|pix|pagamento|devo|deve|financeiro|cobran[cç]|nota fiscal|nf\b|vencimento|parcela/.test(t)) scores.financeiro = (scores.financeiro||0) + 3;
  if (intent === 'financeiro') scores.financeiro = (scores.financeiro||0) + 2;
  // Recolha
  if (/recolh|buscar equipamento|pegar equipamento|devolver|devolução|devolucao/.test(t)) scores.recolha = (scores.recolha||0) + 3;
  if (intent === 'recolha') scores.recolha = (scores.recolha||0) + 2;
  // Entrega
  if (/prazo de entrega|quando (vai|vem|chega)|data de entrega|entrega do/.test(t)) scores.entrega = (scores.entrega||0) + 3;
  if (intent === 'entrega') scores.entrega = (scores.entrega||0) + 2;
  // Suporte
  if (/suporte|reclam|não funciona|com defeito|quebrado|errado|problema com/.test(t)) scores.suporte = (scores.suporte||0) + 3;
  if (intent === 'suporte' || intent === 'reclamacao') scores.suporte = (scores.suporte||0) + 2;
  // Produtos
  if (/andaime\s+fachadeiro|fachadeiro/.test(t)) scores.andaime_fachadeiro = (scores.andaime_fachadeiro||0) + 4;
  if (/andaime\s+tubular|andaime(?!\s+fachadeiro)/.test(t)) scores.andaime = (scores.andaime||0) + 4;
  if (/escor[ae]/.test(t)) scores.escoramento = (scores.escoramento||0) + 4;
  if (/ca[çc]amba/.test(t)) scores.cacamba = (scores.cacamba||0) + 4;
  if (/ferramenta|betoneira|compactador|vibrador|gerador/.test(t)) scores.ferramentas = (scores.ferramentas||0) + 4;
  return scores;
}

function detectarIntencao(texto) {
  const t = texto.toLowerCase();
  if (/urg[eê]nte|emergência|emergencia|urgente|r[aá]pido|agora|imediato/.test(t)) return 'urgencia';
  if (/atendente|humano|pessoa|falar com alguém|falar com alguem|operador|funcionário/.test(t)) return 'humano';
  if (/cancel[ae]r|cancelamento|desistir|não quero mais/.test(t)) return 'cancelamento';
  if (/reclam|problema|reclamação|errado|incorreto|ruim|péssimo/.test(t)) return 'reclamacao';
  if (/suporte|ajuda|dúvida|duvida|não entendo|como funciona/.test(t)) return 'suporte';
  if (/recolh|buscar|pegar|devolver|devolução/.test(t)) return 'recolha';
  if (/entrega|prazo de entrega|quando chega|data de entrega/.test(t)) return 'entrega';
  if (/boleto|pix|pagamento|devo|deve|financeiro|cobran[cç]|nota fiscal/.test(t)) return 'financeiro';
  return 'orcamento';
}

// flowAtual: fluxo que estava ativo (do estado persistido)
// Retorna novo fluxo — protege contra troca indevida
function detectarFluxoComScore(texto, intent, dadosExistentes, flowAtual) {
  // Se já tem equipamento coletado, mantém o fluxo
  if (dadosExistentes?.equipamento) {
    const eq = dadosExistentes.equipamento.toLowerCase();
    if (eq.includes('andaime')) return eq.includes('fachadeiro') ? 'andaime_fachadeiro' : 'andaime';
    if (eq.includes('escora')) return 'escoramento';
    if (eq.includes('caçamba') || eq.includes('cacamba')) return 'cacamba';
  }

  const scores = scoreFluxo(texto, intent);
  // Encontra fluxo com maior score
  let melhorFluxo = null, melhorScore = 0;
  for (const [f, s] of Object.entries(scores)) {
    if (s > melhorScore) { melhorScore = s; melhorFluxo = f; }
  }

  // Se há fluxo ativo e o novo score não é forte o suficiente, mantém o atual
  // Isso evita que "qual o valor?" durante um orçamento mude para 'financeiro'
  const SCORE_MINIMO_PARA_MUDAR = 3;
  if (flowAtual && flowAtual !== 'geral' && melhorFluxo !== flowAtual) {
    if (melhorScore < SCORE_MINIMO_PARA_MUDAR) {
      console.log(`[FLUXO_MANTIDO] atual=${flowAtual} candidato=${melhorFluxo} score=${melhorScore} abaixo_limiar`);
      return flowAtual;
    }
  }

  return melhorFluxo || 'geral';
}

function fluxoBancoParaInterno(f) {
  if (!f) return null;
  const etapas = (f.etapas || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const steps = [...etapas.map(e => e.chave).filter(Boolean), 'orcamento'];
  const perguntas = {}, campos = {};
  for (const e of etapas) { if (!e.chave) continue; if (e.pergunta) perguntas[e.chave] = e.pergunta; campos[e.chave] = e.chave; }
  return {
    id: f.id, nome: f.nome, tipo: f.tipo, steps, perguntas, campos,
    objetivo: f.objetivo || '',
    regras: (f.regras_especificas || []).filter(r => r.ativa !== false).map(r => `• ${r.descricao}`).join('\n'),
    proibidas: (f.respostas_proibidas || []).filter(r => r.ativa !== false).map(r => `• ${r.descricao}`).join('\n'),
    transferencia: (f.transferencia_humana_condicoes || []).filter(r => r.ativa !== false).map(r => `• ${r.condicao}`).join('\n'),
    mensagem_inicio: f.mensagem_inicio || '', mensagem_conclusao: f.mensagem_conclusao || '',
    prompt_adicional: f.prompt_adicional || '',
    dicas_etapa: Object.fromEntries(etapas.filter(e => e.chave && e.dica_ia).map(e => [e.chave, e.dica_ia])),
  };
}

// ─── SERVICE ROLE ─────────────────────────────────────────
// CRÍTICO: cria o client uma vez por request e mantém a instância serviceRole
// Recriar a cada chamada sr() causava 403 auth_required intermitente
let _currentReq = null;
let _srInstance = null;
function initServiceRole(req) {
  _currentReq = req;
  _srInstance = createClientFromRequest(req).asServiceRole;
}
function sr() {
  if (!_srInstance) {
    console.error('[SR_WARN] _srInstance nulo — recriando (pode indicar req fora de contexto)');
    _srInstance = createClientFromRequest(_currentReq).asServiceRole;
  }
  return _srInstance;
}

// ─── CONVERSATION STATE ───────────────────────────────────
async function carregarEstado(telefone, base44) {
  const t0 = Date.now();
  try {
    const lista = await base44.entities.ConversationState.filter({ telefone });
    const ms = Date.now() - t0;
    if (!lista?.length) { console.log(`[ESTADO] tel=${telefone} novo=true ms=${ms}`); return null; }
    const estado = lista.sort((a, b) => new Date(b.ultima_interacao || b.created_date || 0) - new Date(a.ultima_interacao || a.created_date || 0))[0];
    console.log(`[ESTADO] tel=${telefone} id=${estado.id} trocas=${estado.total_trocas||0} flow=${estado.flow||'?'} step=${estado.step||'?'} ms=${ms}`);
    return estado;
  } catch (e) {
    console.error(`[ESTADO_ERRO] tel=${telefone} ms=${Date.now()-t0} erro="${e?.message}"`);
    return null;
  }
}
async function salvarEstado(telefone, estadoAtual, patch, base44) {
  const t0 = Date.now();
  try {
    const agora = new Date().toISOString();
    if (estadoAtual?.id) {
      await base44.entities.ConversationState.update(estadoAtual.id, { ...patch, ultima_interacao: agora });
    } else {
      await base44.entities.ConversationState.create({ telefone, ultima_interacao: agora, total_trocas: 0, apresentado: false, dados_coletados: {}, ...patch });
    }
    console.log(`[ESTADO_SAVE] tel=${telefone} ms=${Date.now()-t0}`);
  } catch (e) {
    console.error(`[ESTADO_SAVE_ERRO] tel=${telefone} ms=${Date.now()-t0} erro="${e?.message}"`);
  }
}

// ─── HISTÓRICO: usa dados do estado persistido ─────────────
// Se já temos ultimo_resposta e ultima_pergunta no estado, não precisamos buscar os logs
// Só busca WhatsappLog quando o estado não tem contexto suficiente
async function carregarHistoricoInteligente(telefone, estadoAtual, base44) {
  // Estado tem histórico suficiente se tem pelo menos 1 troca
  if (estadoAtual?.total_trocas > 0 && estadoAtual?.ultima_resposta) {
    // Reconstrói histórico mínimo a partir do estado — sem query ao banco
    const hist = [];
    if (estadoAtual.ultima_pergunta) hist.push({ role: 'user', content: estadoAtual.ultima_pergunta });
    if (estadoAtual.ultima_resposta) hist.push({ role: 'assistant', content: estadoAtual.ultima_resposta });
    console.log(`[HIST] tel=${telefone} fonte=estado msgs=${hist.length} db_query=false`);
    return hist;
  }
  // Primeira interação ou estado vazio — busca últimas mensagens do banco
  const t0 = Date.now();
  try {
    const corte = new Date(Date.now() - 4 * 3600000).toISOString();
    const logs = await base44.entities.WhatsappLog.filter({ telefone });
    const ms = Date.now() - t0;
    const filtrados = logs
      .filter(l => (l.data_hora || l.created_date || '') >= corte)
      .sort((a, b) => new Date(a.data_hora || a.created_date || 0) - new Date(b.data_hora || b.created_date || 0))
      .slice(-MAX_HIST_MSGS);
    const msgs = [];
    for (const l of filtrados) {
      if (l.pergunta && !l.pergunta.startsWith('[Atendimento humano]')) msgs.push({ role: 'user', content: l.pergunta });
      if (l.resposta) msgs.push({ role: 'assistant', content: l.resposta });
    }
    console.log(`[HIST] tel=${telefone} fonte=banco total=${logs.length} enviados=${msgs.length} ms=${ms}`);
    return msgs;
  } catch (e) {
    console.error(`[HIST_ERRO] tel=${telefone} ms=${Date.now()-t0} erro="${e?.message}"`);
    return [];
  }
}

// ─── EXTRAÇÃO DE DADOS ────────────────────────────────────
function extrairComContexto(dados, texto, ultimaPergunta, flowAtual) {
  const t = texto.toLowerCase().trim();
  const numEx = { uma:1,um:1,dois:2,duas:2,'três':3,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10 };
  const ult = (ultimaPergunta || '').toLowerCase();

  if (!dados.quantidade && (ult.includes('quant') || ult.includes('peças') || ult.includes('caçamba') || ult.includes('escora'))) {
    const n = parseInt(t) || numEx[t.trim()];
    if (n) dados.quantidade = n;
    else {
      const m = t.match(/(?:somente|apenas|só|so|quero|preciso)?\s*(uma?|um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|\d+)/i);
      if (m) dados.quantidade = numEx[m[1].toLowerCase()] || parseInt(m[1]) || null;
    }
  }
  if (!dados.metragem && (ult.includes('metr') || ult.includes('tamanh') || ult.includes('m³') || ult.includes('fachada'))) {
    const m = t.match(/(\d+[\.,]?\d*)/);
    if (m) dados.metragem = m[1].replace(',', '.') + 'm';
  }
  if (!dados.altura && (ult.includes('altur') || ult.includes('metros'))) {
    const m = t.match(/(\d+[\.,]?\d*)/);
    if (m) dados.altura = m[1].replace(',', '.') + 'm';
  }
  if (!dados.periodo && (ult.includes('dias') || ult.includes('quanto tempo') || ult.includes('período') || ult.includes('periodo'))) {
    const m = t.match(/(\d+)/);
    if (m) dados.periodo = m[1] + ' dias';
    const mes = t.match(/(\d+)\s*m[eê]s/i); if (mes) dados.periodo = (parseInt(mes[1])*30) + ' dias';
    const sem = t.match(/(\d+)\s*semana/i);  if (sem) dados.periodo = (parseInt(sem[1])*7)  + ' dias';
  }
  if (!dados.bairro && ult.includes('bairro'))   dados.bairro = texto.trim();
  if (!dados.cidade && ult.includes('cidade'))   dados.cidade = texto.trim();
  if (!dados.endereco && ult.includes('endereço')) dados.endereco = texto.trim();

  if (!dados.equipamento) {
    if (/andaime\s+fachadeiro|fachadeiro/.test(t)) dados.equipamento = 'andaime fachadeiro';
    else if (/andaime/.test(t)) dados.equipamento = 'andaime tubular';
    else if (/escora/.test(t)) dados.equipamento = 'escora metálica';
    else if (/ca[çc]amba/.test(t)) dados.equipamento = 'caçamba';
    else if (/betoneira/.test(t)) dados.equipamento = 'betoneira';
    else if (/vibrador/.test(t)) dados.equipamento = 'vibrador de concreto';
    else if (/compactador/.test(t)) dados.equipamento = 'compactador';
    else if (/gerador/.test(t)) dados.equipamento = 'gerador';
    else if (/grade/.test(t)) dados.equipamento = 'grade de proteção';
  }
  if (!dados.quantidade) {
    const m = t.match(/^(\d+)(?:\s*(pe[çc]as?|escoras?|ca[çc]ambas?|andaimes?|unidades?))?$/);
    if (m) dados.quantidade = parseInt(m[1]);
  }
  if (!dados.quantidade) {
    const m = t.match(/(?:somente|apenas|só|so|quero|preciso de?)\s+(\d+|uma?|um|dois|duas|três|tres|quatro|cinco)/i);
    if (m) dados.quantidade = numEx[m[1].toLowerCase()] || parseInt(m[1]) || null;
  }
  if (!dados.metragem) {
    const m3 = t.match(/(\d+[\.,]?\d*)\s*m[³3]/i); if (m3) dados.metragem = m3[1].replace(',','.')+'m³';
    const m2 = !m3 && t.match(/(\d+[\.,]?\d*)\s*m[²2]/i); if (m2) dados.metragem = m2[1].replace(',','.')+'m²';
    if (!dados.metragem) {
      const mg = t.match(/^(\d+[\.,]?\d*)\s*m$/i);
      if (mg && (flowAtual === 'cacamba' || flowAtual === 'andaime_fachadeiro')) dados.metragem = mg[1].replace(',','.')+'m';
    }
  }
  if (!dados.altura) {
    const m = t.match(/(\d+[\.,]?\d*)\s*m(?:etros?)?\s+de\s+altura/i) || t.match(/altura\s+(?:de\s+)?(\d+[\.,]?\d*)/i);
    if (m) dados.altura = m[1].replace(',','.')+'m';
  }
  if (!dados.periodo) {
    const d = t.match(/(\d+)\s*dias?/i); if (d) dados.periodo = d[1]+' dias';
    else {
      const mes = t.match(/(\d+)\s*m[eê]ses?/i); if (mes) dados.periodo = (parseInt(mes[1])*30)+' dias';
      const sem = t.match(/(\d+)\s*semanas?/i);   if (sem) dados.periodo = (parseInt(sem[1])*7)+' dias';
    }
  }
  if (!dados.cidade) {
    const cidades = ['cabo frio','arraial do cabo','armação dos búzios','búzios','são pedro da aldeia','iguaba grande','araruama','saquarema','maricá','niterói','rio de janeiro','campos','macaé','angra dos reis','paraty'];
    for (const c of cidades) { if (t.includes(c)) { dados.cidade = c; break; } }
  }
  if (!dados.bairro) { const m = texto.match(/bairro[:\s]+([^,\n]+)/i); if (m) dados.bairro = m[1].trim(); }
  if (!dados.endereco) { const m = texto.match(/(?:rua|av(?:enida)?|estrada|rod(?:ovia)?|trav(?:essa)?|alameda)[^\n,]{5,60}/i); if (m) dados.endereco = m[0].trim(); }
  if (!dados.nome_cliente) { const m = texto.match(/(?:meu nome é|me chamo|sou o|sou a)\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÜ][a-záéíóúàâêôãõü]+(?:\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÜ][a-záéíóúàâêôãõü]+)*)/i); if (m) dados.nome_cliente = m[1]; }
  if (!dados.cpf_cnpj) { const m = texto.match(/\d{3}[\.\-\s]?\d{3}[\.\-\s]?\d{3}[\-\.\s]?\d{2}|\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/\-]?\d{4}[\-]?\d{2}/); if (m) dados.cpf_cnpj = m[0]; }
}

function gerarResumoOperacional(dados, flow, step, intent) {
  const labels = { orcamento:'Orçamento',financeiro:'Financeiro',entrega:'Entrega',recolha:'Recolha',suporte:'Suporte',reclamacao:'Reclamação',urgencia:'URGENTE',humano:'Quer humano',cancelamento:'Cancelamento' };
  const fl = { andaime:'Andaime Tubular',andaime_fachadeiro:'Andaime Fachadeiro',escoramento:'Escoramento',cacamba:'Caçamba',ferramentas:'Ferramentas',financeiro:'Financeiro',entrega:'Entrega',recolha:'Recolha',suporte:'Suporte',geral:'Geral' };
  const linhas = [`Intenção: ${labels[intent]||intent}`];
  if (dados.equipamento) linhas.push(`✔ ${dados.equipamento}`);
  if (dados.quantidade)  linhas.push(`✔ Qtd: ${dados.quantidade}`);
  if (dados.metragem)    linhas.push(`✔ Metr: ${dados.metragem}`);
  if (dados.altura)      linhas.push(`✔ Alt: ${dados.altura}`);
  if (dados.bairro)      linhas.push(`✔ Bairro: ${dados.bairro}`);
  if (dados.cidade)      linhas.push(`✔ Cidade: ${dados.cidade}`);
  if (dados.periodo)     linhas.push(`✔ Período: ${dados.periodo}`);
  if (dados.nome_cliente) linhas.push(`✔ Nome: ${dados.nome_cliente}`);
  linhas.push(`Fluxo: ${fl[flow]||flow} | Etapa: ${step}`);
  return linhas.join('\n');
}

// ─── VERIFICAR IA PAUSADA ─────────────────────────────────
async function verificarIAPausada(telefone, settings, base44) {
  try {
    const all = await base44.entities.Intervention.filter({ telefone });
    const ativas = all.filter(i => i.ia_pausada === true && (i.status === 'aguardando' || i.status === 'assumido'));
    if (!ativas.length) return false;
    const timeoutMin = Number(settings.intervencao_timeout_minutos) || 0;
    if (timeoutMin > 0) {
      for (const iv of ativas) {
        const refTime = iv.data_resposta || iv.data_assumido || iv.data_criacao;
        if (!refTime) continue;
        if ((Date.now() - new Date(refTime).getTime()) / 60000 >= timeoutMin) {
          await base44.entities.Intervention.update(iv.id, { status: 'ia_retomada', ia_pausada: false });
          return false;
        }
      }
    }
    return true;
  } catch (e) { console.warn(`[INTERV_PAUSA] tel=${telefone} erro="${e?.message}"`); return false; }
}
async function criarIntervencao(telefone, texto, clienteId, clienteNome, motivo, origem, base44) {
  try {
    await base44.entities.Intervention.create({
      telefone, cliente_nome: clienteNome || 'Sem cadastro', cliente_id: clienteId || null,
      pergunta_original: texto, motivo, status: 'aguardando', ia_pausada: true, origem,
      data_criacao: new Date().toISOString(),
      historico_mensagens: [{ role: 'cliente', conteudo: texto, data_hora: new Date().toISOString(), autor: clienteNome || telefone }],
    });
  } catch (e) { console.warn(`[INTERV_CREATE] erro="${e?.message}"`); }
}
function iaQuerEscalar(resposta) {
  if (!resposta) return false;
  const r = resposta.toLowerCase();
  return ['não tenho essa informação','não sei responder','não consigo responder','precisa falar com um atendente','vou transferir','encaminhar para um humano','não tenho acesso','entre em contato diretamente','não tenho como confirmar'].some(t => r.includes(t));
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────
Deno.serve(async (req) => {
  initServiceRole(req);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (!mode && !challenge) return new Response('OK', { status: 200 });
    const envToken = Deno.env.get('WA_VERIFY_TOKEN');
    let validTokens = ['andaimes_verify_token'];
    if (envToken) { validTokens = [envToken, 'andaimes_verify_token']; }
    else { const banco = await carregarSettings(); validTokens = [banco.whatsapp_verify_token, banco.generica_verify_token, 'andaimes_verify_token'].filter(Boolean); }
    if (mode === 'subscribe' && validTokens.includes(token)) return new Response(challenge, { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const rawBody = await req.text();
    let body;
    try { body = JSON.parse(rawBody); } catch { return new Response('OK', { status: 200 }); }

    let telefone = null, texto = null, messageId = null, origem = null;
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (value) {
      if (!value.messages?.length) return new Response('OK', { status: 200 });
      const msg = value.messages[0];
      if (msg.type === 'text' && msg.text?.body?.trim()) { telefone = msg.from; texto = msg.text.body.trim(); messageId = msg.id; origem = 'meta'; }
    }
    if (!telefone) {
      if (body.phone && body.text?.message)                { telefone = body.phone.replace(/\D/g,''); texto = body.text.message; messageId = body.messageId||body.id||null; origem='generica'; }
      else if (body.data?.key?.remoteJid && (body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text)) {
        telefone = body.data.key.remoteJid.replace('@s.whatsapp.net','').replace(/\D/g,'');
        texto = body.data.message.conversation || body.data.message.extendedTextMessage?.text;
        messageId = body.data.key.id||null; origem='generica';
      } else if ((body.from||body.sender) && (body.body||body.message||body.text)) {
        telefone = (body.from||body.sender||'').replace(/\D/g,'');
        texto = (body.body||body.message||body.text||'').trim();
        messageId = body.messageId||body.id||null; origem='generica';
      }
    }

    if (!telefone || !texto) return new Response('OK', { status: 200 });
    if (messageId && jaProcessado(messageId)) { console.log(`[DEDUP] skip msgId=${messageId}`); return new Response('OK', { status: 200 }); }
    if (messageId) marcarProcessado(messageId);

    const settings = mesclarSettings(await carregarSettings());
    if (origem === 'meta'     && !settings.agente_ativo)          return new Response('OK', { status: 200 });
    if (origem === 'generica' && !settings.generica_agente_ativo) return new Response('OK', { status: 200 });
    if (!passouCooldown(telefone)) { console.log(`[COOLDOWN] skip tel=${telefone}`); return new Response('OK', { status: 200 }); }

    // ── Enfileira com debounce — não processa imediatamente ──────────
    console.log(`[WEBHOOK] tel=${telefone} origem=${origem} queue_size=${_queueSize.value} ia_concurrent=${_iaConcurrent}`);
    enqueueDebounce(telefone, texto, messageId, settings, origem);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`[WEBHOOK_ERRO] erro="${error?.message}" stack="${(error?.stack||'').slice(0,300)}"`);
    return new Response('OK', { status: 200 });
  }
});

// ─── TRACE HELPER ─────────────────────────────────────────
// Registra cada etapa com número, ms acumulado e contexto
function criarTrace(telefone) {
  const t0 = Date.now();
  const etapas = [];
  let etapaAtual = 0;
  return {
    step(nome, extra = {}) {
      etapaAtual++;
      const ms = Date.now() - t0;
      const extraStr = Object.entries(extra).map(([k,v]) => `${k}=${v}`).join(' ');
      console.log(`[T${String(etapaAtual).padStart(2,'0')}] tel=${telefone} etapa="${nome}" ms_acum=${ms}${extraStr ? ' '+extraStr : ''}`);
      etapas.push({ n: etapaAtual, nome, ms, ...extra });
      return ms;
    },
    dump(sufixo = 'FIM') {
      const msTotal = Date.now() - t0;
      const resumo = etapas.map(e => `${e.n}:${e.nome}(${e.ms}ms)`).join(' → ');
      console.log(`[TRACE_${sufixo}] tel=${telefone} ms_total=${msTotal} caminho=[${resumo}]`);
      return msTotal;
    },
    t0,
  };
}

// ─── MONTAGEM DE PROMPT MODULAR v21 ──────────────────────
// Prioridade de instruções: CRÍTICO > IMPORTANTE > CONTEXTO > OPCIONAL
function montarPrompt(settings, origem, intent, flow, step, dados, resumo, ultimaPergunta, jaApresentou, fluxoResolvido, fluxoDinamicoAtivo, contexto, texto, historicoCompacto) {
  const nomeAgente = settings.nome_agente || 'Assistente';
  const tom = { profissional:'comercial',amigavel:'amigável',direto:'objetivo',formal:'formal' }[settings.personalidade||'profissional'] || 'comercial';
  const lingua = settings.linguagem === 'formal' ? 'formal' : 'informal';
  const instrucaoCanal = (origem === 'meta' ? settings.whatsapp_instrucao_especifica : settings.generica_instrucao_especifica) || '';

  // ── CRÍTICO (sempre incluso — ~50 tokens) ─────────────
  const bCrit = `[CRÍTICO] Nunca invente preços/estoque. Não libere cliente bloqueado. Transfira humano em casos críticos.`;

  // ── IDENTIDADE (~30 tokens) ──────────────────────────
  const b1 = `${nomeAgente}/ANDAIMES COSTA DO SOL. Tom:${tom}. ${jaApresentou ? 'JÁ APRESENTADO.' : 'Apresente-se brevemente.'}`;

  // ── ESTADO + DADOS COMPACTOS (~30 tokens) ────────────
  const dadosStr = Object.entries(dados).filter(([,v])=>v).map(([k,v])=>`${k}:${v}`).join(' ');
  const b2 = `Estado:${intent}|${flow}|${step}. ${dadosStr ? 'Coletado:'+dadosStr+'.' : ''} UltPerg:${ultimaPergunta||'-'}`;

  // ── MEMÓRIA COMPACTA (se conversa longa — substitui histórico) ──
  const bMem = historicoCompacto ? `[MEMÓRIA]\n${historicoCompacto}` : '';

  // ── INSTRUÇÃO DA ETAPA (~20-40 tokens) ───────────────
  const perguntaEtapa = fluxoResolvido.perguntas?.[step];
  const dicaEtapa     = fluxoResolvido.dicas_etapa?.[step];
  let b3 = '';
  if (step === 'saudacao')        b3 = fluxoDinamicoAtivo?.mensagem_inicio || 'Apresente-se e pergunte o que precisa.';
  else if (step === 'orcamento')  b3 = `Monte orçamento estimado.${fluxoDinamicoAtivo?.mensagem_conclusao ? ' '+fluxoDinamicoAtivo.mensagem_conclusao.slice(0,60) : ''}`;
  else if (step === 'fechamento') b3 = 'Solicite nome e CPF/CNPJ para formalizar.';
  else if (step === 'escalar')    b3 = 'Informe que atendente responderá em breve. Seja empático.';
  else if (perguntaEtapa)         b3 = `Pergunte APENAS: "${perguntaEtapa}"${dicaEtapa ? ' ('+dicaEtapa.slice(0,50)+')' : ''}`;
  else b3 = 'Continue o atendimento naturalmente.';

  // ── CONTEXTO CLIENTE (~25 tokens) ────────────────────
  let b4 = '';
  if (contexto?.cli?.nome) {
    b4 = `Cliente:${contexto.cli.nome}|Saldo:R$${contexto.cli.deve||0}|Bloq:${contexto.cli.bloq?'SIM':'não'}`;
    if (contexto.cts?.length) b4 += `|Cts:${contexto.cts.map(c=>`${c.n}(${c.s})`).join(',')}`;
  }

  // ── REGRAS IMPORTANTES (~25 tokens) ──────────────────
  const b5 = '1msg/vez. Máx 2 linhas. Não repita perguntas. Português BR.';

  // ── FLUXO DINÂMICO (apenas se existe — opcional) ─────
  let b6 = '';
  if (fluxoDinamicoAtivo) {
    const p = [
      fluxoDinamicoAtivo.objetivo?.slice(0,70),
      fluxoDinamicoAtivo.regras?.slice(0,80),
      fluxoDinamicoAtivo.prompt_adicional?.slice(0,70),
    ].filter(Boolean);
    if (p.length) b6 = `[${flow.toUpperCase()}] ${p.join('|')}`;
  }

  // ── RESPOSTA PRONTA (apenas se matched) ──────────────
  let b7 = '';
  const match = (settings.ia_respostas_prontas||[]).filter(r=>r.ativo).find(r => texto.toLowerCase().includes((r.trigger||'').toLowerCase()));
  if (match) b7 = `USE EXATAMENTE: "${match.texto.slice(0,150)}"`;

  // ── APRENDIZADOS (max 2 — ~30 tokens) ────────────────
  const aprend = (settings.ia_aprendizados||[]).filter(a=>a.ativo).slice(0,2).map(a=>a.texto.slice(0,50)).join('|');
  const b8 = aprend ? `Lembrar:${aprend}` : '';

  // ── CONTEXTO EMPRESA (apenas se preenchido) ───────────
  const ctxEmp = [settings.ia_instrucoes_gerais?.slice(0,70), instrucaoCanal?.slice(0,50)].filter(Boolean).join('|');
  const b9 = ctxEmp || '';

  const blocos = [bCrit,b1,b2,bMem,b3,b4,b5,b6,b7,b8,b9].filter(Boolean);
  const prompt = blocos.join('\n');
  return prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) + '[T]' : prompt;
}

// ─── PROCESSADOR PRINCIPAL v21 ───────────────────────────
async function processarMensagem(telefone, texto, messageId, settings, origem) {
  const trace = criarTrace(telefone);
  trace.step('recebida', { chars: texto.length, origem });

  if (userLocks.has(telefone)) {
    console.log(`[LOCK_SKIP] tel=${telefone} lock_age=${Date.now()-(_lockTimestamps.get(telefone)||Date.now())}ms`);
    trace.dump('LOCK_SKIP');
    return;
  }
  userLocks.add(telefone);
  _lockTimestamps.set(telefone, Date.now());

  try {
    // [T01] Cache de resposta
    const cached = getCached(telefone, texto);
    if (cached) {
      trace.step('cache_hit');
      registrarMetrica('cache', 0, 0, 'cache');
      await enviarMensagem(telefone, cached, settings, origem);
      trace.dump('CACHE_HIT');
      return;
    }

    // [T02] Resposta determinística (sem IA) — instantâneo
    const respostaRapida = verificarRespostaRapida(texto);
    if (respostaRapida !== undefined && respostaRapida !== null) {
      trace.step('rapida');
      registrarMetrica('rapida', 0, 0, 'rapida');
      await enviarMensagem(telefone, respostaRapida, settings, origem);
      trace.dump('RAPIDA');
      return;
    }
    trace.step('cache_miss');

    const srClient = sr();

    // [T03] IA pausada
    if (settings.central_intervencoes_ativa !== false && settings.pausar_ia_automaticamente !== false) {
      const t0p = Date.now();
      const pausada = await verificarIAPausada(telefone, settings, srClient);
      trace.step('ia_pausada', { pausada, ms: Date.now()-t0p });
      if (pausada) { trace.dump('IA_PAUSADA'); return; }
    }

    // [T04] Sinal emocional do cliente (antes de qualquer IO — puro CPU)
    const emocao = analisarSinalEmocional(texto);
    if (emocao.escalarImediato) {
      trace.step('irritado_escalando', { score: emocao.score, querGerente: emocao.querGerente });
      const msgEspera = settings.mensagem_aguardo_humano || 'Vou chamar um atendente imediatamente para te ajudar. 🙏';
      await Promise.all([
        enviarMensagem(telefone, msgEspera, settings, origem),
        criarIntervencao(telefone, texto, null, null, `IRRITADO/GERENTE: score=${emocao.score}`, origem, srClient),
      ]);
      registrarMetrica('escal', 0, 0, 'escal');
      trace.dump('IRRITADO_ESCALADO');
      return;
    }

    // [T05] Estado + cliente em PARALELO
    const t0par = Date.now();
    const [estadoAtual, clienteRaw] = await Promise.all([
      carregarEstado(telefone, srClient),
      buscarClientePorTelefone(telefone, srClient),
    ]);
    trace.step('estado+cliente', { novo: !estadoAtual, cliente: !!clienteRaw, ms: Date.now()-t0par });

    // [T06] Detectar intent/flow (CPU — sem IO)
    const dados          = { ...(estadoAtual?.dados_coletados || {}) };
    const ultimaPergunta = estadoAtual?.ultima_pergunta || '';
    const flowAtual      = estadoAtual?.flow || 'geral';
    const jaApresentou   = estadoAtual?.apresentado || false;
    const isPrimeiraMsg  = !estadoAtual;

    extrairComContexto(dados, texto, ultimaPergunta, flowAtual);
    const intent = detectarIntencao(texto);
    const flow   = detectarFluxoComScore(texto, intent, dados, flowAtual);
    trace.step('intent+flow', { intent, flow, emocao_score: emocao.score });

    // [T07] Fluxo dinâmico + histórico em PARALELO
    const t0io = Date.now();
    const [fluxoBanco, historicoIA] = await Promise.all([
      carregarFluxoDinamicoContextual(flow),
      carregarHistoricoInteligente(telefone, estadoAtual, srClient),
    ]);
    const fluxoDinamicoAtivo = fluxoBancoParaInterno(fluxoBanco);
    const fluxoResolvido     = fluxoDinamicoAtivo || FLUXOS[flow] || FLUXOS.geral;
    // v21: resumo compacto de histórico longo
    const histOtimizado = obterHistoricoOtimizado(estadoAtual, historicoIA);
    trace.step('fluxo+hist', { fluxo_banco: !!fluxoDinamicoAtivo, hist: historicoIA.length, compactado: histOtimizado.compactado, ms: Date.now()-t0io });

    // [T08] Calcular próxima etapa
    let step = 'saudacao';
    if (!isPrimeiraMsg) {
      if (['quero fechar','vamos prosseguir','pode gerar','vou alugar','aprovado','fechado','aceito','combinado','topa'].some(k => texto.toLowerCase().includes(k))) { step = 'fechamento'; }
      else if (intent === 'humano' || intent === 'urgencia') { step = 'escalar'; }
      else {
        let prox = 'orcamento';
        for (const s of (fluxoResolvido.steps||[])) {
          const campo = fluxoResolvido.campos?.[s];
          if (campo && !dados[campo]) { prox = s; break; }
          if (!campo && !dados[s])   { prox = s; break; }
        }
        step = prox;
      }
    }
    const resumo = gerarResumoOperacional(dados, flow, step, intent);

    // [T09] Contexto sob demanda
    const t0ctx = Date.now();
    const contexto = clienteRaw ? await montarContexto(clienteRaw, srClient, intent) : null;
    trace.step('contexto', { sql: !!(clienteRaw && INTENTS_COM_CONTEXTO.has(intent)), ms: Date.now()-t0ctx });

    // [T10] Roteamento inteligente de modelos v21
    const roteamento = rotearModelo(texto, intent, flow, settings);
    trace.step('roteamento', { order: roteamento.order.join('→'), reason: roteamento.reason });

    // [T11] Montar prompt com prioridades + memória compacta
    const systemPrompt = montarPrompt(
      settings, origem, intent, flow, step, dados, resumo, ultimaPergunta,
      jaApresentou, fluxoResolvido, fluxoDinamicoAtivo, contexto, texto,
      histOtimizado.compactado ? histOtimizado.resumo : null
    );
    const promptTokensEst = Math.ceil(systemPrompt.length / 4);
    const totalTokensEst  = promptTokensEst + Math.ceil(texto.length / 4);
    trace.step('prompt', { chars: systemPrompt.length, tokens_est: totalTokensEst, compactado: histOtimizado.compactado });
    if (totalTokensEst > 700) console.warn(`[TOKEN_ALTO] tel=${telefone} tokens_est=${totalTokensEst}`);

    // [T12] Chamar IA com histórico otimizado
    const histParaIA = histOtimizado.compactado ? [] : histOtimizado.hist;
    const t0IA = Date.now();
    const resultado = await chamarIA(telefone, texto, systemPrompt, settings.gemini_api_key, settings.openai_api_key, roteamento.order, histParaIA);
    const msIA = Date.now() - t0IA;
    const modelInfo = resultado.modelUsado ? `${resultado.providerUsado}/${resultado.modelUsado}` : `erro:${resultado.tipoErro||'?'}`;
    trace.step('ia', { ok: resultado.ok, model: modelInfo, ms_ia: msIA, t_in: resultado.tokensIn||0, t_out: resultado.tokensOut||0 });

    // Registra métricas de custo
    registrarMetrica(modelInfo, resultado.tokensIn||promptTokensEst, resultado.tokensOut||0, 'ia');
    if (resultado.fallbacks?.length) _metricas.fallbacks += resultado.fallbacks.length;

    // [T13] Escalamento por intent + anti-loop
    let precisaEscalar = step === 'escalar' || intent === 'humano' || intent === 'urgencia'
      || (settings.central_intervencoes_ativa !== false && settings.ia_pode_pedir_ajuda !== false && resultado.ok && iaQuerEscalar(resultado.resposta));

    // Anti-loop: verifica repetição de respostas
    if (!precisaEscalar && resultado.ok && verificarLoop(telefone, resultado.resposta)) {
      precisaEscalar = true;
      registrarMetrica('loop', 0, 0, 'loop');
      console.warn(`[ANTI_LOOP_ESCALAR] tel=${telefone}`);
    }

    if (precisaEscalar) {
      trace.step('escalando', { motivo: intent });
      registrarMetrica('escal', 0, 0, 'escal');
      await criarIntervencao(telefone, texto, clienteRaw?.id||null, clienteRaw?.nome_razao_social||null, `Intent:${intent} emocao:${emocao.score}`, origem, srClient);
      if (settings.pausar_ia_automaticamente !== false) {
        const msgEspera = settings.mensagem_aguardo_humano || 'Um atendente vai te responder em breve! 😊';
        await enviarMensagem(telefone, msgEspera, settings, origem);
        await registrarLog(srClient, telefone, clienteRaw?.id||null, clienteRaw?.nome_razao_social||'Sem cadastro', texto, msgEspera, origem, 'escalado');
        await salvarEstado(telefone, estadoAtual, { intent, flow, step:'escalado', dados_coletados:dados, resumo_operacional:resumo, ultima_pergunta:ultimaPergunta, ultima_resposta:msgEspera, apresentado:jaApresentou, total_trocas:(estadoAtual?.total_trocas||0)+1, debug_modelo_usado:'escalado', origem }, srClient);
        trace.dump('ESCALADO');
        return;
      }
    }

    // [T14] Libera lock ANTES do envio
    userLocks.delete(telefone);
    _lockTimestamps.delete(telefone);

    if (resultado.ok) setCache(telefone, texto, resultado.resposta);
    await enviarMensagem(telefone, resultado.resposta, settings, origem);

    const msTotal = trace.dump('OK');
    // Log de métricas consolidado por atendimento
    console.log(`[METRICS] tel=${telefone} model=${modelInfo} ms_ia=${msIA} ms_total=${msTotal} t_in=${resultado.tokensIn||0} t_out=${resultado.tokensOut||0} prompt_tokens=${promptTokensEst} route=${roteamento.reason} compactado=${histOtimizado.compactado} acum_custo=$${_metricas.totalCustoUSD.toFixed(6)} acum_chamadas=${_metricas.totalChamadas} acum_cache=${_metricas.cacheHits} acum_rapidas=${_metricas.respostasRapidas}`);

    // [T15] Salvar estado + log assíncrono
    const novaUltimaPergunta = fluxoResolvido.perguntas?.[step] || '';
    Promise.all([
      salvarEstado(telefone, estadoAtual, {
        intent, flow, step, dados_coletados: dados, resumo_operacional: resumo,
        ultima_pergunta: novaUltimaPergunta || ultimaPergunta,
        ultima_resposta: resultado.resposta, apresentado: true,
        total_trocas: (estadoAtual?.total_trocas||0) + 1,
        debug_ultimo_prompt: systemPrompt.slice(0, 600),
        debug_intent_detectada: intent, debug_flow_selecionado: flow, debug_modelo_usado: modelInfo, origem,
      }, srClient),
      registrarLog(srClient, telefone, clienteRaw?.id||null, clienteRaw?.nome_razao_social||'Sem cadastro', texto, resultado.resposta, origem, modelInfo),
    ]).catch(e => console.warn(`[SALVAR_ASYNC_ERRO] tel=${telefone} erro="${e?.message}"`));

  } catch (error) {
    const msTotal = trace.dump('ERRO');
    console.error(`[PROC_ERRO] tel=${telefone} ms=${msTotal} erro="${error?.message}" stack="${(error?.stack||'').slice(0,400)}"`);
    try { await enviarMensagem(telefone, MSG_ERRO, settings, origem); } catch (_) {}
  } finally {
    userLocks.delete(telefone);
    _lockTimestamps.delete(telefone);
  }
}

// ─── ENVIO ────────────────────────────────────────────────
async function enviarMensagem(telefone, texto, settings, origem) {
  if (origem === 'meta') return enviarMeta(telefone, texto, settings);
  return enviarGenerica(telefone, texto, settings);
}
async function enviarMeta(telefone, texto, settings) {
  const { whatsapp_access_token: token, whatsapp_phone_number_id: pid } = settings;
  if (!token || !pid) { console.error('[META_ENVIO] Token/ID ausente'); return; }
  const res = await fetch(`https://graph.facebook.com/v18.0/${pid}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: texto, preview_url: false } }),
  });
  if (!res.ok) console.error(`[META_ENVIO_ERRO] status=${res.status} body=${await res.text()}`);
}
async function enviarGenerica(telefone, texto, settings) {
  const { generica_api_url: apiUrl, generica_api_token: apiToken, generica_instance: instanceId } = settings;
  if (!apiUrl || !apiToken) { console.error('[GENERICA_ENVIO] URL/Token ausente'); return; }
  let url = apiUrl.replace(/\/$/,'');
  const headers = { 'Content-Type': 'application/json' };
  let payload;
  if (instanceId) { url = `${url}/message/sendText/${instanceId}`; headers['apikey'] = apiToken; payload = { number: telefone, text: texto }; }
  else            { url = `${url}/send-text`; headers['Client-Token'] = apiToken; payload = { phone: telefone, message: texto }; }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) console.error(`[GENERICA_ENVIO_ERRO] status=${res.status}`);
}

// ─── LOG ──────────────────────────────────────────────────
async function registrarLog(base44, tel, cliId, cliNome, pergunta, resposta, origem, modelInfo) {
  try {
    await base44.entities.WhatsappLog.create({
      telefone: tel, cliente_id: cliId, cliente_nome: cliNome,
      pergunta, resposta, data_hora: new Date().toISOString(), status: 'enviado',
      erro_detalhe: `[${origem==='generica'?'Genérica':'Meta'}][${modelInfo}]`,
    });
  } catch (e) { console.warn(`[LOG_ERRO] tel=${tel} erro="${e?.message}"`); }
}

// v21 — Fase 2: anti-loop, irritação, roteamento inteligente, resumo automático, métricas de custo, respostas informativas