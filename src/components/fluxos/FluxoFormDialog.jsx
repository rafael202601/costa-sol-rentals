import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Plus, X } from "lucide-react";
import EtapaEditor from "./EtapaEditor";
import ListaSimples from "./ListaSimples";

const TIPOS = [
  { value: "andaime", label: "Andaime" },
  { value: "escoramento", label: "Escoramento" },
  { value: "cacamba", label: "Caçamba" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "financeiro", label: "Financeiro" },
  { value: "entrega", label: "Entrega" },
  { value: "recolha", label: "Recolha" },
  { value: "reclamacao", label: "Reclamação" },
  { value: "suporte", label: "Suporte" },
  { value: "contratos", label: "Contratos" },
  { value: "ordem_servico", label: "Ordem de Serviço" },
  { value: "personalizado", label: "Personalizado" },
];

const EMPTY = {
  nome: "",
  tipo: "personalizado",
  ativo: true,
  objetivo: "",
  palavras_chave: [],
  etapas: [],
  campos_estruturados: [],
  regras_especificas: [],
  respostas_proibidas: [],
  transferencia_humana_condicoes: [],
  mensagem_inicio: "",
  mensagem_conclusao: "",
  mensagem_aguardando: "",
  instrucao_resumo: "",
  prompt_adicional: "",
  prioridade: 10,
};

function TagsInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput("");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {value.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
            {t}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-destructive">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={add}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function FluxoFormDialog({ open, onClose, fluxo, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(fluxo ? { ...EMPTY, ...fluxo } : EMPTY);
  }, [fluxo, open]);

  const up = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fluxo?.id ? "Editar Fluxo" : "Novo Fluxo Operacional"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="mt-2">
          <TabsList className="w-full grid grid-cols-5 h-8">
            <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
            <TabsTrigger value="etapas" className="text-xs">Etapas</TabsTrigger>
            <TabsTrigger value="regras" className="text-xs">Regras</TabsTrigger>
            <TabsTrigger value="transferencia" className="text-xs">Transferência</TabsTrigger>
            <TabsTrigger value="mensagens" className="text-xs">Mensagens</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nome do Fluxo *</Label>
                <Input value={form.nome} onChange={e => up("nome", e.target.value)} placeholder="Ex: Locação de Caçamba" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={form.tipo} onValueChange={v => up("tipo", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Prioridade (menor = ativa primeiro)</Label>
                <Input type="number" value={form.prioridade} onChange={e => up("prioridade", Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={!!form.ativo} onCheckedChange={v => up("ativo", v)} />
                <Label className="text-xs">Fluxo Ativo</Label>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Objetivo do Fluxo</Label>
              <Textarea value={form.objetivo} onChange={e => up("objetivo", e.target.value)} placeholder="Descreva o objetivo deste fluxo..." className="text-xs min-h-[64px] resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Palavras-chave de Ativação</Label>
              <p className="text-[10px] text-muted-foreground">A IA usará estas palavras para ativar este fluxo automaticamente</p>
              <TagsInput value={form.palavras_chave || []} onChange={v => up("palavras_chave", v)} placeholder="Ex: caçamba, cacamba, container..." />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Prompt Adicional (contexto extra para IA)</Label>
              <Textarea value={form.prompt_adicional} onChange={e => up("prompt_adicional", e.target.value)} placeholder="Informações adicionais que a IA deve considerar neste fluxo..." className="text-xs min-h-[80px] resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Instrução para Geração do Resumo</Label>
              <Textarea value={form.instrucao_resumo} onChange={e => up("instrucao_resumo", e.target.value)} placeholder="Ex: Ao coletar todos os dados, gere um resumo com: equipamento, quantidade, local e período..." className="text-xs min-h-[64px] resize-none" />
            </div>
          </TabsContent>

          {/* ETAPAS */}
          <TabsContent value="etapas" className="pt-3">
            <p className="text-xs text-muted-foreground mb-3">
              Defina cada etapa do atendimento. A IA seguirá esta ordem para coletar as informações necessárias.
            </p>
            <EtapaEditor etapas={form.etapas || []} onChange={v => up("etapas", v)} />
          </TabsContent>

          {/* REGRAS */}
          <TabsContent value="regras" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Regras Específicas do Fluxo</Label>
              <p className="text-[10px] text-muted-foreground">A IA seguirá estas regras ao atender neste fluxo</p>
              <ListaSimples
                items={form.regras_especificas || []}
                onChange={v => up("regras_especificas", v)}
                placeholder="Ex: Atendimento apenas para Cabo Frio"
                campo="descricao"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Respostas / Ações Proibidas</Label>
              <p className="text-[10px] text-muted-foreground">A IA nunca deve fazer ou dizer o que está listado aqui</p>
              <ListaSimples
                items={form.respostas_proibidas || []}
                onChange={v => up("respostas_proibidas", v)}
                placeholder="Ex: Nunca aplicar desconto automático"
                campo="descricao"
              />
            </div>
          </TabsContent>

          {/* TRANSFERÊNCIA */}
          <TabsContent value="transferencia" className="pt-3 space-y-2">
            <Label className="text-xs font-medium">Condições para Transferência Humana</Label>
            <p className="text-[10px] text-muted-foreground">Quando uma dessas condições ocorrer, a IA escala para humano</p>
            <ListaSimples
              items={form.transferencia_humana_condicoes || []}
              onChange={v => up("transferencia_humana_condicoes", v)}
              placeholder="Ex: Cliente solicitar desconto especial"
              campo="condicao"
            />
          </TabsContent>

          {/* MENSAGENS */}
          <TabsContent value="mensagens" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Mensagem de Início do Fluxo</Label>
              <Textarea value={form.mensagem_inicio} onChange={e => up("mensagem_inicio", e.target.value)} placeholder="Mensagem enviada quando o fluxo é ativado..." className="text-xs min-h-[64px] resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Mensagem de Conclusão / Resumo</Label>
              <Textarea value={form.mensagem_conclusao} onChange={e => up("mensagem_conclusao", e.target.value)} placeholder="Mensagem enviada ao concluir a coleta de dados..." className="text-xs min-h-[64px] resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Mensagem de Aguardo</Label>
              <Textarea value={form.mensagem_aguardando} onChange={e => up("mensagem_aguardando", e.target.value)} placeholder="Mensagem quando aguardando resposta do cliente..." className="text-xs min-h-[56px] resize-none" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.nome.trim()}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {fluxo?.id ? "Salvar Alterações" : "Criar Fluxo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}