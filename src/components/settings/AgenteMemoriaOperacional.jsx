import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, Trash2, Bot, ChevronDown, ChevronRight } from 'lucide-react';

const INTENT_LABEL = {
  orcamento: 'Orçamento', financeiro: 'Financeiro', entrega: 'Entrega',
  recolha: 'Recolha', suporte: 'Suporte', reclamacao: 'Reclamação',
  urgencia: '🚨 Urgente', humano: 'Humano', cancelamento: 'Cancelamento', outro: 'Geral',
};
const INTENT_COLOR = {
  orcamento: 'bg-blue-100 text-blue-800', financeiro: 'bg-yellow-100 text-yellow-800',
  entrega: 'bg-green-100 text-green-800', recolha: 'bg-orange-100 text-orange-800',
  suporte: 'bg-purple-100 text-purple-800', reclamacao: 'bg-red-100 text-red-800',
  urgencia: 'bg-red-600 text-white', humano: 'bg-gray-100 text-gray-800',
  cancelamento: 'bg-gray-100 text-gray-800', outro: 'bg-gray-100 text-gray-600',
};
const FLOW_LABEL = {
  andaime: 'Andaime Tubular', andaime_fachadeiro: 'Andaime Fachadeiro', escoramento: 'Escoramento',
  cacamba: 'Caçamba', ferramentas: 'Ferramentas', financeiro: 'Financeiro',
  entrega: 'Entrega', recolha: 'Recolha', suporte: 'Suporte', reclamacao: 'Reclamação', geral: 'Geral',
};
const STEP_COLOR = {
  saudacao: 'bg-blue-100 text-blue-700', orcamento: 'bg-green-100 text-green-700',
  fechamento: 'bg-emerald-100 text-emerald-700', escalado: 'bg-red-100 text-red-700',
  escalar: 'bg-red-100 text-red-700',
};

function DadosBadge({ chave, valor }) {
  return (
    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded px-2 py-1">
      <span className="text-green-500 text-xs">✔</span>
      <span className="text-xs text-gray-600">{chave}:</span>
      <span className="text-xs font-medium text-gray-900">{String(valor)}</span>
    </div>
  );
}

function ConvCard({ estado, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const dados = estado.dados_coletados || {};
  const dadosEntradas = Object.entries(dados).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const ultimaInt = estado.ultima_interacao
    ? new Date(estado.ultima_interacao).toLocaleString('pt-BR')
    : '—';

  return (
    <Card className="border-border">
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="font-mono text-sm font-semibold text-gray-800">{estado.telefone}</span>
            <Badge className={`text-xs ${INTENT_COLOR[estado.intent] || 'bg-gray-100 text-gray-600'}`}>
              {INTENT_LABEL[estado.intent] || estado.intent || '—'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {FLOW_LABEL[estado.flow] || estado.flow || '—'}
            </Badge>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STEP_COLOR[estado.step] || 'bg-gray-100 text-gray-600'}`}>
              {estado.step || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{ultimaInt}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={e => { e.stopPropagation(); onDelete(estado.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {/* Resumo rápido dos dados coletados */}
        {dadosEntradas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {dadosEntradas.map(([k, v]) => <DadosBadge key={k} chave={k} valor={v} />)}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Resumo operacional */}
          {estado.resumo_operacional && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resumo Operacional</p>
              <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap font-mono">{estado.resumo_operacional}</pre>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground uppercase mb-1">Última Pergunta</p>
              <p className="text-gray-800 bg-muted rounded p-2">{estado.ultima_pergunta || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground uppercase mb-1">Última Resposta</p>
              <p className="text-gray-800 bg-muted rounded p-2 max-h-24 overflow-auto">{estado.ultima_resposta || '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-muted rounded p-2">
              <p className="text-muted-foreground">Trocas</p>
              <p className="font-bold text-lg">{estado.total_trocas || 0}</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-muted-foreground">Apresentou-se</p>
              <p className="font-bold">{estado.apresentado ? '✅ Sim' : '❌ Não'}</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-muted-foreground">Origem</p>
              <p className="font-bold">{estado.origem || '—'}</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function DebugCard({ estado }) {
  const [expandPrompt, setExpandPrompt] = useState(false);
  if (!estado) return <p className="text-sm text-muted-foreground text-center py-8">Selecione uma conversa para ver o debug</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded p-3">
          <p className="text-xs text-muted-foreground mb-1">Intenção Detectada</p>
          <p className="font-semibold text-sm">{INTENT_LABEL[estado.debug_intent_detectada] || estado.debug_intent_detectada || '—'}</p>
        </div>
        <div className="bg-muted rounded p-3">
          <p className="text-xs text-muted-foreground mb-1">Fluxo Selecionado</p>
          <p className="font-semibold text-sm">{FLOW_LABEL[estado.debug_flow_selecionado] || estado.debug_flow_selecionado || '—'}</p>
        </div>
        <div className="bg-muted rounded p-3">
          <p className="text-xs text-muted-foreground mb-1">Modelo IA Usado</p>
          <p className="font-semibold text-sm font-mono">{estado.debug_modelo_usado || '—'}</p>
        </div>
        <div className="bg-muted rounded p-3">
          <p className="text-xs text-muted-foreground mb-1">Etapa Atual</p>
          <p className="font-semibold text-sm">{estado.step || '—'}</p>
        </div>
      </div>

      {estado.debug_regras_aplicadas && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Regras Aplicadas</p>
          <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap font-mono max-h-40 overflow-auto">
            {estado.debug_regras_aplicadas}
          </pre>
        </div>
      )}

      {estado.debug_ultimo_prompt && (
        <div>
          <button
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase mb-1 w-full"
            onClick={() => setExpandPrompt(!expandPrompt)}
          >
            {expandPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Último Prompt Enviado (primeiros 3000 chars)
          </button>
          {expandPrompt && (
            <ScrollArea className="h-80">
              <pre className="text-xs bg-slate-900 text-green-400 rounded p-3 whitespace-pre-wrap font-mono">
                {estado.debug_ultimo_prompt}
              </pre>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgenteMemoriaOperacional() {
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await base44.entities.ConversationState.list('-ultima_interacao', 50);
      setEstados(lista);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const deletar = async (id) => {
    await base44.entities.ConversationState.delete(id);
    setEstados(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filtrados = estados.filter(e =>
    !busca || e.telefone?.includes(busca) || e.intent?.includes(busca) || e.flow?.includes(busca)
  );

  const selecionado = estados.find(e => e.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Memória Operacional da IA
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estado persistido de cada conversa ativa — fluxo, dados coletados e etapa atual
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por telefone, intenção ou fluxo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Tabs defaultValue="conversas">
        <TabsList>
          <TabsTrigger value="conversas">Conversas Ativas ({filtrados.length})</TabsTrigger>
          <TabsTrigger value="debug">Debug IA</TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa encontrada</p>
          ) : (
            <div className="space-y-2">
              {filtrados.map(e => (
                <div key={e.id} onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}>
                  <ConvCard estado={e} onDelete={deletar} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="debug" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Selecione uma conversa</p>
              <ScrollArea className="h-96">
                <div className="space-y-1 pr-2">
                  {filtrados.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-left px-3 py-2 rounded text-xs hover:bg-muted transition-colors ${selectedId === e.id ? 'bg-primary/10 border border-primary/30' : ''}`}
                    >
                      <p className="font-mono font-semibold">{e.telefone}</p>
                      <p className="text-muted-foreground">{FLOW_LABEL[e.flow] || e.flow} • {e.step}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="lg:col-span-2">
              <DebugCard estado={selecionado} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}