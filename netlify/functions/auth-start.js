exports.handler = async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://molliejobs.netlify.app/.netlify/functions/auth-callback';
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/calendar.readonly'].join(' ');
  const params = new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:scopes,azcess_type:'offline',prompt:'consent'});
  return { statusCode: 302, headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, body: '' };
};