/**
 * Utilitário central de tratamento de erros do sistema.
 * Converte erros técnicos em mensagens amigáveis e operacionais.
 */
import { toast } from "sonner";

// Mapeamento de erros técnicos → mensagens amigáveis
const ERROR_MESSAGES = {
  // Permissões
  "403": "Você não tem permissão para realizar esta ação. Contate o administrador.",
  "401": "Sessão expirada. Faça login novamente.",
  "Forbidden": "Acesso negado. Seu perfil não tem permissão para esta operação.",
  "Unauthorized": "Sessão expirada. Recarregue a página e faça login novamente.",
  "permission": "Sem permissão para realizar esta operação.",

  // Rede / servidor
  "Network Error": "Falha de conexão. Verifique sua internet e tente novamente.",
  "timeout": "A operação demorou muito. Verifique sua conexão e tente novamente.",
  "500": "Erro interno do servidor. Tente novamente em alguns instantes.",
  "502": "Servidor indisponível. Tente novamente em instantes.",
  "503": "Serviço temporariamente indisponível.",

  // Dados
  "duplicate": "Registro duplicado. Este dado já está cadastrado no sistema.",
  "required": "Campos obrigatórios não preenchidos.",
  "invalid": "Dados inválidos. Verifique os campos e tente novamente.",
  "not found": "Registro não encontrado. Ele pode ter sido excluído.",
  "size": "Arquivo muito grande. Reduza o tamanho e tente novamente.",
  "format": "Formato inválido. Verifique o tipo do arquivo ou dado informado.",
};

/**
 * Extrai mensagem amigável de um erro técnico.
 * @param {Error|string|object} error - Erro capturado
 * @param {string} contexto - Contexto da operação (ex: "contrato", "cliente")
 * @returns {string} Mensagem amigável
 */
export function getErrorMessage(error, contexto = "") {
  if (!error) return "Erro desconhecido. Tente novamente.";

  const raw = typeof error === "string"
    ? error
    : error?.message || error?.data?.error || error?.response?.data?.error || JSON.stringify(error);

  const rawLower = raw.toLowerCase();

  // Tenta encontrar mapeamento específico
  for (const [key, msg] of Object.entries(ERROR_MESSAGES)) {
    if (rawLower.includes(key.toLowerCase())) {
      return msg;
    }
  }

  // HTTP status codes
  const statusMatch = raw.match(/status[:\s]+(\d{3})/i);
  if (statusMatch) {
    const code = statusMatch[1];
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (code.startsWith("4")) return "Erro na requisição. Verifique os dados e tente novamente.";
    if (code.startsWith("5")) return "Erro no servidor. Tente novamente em instantes.";
  }

  // Retorna erro original se curto e legível, senão genérico
  if (raw && raw.length < 200 && !raw.includes("{") && !raw.includes("Error:")) {
    return raw;
  }

  const contextoMsg = contexto ? ` ao salvar ${contexto}` : "";
  return `Ocorreu um erro inesperado${contextoMsg}. Tente novamente.`;
}

/**
 * Exibe toast de erro com mensagem amigável.
 * @param {Error|string} error - Erro capturado
 * @param {string} contexto - Contexto da operação
 * @param {string} [prefixo] - Prefixo opcional para a mensagem
 */
export function showError(error, contexto = "", prefixo = "") {
  const msg = getErrorMessage(error, contexto);
  const full = prefixo ? `${prefixo}: ${msg}` : msg;
  toast.error(full, { duration: 6000 });
  console.error(`[Erro${contexto ? " — " + contexto : ""}]`, error);
}

/**
 * Wrapper para operações de save com tratamento automático de erro.
 * Garante que o loading/saving seja sempre resetado, mesmo em caso de erro.
 *
 * @param {Function} operation - Função async a executar
 * @param {object} options - Opções
 * @param {Function} options.setSaving - Setter do estado de loading
 * @param {string} options.contexto - Contexto da operação (ex: "contrato")
 * @param {string} options.prefixo - Prefixo da mensagem de erro
 * @returns {Promise<any>} Resultado da operação ou undefined em caso de erro
 */
export async function withErrorHandling(operation, { setSaving, contexto = "", prefixo = "" } = {}) {
  try {
    return await operation();
  } catch (error) {
    showError(error, contexto, prefixo || `Não foi possível salvar ${contexto || "o registro"}`);
    return undefined;
  } finally {
    if (setSaving) setSaving(false);
  }
}

/**
 * Mensagens específicas por módulo/operação.
 * Use para substituir mensagens genéricas por contextuais.
 */
export const SAVE_ERRORS = {
  contrato: {
    semCliente: "Selecione um cliente antes de salvar o contrato.",
    semEquipamento: "Adicione ao menos um equipamento ao contrato.",
    clienteBloqueado: "Não é possível criar contrato: o cliente está bloqueado.",
    clienteVencido: "Cadastro do cliente vencido. Atualize os dados para continuar.",
    estoqueInsuficiente: (nome, disponivel) =>
      `Estoque insuficiente para "${nome}". Quantidade disponível: ${disponivel}.`,
    semSolicitante: "Informe o nome do solicitante (campo obrigatório).",
    semObra: "Informe o nome da obra (campo obrigatório para este cliente).",
    serialPendente: (nome, qtd, selecionados) =>
      `Selecione exatamente ${qtd} serial(is) para "${nome}". Selecionados: ${selecionados}.`,
    falhaGeral: "Falha ao salvar o contrato. Verifique os dados e tente novamente.",
  },
  os: {
    semCliente: "Selecione um cliente antes de salvar a OS.",
    semLocal: "Informe o local de entrega (campo obrigatório).",
    semAssinatura: "É necessário assinar como responsável antes de salvar a OS.",
    clienteBloqueado: "Não é possível criar OS: o cliente está bloqueado.",
    clienteVencido: "Cadastro do cliente vencido. Atualize os dados para continuar.",
    falhaGeral: "Falha ao salvar a Ordem de Serviço. Verifique os dados e tente novamente.",
  },
  cliente: {
    semNome: "Informe o Nome/Razão Social (campo obrigatório).",
    semDocumento: "Informe o CPF/CNPJ (campo obrigatório).",
    semTelefone: "Informe o Telefone 1 (campo obrigatório).",
    documentoInvalido: (tipo) => `${tipo} inválido. Verifique os dígitos informados.`,
    documentoDuplicado: (tipo) => `Já existe um cliente cadastrado com este ${tipo}. Verifique ou edite o cadastro existente.`,
    codigoDuplicado: (sugestao) => `Código já utilizado por outro cliente. Sugestão disponível: ${sugestao}`,
    falhaGeral: "Falha ao salvar o cadastro do cliente. Tente novamente.",
  },
  orcamento: {
    semCliente: "Selecione um cliente antes de salvar o orçamento.",
    semItens: "Adicione ao menos um item ao orçamento.",
    falhaGeral: "Falha ao salvar o orçamento. Verifique os dados e tente novamente.",
  },
  financeiro: {
    semValor: "Informe o valor da operação.",
    semCategoria: "Selecione a categoria.",
    semData: "Informe a data da operação.",
    falhaGeral: "Falha ao salvar o lançamento financeiro. Tente novamente.",
  },
  upload: {
    tamanhoExcedido: "Arquivo muito grande. O limite é 10MB.",
    formatoInvalido: "Formato de arquivo não suportado.",
    falhaGeral: "Falha ao enviar o arquivo. Verifique sua conexão e tente novamente.",
  },
  assinatura: {
    naoPreenchida: "A assinatura não foi preenchida. Assine antes de confirmar.",
    falhaGeral: "Falha ao salvar a assinatura. Tente novamente.",
  },
  pdf: {
    falhaGeral: "Falha ao gerar o PDF. Tente novamente.",
    semDados: "Dados insuficientes para gerar o documento.",
  },
};