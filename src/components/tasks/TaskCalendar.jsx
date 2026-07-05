import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIO_CONFIG, STATUS_CONFIG } from "./TaskConfig";

export default function TaskCalendar({ tasks, onEdit, onNewForDate }) {
  const [current, setCurrent] = useState(new Date());

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks = [];
  let day = calStart;
  while (day <= calEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const getTasksForDay = (d) => {
    return tasks.filter(t => t.data && isSameDay(parseISO(t.data), d));
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg capitalize">{format(current, "MMMM yyyy", { locale: ptBR })}</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setCurrent(subMonths(current, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCurrent(new Date())}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => setCurrent(addMonths(current, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Grid */}
      <div className="border rounded-2xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-semibold py-2 text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((d, di) => {
              const dayTasks = getTasksForDay(d);
              const inMonth = d.getMonth() === current.getMonth();
              const todayDay = isToday(d);
              const dateStr = format(d, "yyyy-MM-dd");
              return (
                <div
                  key={di}
                  className={`min-h-[80px] p-1.5 border-r last:border-r-0 transition-colors group relative cursor-pointer
                    ${!inMonth ? "bg-muted/20" : "hover:bg-primary/3"}
                    ${todayDay ? "bg-primary/5" : ""}`}
                  onClick={() => onNewForDate && onNewForDate(dateStr)}
                >
                  {/* Day number */}
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${todayDay ? "bg-primary text-white" : !inMonth ? "text-muted-foreground/50" : "text-foreground"}`}>
                    {format(d, "d")}
                  </div>

                  {/* + button on hover (only in-month) */}
                  {inMonth && onNewForDate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNewForDate(dateStr); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80"
                      title="Nova tarefa"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}

                  {/* Tasks */}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => {
                      const pc = PRIO_CONFIG[t.prioridade] || PRIO_CONFIG.media;
                      const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pendente;
                      return (
                        <button
                          key={t.id}
                          onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                          className={`w-full text-left text-[9px] font-medium px-1 py-0.5 rounded truncate ${sc.color} hover:opacity-80 transition-opacity`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${pc.dot}`} />
                          {t.horario && <span className="mr-0.5 opacity-70">{t.horario}</span>}
                          {t.titulo}
                        </button>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] text-muted-foreground pl-1">+{dayTasks.length - 3} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">Clique em uma data para criar uma nova tarefa</p>
    </div>
  );
}