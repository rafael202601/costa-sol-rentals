// Gerencia histórico de endereços por cliente (baseado em contratos e OS passados)
// Os endereços são extraídos dos contratos/OS do cliente ao selecionar

export function extractAddressesFromDocs(docs, addressField) {
  const seen = new Set();
  const result = [];
  for (const doc of docs) {
    const addr = doc[addressField];
    if (addr && addr.trim() && !seen.has(addr.trim())) {
      seen.add(addr.trim());
      result.push(addr.trim());
    }
  }
  return result.slice(0, 8);
}