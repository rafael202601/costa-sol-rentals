import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Truck, Columns3, BarChart3, Package, X,
  Wrench, HardHat, CalendarDays, Target, UserCog, Wallet, Building2,
  ClipboardList, Settings, Activity, MapPin, Car, Bell, Megaphone,
  ShoppingCart, ShoppingBag, ListTodo, MessageSquare, ScanBarcode
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/usePermissions";
import UserMenu from "./UserMenu";

const ALL_SECTIONS = [
  {
    title: "Principal",
    items: [
      { label: "Painel", icon: LayoutDashboard, path: "/", module: null, excludeRoles: ["motorista"] },
    ],
  },
  {
    title: "Operacional",
    items: [
      { label: "Clientes",          icon: Users,         path: "/clientes",       module: "clientes" },
      { label: "Equipamentos",      icon: Package,       path: "/equipamentos",   module: "equipamentos" },
      { label: "Seriais / Numerações", icon: ScanBarcode, path: "/seriais",       module: "equipamentos" },
      { label: "Contratos",         icon: FileText,      path: "/contratos",      module: "contratos", excludeRoles: ["motorista"] },
      { label: "Ordens de Serviço", icon: Truck,         path: "/ordens-servico", module: "os",        excludeRoles: ["motorista"] },
      { label: "Orçamentos",        icon: ClipboardList, path: "/orcamentos",     module: "orcamentos" },
      { label: "Produtos",          icon: ShoppingBag,   path: "/produtos",       module: "produtos" },
      { label: "Venda / Balcão",    icon: ShoppingCart,  path: "/vendas",         module: "vendas" },
      { label: "Tarefas do Dia",    icon: ListTodo,      path: "/tarefas",        module: "tarefas" },
    ],
  },
  {
    title: "Logística",
    items: [
      { label: "Quadro Logístico",    icon: Columns3,    path: "/kanban",           module: "kanban" },
      { label: "Calendário",          icon: CalendarDays, path: "/calendario",      module: "calendario" },
      { label: "Motoristas",          icon: MapPin,      path: "/motoristas",       module: "motoristas" },
      { label: "Painel do Motorista", icon: Truck,       path: "/painel-motorista", module: "painel_motorista" },
      { label: "Veículos",            icon: Car,         path: "/veiculos",         module: "veiculos" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "Fluxo de Caixa",        icon: Wallet,    path: "/fluxo-caixa",                 module: "financeiro" },
      { label: "Solicitações Pendentes", icon: Bell,     path: "/fluxo-caixa?tab=solicitacoes", module: "financeiro" },
      { label: "Portal do Cliente",      icon: Building2, path: "/portal-cliente",              module: "portal_cliente" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Relatórios",         icon: BarChart3, path: "/relatorios",    module: "relatorios" },
      { label: "Metas",              icon: Target,    path: "/metas",         module: "metas" },
      { label: "Usuários",           icon: UserCog,   path: "/usuarios",      module: "usuarios" },
      { label: "Configurações",      icon: Settings,  path: "/configuracoes", module: "configuracoes" },
      { label: "Log de Atividades",  icon: Activity,  path: "/logs",          module: "logs" },
      { label: "Anúncios e Novidades", icon: Megaphone, path: "/anuncios",    module: "anuncios" },
      { label: "Feedbacks",           icon: MessageSquare, path: "/feedbacks", module: "feedbacks" },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const { canView, isAdmin, role, loading } = usePermissions();

  const menuSections = ALL_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.excludeRoles?.includes(role)) return false;
        if (item.module === null) return true;
        if (isAdmin) return true;
        return canView(item.module);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="w-72 h-screen bg-sidebar text-sidebar-foreground flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="p-6 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <HardHat className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-sm text-white leading-tight">Costa do Sol</h1>
            <p className="text-[11px] text-sidebar-foreground/60 leading-tight">Gestão de Locação</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-sidebar-accent">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 px-3 space-y-6">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-8 rounded-lg bg-sidebar-accent/50 animate-pulse" />
            ))}
          </div>
        ) : (
          menuSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const itemPath = item.path.split("?")[0];
                  const isActive =
                    location.pathname === itemPath ||
                    (itemPath !== "/" && location.pathname.startsWith(itemPath));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                          : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Footer — User Menu */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <UserMenu />
        <div className="flex items-center gap-2 px-3 py-1 text-sidebar-foreground/30 text-[10px]">
          <Wrench className="w-3 h-3" />
          <span>Costa do Sol · Gestão</span>
        </div>
      </div>
    </div>
  );
}