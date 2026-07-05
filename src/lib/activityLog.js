import { base44 } from "@/api/base44Client";

export async function logActivity({ acao, modulo, referencia_id = "", referencia_numero = "", detalhes = "" }) {
  try {
    let usuario = "";
    try {
      const me = await base44.auth.me();
      usuario = me?.email || me?.full_name || "Sistema";
    } catch {}
    await base44.entities.ActivityLog.create({
      usuario,
      acao,
      modulo,
      referencia_id,
      referencia_numero,
      detalhes,
      data_hora: new Date().toISOString(),
    });
  } catch {}
}