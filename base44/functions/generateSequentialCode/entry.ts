import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Geração SEGURA de códigos sequenciais.
 *
 * ESTRATÉGIA ANTI-REGRESSÃO:
 *   A cada chamada, o sistema:
 *   1. Busca o MAIOR número real existente no banco (varredura completa)
 *   2. Compara com o counter salvo
 *   3. Usa o MAIOR dos dois como base
 *   4. Gera o próximo = max + 1
 *   5. Atualiza o counter
 *
 * Isso garante que mesmo se o counter regredir ou for apagado,
 * o sistema NUNCA gera um número menor que o último existente.
 *
 * tipo: "client_code" | "contrato" | "os"
 * Retorna: { numero: number|string, tipo: string }
 *   - contrato: número puro (ex: 1058)
 *   - os: string com prefixo CB (ex: "CB1058")
 *   - client_code: número puro
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tipo } = body;

  if (!tipo || !["client_code", "contrato", "os"].includes(tipo)) {
    return Response.json({ error: 'Tipo inválido. Use: client_code, contrato, os' }, { status: 400 });
  }

  // Valores mínimos absolutos por tipo
  const MINIMUM_VALUES = {
    client_code: 20000,
    contrato: 1000,
    os: 1000,
  };

  const MAX_RETRIES = 8;

  /**
   * Busca o maior número real no banco para o tipo.
   * Para OS: extrai só o número do prefixo CB (ex: "CB1057" → 1057, "1057" → 1057)
   */
  const getRealMax = async (tipo) => {
    let realMax = MINIMUM_VALUES[tipo] - 1;

    if (tipo === "client_code") {
      const all = await base44.asServiceRole.entities.Client.list("-created_date", 10000).catch(() => []);
      for (const c of all) {
        const code = parseInt(c.codigo_cliente, 10);
        if (!isNaN(code) && code > realMax && code < 10_000_000) realMax = code;
      }
    } else if (tipo === "contrato") {
      const all = await base44.asServiceRole.entities.Contract.list("-created_date", 5000).catch(() => []);
      for (const c of all) {
        // Contratos: número puro (ex: "1057")
        const num = parseInt(String(c.numero || "").replace(/\D/g, ""), 10);
        if (!isNaN(num) && num > realMax && num < 10_000_000) realMax = num;
      }
    } else if (tipo === "os") {
      const all = await base44.asServiceRole.entities.ServiceOrder.list("-created_date", 5000).catch(() => []);
      for (const o of all) {
        // OS: pode ser "CB1057", "1057", etc. Extrai só os dígitos.
        const num = parseInt(String(o.numero || "").replace(/\D/g, ""), 10);
        if (!isNaN(num) && num > realMax && num < 10_000_000) realMax = num;
      }
    }

    return realMax;
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 1. Buscar o maior número REAL no banco (fonte da verdade)
    const realMax = await getRealMax(tipo);

    // 2. Buscar o counter atual
    const counters = await base44.asServiceRole.entities.Counter.filter({ tipo }).catch(() => []);

    let counterMax = MINIMUM_VALUES[tipo] - 1;
    let counterId = null;

    if (counters.length > 0) {
      counterMax = counters[0].ultimo_numero || counterMax;
      counterId = counters[0].id;
    }

    // 3. Base = MAX(realMax, counterMax) — nunca regredir
    const base = Math.max(realMax, counterMax);
    const nextNum = base + 1;

    // 4. Verificar se o próximo número já existe no banco (dupla proteção)
    let isDuplicate = false;
    if (tipo === "client_code") {
      const ex = await base44.asServiceRole.entities.Client.filter({ codigo_cliente: String(nextNum) }).catch(() => []);
      isDuplicate = ex.length > 0;
    } else if (tipo === "contrato") {
      const ex = await base44.asServiceRole.entities.Contract.filter({ numero: String(nextNum) }).catch(() => []);
      isDuplicate = ex.length > 0;
    } else if (tipo === "os") {
      // Verifica tanto "CB1058" quanto "1058" para máxima segurança
      const [ex1, ex2] = await Promise.all([
        base44.asServiceRole.entities.ServiceOrder.filter({ numero: `CB${nextNum}` }).catch(() => []),
        base44.asServiceRole.entities.ServiceOrder.filter({ numero: String(nextNum) }).catch(() => []),
      ]);
      isDuplicate = ex1.length > 0 || ex2.length > 0;
    }

    if (isDuplicate) {
      // Número já existe — avançar e tentar novamente
      if (counterId) {
        await base44.asServiceRole.entities.Counter.update(counterId, { ultimo_numero: nextNum }).catch(() => null);
      }
      continue;
    }

    // 5. Persistir o counter com o novo valor
    let persistOk = false;
    if (counterId) {
      const updated = await base44.asServiceRole.entities.Counter.update(counterId, {
        ultimo_numero: nextNum,
      }).catch(() => null);
      persistOk = !!updated;
    } else {
      // Criar counter novo
      const created = await base44.asServiceRole.entities.Counter.create({
        tipo,
        ultimo_numero: nextNum,
      }).catch(() => null);
      persistOk = !!created;
    }

    if (!persistOk) {
      // Falha ao persistir — aguardar e tentar novamente
      await new Promise(r => setTimeout(r, 60 + Math.random() * 120));
      continue;
    }

    // 6. Retornar o número no formato correto
    if (tipo === "os") {
      return Response.json({ numero: `CB${nextNum}`, tipo });
    }
    return Response.json({ numero: nextNum, tipo });
  }

  return Response.json({ error: 'Não foi possível gerar código único após múltiplas tentativas. Tente novamente.' }, { status: 500 });
});