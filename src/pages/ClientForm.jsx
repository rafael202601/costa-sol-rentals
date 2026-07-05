import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2, Plus, X, Building2, Search, RefreshCw, AlertCircle, CheckCircle2, FileText, Clock, Ban, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { showError, SAVE_ERRORS } from "../lib/errorHandler";
import { getNextClientCode, isClientCodeDuplicate } from "../lib/sequentialNumber";
import { formatCPF, formatCNPJ, formatCPFCNPJ, validarCPF, validarCNPJ, validarDocumento } from "../lib/cpfCnpj";
import { calcularScoreFromContracts, calcularClassificacao } from "../lib/clientScore";
import ClientScoreBadge from "../components/client/ClientScoreBadge";
import ClientDocuments from "../components/client/ClientDocuments";
import ClientTagsField from "../components/client/ClientTagsField";
import FichaCadastralDialog from "../components/client/FichaCadastralDialog";
import { PERIODOS_VALIDADE, calcularDataValidade, getStatusValidade, getValidadeConfig, getDiasParaValidade } from "../lib/clientValidade";
import { format as fmtDate, parseISO, addDays, addMonths } from "date-fns";

// Prazos para pessoas autorizadas
const PRAZOS_PESSOA = [
  { value: "30d", label: "30 dias", fn: () => addDays(new Date(), 30) },
  { value: "90d", label: "90 dias", fn: () => addDays(new Date(), 90) },
  { value: "6m", label: "6 meses", fn: () => addMonths(new Date(), 6) },
  { value: "1a", label: "1 ano", fn: () => addMonths(new Date(), 12) },
  { value: "manual", label: "Personalizado", fn: null },
];

function getPessoaStatus(pessoa) {
  if (!pessoa.data_vencimento) return null;
  const hoje = new Date();
  const venc = new Date(pessoa.data_vencimento);
  const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "vencido";
  if (diff <= 7) return "proximo";
  return "ativo";
}

const PESSOA_STATUS_CFG = {
  ativo: { label: "Ativa", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  proximo: { label: "Vence em breve", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  vencido: { label: "Vencida", cls: "bg-red-100 text-red-700 border-red-200" },
};

function FormField({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

export default function ClientForm() {
  const navigate = useNavigate();
  const pathParts = window.location.pathname.split("/");
  const clientId = pathParts[pathParts.length - 1];
  const isEditing = clientId && clientId !== "novo";

  const [fotoUrl, setFotoUrl] = useState("");
  const [fichaDialog, setFichaDialog] = useState(false);

  const emptyForm = {
    codigo_cliente: "",
    tipo_perfil: "comum",
    nome_razao_social: "", fantasia: "", cpf_cnpj: "", inscricao_estadual: "",
    inscricao_municipal: "", rg: "", data_nascimento: "", email: "",
    telefone1: "", telefone2: "", telefone3: "", conjuge_contato: "",
    socio: "", socio_cpf: "", nome_pai: "", nome_mae: "",
    empreiteiro_id: "", empreiteiro_nome: "",
    obras: [],
    endereco_entrega_rua: "", endereco_entrega_numero: "", endereco_entrega_complemento: "",
    endereco_entrega_bairro: "", endereco_entrega_cidade: "", endereco_entrega_uf: "", endereco_entrega_cep: "",
    endereco_cobranca_rua: "", endereco_cobranca_numero: "", endereco_cobranca_complemento: "",
    endereco_cobranca_bairro: "", endereco_cobranca_cidade: "", endereco_cobranca_uf: "", endereco_cobranca_cep: "",
    pessoas_liberadas: [],
    etiquetas: [],
    data_validade_cadastro: calcularDataValidade("6m"),
    bloqueado: false, pendencia_financeira: false, status_serasa: "limpo", observacoes: "", motivo_bloqueio: "",
    financeiro_bloqueio_automatico: false, financeiro_limite_bloqueio: 0, financeiro_dias_carencia: 0,
    financeiro_faturamento_automatico: false, financeiro_intervalo_faturamento: 30,
    financeiro_observacoes: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [empreiteiros, setEmpreiteiros] = useState([]);
  const [clientContracts, setClientContracts] = useState([]);
  const [docError, setDocError] = useState("");
  const [docSuccess, setDocSuccess] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFound, setCnpjFound] = useState(null); // true | false | null
  const [docDuplicate, setDocDuplicate] = useState(false);
  const [codigoDuplicate, setCodigoDuplicate] = useState(false);
  const [nextCodigoSugerido, setNextCodigoSugerido] = useState("");
  const [periodoValidade, setPeriodoValidade] = useState("6m");
  const cnpjQueryTimeout = useRef(null);

  useEffect(() => {
    base44.entities.Client.filter({ tipo_perfil: "empreiteiro" }).then(setEmpreiteiros).catch(() => {});
    if (isEditing) {
      base44.entities.Contract.filter({ client_id: clientId }).then(setClientContracts).catch(() => {});
      base44.entities.Client.filter({ id: clientId }).then(([client]) => {
        if (client) {
          setFotoUrl(client.foto_url || "");
          setForm((prev) => {
            const updated = { ...prev };
            Object.keys(prev).forEach((key) => {
              if (client[key] !== undefined && client[key] !== null) updated[key] = client[key];
            });
            if (!updated.pessoas_liberadas) updated.pessoas_liberadas = [];
            if (!updated.obras) updated.obras = [];
            return updated;
          });
        }
      });
    }
  }, [clientId, isEditing]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // CPF/CNPJ input handler com formatação automática
  const handleDocChange = (rawValue) => {
    const digits = rawValue.replace(/\D/g, "");
    let formatted = rawValue;

    if (form.tipo_perfil === "comum") {
      formatted = formatCPF(digits);
    } else if (form.tipo_perfil === "cnpj") {
      formatted = formatCNPJ(digits);
    } else {
      formatted = formatCPFCNPJ(digits);
    }

    update("cpf_cnpj", formatted);
    setDocError("");
    setDocSuccess(false);
    setDocDuplicate(false);
    setCnpjFound(null);

    // Quando CNPJ completo (14 dígitos), consultar automaticamente
    if (form.tipo_perfil === "cnpj" && digits.length === 14) {
      clearTimeout(cnpjQueryTimeout.current);
      cnpjQueryTimeout.current = setTimeout(() => {
        checkAndConsultCnpj(digits, formatted);
      }, 600);
    } else if (form.tipo_perfil === "empreiteiro" && digits.length === 14) {
      clearTimeout(cnpjQueryTimeout.current);
      cnpjQueryTimeout.current = setTimeout(() => {
        checkAndConsultCnpj(digits, formatted);
      }, 600);
    }

    // Verificar duplicidade para CPF quando completo
    if ((form.tipo_perfil === "comum" || form.tipo_perfil === "empreiteiro") && digits.length === 11) {
      checkDuplicateCPF(formatted);
    }

    // Verificar duplicidade para CNPJ quando completo
    if (form.tipo_perfil === "cnpj" && digits.length === 14) {
      checkDuplicateCNPJ(formatted);
    }
  };

  const checkDuplicateCPF = async (cpfFormatted) => {
    const existing = await base44.entities.Client.filter({ cpf_cnpj: cpfFormatted }).catch(() => []);
    const others = existing.filter((c) => c.id !== (isEditing ? clientId : null));
    if (others.length > 0) {
      setDocDuplicate(true);
      setDocError("CPF já cadastrado no sistema.");
    }
  };

  const checkDuplicateCNPJ = async (cnpjFormatted) => {
    const existing = await base44.entities.Client.filter({ cpf_cnpj: cnpjFormatted }).catch(() => []);
    const others = existing.filter((c) => c.id !== (isEditing ? clientId : null));
    if (others.length > 0) {
      setDocDuplicate(true);
      setDocError("CNPJ já cadastrado no sistema.");
    }
  };

  const checkDuplicateDoc = async (cpfCnpj, currentId) => {
    const existing = await base44.entities.Client.filter({ cpf_cnpj: cpfCnpj }).catch(() => []);
    return existing.filter((c) => c.id !== currentId);
  };

  const handleCodigoChange = async (value) => {
    update("codigo_cliente", value);
    setCodigoDuplicate(false);
    setNextCodigoSugerido("");
    if (!value) return;
    const isDup = await isClientCodeDuplicate(value, isEditing ? clientId : null);
    if (isDup) {
      setCodigoDuplicate(true);
      const nextCode = await getNextClientCode(isEditing ? clientId : null);
      setNextCodigoSugerido(nextCode);
    }
  };

  const checkAndConsultCnpj = async (digits, formatted) => {
    if (!validarCNPJ(digits)) {
      setDocError("CNPJ inválido. Verifique os dígitos informados.");
      return;
    }
    await consultarCNPJ(formatted);
  };

  const consultarCNPJ = async (cnpjFormatted) => {
    const digits = cnpjFormatted.replace(/\D/g, "");
    if (!validarCNPJ(digits)) {
      toast.error("CNPJ inválido. Não é possível consultar.");
      return;
    }
    setCnpjLoading(true);
    setCnpjFound(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();

      const razaoSocial = data.razao_social || data.nome || "";
      const nomeFantasia = data.nome_fantasia || "";
      const cep = data.cep || "";
      const logradouro = data.logradouro || "";
      const numero = data.numero || "";
      const complemento = data.complemento || "";
      const bairro = data.bairro || "";
      const municipio = data.municipio || "";
      const uf = data.uf || "";

      setForm((prev) => ({
        ...prev,
        nome_razao_social: razaoSocial || prev.nome_razao_social,
        fantasia: nomeFantasia || prev.fantasia,
        endereco_entrega_rua: logradouro || prev.endereco_entrega_rua,
        endereco_entrega_numero: numero || prev.endereco_entrega_numero,
        endereco_entrega_complemento: complemento || prev.endereco_entrega_complemento,
        endereco_entrega_bairro: bairro || prev.endereco_entrega_bairro,
        endereco_entrega_cidade: municipio || prev.endereco_entrega_cidade,
        endereco_entrega_uf: uf || prev.endereco_entrega_uf,
        endereco_entrega_cep: cep || prev.endereco_entrega_cep,
      }));

      setCnpjFound(true);
      setDocSuccess(true);
      setDocError("");
      toast.success("Dados do CNPJ preenchidos automaticamente!");
    } catch {
      setCnpjFound(false);
      toast.warning("CNPJ não encontrado na base pública. Preencha manualmente.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const validateDoc = () => {
    const result = validarDocumento(form.cpf_cnpj, form.tipo_perfil);
    if (!result.valid) {
      setDocError(result.erro);
      setDocSuccess(false);
      return false;
    }
    setDocError("");
    setDocSuccess(true);
    return true;
  };

  const copyAddressToCobranca = () => {
    setForm((prev) => ({
      ...prev,
      endereco_cobranca_rua: prev.endereco_entrega_rua,
      endereco_cobranca_numero: prev.endereco_entrega_numero,
      endereco_cobranca_complemento: prev.endereco_entrega_complemento,
      endereco_cobranca_bairro: prev.endereco_entrega_bairro,
      endereco_cobranca_cidade: prev.endereco_entrega_cidade,
      endereco_cobranca_uf: prev.endereco_entrega_uf,
      endereco_cobranca_cep: prev.endereco_entrega_cep,
    }));
    toast.success("Endereço copiado!");
  };

  // Pessoas liberadas
  const addPessoa = () => {
    const inicio = fmtDate(new Date(), "yyyy-MM-dd");
    const vencimento = fmtDate(addMonths(new Date(), 12), "yyyy-MM-dd");
    setForm((prev) => ({ ...prev, pessoas_liberadas: [...(prev.pessoas_liberadas || []), { nome: "", cpf: "", telefone: "", data_inicio: inicio, data_vencimento: vencimento, prazo: "1a" }] }));
  };
  const updatePessoa = (idx, field, value) => {
    setForm((prev) => {
      const list = [...prev.pessoas_liberadas];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, pessoas_liberadas: list };
    });
  };
  const setPessoaPrazo = (idx, prazoVal) => {
    const p = PRAZOS_PESSOA.find(x => x.value === prazoVal);
    setForm((prev) => {
      const list = [...prev.pessoas_liberadas];
      const vencimento = p?.fn ? fmtDate(p.fn(), "yyyy-MM-dd") : list[idx].data_vencimento;
      list[idx] = { ...list[idx], prazo: prazoVal, data_vencimento: vencimento };
      return { ...prev, pessoas_liberadas: list };
    });
  };
  const removePessoa = (idx) => {
    setForm((prev) => ({ ...prev, pessoas_liberadas: prev.pessoas_liberadas.filter((_, i) => i !== idx) }));
  };

  // Obras
  const addObra = () => {
    setForm((prev) => ({
      ...prev,
      obras: [...(prev.obras || []), { nome_obra: "", endereco: "", responsavel: "", empreiteiro_id: "", empreiteiro_nome: "", pessoas_autorizadas: [], ativa: true }],
    }));
  };
  const updateObra = (idx, field, value) => {
    setForm((prev) => {
      const obras = [...(prev.obras || [])];
      obras[idx] = { ...obras[idx], [field]: value };
      return { ...prev, obras };
    });
  };
  const removeObra = (idx) => {
    setForm((prev) => ({ ...prev, obras: (prev.obras || []).filter((_, i) => i !== idx) }));
  };
  const addObraPessoa = (obraIdx) => {
    setForm((prev) => {
      const obras = [...(prev.obras || [])];
      obras[obraIdx] = { ...obras[obraIdx], pessoas_autorizadas: [...(obras[obraIdx].pessoas_autorizadas || []), { nome: "", telefone: "" }] };
      return { ...prev, obras };
    });
  };
  const updateObraPessoa = (obraIdx, pessoaIdx, field, value) => {
    setForm((prev) => {
      const obras = [...(prev.obras || [])];
      const pessoas = [...(obras[obraIdx].pessoas_autorizadas || [])];
      pessoas[pessoaIdx] = { ...pessoas[pessoaIdx], [field]: value };
      obras[obraIdx] = { ...obras[obraIdx], pessoas_autorizadas: pessoas };
      return { ...prev, obras };
    });
  };
  const removeObraPessoa = (obraIdx, pessoaIdx) => {
    setForm((prev) => {
      const obras = [...(prev.obras || [])];
      obras[obraIdx] = { ...obras[obraIdx], pessoas_autorizadas: (obras[obraIdx].pessoas_autorizadas || []).filter((_, i) => i !== pessoaIdx) };
      return { ...prev, obras };
    });
  };

  const handleSave = async () => {
    if (!form.nome_razao_social || !form.cpf_cnpj || !form.telefone1) {
      toast.error("Preencha os campos obrigatórios: Nome, CPF/CNPJ e Telefone 1");
      return;
    }

    // Validar documento antes de salvar
    const docValido = validateDoc();
    if (!docValido) {
      toast.error(docError || "Documento inválido. Corrija antes de salvar.");
      return;
    }

    setSaving(true);

    // Verificar duplicidade de CPF/CNPJ
    const dupDoc = await checkDuplicateDoc(form.cpf_cnpj, isEditing ? clientId : null);
    if (dupDoc.length > 0) {
      toast.error("Já existe um cliente cadastrado com este CPF/CNPJ. Verifique ou edite o cadastro existente.");
      setSaving(false);
      setDocDuplicate(true);
      setDocError("Já existe um cliente cadastrado com este CPF/CNPJ.");
      return;
    }

    // Verificar duplicidade de Código do cliente (se informado)
    if (form.codigo_cliente) {
      const isDup = await isClientCodeDuplicate(form.codigo_cliente, isEditing ? clientId : null);
      if (isDup) {
        const nextCode = await getNextClientCode(isEditing ? clientId : null);
        toast.error(`Já existe um cliente utilizando este código. Sugestão: ${nextCode}`);
        setNextCodigoSugerido(nextCode);
        setCodigoDuplicate(true);
        setSaving(false);
        return;
      }
    }

    let data = { ...form };

    if (!isEditing) {
      if (!data.codigo_cliente) {
        data.codigo_cliente = await getNextClientCode();
      }
    }

    try {
      if (isEditing) {
        await base44.entities.Client.update(clientId, data);
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await base44.entities.Client.create(data);
        toast.success("Cliente cadastrado com sucesso!");
      }
      navigate("/clientes");
    } catch (err) {
      showError(err, "cliente", "Não foi possível salvar o cadastro do cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    await base44.entities.Client.delete(clientId);
    toast.success("Cliente excluído");
    navigate("/clientes");
  };

  // Placeholder do campo CPF/CNPJ conforme tipo
  const docPlaceholder = form.tipo_perfil === "comum"
    ? "000.000.000-00"
    : form.tipo_perfil === "cnpj"
    ? "00.000.000/0001-00"
    : "CPF ou CNPJ";

  const docLabel = form.tipo_perfil === "comum"
    ? "CPF *"
    : form.tipo_perfil === "cnpj"
    ? "CNPJ *"
    : "CPF/CNPJ *";

  return (
    <div>
      <PageHeader title={isEditing ? "Editar Cliente" : "Novo Cliente"} subtitle="Preencha os dados cadastrais">
        <Button variant="outline" onClick={() => navigate("/clientes")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        {isEditing && (
          <Button variant="outline" onClick={() => setFichaDialog(true)} className="gap-2 text-blue-700 border-blue-300 hover:bg-blue-50">
            <FileText className="w-4 h-4" /> Ficha Cadastral
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </PageHeader>

      <div className="space-y-6 max-w-5xl">
        {/* Status Alerts */}
        {(form.bloqueado || form.pendencia_financeira || form.status_serasa !== "limpo") && (
          <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-red-50 border border-red-200">
            {form.bloqueado && <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">⛔ BLOQUEADO</span>}
            {form.pendencia_financeira && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">⚠ PENDÊNCIA FINANCEIRA</span>}
            {form.status_serasa !== "limpo" && <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">SERASA: {form.status_serasa.toUpperCase()}</span>}
          </div>
        )}

        {/* Score (apenas edição) */}
        {isEditing && clientContracts.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
            <span className="text-sm text-muted-foreground">Score interno:</span>
            <ClientScoreBadge
              score={Math.max(0, Math.min(100, calcularScoreFromContracts(clientContracts) - (form.status_serasa === "negativado" ? 50 : 0)))}
            />
          </div>
        )}

        {/* Tipo de Perfil */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Tipo de Perfil *</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "comum", label: "Cliente Comum (CPF)", icon: "👤" },
                { key: "cnpj", label: "Cliente CNPJ", icon: "🏢" },
                { key: "empreiteiro", label: "Empreiteiro", icon: "🏗" },
              ].map(({ key, label, icon }) => (
                <button key={key} type="button" onClick={() => {
                  update("tipo_perfil", key);
                  update("cpf_cnpj", "");
                  setDocError("");
                  setDocSuccess(false);
                  setCnpjFound(null);
                  setDocDuplicate(false);
                }}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${form.tipo_perfil === key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"}`}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs font-semibold">{label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dados Cadastrais */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Dados Cadastrais</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Código do Cliente" className="">
              <Input
                value={form.codigo_cliente}
                onChange={(e) => handleCodigoChange(e.target.value)}
                placeholder="Gerado automaticamente"
                className={`bg-muted/30 ${codigoDuplicate ? "border-destructive" : ""}`}
              />
              {codigoDuplicate && (
                <div className="mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <p className="font-semibold">⛔ Código já utilizado por outro cliente.</p>
                  {nextCodigoSugerido && (
                    <button
                      type="button"
                      className="mt-1 text-primary underline"
                      onClick={() => { update("codigo_cliente", nextCodigoSugerido); setCodigoDuplicate(false); setNextCodigoSugerido(""); }}
                    >
                      Usar código sugerido: {nextCodigoSugerido}
                    </button>
                  )}
                </div>
              )}
            </FormField>
            <FormField label="Nome/Razão Social *" className="sm:col-span-2">
              <Input value={form.nome_razao_social} onChange={(e) => update("nome_razao_social", e.target.value)} />
            </FormField>
            <FormField label="Fantasia">
              <Input value={form.fantasia} onChange={(e) => update("fantasia", e.target.value)} />
            </FormField>

            {/* Campo CPF/CNPJ com validação */}
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{docLabel}</Label>
              <div className="relative flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={form.cpf_cnpj}
                    onChange={(e) => handleDocChange(e.target.value)}
                    onBlur={validateDoc}
                    placeholder={docPlaceholder}
                    className={`pr-8 ${docError ? "border-destructive" : docSuccess ? "border-emerald-400" : ""}`}
                    maxLength={form.tipo_perfil === "comum" ? 14 : form.tipo_perfil === "cnpj" ? 18 : 18}
                  />
                  {docSuccess && !docError && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-2 top-2.5" />
                  )}
                  {docError && (
                    <AlertCircle className="w-4 h-4 text-destructive absolute right-2 top-2.5" />
                  )}
                </div>
                {/* Botão de consulta CNPJ */}
                {(form.tipo_perfil === "cnpj" || form.tipo_perfil === "empreiteiro") && form.cpf_cnpj.replace(/\D/g, "").length === 14 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => consultarCNPJ(form.cpf_cnpj)}
                    disabled={cnpjLoading}
                    className="gap-1.5 shrink-0"
                    title="Consultar dados do CNPJ"
                  >
                    {cnpjLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    {cnpjLoading ? "Consultando..." : "Atualizar CNPJ"}
                  </Button>
                )}
              </div>
              {docError && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {docError}
                </div>
              )}
              {docDuplicate && !docError && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  CPF já existe no sistema. Verifique se é um cliente duplicado.
                </div>
              )}
              {cnpjFound === true && !docError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Dados preenchidos automaticamente da Receita Federal
                </div>
              )}
              {cnpjFound === false && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5" /> CNPJ não encontrado na base pública. Preencha manualmente.
                </div>
              )}
            </div>

            <FormField label="RG">
              <Input value={form.rg} onChange={(e) => update("rg", e.target.value)} />
            </FormField>
            <FormField label="Data de Nascimento">
              <Input type="date" value={form.data_nascimento} onChange={(e) => update("data_nascimento", e.target.value)} />
            </FormField>
            <FormField label="Inscrição Estadual">
              <Input value={form.inscricao_estadual} onChange={(e) => update("inscricao_estadual", e.target.value)} />
            </FormField>
            <FormField label="Inscrição Municipal">
              <Input value={form.inscricao_municipal} onChange={(e) => update("inscricao_municipal", e.target.value)} />
            </FormField>
            <FormField label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </FormField>

            {/* Empreiteiro */}
            {form.tipo_perfil !== "empreiteiro" && (
              <FormField label="Empreiteiro Responsável" className="sm:col-span-2">
                <Select value={form.empreiteiro_id || "__none__"} onValueChange={(v) => {
                  if (v === "__none__") { update("empreiteiro_id", ""); update("empreiteiro_nome", ""); return; }
                  const emp = empreiteiros.find((e) => e.id === v);
                  update("empreiteiro_id", v);
                  update("empreiteiro_nome", emp?.nome_razao_social || "");
                }}>
                  <SelectTrigger><SelectValue placeholder="Nenhum (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {empreiteiros.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.empreiteiro_nome && <p className="text-xs text-emerald-600 mt-1">✓ {form.empreiteiro_nome}</p>}
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Contatos</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Telefone 1 *"><Input value={form.telefone1} onChange={(e) => update("telefone1", e.target.value)} /></FormField>
            <FormField label="Telefone 2"><Input value={form.telefone2} onChange={(e) => update("telefone2", e.target.value)} /></FormField>
            <FormField label="Telefone 3"><Input value={form.telefone3} onChange={(e) => update("telefone3", e.target.value)} /></FormField>
            <FormField label="Cônjuge/Contato"><Input value={form.conjuge_contato} onChange={(e) => update("conjuge_contato", e.target.value)} /></FormField>
            <FormField label="Sócio"><Input value={form.socio} onChange={(e) => update("socio", e.target.value)} /></FormField>
            <FormField label="CPF do Sócio"><Input value={form.socio_cpf} onChange={(e) => update("socio_cpf", e.target.value)} /></FormField>
            <FormField label="Nome do Pai"><Input value={form.nome_pai} onChange={(e) => update("nome_pai", e.target.value)} /></FormField>
            <FormField label="Nome da Mãe"><Input value={form.nome_mae} onChange={(e) => update("nome_mae", e.target.value)} /></FormField>
          </CardContent>
        </Card>

        {/* Endereço de Entrega */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Endereço Principal / Entrega</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <FormField label="Rua" className="lg:col-span-3"><Input value={form.endereco_entrega_rua} onChange={(e) => update("endereco_entrega_rua", e.target.value)} /></FormField>
            <FormField label="Número"><Input value={form.endereco_entrega_numero} onChange={(e) => update("endereco_entrega_numero", e.target.value)} /></FormField>
            <FormField label="Complemento" className="lg:col-span-2"><Input value={form.endereco_entrega_complemento} onChange={(e) => update("endereco_entrega_complemento", e.target.value)} /></FormField>
            <FormField label="Bairro" className="lg:col-span-2"><Input value={form.endereco_entrega_bairro} onChange={(e) => update("endereco_entrega_bairro", e.target.value)} /></FormField>
            <FormField label="Cidade" className="lg:col-span-2"><Input value={form.endereco_entrega_cidade} onChange={(e) => update("endereco_entrega_cidade", e.target.value)} /></FormField>
            <FormField label="UF"><Input value={form.endereco_entrega_uf} onChange={(e) => update("endereco_entrega_uf", e.target.value)} maxLength={2} /></FormField>
            <FormField label="CEP"><Input value={form.endereco_entrega_cep} onChange={(e) => update("endereco_entrega_cep", e.target.value)} /></FormField>
          </CardContent>
        </Card>

        {/* Endereço de Cobrança */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading">Endereço de Cobrança</CardTitle>
            <Button variant="outline" size="sm" onClick={copyAddressToCobranca} className="text-xs gap-1">Copiar Endereço Principal</Button>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <FormField label="Rua" className="lg:col-span-3"><Input value={form.endereco_cobranca_rua} onChange={(e) => update("endereco_cobranca_rua", e.target.value)} /></FormField>
            <FormField label="Número"><Input value={form.endereco_cobranca_numero} onChange={(e) => update("endereco_cobranca_numero", e.target.value)} /></FormField>
            <FormField label="Complemento" className="lg:col-span-2"><Input value={form.endereco_cobranca_complemento} onChange={(e) => update("endereco_cobranca_complemento", e.target.value)} /></FormField>
            <FormField label="Bairro" className="lg:col-span-2"><Input value={form.endereco_cobranca_bairro} onChange={(e) => update("endereco_cobranca_bairro", e.target.value)} /></FormField>
            <FormField label="Cidade" className="lg:col-span-2"><Input value={form.endereco_cobranca_cidade} onChange={(e) => update("endereco_cobranca_cidade", e.target.value)} /></FormField>
            <FormField label="UF"><Input value={form.endereco_cobranca_uf} onChange={(e) => update("endereco_cobranca_uf", e.target.value)} maxLength={2} /></FormField>
            <FormField label="CEP"><Input value={form.endereco_cobranca_cep} onChange={(e) => update("endereco_cobranca_cep", e.target.value)} /></FormField>
          </CardContent>
        </Card>

        {/* OBRAS */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Obras
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Obras vinculadas a este cliente.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addObra} className="gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar Obra</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {(form.obras || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma obra cadastrada</p>
            )}
            {(form.obras || []).map((obra, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-dashed border-border space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-primary">Obra {idx + 1}</p>
                  <button onClick={() => removeObra(idx)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome da Obra</Label>
                    <Input value={obra.nome_obra || ""} onChange={(e) => updateObra(idx, "nome_obra", e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Responsável</Label>
                    <Input value={obra.responsavel || ""} onChange={(e) => updateObra(idx, "responsavel", e.target.value)} className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Endereço da Obra</Label>
                    <Input value={obra.endereco || ""} onChange={(e) => updateObra(idx, "endereco", e.target.value)} className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Empreiteiro da Obra</Label>
                    <Select value={obra.empreiteiro_id || "__none__"} onValueChange={(v) => {
                      const emp = empreiteiros.find((e) => e.id === v);
                      updateObra(idx, "empreiteiro_id", v === "__none__" ? "" : v);
                      updateObra(idx, "empreiteiro_nome", emp?.nome_razao_social || "");
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar empreiteiro..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {empreiteiros.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold">Pessoas Autorizadas</Label>
                    <button onClick={() => addObraPessoa(idx)} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  {(obra.pessoas_autorizadas || []).map((p, pIdx) => (
                    <div key={pIdx} className="flex gap-2 mb-2 items-center">
                      <Input placeholder="Nome" value={p.nome || ""} onChange={(e) => updateObraPessoa(idx, pIdx, "nome", e.target.value)} className="flex-1" />
                      <Input placeholder="Telefone" value={p.telefone || ""} onChange={(e) => updateObraPessoa(idx, pIdx, "telefone", e.target.value)} className="w-36" />
                      <button onClick={() => removeObraPessoa(idx, pIdx)} className="p-1.5 hover:bg-red-50 rounded-lg"><X className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pessoas Liberadas com validade */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-heading">Pessoas Autorizadas (Geral)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Pessoas liberadas para retirar equipamentos ou assinar documentos</p>
            </div>
            <Button variant="outline" size="sm" onClick={addPessoa} className="gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(form.pessoas_liberadas || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pessoa autorizada cadastrada</p>
            )}
            {(form.pessoas_liberadas || []).map((pessoa, idx) => {
              const statusP = getPessoaStatus(pessoa);
              const statusCfg = statusP ? PESSOA_STATUS_CFG[statusP] : null;
              return (
                <div key={idx} className={`p-3 rounded-xl border space-y-3 ${statusP === "vencido" ? "border-red-200 bg-red-50/40" : statusP === "proximo" ? "border-amber-200 bg-amber-50/40" : "bg-muted/30 border-border"}`}>
                  {/* Status badge + botão remover */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Pessoa {idx + 1}</span>
                      {statusCfg && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      )}
                    </div>
                    <button onClick={() => removePessoa(idx)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Nome Completo</Label>
                      <Input value={pessoa.nome || ""} onChange={(e) => updatePessoa(idx, "nome", e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input value={pessoa.cpf || ""} onChange={(e) => updatePessoa(idx, "cpf", e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input value={pessoa.telefone || ""} onChange={(e) => updatePessoa(idx, "telefone", e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  {/* Prazo de validade */}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Prazo</Label>
                      <Select value={pessoa.prazo || "1a"} onValueChange={(v) => setPessoaPrazo(idx, v)}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRAZOS_PESSOA.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Data de Início</Label>
                      <Input type="date" value={pessoa.data_inicio || ""} onChange={(e) => updatePessoa(idx, "data_inicio", e.target.value)} className="mt-1 h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Data de Vencimento</Label>
                      <Input type="date" value={pessoa.data_vencimento || ""} onChange={(e) => { updatePessoa(idx, "data_vencimento", e.target.value); updatePessoa(idx, "prazo", "manual"); }} className="mt-1 h-8 text-xs" />
                    </div>
                  </div>

                  {statusP === "vencido" && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      ⛔ Esta autorização está vencida — pessoa não pode retirar material nem assinar documentos.
                    </p>
                  )}
                  {statusP === "proximo" && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      ⚠ Autorização próxima do vencimento. Renove em breve.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Etiquetas */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Etiquetas</CardTitle>
            <p className="text-xs text-muted-foreground">Categorize o cliente para facilitar buscas e relatórios</p>
          </CardHeader>
          <CardContent>
            <ClientTagsField
              value={form.etiquetas || []}
              onChange={(tags) => update("etiquetas", tags)}
            />
          </CardContent>
        </Card>

        {/* Validade do Cadastro */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              Validade do Cadastro
              {form.data_validade_cadastro && (() => {
                const status = getStatusValidade(form.data_validade_cadastro);
                const cfg = getValidadeConfig(status);
                return (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status visual */}
            {form.data_validade_cadastro && (() => {
              const status = getStatusValidade(form.data_validade_cadastro);
              const dias = getDiasParaValidade(form.data_validade_cadastro);
              const cfg = getValidadeConfig(status);
              if (status === "vencido") return (
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.color}`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Cadastro Vencido</p>
                    <p className="text-xs mt-0.5">Venceu há {Math.abs(dias)} dia(s). Renove a validade para liberar novas operações (contratos e OS).</p>
                  </div>
                </div>
              );
              if (status === "proximo") return (
                <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.color}`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-sm">Cadastro vence em <strong>{dias} dia(s)</strong>. Renove em breve para evitar bloqueio.</p>
                </div>
              );
              return (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.color}`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <p className="text-sm">Cadastro válido por mais <strong>{dias} dia(s)</strong>.</p>
                </div>
              );
            })()}

            {/* Seleção de período */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Renovar por período</Label>
                <Select value={periodoValidade} onValueChange={(v) => {
                  setPeriodoValidade(v);
                  if (v !== "manual") {
                    update("data_validade_cadastro", calcularDataValidade(v));
                  }
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODOS_VALIDADE.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Data de Validade do Cadastro">
                <Input
                  type="date"
                  value={form.data_validade_cadastro || ""}
                  onChange={(e) => {
                    update("data_validade_cadastro", e.target.value);
                    setPeriodoValidade("manual");
                  }}
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Configurações Financeiras */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-heading">Configurações Financeiras</CardTitle>
            <p className="text-xs text-muted-foreground">Regras de bloqueio automático e faturamento por cliente</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Bloqueio Automático</Label>
                  <Switch checked={!!form.financeiro_bloqueio_automatico} onCheckedChange={(v) => update("financeiro_bloqueio_automatico", v)} />
                </div>
                {form.financeiro_bloqueio_automatico && (
                  <div className="space-y-2">
                    <FormField label="Limite para Bloqueio (R$)">
                      <Input type="number" min={0} value={form.financeiro_limite_bloqueio || ""} onChange={(e) => update("financeiro_limite_bloqueio", parseFloat(e.target.value) || 0)} placeholder="Ex: 500" />
                    </FormField>
                    <FormField label="Dias de Carência">
                      <Input type="number" min={0} value={form.financeiro_dias_carencia || ""} onChange={(e) => update("financeiro_dias_carencia", parseInt(e.target.value) || 0)} placeholder="Ex: 5" />
                    </FormField>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Faturamento Automático</Label>
                  <Switch checked={!!form.financeiro_faturamento_automatico} onCheckedChange={(v) => update("financeiro_faturamento_automatico", v)} />
                </div>
                {form.financeiro_faturamento_automatico && (
                  <FormField label="Intervalo de Faturamento (dias)">
                    <Input type="number" min={1} value={form.financeiro_intervalo_faturamento || 30} onChange={(e) => update("financeiro_intervalo_faturamento", parseInt(e.target.value) || 30)} />
                  </FormField>
                )}
              </div>
            </div>
            <FormField label="Observações Financeiras (histórico interno)">
              <Textarea value={form.financeiro_observacoes || ""} onChange={(e) => update("financeiro_observacoes", e.target.value)} rows={3} placeholder="Ex: acordou pagamento em parcelas, negativado em 01/05, cheque devolvido..." />
            </FormField>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-heading">Status e Observações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <Label className="text-sm">Bloqueado</Label>
                <Switch checked={form.bloqueado} onCheckedChange={(v) => update("bloqueado", v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <Label className="text-sm">Pendência Financeira</Label>
                <Switch checked={form.pendencia_financeira} onCheckedChange={(v) => update("pendencia_financeira", v)} />
              </div>
              <FormField label="Status Serasa">
                <Select value={form.status_serasa} onValueChange={(v) => {
                  const bloqueioAuto = v === "restrito" || v === "negativado";
                  setForm(prev => ({
                    ...prev,
                    status_serasa: v,
                    bloqueado: bloqueioAuto ? true : prev.bloqueado,
                    motivo_bloqueio: bloqueioAuto ? `Bloqueio automático — Serasa ${v}` : prev.motivo_bloqueio,
                  }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limpo">Limpo</SelectItem>
                    <SelectItem value="restrito">Restrito</SelectItem>
                    <SelectItem value="negativado">Negativado</SelectItem>
                  </SelectContent>
                </Select>
                {(form.status_serasa === "restrito" || form.status_serasa === "negativado") && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Cliente bloqueado automaticamente por restrição Serasa
                  </p>
                )}
              </FormField>
            </div>
            {form.bloqueado && (
              <FormField label="Motivo do Bloqueio">
                <Input value={form.motivo_bloqueio || ""} onChange={(e) => update("motivo_bloqueio", e.target.value)} placeholder="Ex: Inadimplência, Serasa restrito..." />
              </FormField>
            )}
            <FormField label="Observações">
              <Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={3} />
            </FormField>
          </CardContent>
        </Card>

        {/* Foto e Documentos (apenas edição) */}
        {isEditing && (
          <ClientDocuments
            clientId={clientId}
            fotoUrl={fotoUrl}
            onFotoChange={setFotoUrl}
          />
        )}

        {/* Ficha Cadastral Dialog */}
        {isEditing && (
          <FichaCadastralDialog
            open={fichaDialog}
            onOpenChange={setFichaDialog}
            client={{ ...form, id: clientId }}
            onClientUpdate={() => {
              // Recarrega o cliente para refletir o novo documento salvo
              base44.entities.Client.filter({ id: clientId }).then(([c]) => {
                if (c) setForm(prev => ({ ...prev, documentos: c.documentos || [] }));
              });
            }}
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pb-8">
          {isEditing ? (
            <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="w-4 h-4" /> Excluir</Button>
          ) : <div />}
          <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}