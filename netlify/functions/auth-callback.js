const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
exports.handler = async (event) => {
  const { code, error } = event.queryStringParameters || {};
  if (error) return { statusCode: 302, headers: { Location: '/?auth=error&reason='+error }, body: '' };
  if (!code) return { statusCode: 302, headers: { Location: '/?auth=error&reason=no_code' }, body: '' };
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://molliejobs.netlify.app/.netlify/functions/auth-callback';
    const tokenRes = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})});
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description);
    const expiry = new Date(Date.now()+tokens.expires_in*1000).toISOString();
    await supabase.from('google_tokens').upsert({id:1,access_token:tokens.access_token,refresh_token:tokens.refresh_token||null,expiry,updated_at:new Date().toISOString()});
    return { statusCode: 302, headers: { Location: '/?auth=success' }, body: '' };
  } catch (err) {
    return { statusCode: 302, headers: { Location: '/?auth=error&reason='+encodeURIComponent(err.message) }, body: '' };
  }
};