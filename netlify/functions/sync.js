const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Refresh Google access token if expired
async function getValidAccessToken() {
  const { data: tokenRow } = await supabase.from('google_tokens').select('*').eq('id', 1).single();
  if (!tokenRow) throw new Error('Not authenticated — please connect Google account first');

  const isExpired = !tokenRow.expiry || new Date(tokenRow.expiry) < new Date(Date.now() + 60000);

  if (!isExpired) return tokenRow.access_token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await res.json();
  if (newTokens.error) throw new Error('Token refresh failed: ' + newTokens.error);

  const expiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
  await supabase.from('google_tokens').update({ access_token: newTokens.access_token, expiry, updated_at: new Date().toISOString() }).eq('id', 1);
  return newTokens.access_token;
}

ae function fetchGmailThreads(accessToken, companies) {
  const query = companies.join(' OR ') + ' newer_than:30d';
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!data.threads) return [];
  const threads = [];
  for (const t of (data.threads || []).slice(0, 20)) {
    const tRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{ headers: { Authorization: `Bearer ${accessToken}` } });
    const tData = await tRes.json();
    if (tData.messages) {
      const lastMsg = tData.messages[tData.messages.length - 1];
      const headers = {};
      (lastMsg.payload?.headers || []).forEach(h => { headers[h.name.toLowerCase()] = h.value; });
      threads.push({ id: t.id, subject: headers['subject'] || '', from: headers['from'] || '', date: headers['date'] || '', snippet: lastMsg.snippet || '' });
    }
  }
  return threads;
}

async function fetchCalendarEvents(accessToken, companies) {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&maxResults=50&singleEvents=true&orderBy=startTime`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  const companyTerms = companies.map(c => c.toLowerCase());
  return (data.items || []).filter(event => {
    const text = ((event.summary || '') + ' ' + (event.description || '')).toLowerCase();
    return companyTerms.some(c => text.includes(c));
  }).map(event => ({ id: event.id, summary: event.summary || '', start: event.start?.dateTime || event.start?.date || '', end: event.end?.dateTime || event.end?.date || '', description: event.description || '', attendees: (event.attendees || []).map(a => a.email) }));
}

async function analyzeWithClaude(jobs, threads, events) {
  const jobSummary = jobs.map(j => `- ${j.company} (${j.title || 'TBD'}) — Status: ${j.status}`).join('\n');
  const emailSummary = threads.slice(0, 15).map(t => `From: ${t.from} | Subject: ${t.subject} | Date: ${t.date}\nSnippet: ${t.snippet}`).join('\n---\n');
  const calSummary = events.map(e => `Event: ${e.summary} | Start: ${e.start} | Attendees: ${e.attendees.join(', ')}`).join('\n');
  const prompt = `You are a job search assistant. Analyze these emails/events and identify CRM updates.\n\nJOBS:\n${jobSummary}\n\nEMAILS:\n${emailSummary || 'None'}\n\nCALENDAR:\n${calSummary || 'None'}\n\nRespond ONLY with JSON: {"updates":[],"summary":"string"}`;
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]})});
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return { updates: [], summary: 'Could not parse AI analysis.' }; }
}

ae function applyUpdates(jobs, analysis) {
  const applied = [];
  for (const update of analysis.updates) {
    const job = jobs.find(j => j.company.toLowerCase() === update.company.toLowerCase());
    if (!job) continue;
    try {
      if (update.field === 'status') { await supabase.from('jobs').update({ status: update.new_value, updated_at: new Date().toISOString() }).eq('id', job.id); applied.push(`${job.company}: status → ${update.new_value}`); }
      if (update.field === 'notes') { const newNotes = job.notes ? job.notes + '\n\n[Auto-sync ' + new Date().toLocaleDateString() + '] ' + update.new_value : update.new_value; await supabase.from('jobs').update({ notes: newNotes, updated_at: new Date().toISOString() }).eq('id', job.id); applied.push(`${job.company}: notes updated`); }
      if (update.field === 'new_interview') { const parts = update.new_value.split('|'); await supabase.from('interviews').insert({ id: Date.now()+Math.floor(Math.random()*1000), job_id: job.id, round: parts[0]||'Interview', date: parts[1]||new Date().toISOString().split('T')[0], notes: parts[2]||update.reason, outcome: 'Pending' }); applied.push(`${job.company}: new interview logged`); }
      if (update.field === 'new_followup') { const dueDate = new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0]; await supabase.from('follow_ups').insert({ id: Date.now()+Math.floor(Math.random()*1000), job_id: job.id, text: update.new_value, due_date: dueDate, done: false }); applied.push(`${job.company}: new follow-up added`); }
    } catch(err) { console.error('Failed update:', err); }
  }
  return applied;
}

exports.handler = async (event) => {
  const headers = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const { data: jobs } = await supabase.from('jobs').select('*');
    if (!jobs || jobs.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ message: 'No jobs' }) };
    const companies = jobs.map(j => j.company);
    let accessToken;
    try { accessToken = await getValidAccessToken(); }
    catch (err) { return { statusCode: 200, headers, body: JSON.stringify({ message: 'Not authenticated', needsAuth: true, authUrl: '/.netlify/functions/auth-start' }) }; }
    const [threads, events] = await Promise.all([fetchGmailThreads(accessToken, companies), fetchCalendarEvents(accessToken, companies)]);
    const analysis = await analyzeWithClaude(jobs, threads, events);
    const applied = await applyUpdates(jobs, analysis);
    await supabase.from('sync_log').insert({ synced_at: new Date().toISOString(), emails_processed: threads.length, events_processed: events.length, updates_made: applied, error: null });
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, emailsProcessed: threads.length, eventsProcessed: events.length, updatesApplied: applied, summary: analysis.summary, pendingUpdates: analysis.updates }) };
  } catch (err) {
    await supabase.from('sync_log').insert({ synced_at: new Date().toISOString(), emails_processed: 0, events_processed: 0, updates_made: [], error: err.message }).catch(()=>{});
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};