// Gerencia histórico de clientes recentes por usuário no localStorage
const MAX_RECENT = 8;

function getKey(userEmail) {
  return `recent_clients_${userEmail || "anon"}`;
}

export function getRecentClients(userEmail) {
  try {
    const raw = localStorage.getItem(getKey(userEmail));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentClient(userEmail, client) {
  if (!client?.id) return;
  try {
    const existing = getRecentClients(userEmail);
    const filtered = existing.filter((c) => c.id !== client.id);
    const updated = [
      {
        id: client.id,
        nome_razao_social: client.nome_razao_social,
        codigo_cliente: client.codigo_cliente,
        cpf_cnpj: client.cpf_cnpj,
        endereco_entrega_cidade: client.endereco_entrega_cidade,
        bloqueado: client.bloqueado,
        pendencia_financeira: client.pendencia_financeira,
      },
      ...filtered,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(getKey(userEmail), JSON.stringify(updated));
  } catch {}
}