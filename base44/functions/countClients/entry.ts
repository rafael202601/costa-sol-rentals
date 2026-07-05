import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let total = 0;
  let skip = 0;
  const BATCH = 1000;

  while (true) {
    const batch = await base44.asServiceRole.entities.Client.list("id", BATCH, skip);
    if (!batch || batch.length === 0) break;
    total += batch.length;
    if (batch.length < BATCH) break;
    skip += BATCH;
    await new Promise(r => setTimeout(r, 80));
  }

  return Response.json({ total });
});