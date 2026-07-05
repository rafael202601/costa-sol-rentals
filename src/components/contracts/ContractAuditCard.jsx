import { format } from "date-fns";

export default function ContractAuditCard({ contract }) {
  const hasData = contract.solicitante_nome || contract.criado_por || contract.created_date ||
    contract.editado_por || contract.motorista_entrega || contract.veiculo_entrega ||
    contract.motorista_recolha || contract.assinatura_data || contract.obra_nome;

  if (!hasData) return null;

  const criadoEmStr = contract.created_date
    ? (() => {
        try { return format(new Date(contract.created_date), "dd/MM/yyyy 'às' HH:mm"); }
        catch { return contract.created_date; }
      })()
    : null;

  return (
    <div className="flex flex-wrap gap-6 text-sm">
      {contract.solicitante_nome && (
        <div>
          <p className="text-xs text-muted-foreground">Solicitante</p>
          <p className="font-medium">{contract.solicitante_nome}
            {contract.solicitante_tipo && contract.solicitante_tipo !== "cliente" && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({contract.solicitante_tipo === "empreiteiro" ? "Empreiteiro" : "Pessoa Autorizada"})
              </span>
            )}
          </p>
        </div>
      )}
      {contract.obra_nome && (
        <div>
          <p className="text-xs text-muted-foreground">Obra</p>
          <p className="font-medium">{contract.obra_nome}</p>
          {contract.obra_endereco && <p className="text-xs text-muted-foreground">{contract.obra_endereco}</p>}
        </div>
      )}
      {contract.criado_por && (
        <div>
          <p className="text-xs text-muted-foreground">Criado por</p>
          <p className="font-medium">{contract.criado_por}</p>
        </div>
      )}
      {criadoEmStr && (
        <div>
          <p className="text-xs text-muted-foreground">Criado em</p>
          <p className="font-medium">{criadoEmStr}</p>
        </div>
      )}
      {contract.editado_por && (
        <div>
          <p className="text-xs text-muted-foreground">Última edição por</p>
          <p className="font-medium">{contract.editado_por}</p>
        </div>
      )}
      {contract.motorista_entrega && (
        <div>
          <p className="text-xs text-muted-foreground">Motorista de Entrega</p>
          <p className="font-medium">{contract.motorista_entrega}</p>
          {(contract.data_entrega_real || contract.data_confirmacao_entrega) && (
            <p className="text-xs text-emerald-700 mt-0.5 font-medium">
              ✓ {contract.data_entrega_real || contract.data_confirmacao_entrega}
            </p>
          )}
        </div>
      )}
      {contract.veiculo_entrega && (
        <div>
          <p className="text-xs text-muted-foreground">Veículo de Entrega</p>
          <p className="font-medium font-mono">{contract.veiculo_entrega}</p>
        </div>
      )}
      {contract.motorista_recolha && (
        <div>
          <p className="text-xs text-muted-foreground">Motorista de Recolha</p>
          <p className="font-medium">{contract.motorista_recolha}</p>
          {contract.data_recolha_real && (
            <p className="text-xs text-amber-700 mt-0.5 font-medium">
              ✓ {contract.data_recolha_real}
            </p>
          )}
        </div>
      )}
      {contract.assinatura_data && (
        <div>
          <p className="text-xs text-muted-foreground">Assinado pelo cliente em</p>
          <p className="font-medium text-emerald-700">✓ {contract.assinatura_data}</p>
        </div>
      )}
    </div>
  );
}