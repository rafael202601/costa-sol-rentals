import { useState, useCallback, useRef, memo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Phone, Mail, MapPin, AlertCircle, Ban, Users, Upload, X, SlidersHorizontal, ChevronLeft, ChevronRight, Tag, Hash } from "lucide-react";
import ClientImportModal from "../components/client/ClientImportModal";

const profileBadge = {
  comum: { label: "CPF", cls: "bg-slate-100 text-slate-600" },
  cnpj: { label: "CNPJ", cls: "bg-blue-100 text-blue-700" },
  empreiteiro: { label: "Empreiteiro", cls: "bg-amber-100 text-amber-700" },
};

const SEARCH_FIELDS = [
  { value: "todos", label: "Todos os campos" },
  { value: "nome_razao_social", label: "Nome / Razão Social" },
  { value: "cpf_cnpj", label: "CPF / CNPJ" },
  { value: "external_id", label: "Código Externo (ID)" },
  { value: "codigo_cliente", label: "Código do Cliente" },
  { value: "telefone1", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "endereco_entrega_rua", label: "Endereço (Rua)" },
  { value: "endereco_entrega_bairro", label: "Bairro" },
  { value: "endereco_entrega_cidade", label: "Cidade" },
  { value: "obras", label: "Obras vinculadas" },
  { value: "pessoas_liberadas", label: "Pessoas autorizadas" },
  { value: "etiquetas", label: "Etiqueta" },
];

const ClientCard = memo(function ClientCard({ client }) {
  const pb = profileBadge[client.tipo_perfil || "comum"];
  return (
    <Link to={`/clientes/ver/${client.id}`}>
      <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {client.codigo_cliente ? `${client.codigo_cliente} — ` : ""}{client.nome_razao_social}
              </h3>
              {pb && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pb.cls}`}>{pb.label}</span>}
              {client.fantasia && (
                <p className="text-xs text-muted-foreground truncate">{client.fantasia}</p>
              )}
            </div>
            <div className="flex gap-1 ml-2 items-center">
              {client.bloqueado && (
                <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center" title="Bloqueado">
                  <Ban className="w-3 h-3 text-red-600" />
                </span>
              )}
              {client.pendencia_financeira && (
                <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center" title="Pendência Financeira">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {client.codigo_cliente && (
              <p className="font-mono font-semibold text-primary/80">#{client.codigo_cliente}</p>
            )}
            {client.cpf_cnpj && <p className="font-mono">{client.cpf_cnpj}</p>}
            {client.external_id && <p>Cód. Externo: {client.external_id}</p>}
            {client.telefone1 && (
              <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /><span>{client.telefone1}</span></div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /><span className="truncate">{client.email}</span></div>
            )}
            {client.endereco_entrega_cidade && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span>{client.endereco_entrega_cidade}{client.endereco_entrega_uf ? ` - ${client.endereco_entrega_uf}` : ""}</span>
              </div>
            )}
          </div>
          {(client.etiquetas || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/50">
              {client.etiquetas.slice(0, 4).map((et, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                  <Tag className="w-2.5 h-2.5" />{et}
                </span>
              ))}
              {client.etiquetas.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{client.etiquetas.length - 4}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});

export default function Clients() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [sort, setSort] = useState("recentes");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const runSearch = useCallback(async (q, field, tipo, sortOrder, pg = 1) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await base44.functions.invoke("searchClients", {
        query: q.slice(0, 200),
        field,
        tipo,
        sort: sortOrder,
        page: pg,
        page_size: 50,
      });
      const data = res.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(pg);
    } catch {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => runSearch(query, searchField, tipoFilter, sort, 1);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleQueryChange = (e) => {
    const val = e.target.value.slice(0, 200);
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 3) {
      debounceRef.current = setTimeout(() => runSearch(val, searchField, tipoFilter, sort, 1), 600);
    }
    if (val.trim().length === 0) {
      debounceRef.current = setTimeout(() => runSearch("", searchField, tipoFilter, sort, 1), 600);
    }
  };

  const handleClear = () => {
    setQuery("");
    runSearch("", searchField, tipoFilter, sort, 1);
  };

  // Carrega a listagem inicial
  useEffect(() => {
    runSearch("", searchField, tipoFilter, sort, 1);
  }, []);

  const goToPage = (pg) => {
    runSearch(query, searchField, tipoFilter, sort, pg);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={searched ? `${total} cliente(s) encontrado(s)` : "Pesquise para listar clientes"}
      >
        <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
          <Upload className="w-4 h-4" /> Importar CSV
        </Button>
        <Button onClick={() => navigate("/clientes/novo")} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </PageHeader>

      <ClientImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onDone={() => runSearch(query, searchField, tipoFilter, sort, 1)}
      />

      {/* Busca avançada */}
      <div className="bg-card rounded-xl shadow-sm p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="w-4 h-4" /> Busca avançada
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-full sm:w-52 border bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEARCH_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar por ${SEARCH_FIELDS.find(f => f.value === searchField)?.label || "..."}...`}
              className="pl-10 pr-10 border bg-background"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              maxLength={200}
              autoFocus
            />
            {query && (
              <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); if (searched) runSearch(query, searchField, v, sort, 1); }}>
            <SelectTrigger className="w-full sm:w-40 border bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os perfis</SelectItem>
              <SelectItem value="comum">Cliente CPF</SelectItem>
              <SelectItem value="cnpj">Cliente CNPJ</SelectItem>
              <SelectItem value="empreiteiro">Empreiteiro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => { setSort(v); if (searched) runSearch(query, searchField, tipoFilter, v, 1); }}>
            <SelectTrigger className="w-full sm:w-40 border bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais Recentes</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={handleSearch} className="gap-2 shrink-0">
              <Search className="w-4 h-4" /> Buscar
            </Button>
            {searched && (
              <Button variant="outline" onClick={handleClear} className="gap-2 shrink-0">
                <X className="w-4 h-4" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Checkbox busca por código */}
        <label className="inline-flex items-center gap-2 cursor-pointer select-none group pt-1">
          <input
            type="checkbox"
            checked={searchField === "codigo_cliente"}
            onChange={e => setSearchField(e.target.checked ? "codigo_cliente" : "todos")}
            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
          />
          <Hash className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Buscar por código do cliente
          </span>
          {searchField === "codigo_cliente" && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">ativo</span>
          )}
        </label>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm">Buscando em toda a base de clientes...</p>
          <p className="text-xs opacity-60">Isso pode levar alguns segundos com bases grandes</p>
        </div>
      )}

      {/* Estado inicial */}
      {!loading && !searched && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">Nenhum cliente carregado</p>
          <p className="text-sm mt-1">Digite para pesquisar ou clique em <strong>Buscar</strong> para listar todos.</p>
        </div>
      )}

      {/* Sem resultados */}
      {!loading && searched && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo cliente.</p>
        </div>
      )}

      {/* Resultados */}
      {!loading && items.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {items.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-card rounded-xl shadow-sm p-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} — {total} clientes encontrados
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <span className="text-sm font-medium px-2">{page} / {totalPages}</span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}