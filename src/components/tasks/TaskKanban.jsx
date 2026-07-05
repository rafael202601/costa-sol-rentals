import { useState } from "react";
import { base44 } from "@/api/base44Client";
import TaskCard from "./TaskCard";
import { KANBAN_COLUMNS } from "./TaskConfig";

export default function TaskKanban({ tasks, user, onEdit, onDelete, onReload }) {
  const [dragOver, setDragOver] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const handleDragStart = (e, task) => {
    setDraggingId(task.id);
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleDrop = async (e, colKey) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    setDragOver(null);
    setDraggingId(null);
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === colKey) return;

    const updateData = { status: colKey };
    if (colKey === "concluida") {
      updateData.data_conclusao = new Date().toISOString();
      updateData.concluido_por = user?.full_name || user?.email || "—";
    }
    await base44.entities.Task.update(taskId, updateData);
    onReload();
  };

  const onToggleDone = async (task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await base44.entities.Task.update(task.id, {
      status: newStatus,
      data_conclusao: newStatus === "concluida" ? new Date().toISOString() : "",
      concluido_por: newStatus === "concluida" ? (user?.full_name || user?.email || "—") : "",
    });
    onReload();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {KANBAN_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        return (
          <div
            key={col.key}
            className={`flex-1 min-w-[220px] max-w-[300px] rounded-2xl border ${col.color} transition-all ${dragOver === col.key ? "ring-2 ring-primary" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className="p-3 border-b border-inherit">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{col.label}</span>
                <span className="text-xs bg-white/80 rounded-full px-2 py-0.5 font-semibold">{colTasks.length}</span>
              </div>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {colTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  user={user}
                  onToggleDone={onToggleDone}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showUser={true}
                  draggable={true}
                  onDragStart={e => handleDragStart(e, task)}
                />
              ))}
              {colTasks.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground opacity-60">Solte aqui</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}