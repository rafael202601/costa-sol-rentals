import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  LogOut, RefreshCw, ChevronUp, User, Shield, Briefcase, Truck, DollarSign, Settings
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ROLE_LABELS = {
  admin: "Administrador",
  atendente: "Atendente",
  financeiro: "Financeiro",
  operacional: "Operacional",
  motorista: "Motorista",
};

const ROLE_ICONS = {
  admin: Shield,
  atendente: Settings,
  financeiro: DollarSign,
  operacional: Briefcase,
  motorista: Truck,
};

export default function UserMenu({ collapsed = false }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const RoleIcon = user?.role ? (ROLE_ICONS[user.role] || User) : User;
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] || user.role) : "";

  const doLogout = () => {
    // Limpa query cache se disponível
    try {
      if (window.__queryClient) window.__queryClient.clear();
    } catch {}
    localStorage.clear();
    sessionStorage.clear();
    base44.auth.logout();
  };

  const doSwitch = () => {
    try {
      if (window.__queryClient) window.__queryClient.clear();
    } catch {}
    localStorage.clear();
    sessionStorage.clear();
    base44.auth.redirectToLogin();
  };

  if (!user) return null;

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
          "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-white",
          open && "bg-sidebar-accent text-white"
        )}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-white">
            {user.full_name?.charAt(0)?.toUpperCase() || "U"}
          </span>
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user.full_name || user.email}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate leading-tight flex items-center gap-1 mt-0.5">
                <RoleIcon className="w-2.5 h-2.5" />
                {roleLabel}
              </p>
            </div>
            <ChevronUp
              className={cn(
                "w-4 h-4 shrink-0 text-sidebar-foreground/40 transition-transform",
                !open && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="mt-1 mx-1 rounded-xl bg-sidebar-accent border border-sidebar-border overflow-hidden shadow-lg">
          {/* User info */}
          <div className="px-4 py-3 border-b border-sidebar-border">
            <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">{user.email}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-medium">
              <RoleIcon className="w-2.5 h-2.5" />
              {roleLabel}
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => { setOpen(false); setConfirmSwitch(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-primary/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Trocar Usuário
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmLogout(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}

      {/* Confirm Logout */}
      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja sair do sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua sessão será encerrada e você será redirecionado para a tela de login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Switch User */}
      <AlertDialog open={confirmSwitch} onOpenChange={setConfirmSwitch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar de usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              A sessão atual será encerrada e você será redirecionado para o login para entrar com outra conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSwitch}>
              Ir para o Login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}