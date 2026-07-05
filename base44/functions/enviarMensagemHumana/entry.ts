import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─────────────────────────────────────────────────────────
//  enviarMensagemHumana
//  Envia uma mensagem manual pelo atendente via WhatsApp
//  (Meta ou API Genérica) usando as credenciais do banco.
// ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { telefone, texto, origem } = await req.json();
    if (!telefone || !texto) {
      return Response.json({ error: 'telefone e texto são obrigatórios' }, { status: 400 });
    }

    // Carrega settings
    const list = await base44.asServiceRole.entities.AgentSettings.list();
    const settings = list[0] || {};

    const geminiKey   = Deno.env.get('WA_GEMINI_KEY')      || settings.gemini_api_key          || '';
    const openaiKey   = Deno.env.get('WA_OPENAI_KEY')      || settings.openai_api_key           || '';
    const token       = Deno.env.get('WA_ACCESS_TOKEN')    || settings.whatsapp_access_token    || '';
    const pid         = Deno.env.get('WA_PHONE_NUMBER_ID') || settings.whatsapp_phone_number_id || '';
    const genericaUrl = settings.generica_api_url   || '';
    const genericaTok = settings.generica_api_token || '';
    const genericaInst= settings.generica_instance  || '';

    let enviado = false;

    if (origem === 'generica' || (!origem && genericaUrl && genericaTok)) {
      // API Genérica
      if (!genericaUrl || !genericaTok) {
        return Response.json({ error: 'API Genérica não configurada' }, { status: 400 });
      }
      let url = genericaUrl.replace(/\/$/, '');
      const headers = { 'Content-Type': 'application/json' };
      let payload;
      if (genericaInst) {
        url = `${url}/message/sendText/${genericaInst}`;
        headers['apikey'] = genericaTok;
        payload = { number: telefone, text: texto };
      } else {
        url = `${url}/send-text`;
        headers['Client-Token'] = genericaTok;
        payload = { phone: telefone, message: texto };
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Erro ao enviar pela API Genérica: ' + await res.text());
      enviado = true;
    } else {
      // Meta
      if (!token || !pid) {
        return Response.json({ error: 'WhatsApp Meta não configurado' }, { status: 400 });
      }
      const res = await fetch(`https://graph.facebook.com/v18.0/${pid}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefone,
          type: 'text',
          text: { body: texto, preview_url: false },
        }),
      });
      if (!res.ok) throw new Error('Erro ao enviar pela Meta: ' + await res.text());
      enviado = true;
    }

    // Loga no WhatsappLog
    await base44.asServiceRole.entities.WhatsappLog.create({
      telefone,
      cliente_nome: 'Humano → ' + (user.full_name || user.email),
      pergunta: '[Atendimento humano]',
      resposta: texto,
      data_hora: new Date().toISOString(),
      status: 'enviado',
      erro_detalhe: `[humano][${user.email}]`,
    });

    return Response.json({ ok: true, enviado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});