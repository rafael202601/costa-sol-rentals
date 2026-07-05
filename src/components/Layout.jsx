import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import NotificationBell from "./notifications/NotificationBell";
import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { usePermissions, clearPermissionsCache } from "@/lib/usePermissions";
import { base44 } from "@/api/base44Client";
import { LogOut } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { role, isPathAllowed, loading } = usePermissions();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const doLogout = () => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    clearPermissionsCache();
    base44.auth.logout();
  };

  // Redireciona perfis especiais para seu painel padrão ao acessar "/"
  useEffect(() => {
    if (loading) return;
    if (location.pathname !== "/") return;
    if (role === "motorista") {
      navigate("/painel-motorista", { replace: true });
    }
    // financeiro vai direto para fluxo de caixa
    else if (role === "financeiro") {
      navigate("/fluxo-caixa", { replace: true });
    }
  }, [loading, role, location.pathname]);

  const allowed = loading || isPathAllowed(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar — fixed */}
      <div className="hidden lg:block fixed top-0 left-0 h-screen z-30">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 animate-in slide-in-from-left">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col min-h-screen lg:pl-72">
        {/* Mobile Top Bar */}
        <MobileNav onMenuClick={() => setSidebarOpen(true)} />

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-3 border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur">
          {/* User info pill */}
          {currentUser && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {currentUser.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">{currentUser.full_name || currentUser.email}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md capitalize">{currentUser.role}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setConfirmLogout(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-8">
          {!loading && !allowed ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground text-center">
              <Lock className="w-14 h-14 opacity-20" />
              <p className="font-semibold text-lg text-foreground">Acesso Negado</p>
              <p className="text-sm">Você não tem permissão para acessar esta página.</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {/* Confirm logout */}
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
    </div>
  );
}