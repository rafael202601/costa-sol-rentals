import { supabase, uploadFile } from './supabaseClient';

// Mapeamento de Entidades do Base44 (PascalCase) para as Tabelas do Supabase (snake_case no plural)
const tableMap = {
  CompanySettings: 'company_settings',
  User: 'users',
  Client: 'clients',
  Vehicle: 'vehicles',
  VehicleExpense: 'vehicle_expenses',
  Equipment: 'equipment',
  Contract: 'contracts',
  ServiceOrder: 'service_orders',
  Sale: 'sales',
  Product: 'products',
  Driver: 'drivers',
  Task: 'tasks',
  MuralPost: 'mural_posts',
  PaymentRequest: 'payment_requests',
  Quote: 'quotes',
  CashEntry: 'cash_entries',
  BillingNote: 'billing_notes',
  Announcement: 'announcements',
  Feedback: 'feedbacks'
};

const getTableName = (entityName) => {
  if (tableMap[entityName]) return tableMap[entityName];
  // Fallback: converte PascalCase para snake_case
  return entityName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") + "s";
};

// Adaptador para simular as queries do Base44 no Supabase
function createEntityAdapter(entityName) {
  const tableName = getTableName(entityName);
  
  const mapLegacyDates = (item) => {
    if (!item) return item;
    if (!item.created_date && item.created_at) {
      item.created_date = item.created_at;
    }
    return item;
  };

  return {
    list: async (orderBy, limit) => {
      let query = supabase.from(tableName).select('*');
      
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        let col = desc ? orderBy.substring(1) : orderBy;
        
        // Tradução de order by legado
        if (col === 'created_date') col = 'created_at';
        
        query = query.order(col, { ascending: !desc });
      }
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      if (error) {
        console.warn(`Erro no adapter list para ${tableName}:`, error);
        return [];
      }
      return data.map(mapLegacyDates);
    },
    
    filter: async (filters, orderBy, limit) => {
      let query = supabase.from(tableName).select('*');
      
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        let col = desc ? orderBy.substring(1) : orderBy;
        if (col === 'created_date') col = 'created_at';
        query = query.order(col, { ascending: !desc });
      }
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      if (error) {
        console.warn(`Erro no adapter filter para ${tableName}:`, error);
        return [];
      }
      return data.map(mapLegacyDates);
    },
    
    create: async (payload) => {
      const { data, error } = await supabase.from(tableName).insert([payload]).select();
      if (error) {
        console.error("ERRO SUPABASE INSERT:", error);
        throw new Error(`[ERRO SUPABASE] ${error.message || JSON.stringify(error)}`);
      }
      return mapLegacyDates(data[0]);
    },
    
    update: async (id, payload) => {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select();
      if (error) {
        console.error("ERRO SUPABASE UPDATE:", error);
        throw new Error(`[ERRO SUPABASE] ${error.message || JSON.stringify(error)}`);
      }
      return mapLegacyDates(data[0]);
    },
    
    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  };
}

// Proxies dynamically create adapters for any entity requested
const entitiesProxy = new Proxy({}, {
  get: (target, prop) => {
    if (!target[prop]) {
      target[prop] = createEntityAdapter(prop);
    }
    return target[prop];
  }
});

// Mock user actions
const usersMock = {
  inviteUser: async (email, role) => {
    console.log("Mock Invite user:", email, role);
    return true;
  }
};

export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Não autenticado");
      
      try {
        const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        if (profile) {
          return { ...data.user, ...profile };
        }
      } catch (err) {
        // Ignora erro se a tabela users não existir ou não achar o perfil
      }
      
      // Fallback: se não tiver perfil, concede admin para não travar o sistema
      return { ...data.user, role: 'admin', full_name: data.user.email };
    },
    logout: async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    }
  },
  integrations: {
    Core: {
      UploadFile: uploadFile
    }
  },
  users: usersMock,
  functions: {
    invoke: async (funcName, payload) => {
      if (funcName === "countClients") {
        const { count, error } = await supabase.from('clients').select('*', { count: 'exact', head: true });
        if (error) console.warn("Error counting clients:", error);
        return { data: { total: count || 0 } };
      }
      
      if (funcName === "searchClients") {
        const { query = "", field = "todos", tipo = "todos", sort = "recentes", page = 1, page_size = 50 } = payload || {};
        
        let dbQuery = supabase.from('clients').select('*', { count: 'exact' });
        
        // Filter by tipo
        if (tipo !== "todos") {
          dbQuery = dbQuery.eq('tipo_perfil', tipo);
        }
        
        // Search query
        if (query.trim()) {
          if (field === "todos") {
            dbQuery = dbQuery.or(`nome_razao_social.ilike.%${query}%,codigo_cliente.ilike.%${query}%,cpf_cnpj.ilike.%${query}%,fantasia.ilike.%${query}%`);
          } else {
            // Se for um field específico de json (obras, pessoas_liberadas) fica mais complexo, 
            // mas pro text normal podemos usar ilike
            if (["obras", "pessoas_liberadas", "etiquetas"].includes(field)) {
              // fallback simples se for json
              dbQuery = dbQuery.textSearch(field, query); // ou ignore para não quebrar
            } else {
              dbQuery = dbQuery.ilike(field, `%${query}%`);
            }
          }
        }
        
        // Sort
        if (sort === "recentes") dbQuery = dbQuery.order('created_at', { ascending: false });
        else if (sort === "antigos") dbQuery = dbQuery.order('created_at', { ascending: true });
        else if (sort === "a-z") dbQuery = dbQuery.order('nome_razao_social', { ascending: true });
        else if (sort === "z-a") dbQuery = dbQuery.order('nome_razao_social', { ascending: false });
        
        // Pagination
        const from = (page - 1) * page_size;
        const to = from + page_size - 1;
        dbQuery = dbQuery.range(from, to);
        
        const { data, count, error } = await dbQuery;
        if (error) {
          console.error("Error searchClients:", error);
          return { data: { items: [], total: 0, totalPages: 1 } };
        }
        
        return { 
          data: { 
            items: data || [], 
            total: count || 0, 
            totalPages: Math.ceil((count || 0) / page_size) || 1 
          } 
        };
      }

      if (funcName === "generateSequentialCode") {
        const { tipo } = payload || {};
        try {
          if (tipo === "client_code") {
            const { data, error } = await supabase.from('clients')
              .select('codigo_cliente')
              .not('codigo_cliente', 'is', null);
            
            if (error) throw error;
            let maxCode = 20000;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.codigo_cliente) {
                  const num = parseInt(row.codigo_cliente.replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            return { data: { numero: maxCode + 1 } };
          }
          
          if (tipo === "contrato") {
            const { data, error } = await supabase.from('contracts')
              .select('numero')
              .not('numero', 'is', null);
              
            if (error) throw error;
            let maxCode = 1000;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.numero) {
                  const num = parseInt(String(row.numero).replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            return { data: { numero: maxCode + 1 } };
          }
          
          if (tipo === "os") {
            const { data, error } = await supabase.from('service_orders')
              .select('codigo_os')
              .not('codigo_os', 'is', null)
              .catch(() => ({ data: [] })); // fallbacks
              
            let maxCode = 1000;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.codigo_os) {
                  const num = parseInt(String(row.codigo_os).replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            // Retorna algo parecido com CB1001
            return { data: { numero: `CB${maxCode + 1}` } };
          }

          if (tipo === "orcamento") {
            const { data, error } = await supabase.from('quotes')
              .select('numero')
              .not('numero', 'is', null)
              .catch(() => ({ data: [] }));

            let maxCode = 2000;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.numero) {
                  const num = parseInt(String(row.numero).replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            return { data: { numero: String(maxCode + 1) } };
          }

          if (tipo === "venda") {
            const { data, error } = await supabase.from('sales')
              .select('numero')
              .not('numero', 'is', null)
              .catch(() => ({ data: [] }));

            let maxCode = 0;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.numero) {
                  const num = parseInt(String(row.numero).replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            return { data: { numero: `V-${String(maxCode + 1).padStart(4, "0")}` } };
          }

          if (tipo === "fatura") {
            const { data, error } = await supabase.from('billing_notes')
              .select('numero')
              .not('numero', 'is', null)
              .catch(() => ({ data: [] }));

            let maxCode = 0;
            if (data && data.length > 0) {
              for (const row of data) {
                if (row.numero) {
                  const num = parseInt(String(row.numero).replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > maxCode) maxCode = num;
                }
              }
            }
            return { data: { numero: `FT${String(maxCode + 1).padStart(3, "0")}` } };
          }
        } catch (e) {
          console.error("Error generating sequential code:", e);
        }
        // Fallback default numbers
        return { data: { numero: tipo === "client_code" ? 20001 : (tipo === "contrato" ? 1001 : "CB1001") } };
      }

      return { data: {} };
    }
  }
};
