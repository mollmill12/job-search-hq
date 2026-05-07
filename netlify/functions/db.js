const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { table, id } = event.queryStringParameters || {};
  const method = event.httpMethod;

  const VALID_TABLES = ['jobs', 'contacts', 'follow_ups', 'interviews', 'sync_log'];
  if (!VALID_TABLES.includes(table)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid table: ${table}` }) };
  }

  try {
    if (method === 'GET') {
      let query = supabase.from(table).select('*');
      if (table === 'jobs') query = query.order('date_added', { ascending: false });
      if (table === 'follow_ups') query = query.order('due_date', { ascending: true });
      if (table === 'interviews') query = query.order('date', { ascending: false });
      if (table === 'sync_log') query = query.order('synced_at', { ascending: false }).limit(5);
      if (id) query = query.eq('id', id).single();
      const { data, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.id) body.id = Date.now();
      const { data, error } = await supabase.from(table).insert(body).select().single();
      if (error) throw error;
      return { statusCode: 201, headers, body: JSON.stringify(data) };
    }
    if (method === 'PUT') {
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      const body = JSON.parse(event.body || '{}');
      body.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from(table).update(body).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }
    if (method === 'DELETE') {
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id required' }) };
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
    }
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};