import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Mapeamento de módulo → path(s) no sistema
export const MODULE_PATHS = {
  clientes:        ["/clientes"],
  equipamentos:    ["/equipamentos", "/seriais"],
  contratos:       ["/contratos"],
  os:              ["/ordens-servico"],
  orcamentos:      ["/orcamentos"],
  produtos:        ["/produtos"],
  vendas:          ["/vendas"],
  tarefas:         ["/tarefas"],
  kanban:          ["/kanban"],
  calendario:      ["/calendario"],
  motoristas:      ["/motoristas"],
  painel_motorista:["/painel-motorista"],
  veiculos:        ["/veiculos"],
  financeiro:      ["/fluxo-caixa"],
  cobrancas:       [],
  portal_cliente:  ["/portal-cliente"],
  relatorios:      ["/relatorios"],
  metas:           ["/metas"],
  usuarios:        ["/usuarios"],
  configuracoes:   ["/configuracoes"],
  logs:            ["/logs"],
  anuncios:        ["/anuncios"],
  feedbacks:       ["/feedbacks"],
};

const DEFAULT_PERMISSIONS = {
  admin: null, // null = acesso total
  atendente: {
    clientes: ["visualizar","criar","editar"],
    equipamentos: ["visualizar","criar","editar"],
    contratos: ["visualizar","criar","editar"],
    os: ["visualizar","criar","editar"],
    orcamentos: ["visualizar","criar","editar"],
    produtos: ["visualizar","criar","editar"],
    vendas: ["visualizar","criar","editar"],
    tarefas: ["visualizar","criar","editar"],
    kanban: ["visualizar","editar"],
    calendario: ["visualizar","editar"],
    motoristas: ["visualizar"],
    painel_motorista: [],
    veiculos: ["visualizar"],
    financeiro: ["visualizar","criar","editar"],
    cobrancas: ["visualizar"],
    portal_cliente: ["visualizar"],
    relatorios: ["visualizar"],
    metas: [],
    usuarios: [],
    configuracoes: ["visualizar","editar"], // acesso à aba Minha Assinatura
    logs: [],
    anuncios: [],
    feedbacks: ["visualizar","editar"],
  },
  financeiro: {
    clientes: ["visualizar"],
    equipamentos: ["visualizar"],
    contratos: ["visualizar"],
    os: ["visualizar"],
    orcamentos: [],
    produtos: [],
    vendas: ["visualizar","criar","editar","excluir"],
    tarefas: ["visualizar"],
    kanban: [],
    calendario: [],
    motoristas: [],
    painel_motorista: [],
    veiculos: [],
    financeiro: ["visualizar","criar","editar","excluir"],
    cobrancas: ["visualizar","criar","editar","excluir"],
    portal_cliente: ["visualizar","editar"],
    relatorios: ["visualizar"],
    metas: [],
    usuarios: [],
    configuracoes: ["visualizar","editar"], // acesso à aba Minha Assinatura
    logs: [],
    anuncios: [],
    feedbacks: [],
  },
  operacional: {
    clientes: [],
    equipamentos: ["visualizar","editar"],
    contratos: ["visualizar","editar"],
    os: ["visualizar","criar","editar"],
    orcamentos: [],
    produtos: [],
    vendas: [],
    tarefas: ["visualizar","editar"],
    kanban: ["visualizar","editar"],
    calendario: ["visualizar","editar"],
    motoristas: ["visualizar","editar"],
    painel_motorista: ["visualizar"],
    veiculos: ["visualizar","editar"],
    financeiro: [],
    cobrancas: [],
    portal_cliente: [],
    relatorios: [],
    metas: [],
    usuarios: [],
    configuracoes: ["visualizar","editar"], // acesso à aba Minha Assinatura
    logs: [],
    anuncios: [],
    feedbacks: [],
  },
  // Motorista: acesso APENAS ao painel do motorista + contratos/OS (para salvar assinaturas via DriverStatusActions)
  // contratos e os ficam com "editar" para que o RLS permita update (salvar assinatura)
  motorista: {
    clientes: [],
    equipamentos: [],
    contratos: ["visualizar","editar"],
    os: ["visualizar","editar"],
    orcamentos: [],
    produtos: [],
    vendas: [],
    tarefas: [],
    kanban: [],
    calendario: [],
    motoristas: [],
    painel_motorista: ["visualizar","editar"],
    veiculos: [],
    financeiro: [],
    cobrancas: [],
    portal_cliente: [],
    relatorios: [],
    metas: [],
    usuarios: [],
    configuracoes: [],
    logs: [],
    anuncios: [],
    feedbacks: [],
  },
};

let cachedUser = null;
let cachedPermissions = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minuto — garante que permissões atualizadas sejam carregadas rapidamente

/** Limpa o cache global — chamar no logout ou troca de usuário */
export function clearPermissionsCache() {
  cachedUser = null;
  cachedPermissions = null;
  cacheTimestamp = 0;
}

/**
 * Hook principal de permissões.
 * Carrega usuário + permissões reais salvas no banco (user.permissions).
 * Fallback: usa DEFAULT_PERMISSIONS por role.
 */
export function usePermissions() {
  const [user, setUser] = useState(cachedUser);
  const [permissions, setPermissions] = useState(cachedPermissions);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    // Invalida cache se o usuário logado mudou (segurança em troca de sessão)
    if (cachedUser && user && cachedUser.email !== user?.email) {
      cachedUser = null;
      cachedPermissions = null;
      cacheTimestamp = 0;
    }
    // Cache expirado ou vazio → recarrega
    if (cachedUser && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) return;
    base44.auth.me().then((u) => {
      const role = (u?.role || "").toLowerCase();
      const saved = u?.permissions && Object.keys(u.permissions).length > 0 ? u.permissions : null;
      const effective = role === "admin" ? null : (saved || DEFAULT_PERMISSIONS[role] || {});

      console.log("[Permissões] Usuário:", u?.email);
      console.log("[Permissões] Perfil:", role);
      console.log("[Permissões] Fonte:", role === "admin" ? "ADMIN (acesso total)" : saved ? "banco de dados" : "padrão por role");
      if (effective) console.log("[Permissões] Módulos com acesso:", Object.entries(effective).filter(([,v]) => v?.length > 0).map(([k]) => k));

      cachedUser = u;
      cachedPermissions = effective;
      cacheTimestamp = Date.now();
      setUser(u);
      setPermissions(effective);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";

  /** Verifica se o usuário pode realizar uma ação em um módulo */
  const can = (module, action = "visualizar") => {
    if (isAdmin) return true;
    if (!permissions) return false;
    const modulePerms = permissions[module];
    if (!modulePerms || modulePerms.length === 0) return false;
    return modulePerms.includes(action);
  };

  /** Verifica se o usuário pode visualizar (acessar) um módulo */
  const canView = (module) => can(module, "visualizar");

  /** Verifica se um path está acessível */
  const isPathAllowed = (pathname) => {
    if (isAdmin) return true;
    // Path raiz "/" sempre permitido
    if (pathname === "/") return true;
    // Verifica qual módulo corresponde ao path
    for (const [module, paths] of Object.entries(MODULE_PATHS)) {
      if (paths.some(p => pathname === p || (p !== "/" && pathname.startsWith(p)))) {
        return canView(module);
      }
    }
    // Paths sem módulo registrado: permitir se não for área admin
    return false;
  };

  /** Invalida cache (chamar após salvar permissões) */
  const refreshPermissions = async () => {
    cachedUser = null;
    cachedPermissions = null;
    const u = await base44.auth.me();
    const role2 = (u?.role || "").toLowerCase();
    const saved = u?.permissions && Object.keys(u.permissions).length > 0 ? u.permissions : null;
    const effective = role2 === "admin" ? null : (saved || DEFAULT_PERMISSIONS[role2] || {});
    cachedUser = u;
    cachedPermissions = effective;
    cacheTimestamp = Date.now();
    setUser(u);
    setPermissions(effective);
    return effective;
  };

  return { user, role, isAdmin, permissions, loading, can, canView, isPathAllowed, refreshPermissions };
}