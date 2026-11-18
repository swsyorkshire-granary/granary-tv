// Granary TV: sign a TV in from a phone/iPad that is already signed in.
//   TV:    {action:"start"}        → {code}            (code valid 10 minutes)
//   Phone: {action:"approve",code} + Authorization: Bearer <phone's session token>
//          → creates a one-time sign-in token for that same account and attaches it to the code
//   TV:    {action:"poll",code}    → {waiting} | {expired} | {email, token_hash}  (row deleted once collected)
// The TV then calls supabase.auth.verifyOtp({ token_hash, type: "magiclink" }) to get its own session.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';          // no 0/O/1/I/L to avoid mix-ups
const newCode = () => { const b = crypto.getRandomValues(new Uint8Array(6)); return Array.from(b, x => ALPHABET[x % ALPHABET.length]).join(''); };
const clean = (c: unknown) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const now = new Date();
  await admin.from('tv_pairings').delete().lt('expires_at', now.toISOString());   // tidy up old codes

  if (body.action === 'start') {
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { error } = await admin.from('tv_pairings').insert({ code });
      if (!error) return json({ code, expiresIn: 600 });
    }
    return json({ error: 'Could not make a code, please try again' }, 500);
  }

  const code = clean(body.code);
  if (code.length !== 6) return json({ error: 'That code should be 6 letters and numbers' }, 400);
  const { data: row } = await admin.from('tv_pairings').select('*').eq('code', code).maybeSingle();
  if (!row || new Date(row.expires_at) < now) return json({ expired: true, error: 'That code has expired or doesn’t exist – show a new one on the TV' }, 404);

  if (body.action === 'poll') {
    if (!row.token_hash) return json({ waiting: true });
    await admin.from('tv_pairings').delete().eq('code', code);                       // one use only
    return json({ email: row.email, token_hash: row.token_hash });
  }

  if (body.action === 'approve') {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u?.user?.email) return json({ error: 'Please sign in on this phone first' }, 401);
    if (row.token_hash) return json({ error: 'That code has already been used' }, 409);
    const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
    const token_hash = (link as any)?.properties?.hashed_token;
    if (le || !token_hash) return json({ error: 'Could not create the TV sign-in: ' + (le?.message || 'unknown') }, 500);
    await admin.from('tv_pairings').update({ email: u.user.email, token_hash, approved_at: now.toISOString() }).eq('code', code);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
