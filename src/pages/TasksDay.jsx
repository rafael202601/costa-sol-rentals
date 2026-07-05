import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Bell, ListTodo, Eye, Megaphone, LayoutGrid, Calendar, Send, Trash2,
  MessageSquare, Search, X, BarChart3, CheckCircle2, Clock, AlertTriangle, Filter
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, parseISO } from "date-fns";

import TaskDialog from "../components/tasks/TaskDialog";
import TaskListView from "../components/tasks/TaskListView";
import TaskKanban from "../components/tasks/TaskKanban";
import TaskCalendar from "../components/tasks/TaskCalendar";
import { EMPTY_TASK, STATUS_CONFIG, PRIO_CONFIG, CATEGORIA_CONFIG } from "../components/tasks/TaskConfig";

const MURAL_TIPOS = {
  info:    { label: "Informação", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  aviso:   { label: "Aviso",      cls: "bg-amber-100 text-amber-700 border-amber-200" },
  urgente: { label: "Urgente",    cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function TasksDay() {
  const [tasks, setTasks] = useState([]);
  const [mural, setMural] = useState([]);
  const [user, setUser] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [tab, setTab] = useState("minhas");
  const [viewMode, setViewMode] = useState("lista"); // lista | kanban | calendario
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterPrio, setFilterPrio] = useState("todos");
  const [filterCat, setFilterCat] = useState("todos");
  const [muralText, setMuralText] = useState("");
  const [muralTipo, setMuralTipo] = useState("info");
  const [postingMural, setPostingMural] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadTasks();
    loadMural();
  }, []);

  const loadTasks = useCallback(async () => {
    const all = await base44.entities.Task.list("-created_date", 300);
    setTasks(all);
  }, []);

  const loadMural = useCallback(async () => {
    const all = await base44.entities.MuralPost.list("-created_date", 50);
    setMural(all);
  }, []);

  const openNew = (dateStr) => {
    setEditTask({ ...EMPTY_TASK, data: dateStr || format(new Date(), "yyyy-MM-dd") });
    setDialog(true);
  };

  const openEdit = (t) => {
    setEditTask({ ...EMPTY_TASK, ...t });
    setDialog(true);
  };

  const deleteTask = async (id) => {
    await base44.entities.Task.delete(id);
    toast.success("Tarefa removida");
    loadTasks();
  };

  const postMural = async () => {
    if (!muralText.trim()) return;
    setPostingMural(true);
    await base44.entities.MuralPost.create({
      conteudo: muralText, tipo: muralTipo,
      usuario_email: user?.email || "",
      usuario_nome: user?.full_name || user?.email || "",
    });
    setMuralText("");
    setPostingMural(false);
    loadMural();
  };

  const deleteMural = async (id) => {
    await base44.entities.MuralPost.delete(id);
    loadMural();
  };

  // ─── Filtros ──────────────────────────────────────────────────────────────
  const applyFilters = (list) => list.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.titulo?.toLowerCase().includes(q) || t.descricao?.toLowerCase().includes(q) || t.usuario_nome?.toLowerCase().includes(q);
    const matchS = filterStatus === "todos" || t.status === filterStatus;
    const matchP = filterPrio === "todos" || t.prioridade === filterPrio;
    const matchC = filterCat === "todos" || t.categoria === filterCat;
    return matchQ && matchS && matchP && matchC;
  });

  const minhasTarefas = applyFilters(tasks.filter(t => t.usuario_email === user?.email));
  const compartilhadas = applyFilters(tasks.filter(t => t.visibilidade === "compartilhada"));

  // ─── Métricas ─────────────────────────────────────────────────────────────
  const hojeCount = tasks.filter(t => t.data === format(new Date(), "yyyy-MM-dd") && t.status !== "concluida" && t.usuario_email === user?.email).length;
  const atrasadas = tasks.filter(t => t.data && t.status !== "concluida" && t.status !== "cancelada" && parseISO(t.data) < new Date() && t.data !== format(new Date(), "yyyy-MM-dd") && t.usuario_email === user?.email).length;
  const concluidasHoje = tasks.filter(t => t.data_conclusao && isToday(new Date(t.data_conclusao)) && t.usuario_email === user?.email).length;

  const taskList = tab === "minhas" ? minhasTarefas : compartilhadas;

  const clearFilters = () => { setSearch(""); setFilterStatus("todos"); setFilterPrio("todos"); setFilterCat("todos"); };
  const hasFilters = search || filterStatus !== "todos" || filterPrio !== "todos" || filterCat !== "todos";

  return (
    <div>
      <PageHeader title="Tarefas" subtitle="Central de produtividade da equipe">
        {hojeCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <Bell className="w-4 h-4" /> {hojeCount} hoje
          </div>
        )}
        {atrasadas > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" /> {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </div>
        )}
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova Tarefa</Button>
      </PageHeader>

      {/* ─── Métricas rápidas ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Pendentes", value: tasks.filter(t => t.status === "pendente" && t.usuario_email === user?.email).length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
          { label: "Em Andamento", value: tasks.filter(t => t.status === "em_andamento" && t.usuario_email === user?.email).length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Concluídas Hoje", value: concluidasHoje, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Atrasadas", value: atrasadas, color: "text-red-600", bg: "bg-red-50 border-red-200" },
        ].map(m => (
          <div key={m.label} className={`rounded-2xl border p-3 ${m.bg}`}>
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="minhas" className="gap-1.5"><ListTodo className="w-4 h-4" /> Minhas</TabsTrigger>
            <TabsTrigger value="equipe" className="gap-1.5"><Eye className="w-4 h-4" /> Equipe</TabsTrigger>
            <TabsTrigger value="mural" className="gap-1.5"><Megaphone className="w-4 h-4" /> Mural</TabsTrigger>
          </TabsList>

          {tab !== "mural" && (
            <div className="flex items-center gap-2">
              {/* View mode */}
              <div className="flex rounded-lg border overflow-hidden">
                {[
                  { key: "lista", icon: ListTodo },
                  { key: "kanban", icon: LayoutGrid },
                  { key: "calendario", icon: Calendar },
                ].map(v => (
                  <button
                    key={v.key}
                    onClick={() => setViewMode(v.key)}
                    className={`p-2 text-sm transition-colors ${viewMode === v.key ? "bg-primary text-white" : "hover:bg-muted"}`}
                    title={v.key}
                  >
                    <v.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {tab !== "mural" && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefas..." className="pl-8" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPrio} onValueChange={setFilterPrio}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {Object.entries(PRIO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {Object.entries(CATEGORIA_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="w-4 h-4" /> Limpar
              </Button>
            )}
          </div>
        )}

        {/* ─── MINHAS TAREFAS ──────────────────────────────────────────── */}
        <TabsContent value="minhas">
          {viewMode === "lista" && <TaskListView tasks={taskList} user={user} onEdit={openEdit} onDelete={deleteTask} onReload={loadTasks} showUser={false} />}
          {viewMode === "kanban" && <TaskKanban tasks={taskList} user={user} onEdit={openEdit} onDelete={deleteTask} onReload={loadTasks} />}
          {viewMode === "calendario" && <TaskCalendar tasks={taskList} onEdit={openEdit} onNewForDate={openNew} />}
        </TabsContent>

        {/* ─── TAREFAS DA EQUIPE ───────────────────────────────────────── */}
        <TabsContent value="equipe">
          {viewMode === "lista" && <TaskListView tasks={taskList} user={user} onEdit={openEdit} onDelete={deleteTask} onReload={loadTasks} showUser={true} />}
          {viewMode === "kanban" && <TaskKanban tasks={taskList} user={user} onEdit={openEdit} onDelete={deleteTask} onReload={loadTasks} />}
          {viewMode === "calendario" && <TaskCalendar tasks={taskList} onEdit={openEdit} onNewForDate={openNew} />}
        </TabsContent>

        {/* ─── MURAL ───────────────────────────────────────────────────── */}
        <TabsContent value="mural">
          <div className="space-y-4 max-w-2xl">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Label className="text-xs font-semibold">Nova publicação no mural</Label>
                <Textarea placeholder="Deixe um aviso para a equipe..." value={muralText} onChange={e => setMuralText(e.target.value)} rows={3} />
                <div className="flex gap-2 items-center justify-between flex-wrap">
                  <div className="flex gap-2">
                    {Object.entries(MURAL_TIPOS).map(([k, v]) => (
                      <button key={k} onClick={() => setMuralTipo(k)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${muralTipo === k ? v.cls + " border-current" : "border-border"}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" onClick={postMural} disabled={postingMural || !muralText.trim()} className="gap-2">
                    <Send className="w-3.5 h-3.5" /> Publicar
                  </Button>
                </div>
              </CardContent>
            </Card>
            {mural.map(post => {
              const cfg = MURAL_TIPOS[post.tipo] || MURAL_TIPOS.info;
              return (
                <Card key={post.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                        <span className="text-xs font-semibold">{post.usuario_nome || post.usuario_email || "Usuário"}</span>
                        <span className="text-xs text-muted-foreground">{post.created_date ? format(new Date(post.created_date), "dd/MM HH:mm") : ""}</span>
                      </div>
                      {(post.usuario_email === user?.email || user?.role === "admin") && (
                        <button onClick={() => deleteMural(post.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{post.conteudo}</p>
                  </CardContent>
                </Card>
              );
            })}
            {mural.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma publicação ainda</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      {dialog && editTask && (
        <TaskDialog
          open={dialog}
          onOpenChange={setDialog}
          task={editTask}
          user={user}
          onSaved={loadTasks}
        />
      )}
    </div>
  );
}