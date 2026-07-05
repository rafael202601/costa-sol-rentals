import { AlertTriangle, Ban, ShieldX } from "lucide-react";
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

/**
 * Hook-like helper: retorna { bloqueado, serasa_restrito, pendencia }
 */
export function getClienteRestricoes(client) {
  if (!client) return { bloqueado: false, serasa_restrito: false, pendencia: false };
  const serasa_restrito = client.status_serasa === "restrito" || client.status_serasa === "negativado";
  const bloqueado = client.bloqueado === true || serasa_restrito;
  const pendencia = client.pendencia_financeira === true;
  return { bloqueado, serasa_restrito, pendencia };
}

/**
 * Dialog de confirmação para pendência financeira.
 * Chame com: open, onConfirm, onCancel
 */
export function PendenciaFinanceiraDialog({ open, onConfirm, onCancel }) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            Pendência Financeira
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Este cliente possui <strong>pendência financeira</strong> em aberto.<br />
            Deseja continuar mesmo assim?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Continuar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Badges de status do cliente para exibir em listas/detalhes.
 */
export function ClientStatusBadges({ client, className = "" }) {
  if (!client) return null;
  const { bloqueado, serasa_restrito, pendencia } = getClienteRestricoes(client);
  const negativado = client.status_serasa === "negativado";

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {bloqueado && !serasa_restrito && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded-full">
          <Ban className="w-3 h-3" /> BLOQUEADO
        </span>
      )}
      {serasa_restrito && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-700 px-2 py-0.5 rounded-full">
          <ShieldX className="w-3 h-3" /> {negativado ? "SERASA NEGATIVADO" : "SERASA RESTRITO"}
        </span>
      )}
      {pendencia && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> PENDÊNCIA FINANCEIRA
        </span>
      )}
    </div>
  );
}