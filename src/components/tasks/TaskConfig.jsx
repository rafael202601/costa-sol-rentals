export const PRIO_CONFIG = {
  baixa:   { label: "Baixa",   cls: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400" },
  media:   { label: "Média",   cls: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
  alta:    { label: "Alta",    cls: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-500" },
  urgente: { label: "Urgente", cls: "bg-red-100 text-red-700 border-red-200",         dot: "bg-red-500" },
};

export const STATUS_CONFIG = {
  pendente:     { label: "Pendente",     color: "bg-slate-100 text-slate-700",   border: "border-slate-200" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700",     border: "border-blue-200" },
  aguardando:   { label: "Aguardando",   color: "bg-amber-100 text-amber-700",   border: "border-amber-200" },
  concluida:    { label: "Concluída",    color: "bg-emerald-100 text-emerald-700", border: "border-emerald-200" },
  atrasada:     { label: "Atrasada",     color: "bg-red-100 text-red-700",       border: "border-red-200" },
  cancelada:    { label: "Cancelada",    color: "bg-gray-100 text-gray-500",     border: "border-gray-200" },
};

export const CATEGORIA_CONFIG = {
  logistica:      { label: "Logística",      cls: "bg-violet-100 text-violet-700" },
  financeiro:     { label: "Financeiro",     cls: "bg-emerald-100 text-emerald-700" },
  manutencao:     { label: "Manutenção",     cls: "bg-orange-100 text-orange-700" },
  entrega:        { label: "Entrega",        cls: "bg-blue-100 text-blue-700" },
  cobranca:       { label: "Cobrança",       cls: "bg-red-100 text-red-700" },
  administrativo: { label: "Administrativo", cls: "bg-slate-100 text-slate-700" },
  outro:          { label: "Outro",          cls: "bg-gray-100 text-gray-600" },
};

export const KANBAN_COLUMNS = [
  { key: "pendente",     label: "Pendente",     color: "bg-slate-50 border-slate-200" },
  { key: "em_andamento", label: "Em Andamento", color: "bg-blue-50 border-blue-200" },
  { key: "aguardando",   label: "Aguardando",   color: "bg-amber-50 border-amber-200" },
  { key: "concluida",    label: "Concluída",    color: "bg-emerald-50 border-emerald-200" },
];

export const EMPTY_TASK = {
  titulo: "", descricao: "", observacoes: "", prioridade: "media", status: "pendente",
  categoria: "administrativo", data: "", horario: "", visibilidade: "compartilhada",
  responsaveis: [], checklist: [], comentarios: [], anexos: [], ordem: 0,
};