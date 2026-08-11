import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseKey)

const tableMap: Record<string, string> = {
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
  Feedback: 'feedbacks',
  ActivityLog: 'activity_logs',
  AgentSettings: 'agent_settings',
  CashAutoConfig: 'cash_auto_configs',
  CashRegister: 'cash_registers',
  ClientTag: 'client_tags',
  ConversationState: 'conversation_states',
  Counter: 'counters',
  FluxoIA: 'fluxos_ia',
  IntegraWebhookAWS: 'integra_webhooks_aws',
  Intervention: 'interventions',
  WhatsappLog: 'whatsapp_logs'
}

const getTableName = (entityName: string) => {
  if (tableMap[entityName]) return tableMap[entityName];
  return entityName.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") + "s";
};

const mapLegacyDates = (item: any) => {
  if (!item) return item;
  if (!item.created_date && item.created_at) {
    item.created_date = item.created_at;
  }
  return item;
};

const createAdapter = (tableName: string) => ({
  list: async () => {
    const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapLegacyDates);
  },
  filter: async (filters: any) => {
    let query = supabase.from(tableName).select('*');
    for (const key in filters) {
      query = query.eq(key, filters[key]);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data.map(mapLegacyDates);
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (error) throw error;
    return mapLegacyDates(data);
  },
  create: async (payload: any) => {
    if (payload.id === "") delete payload.id;
    Object.keys(payload).forEach(key => {
      if (key.endsWith('_id') && payload[key] === "") {
        payload[key] = null;
      }
    });
    const { data, error } = await supabase.from(tableName).insert([payload]).select();
    if (error) throw error;
    return mapLegacyDates(data[0]);
  },
  update: async (id: string, payload: any) => {
    if (payload.id === "") delete payload.id;
    Object.keys(payload).forEach(key => {
      if (key.endsWith('_id') && payload[key] === "") {
        payload[key] = null;
      }
    });
    const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select();
    if (error) throw error;
    return mapLegacyDates(data[0]);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
});

class MockAPI {
  entities: any = new Proxy({}, {
    get: (target: any, prop: string) => {
      if (!target[prop]) {
        target[prop] = createAdapter(getTableName(prop));
      }
      return target[prop];
    }
  });
}

export function createClientFromRequest(req: Request) {
  const api = new MockAPI();
  return {
    asServiceRole: api,
    api: api
  };
}
