import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, AlertCircle, Zap } from "lucide-react";
import FluxoCard from "./FluxoCard";
import FluxoFormDialog from "./FluxoFormDialog";
import { toast } from "sonner";

const FLUXOS_PADRAO = [
  {
    nome: "Locação de Caçamba",
    tipo: "cacamba",
    ativo: true,
    objetivo: "Coletar todos os dados necessários para orçamento e locação de caçamba.",
    palavras_chave: ["caçamba", "cacamba", "container", "entulho", "lixo"],
    prioridade: 1,
    etapas: [
      { id: "e1", ordem: 1, nome: "Quantidade", chave: "quantidade", pergunta: "Quantas caçambas você precisa?", obrigatoria: true, tipo_dado: "numero", dica_ia: "Aceitar valores numéricos. Se disser 'uma' ou 'somente uma', registrar como 1." },
      { id: "e2", ordem: 2, nome: "Metragem", chave: "metragem", pergunta: "Qual a metragem necessária? (ex: 4m³, 5m³, 7m³)", obrigatoria: true, tipo_dado: "texto", dica_ia: "Aceitar m³ ou apenas número. Se disser só o número, assumir m³." },
      { id: "e3", ordem: 3, nome: "Cidade", chave: "cidade", pergunta: "Qual a cidade de entrega?", obrigatoria: true, tipo_dado: "texto" },
      { id: "e4", ordem: 4, nome: "Bairro", chave: "bairro", pergunta: "Qual o bairro?", obrigatoria: true, tipo_dado: "texto", dica_ia: "Sempre confirmar o bairro antes de calcular frete." },
      { id: "e5", ordem: 5, nome: "Período", chave: "periodo", pergunta: "Por quantos dias você precisará da caçamba?", obrigatoria: true, tipo_dado: "texto" },
      { id: "e6", ordem: 6, nome: "Endereço completo", chave: "endereco", pergunta: "Qual o endereço completo de entrega?", obrigatoria: true, tipo_dado: "endereco" },
    ],
    regras_especificas: [
      { id: "r1", descricao: "Atendimento apenas para Cabo Frio e região", ativa: true },
      { id: "r2", descricao: "Valor padrão R$300 por caçamba", ativa: true },
      { id: "r3", descricao: "Prazo máximo de locação: 10 dias", ativa: true },
      { id: "r4", descricao: "Não aplicar desconto automático", ativa: true },
      { id: "r5", descricao: "Sempre confirmar bairro antes de calcular frete", ativa: true },
    ],
    respostas_proibidas: [
      { id: "p1", descricao: "Nunca prometer desconto sem aprovação humana", ativa: true },
      { id: "p2", descricao: "Nunca informar valores de concorrentes", ativa: true },
    ],
    transferencia_humana_condicoes: [
      { id: "t1", condicao: "Cliente reclamar do preço ou serviço", ativa: true },
      { id: "t2", condicao: "Solicitar desconto especial ou negociação", ativa: true },
      { id: "t3", condicao: "Dúvida operacional complexa", ativa: true },
    ],
    mensagem_inicio: "Ótimo! Vou te ajudar com a locação de caçamba. Preciso de algumas informações 😊",
    mensagem_conclusao: "Perfeito! Tenho todos os dados. Vou gerar seu orçamento agora.",
    instrucao_resumo: "Gerar resumo com: quantidade de caçambas, metragem, cidade, bairro, endereço e período de locação.",
  },
  {
    nome: "Locação de Andaime",
    tipo: "andaime",
    ativo: true,
    objetivo: "Coletar dados para orçamento de andaime tubular ou fachadeiro.",
    palavras_chave: ["andaime", "andaimes", "tubular", "fachadeiro", "scaffold"],
    prioridade: 2,
    etapas: [
      { id: "e1", ordem: 1, nome: "Quantidade", chave: "quantidade", pergunta: "Quantos andaimes você precisa?", obrigatoria: true, tipo_dado: "numero" },
      { id: "e2", ordem: 2, nome: "Altura", chave: "altura", pergunta: "Qual a altura necessária? (em metros ou número de andares)", obrigatoria: true, tipo_dado: "texto" },
      { id: "e3", ordem: 3, nome: "Período", chave: "periodo", pergunta: "Por quantos dias você precisará? (mínimo 5 dias)", obrigatoria: true, tipo_dado: "texto" },
      { id: "e4", ordem: 4, nome: "Cidade", chave: "cidade", pergunta: "Qual a cidade?", obrigatoria: true, tipo_dado: "texto" },
      { id: "e5", ordem: 5, nome: "Bairro", chave: "bairro", pergunta: "Qual o bairro?", obrigatoria: true, tipo_dado: "texto" },
      { id: "e6", ordem: 6, nome: "Rodas", chave: "rodas", pergunta: "Você precisa de andaimes com rodas?", obrigatoria: false, tipo_dado: "booleano" },
    ],
    regras_especificas: [
      { id: "r1", descricao: "Período mínimo de locação: 5 dias", ativa: true },
      { id: "r2", descricao: "Sempre perguntar sobre necessidade de rodas", ativa: true },
      { id: "r3", descricao: "Sempre perguntar sobre bases reguláveis", ativa: true },
      { id: "r4", descricao: "Lembrar sobre uso obrigatório de EPIs", ativa: true },
    ],
    transferencia_humana_condicoes: [
      { id: "t1", condicao: "Quantidade acima de 50 unidades", ativa: true },
      { id: "t2", condicao: "Projeto especial ou fachada complexa", ativa: true },
    ],
    mensagem_inicio: "Vou te ajudar com o orçamento de andaimes! Só preciso de algumas informações 👷",
    instrucao_resumo: "Resumo com: tipo de andaime, quantidade, altura, cidade, bairro e período.",
  },
];

export default function FluxosIAManager() {
  const [fluxos, setFluxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [deletando, setDeletando] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.FluxoIA.list("-created_date", 100);
    setFluxos(data);
    setLoading(false);
  };

  const handleSave = async (form) => {
    if (form.id) {
      await base44.entities.FluxoIA.update(form.id, form);
      toast.success("Fluxo atualizado!");
    } else {
      await base44.entities.FluxoIA.create(form);
      toast.success("Fluxo criado!");
    }
    await load();
  };

  const handleToggle = async (fluxo, ativo) => {
    await base44.entities.FluxoIA.update(fluxo.id, { ativo });
    setFluxos(f => f.map(x => x.id === fluxo.id ? { ...x, ativo } : x));
    toast.success(ativo ? "Fluxo ativado" : "Fluxo desativado");
  };

  const handleDelete = async () => {
    await base44.entities.FluxoIA.delete(deletando.id);
    setDeletando(null);
    toast.success("Fluxo removido");
    await load();
  };

  const handleCriarPadrao = async () => {
    setLoading(true);
    for (const f of FLUXOS_PADRAO) {
      await base44.entities.FluxoIA.create(f);
    }
    toast.success(`${FLUXOS_PADRAO.length} fluxos padrão criados!`);
    await load();
  };

  const fluxosFiltrados = fluxos.filter(f => {
    const buscaOk = !busca || f.nome?.toLowerCase().includes(busca.toLowerCase()) || (f.palavras_chave || []).some(p => p.toLowerCase().includes(busca.toLowerCase()));
    const tipoOk = filtroTipo === "todos" || f.tipo === filtroTipo;
    return buscaOk && tipoOk;
  });

  const ativos = fluxos.filter(f => f.ativo).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">Fluxos Operacionais</h3>
          <p className="text-xs text-muted-foreground">{ativos} ativo{ativos !== 1 ? "s" : ""} de {fluxos.length} total</p>
        </div>
        <div className="flex gap-2">
          {fluxos.length === 0 && !loading && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleCriarPadrao}>
              <Zap className="w-3.5 h-3.5 text-yellow-500" /> Criar Fluxos Padrão
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setEditando(null); setFormOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> Novo Fluxo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fluxo..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="andaime">Andaime</SelectItem>
            <SelectItem value="escoramento">Escoramento</SelectItem>
            <SelectItem value="cacamba">Caçamba</SelectItem>
            <SelectItem value="ferramentas">Ferramentas</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="entrega">Entrega</SelectItem>
            <SelectItem value="recolha">Recolha</SelectItem>
            <SelectItem value="reclamacao">Reclamação</SelectItem>
            <SelectItem value="suporte">Suporte</SelectItem>
            <SelectItem value="contratos">Contratos</SelectItem>
            <SelectItem value="ordem_servico">Ordem de Serviço</SelectItem>
            <SelectItem value="personalizado">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : fluxosFiltrados.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {fluxos.length === 0 ? "Nenhum fluxo criado ainda." : "Nenhum fluxo encontrado."}
          </p>
          {fluxos.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs mt-2" onClick={handleCriarPadrao}>
              <Zap className="w-3.5 h-3.5 text-yellow-500" /> Criar Fluxos Padrão (Caçamba + Andaime)
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fluxosFiltrados.map(fluxo => (
            <FluxoCard
              key={fluxo.id}
              fluxo={fluxo}
              onEdit={(f) => { setEditando(f); setFormOpen(true); }}
              onDelete={setDeletando}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <FluxoFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        fluxo={editando}
        onSave={handleSave}
      />

      <AlertDialog open={!!deletando} onOpenChange={() => setDeletando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Fluxo</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover o fluxo "<strong>{deletando?.nome}</strong>"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}