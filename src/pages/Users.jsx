import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, UserCheck, UserX, Lock, Shield, Users as UsersIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "../lib/activityLog";
import { usePermissions } from "@/lib/usePermissions";

const ROLES = [
  { key: "admin", label: "Administrador", color: "bg-red-100 text-red-700" },
  { key: "atendente", label: "Atendente", color: "bg-blue-100 text-blue-700" },
  { key: "financeiro", label: "Financeiro", color: "bg-emerald-100 text-emerald-700" },
  { key: "operacional", label: "Operacional", color: "bg-amber-100 text-amber-700" },
  { key: "motorista", label: "Motorista", color: "bg-purple-100 text-purple-700" },
];

const SETORES = ["Comercial", "Financeiro", "Logística", "Administrativo", "Operacional"];

const PERMISSION_GROUPS = [
  {
    group: "Principal",
    items: [
      { key: "tarefas", label: "Tarefas do Dia" },
      { key: "feedbacks", label: "Feedbacks" },
    ]
  },
  {
    group: "Operacional",
    items: [
      { key: "clientes", label: "Clientes" },
      { key: "equipamentos", label: "Equipamentos / Seriais" },
      { key: "contratos", label: "Contratos" },
      { key: "os", label: "Ordens de Serviço" },
      { key: "orcamentos", label: "Orçamentos" },
      { key: "produtos", label: "Produtos" },
      { key: "vendas", label: "Venda / Balcão" },
    ]
  },
  {
    group: "Logística",
    items: [
      { key: "kanban", label: "Quadro Logístico" },
      { key: "calendario", label: "Calendário" },
      { key: "motoristas", label: "Motoristas" },
      { key: "painel_motorista", label: "Painel do Motorista" },
      { key: "veiculos", label: "Veículos" },
    ]
  },
  {
    group: "Financeiro",
    items: [
      { key: "financeiro", label: "Fluxo de Caixa" },
      { key: "cobrancas", label: "Notas / Cobranças" },
      { key: "portal_cliente", label: "Portal do Cliente" },
    ]
  },
  {
    group: "Admin",
    items: [
      { key: "relatorios", label: "Relatórios" },
      { key: "metas", label: "Metas" },
      { key: "usuarios", label: "Usuários" },
      { key: "configuracoes", label: "Configurações" },
      { key: "logs", label: "Log de Atividades" },
      { key: "anuncios", label: "Anúncios e Novidades" },
    ]
  },
];

// Flat list for iteration
const PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items);

const PERM_ACTIONS = ["visualizar", "criar", "editar", "excluir"];

const DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(PERMISSIONS.map((p) => [p.key, [...PERM_ACTIONS]])),
  atendente: Object.fromEntries(PERMISSIONS.map((p) => {
    const restricted = ["metas", "usuarios", "relatorios", "veiculos", "motoristas", "configuracoes", "logs", "anuncios"];
    const noAccess = ["painel_motorista"];
    if (noAccess.includes(p.key)) return [p.key, []];
    if (restricted.includes(p.key)) return [p.key, ["visualizar"]];
    return [p.key, ["visualizar", "criar", "editar"]];
  })),
  financeiro: Object.fromEntries(PERMISSIONS.map((p) => {
    const full = ["financeiro", "cobrancas"];
    const noAccess = ["usuarios", "configuracoes", "logs", "motoristas", "painel_motorista", "kanban", "feedbacks"];
    if (noAccess.includes(p.key)) return [p.key, []];
    if (full.includes(p.key)) return [p.key, [...PERM_ACTIONS]];
    return [p.key, ["visualizar"]];
  })),
  operacional: Object.fromEntries(PERMISSIONS.map((p) => {
    const allowed = ["contratos", "os", "equipamentos", "kanban", "calendario", "motoristas", "painel_motorista", "veiculos", "tarefas"];
    if (allowed.includes(p.key)) return [p.key, ["visualizar", "editar"]];
    return [p.key, []];
  })),
  // Motorista: painel + contratos/OS com editar (necessário para salvar assinaturas)
  motorista: Object.fromEntries(PERMISSIONS.map((p) => {
    if (p.key === "painel_motorista") return [p.key, ["visualizar", "editar"]];
    if (p.key === "contratos" || p.key === "os") return [p.key, ["visualizar", "editar"]];
    return [p.key, []];
  })),
};

const emptyForm = () => ({
  email: "", setor: "Comercial", role: "atendente", ativo: true, permissions: {}
});

export default function Users() {
  const { refreshPermissions } = usePermissions();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [permTab, setPermTab] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [me, allUsers] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.User.list().catch(() => []),
    ]);
    setCurrentUser(me);
    setUsers(allUsers);
    setLoading(false);
  };

  const isAdmin = ["admin", "Admin", "ADMIN"].includes(currentUser?.role || "");

  // Loading state — wait before deciding access
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <Lock className="w-12 h-12 opacity-30" />
        <p className="font-semibold text-lg">Acesso Restrito</p>
        <p className="text-sm">Apenas Administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const openNew = () => {
    setForm(emptyForm());
    setEditId(null);
    setPermTab(false);
    setDialog(true);
  };

  const openEdit = (user) => {
    setForm({
      email: user.email || "",
      setor: user.setor || "Comercial",
      role: user.role || "atendente",
      ativo: user.ativo !== false,
      permissions: user.permissions || {},
    });
    setEditId(user.id);
    setPermTab(false);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.email && !editId) { toast.error("Email obrigatório"); return; }
    setSaving(true);
    const perms = Object.keys(form.permissions).length > 0
      ? form.permissions
      : DEFAULT_PERMISSIONS[form.role] || {};

    if (editId) {
      await base44.entities.User.update(editId, {
        role: form.role,
        setor: form.setor,
        ativo: form.ativo,
        permissions: perms,
      });
      await logActivity({
        acao: `Usuário editado: role=${form.role}, setor=${form.setor}`,
        modulo: "cliente",
        referencia_id: editId,
        detalhes: `Permissões atualizadas por ${currentUser?.email}`,
      });
      // Se as permissões são do próprio usuário logado, recarrega imediatamente
      if (currentUser?.id === editId) await refreshPermissions();
      toast.success("Usuário atualizado!");
    } else {
      await base44.users.inviteUser(form.email, form.role === "admin" ? "admin" : "user");
      await logActivity({
        acao: `Convite enviado para ${form.email} com perfil ${form.role}`,
        modulo: "cliente",
        detalhes: `Convidado por ${currentUser?.email}`,
      });
      toast.success("Convite enviado para " + form.email);
    }
    setSaving(false);
    setDialog(false);
    loadAll();
  };

  const togglePerm = (module, action) => {
    setForm((prev) => {
      const base = DEFAULT_PERMISSIONS[prev.role]?.[module] || [];
      const current = prev.permissions[module] !== undefined ? prev.permissions[module] : base;
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, permissions: { ...prev.permissions, [module]: updated } };
    });
  };

  const roleConfig = (role) => ROLES.find((r) => r.key === role) || { label: role || "—", color: "bg-muted text-muted-foreground" };

  // Motoristas são visíveis apenas para admin (já temos isAdmin check acima)
  const visibleUsers = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  const currentPerms = (module) => {
    if (form.permissions[module] !== undefined) return form.permissions[module];
    return DEFAULT_PERMISSIONS[form.role]?.[module] || [];
  };

  return (
    <div>
      <PageHeader title="Gestão de Usuários" subtitle={`${visibleUsers.length} usuário(s) cadastrado(s)`}>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 h-9"
          />
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Convidar Usuário
          </Button>
        </div>
      </PageHeader>

      {visibleUsers.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <UsersIcon className="w-10 h-10 opacity-20" />
          <p className="text-sm">Nenhum usuário encontrado.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleUsers.map((user) => {
          const rc = roleConfig(user.role);
          return (
            <Card key={user.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-bold text-primary text-sm">
                        {(user.full_name || user.email || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{user.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.color}`}>{rc.label}</span>
                  {user.setor && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{user.setor}</span>
                  )}
                  {user.ativo === false ? (
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <UserX className="w-2.5 h-2.5" /> Inativo
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <UserCheck className="w-2.5 h-2.5" /> Ativo
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit/Invite Dialog */}
      <Dialog open={dialog} onOpenChange={(o) => { if (!saving) setDialog(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar Usuário" : "Convidar Usuário"}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button size="sm" variant={!permTab ? "default" : "outline"} onClick={() => setPermTab(false)} className="gap-1.5">
              <UsersIcon className="w-3.5 h-3.5" /> Dados
            </Button>
            {editId && (
              <Button size="sm" variant={permTab ? "default" : "outline"} onClick={() => setPermTab(true)} className="gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Permissões
              </Button>
            )}
          </div>

          {!permTab ? (
            <div className="space-y-4">
              {!editId && (
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input className="mt-1" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@email.com" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Setor</Label>
                  <Select value={form.setor} onValueChange={(v) => setForm(p => ({ ...p, setor: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SETORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Perfil de Acesso</Label>
                  <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v, permissions: {} }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editId && (
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Status:</Label>
                  <Button size="sm" variant={form.ativo ? "default" : "outline"} onClick={() => setForm(p => ({ ...p, ativo: true }))} className="gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Ativo
                  </Button>
                  <Button size="sm" variant={!form.ativo ? "destructive" : "outline"} onClick={() => setForm(p => ({ ...p, ativo: false }))} className="gap-1">
                    <UserX className="w-3.5 h-3.5" /> Inativo
                  </Button>
                </div>
              )}
              {form.role === "admin" && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Perfil Admin possui acesso total ao sistema — todas as permissões são ignoradas e substituídas por acesso completo.</span>
                </div>
              )}
              {form.role === "motorista" && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Motorista só tem acesso ao Painel do Motorista. Não aparece na lista para outros motoristas.</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              {form.role === "admin" ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
                  <Shield className="w-6 h-6 mx-auto mb-2" />
                  <strong>Perfil Admin — Acesso Total</strong>
                  <p className="text-xs mt-1 text-red-600">Administradores ignoram todas as restrições de permissão.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Personalize as permissões deste usuário. Os valores padrão são herdados do perfil selecionado.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-semibold">Módulo</th>
                          {PERM_ACTIONS.map((a) => (
                            <th key={a} className="text-center py-2 px-2 font-semibold capitalize">{a}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_GROUPS.map((group) => (
                          <>
                            <tr key={`g-${group.group}`}>
                              <td colSpan={PERM_ACTIONS.length + 1} className="pt-3 pb-1 font-bold text-[10px] uppercase tracking-widest text-primary/70">
                                {group.group}
                              </td>
                            </tr>
                            {group.items.map((p) => {
                              const active = currentPerms(p.key);
                              return (
                                <tr key={p.key} className="border-b border-dashed hover:bg-muted/20">
                                  <td className="py-2 pr-4 font-medium pl-2">{p.label}</td>
                                  {PERM_ACTIONS.map((action) => (
                                    <td key={action} className="text-center py-2 px-2">
                                      <button
                                        type="button"
                                        onClick={() => togglePerm(p.key, action)}
                                        className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center mx-auto ${
                                          active.includes(action)
                                            ? "bg-primary border-primary"
                                            : "border-muted-foreground/30 hover:border-primary/50"
                                        }`}
                                      >
                                        {active.includes(action) && <span className="text-white text-[10px] font-bold">✓</span>}
                                      </button>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? "Salvar" : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}