import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // GET — carrega configurações
  if (req.method === 'GET') {
    const list = await base44.asServiceRole.entities.AgentSettings.list();
    const settings = list.length > 0 ? list[0] : null;
    return Response.json({ settings });
  }

  // POST — salva configurações (upsert)
  if (req.method === 'POST') {
    const body = await req.json();
    const list = await base44.asServiceRole.entities.AgentSettings.list();

    let result;
    if (list.length > 0) {
      // UPDATE
      result = await base44.asServiceRole.entities.AgentSettings.update(list[0].id, body);
    } else {
      // CREATE
      result = await base44.asServiceRole.entities.AgentSettings.create(body);
    }
    return Response.json({ success: true, settings: result });
  }

  return Response.json({ error: 'Método não permitido' }, { status: 405 });
});