import { CheckCircle2, Circle, Pencil, Trash2, MessageSquare, Paperclip, ListChecks, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PRIO_CONFIG, STATUS_CONFIG, CATEGORIA_CONFIG } from "./TaskConfig";
import { format, isPast, parseISO } from "date-fns";

export default function TaskCard({ task, user, onToggleDone, onEdit, onDelete, showUser = false, draggable = false, onDragStart }) {
  const pc = PRIO_CONFIG[task.prioridade] || PRIO_CONFIG.media;
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.pendente;
  const cc = CATEGORIA_CONFIG[task.categoria] || CATEGORIA_CONFIG.administrativo;
  const isDone = task.status === "concluida" || task.status === "cancelada";
  const isOverdue = task.data && task.status !== "concluida" && task.status !== "cancelada" && isPast(parseISO(task.data));
  const checkDone = (task.checklist || []).filter(c => c.concluido).length;
  const checkTotal = (task.checklist || []).length;
  const canEdit = task.usuario_email === user?.email || user?.role === "admin";

  return (
    <Card
      className={`border shadow-sm transition-all hover:shadow-md cursor-pointer ${isDone ? "opacity-60" : ""} ${isOverdue && !isDone ? "border-red-200 bg-red-50/30" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Checkbox conclusão */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleDone(task); }}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600 transition-colors"
            title="Marcar como concluída"
          >
            {task.status === "concluida"
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : <Circle className="w-5 h-5" />
            }
          </button>

          <div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
            <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
              {task.titulo}
            </p>
            {task.descricao && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.descricao}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${pc.cls}`}>{pc.label}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cc.cls}`}>{cc.label}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sc.color} ${sc.border}`}>{sc.label}</span>
              {task.data && (
                <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue && !isDone ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  <Clock className="w-2.5 h-2.5" />
                  {format(parseISO(task.data), "dd/MM")}{task.horario ? ` ${task.horario}` : ""}
                  {isOverdue && !isDone && " ⚠"}
                </span>
              )}
              {showUser && task.usuario_nome && (
                <span className="text-[10px] text-primary flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{task.usuario_nome}</span>
              )}
            </div>

            {/* Indicadores de conteúdo */}
            <div className="flex gap-2 mt-1.5">
              {checkTotal > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <ListChecks className="w-3 h-3" /> {checkDone}/{checkTotal}
                </span>
              )}
              {(task.comentarios || []).length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageSquare className="w-3 h-3" /> {task.comentarios.length}
                </span>
              )}
              {(task.anexos || []).length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Paperclip className="w-3 h-3" /> {task.anexos.length}
                </span>
              )}
              {(task.responsaveis || []).length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <User className="w-3 h-3" /> {task.responsaveis.map(r => r.nome.split(" ")[0]).join(", ")}
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}