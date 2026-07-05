import { base44 } from "@/api/base44Client";
import TaskCard from "./TaskCard";
import { format, isPast, parseISO } from "date-fns";
import { ListTodo } from "lucide-react";

export default function TaskListView({ tasks, user, onEdit, onDelete, onReload, showUser = false }) {
  const onToggleDone = async (task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await base44.entities.Task.update(task.id, {
      status: newStatus,
      data_conclusao: newStatus === "concluida" ? new Date().toISOString() : "",
      concluido_por: newStatus === "concluida" ? (user?.full_name || user?.email || "—") : "",
    });
    onReload();
  };

  if (tasks.length === 0) return (
    <div className="text-center py-14 text-muted-foreground">
      <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p>Nenhuma tarefa aqui</p>
    </div>
  );

  // Agrupar por data
  const grouped = {};
  tasks.forEach(t => {
    const d = t.data || "sem-data";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });

  return (
    <div className="space-y-6">
      {Object.entries(grouped).sort(([a], [b]) => {
        if (a === "sem-data") return 1;
        if (b === "sem-data") return -1;
        return a.localeCompare(b);
      }).map(([date, items]) => {
        const isHoje = date === format(new Date(), "yyyy-MM-dd");
        const isPastDate = date !== "sem-data" && isPast(parseISO(date)) && !isHoje;
        return (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isHoje ? "bg-primary text-white" : isPastDate ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                {date === "sem-data" ? "Sem data" : isHoje ? "📅 Hoje" : format(parseISO(date), "dd/MM/yyyy")}
              </div>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  user={user}
                  onToggleDone={onToggleDone}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showUser={showUser}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}