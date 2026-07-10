const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:R@Kjkh2026Rty@db.sotluugxlslvmhfmoidm.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    
    console.log("Connected. Dropping tables...");
    
    // Drop in reverse order of dependencies
    await client.query(`
      DROP TABLE IF EXISTS public.announcements CASCADE;
      DROP TABLE IF EXISTS public.drivers CASCADE;
      DROP TABLE IF EXISTS public.products CASCADE;
      DROP TABLE IF EXISTS public.equipment CASCADE;
      DROP TABLE IF EXISTS public.contracts CASCADE;
      DROP TABLE IF EXISTS public.sales CASCADE;
      DROP TABLE IF EXISTS public.service_orders CASCADE;
      DROP TABLE IF EXISTS public.vehicles CASCADE;
      DROP TABLE IF EXISTS public.clients CASCADE;
    `);

    console.log("Creating clients...");
    await client.query(`
      create table public.clients (
        id uuid primary key default uuid_generate_v4(),
        codigo_cliente text,
        tipo_perfil text default 'comum',
        nome_razao_social text,
        fantasia text,
        cpf_cnpj text,
        inscricao_estadual text,
        inscricao_municipal text,
        rg text,
        data_nascimento text,
        email text,
        telefone1 text,
        telefone2 text,
        telefone3 text,
        conjuge_contato text,
        socio text,
        socio_cpf text,
        nome_pai text,
        nome_mae text,
        empreiteiro_id text,
        empreiteiro_nome text,
        obras jsonb default '[]'::jsonb,
        endereco_entrega_rua text,
        endereco_entrega_numero text,
        endereco_entrega_complemento text,
        endereco_entrega_bairro text,
        endereco_entrega_cidade text,
        endereco_entrega_uf text,
        endereco_entrega_cep text,
        endereco_cobranca_rua text,
        endereco_cobranca_numero text,
        endereco_cobranca_complemento text,
        endereco_cobranca_bairro text,
        endereco_cobranca_cidade text,
        endereco_cobranca_uf text,
        endereco_cobranca_cep text,
        pessoas_liberadas jsonb default '[]'::jsonb,
        etiquetas jsonb default '[]'::jsonb,
        data_validade_cadastro text,
        bloqueado boolean default false,
        pendencia_financeira boolean default false,
        status_serasa text default 'limpo',
        observacoes text,
        motivo_bloqueio text,
        financeiro_bloqueio_automatico boolean default false,
        financeiro_limite_bloqueio numeric default 0,
        financeiro_dias_carencia numeric default 0,
        financeiro_faturamento_automatico boolean default false,
        financeiro_intervalo_faturamento numeric default 30,
        financeiro_observacoes text,
        foto_url text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.clients enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.clients for all to authenticated using (true);
    `);

    console.log("Creating contracts...");
    await client.query(`
      create table public.contracts (
        id uuid primary key default uuid_generate_v4(),
        numero text,
        client_id uuid references public.clients(id) on delete set null,
        client_nome text,
        data_inicio text,
        sem_prazo boolean,
        prazo_tipo text,
        prazo_valor numeric,
        data_prevista_termino text,
        solicitante_nome text,
        solicitante_tipo text,
        obra_nome text,
        obra_endereco text,
        itens jsonb default '[]'::jsonb,
        frete text,
        sinal text,
        valor_total numeric,
        valor_pago text,
        saldo_pagar numeric,
        status text,
        status_financeiro text,
        endereco_entrega text,
        observacoes text,
        tipo_entrega text,
        codigo_contrato text,
        data_fim date,
        data_recolha date,
        motorista_entrega text,
        veiculo_entrega text,
        assinatura_data timestamp with time zone,
        fotos jsonb default '[]'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.contracts enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.contracts for all to authenticated using (true);
    `);

    console.log("Creating equipment...");
    await client.query(`
      create table public.equipment (
        id uuid primary key default uuid_generate_v4(),
        nome text,
        marca text,
        modelo text,
        tipos jsonb default '["equipamento"]'::jsonb,
        voltagem text,
        codigo text,
        foto_url text,
        link_externo text,
        quantidade_total numeric,
        quantidade_disponivel numeric,
        quantidade_manutencao numeric,
        status_item text,
        valor_diario numeric,
        valor_mensal numeric,
        valor_indenizacao numeric,
        descricao text,
        ativo boolean default true,
        aplica_valor_minimo boolean,
        dias_minimos_proprio numeric,
        aplica_desconto_automatico boolean,
        controle_individual boolean,
        numeracoes jsonb default '[]'::jsonb,
        categoria text,
        valor_locacao numeric,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.equipment enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.equipment for all to authenticated using (true);
    `);

    console.log("Creating products...");
    await client.query(`
      create table public.products (
        id uuid primary key default uuid_generate_v4(),
        nome text,
        codigo text,
        codigo_barras text,
        categoria text,
        marca text,
        modelo text,
        custo numeric,
        margem numeric,
        valor_venda numeric,
        estoque_atual numeric,
        estoque_minimo numeric,
        unidade text,
        descricao text,
        ativo boolean default true,
        preco numeric,
        estoque integer,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.products enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.products for all to authenticated using (true);
    `);

    console.log("Creating drivers...");
    await client.query(`
      create table public.drivers (
        id uuid primary key default uuid_generate_v4(),
        nome text,
        email text,
        telefone text,
        cnh text,
        veiculo text,
        placa text,
        cor text,
        status text default 'ativo',
        observacoes text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.drivers enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.drivers for all to authenticated using (true);
    `);

    console.log("Creating announcements...");
    await client.query(`
      create table public.announcements (
        id uuid primary key default uuid_generate_v4(),
        titulo text,
        descricao text,
        imagem_url text,
        categoria text,
        prioridade text,
        status text,
        data text,
        data_inicio text,
        data_fim text,
        hora_publicacao text,
        ativo boolean,
        destaque boolean,
        fixado boolean,
        exibir_portal boolean,
        setor_destino text,
        responsavel text,
        anexos jsonb default '[]'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.announcements enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.announcements for all to authenticated using (true);
    `);

    // Add vehicles, sales, service_orders just with jsonb fallback or standard basic to not break
    await client.query(`
      create table public.vehicles (
        id uuid primary key default uuid_generate_v4(),
        placa text,
        modelo text,
        marca text,
        ano text,
        km_atual text,
        status text default 'ativo',
        chassi text,
        renavam text,
        tipo text,
        combustivel text,
        capacidade_carga text,
        observacoes text,
        foto_url text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.vehicles enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.vehicles for all to authenticated using (true);
    `);

    await client.query(`
      create table public.sales (
        id uuid primary key default uuid_generate_v4(),
        client_id uuid references public.clients(id) on delete set null,
        client_nome text,
        data_venda text,
        itens jsonb default '[]'::jsonb,
        valor_total numeric,
        valor_desconto numeric,
        valor_final numeric,
        forma_pagamento text,
        status text,
        observacoes text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.sales enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.sales for all to authenticated using (true);
    `);

    await client.query(`
      create table public.service_orders (
        id uuid primary key default uuid_generate_v4(),
        client_id uuid references public.clients(id) on delete set null,
        client_nome text,
        os_origem_id uuid references public.service_orders(id),
        status text,
        tipo text,
        data_agendada text,
        data_conclusao text,
        motorista_entrega text,
        veiculo_entrega text,
        fotos jsonb default '[]'::jsonb,
        itens jsonb default '[]'::jsonb,
        status_pagamento text,
        valor_total numeric,
        observacoes text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
      alter table public.service_orders enable row level security;
      create policy "Permitir tudo para usuários autenticados" on public.service_orders for all to authenticated using (true);
    `);
    
    console.log("Done.");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
