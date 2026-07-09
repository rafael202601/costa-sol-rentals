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
  
  return {
    list: async (orderBy, limit) => {
      let query = supabase.from(tableName).select('*');
      
      if (orderBy) {
        const desc = orderBy.startsWith('-');
        const col = desc ? orderBy.substring(1) : orderBy;
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
      return data;
    },
    
    filter: async (filters) => {
      let query = supabase.from(tableName).select('*');
      
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      
      const { data, error } = await query;
      if (error) {
        console.warn(`Erro no adapter filter para ${tableName}:`, error);
        return [];
      }
      return data;
    },
    
    create: async (payload) => {
      const { data, error } = await supabase.from(tableName).insert([payload]).select();
      if (error) {
        console.error("ERRO SUPABASE INSERT:", error);
        throw new Error(`[ERRO SUPABASE] ${error.message || JSON.stringify(error)}`);
      }
      return data[0];
    },
    
    update: async (id, payload) => {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select();
      if (error) {
        console.error("ERRO SUPABASE UPDATE:", error);
        throw new Error(`[ERRO SUPABASE] ${error.message || JSON.stringify(error)}`);
      }
      return data[0];
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
      return { data: {} };
    }
  }
};
