// No credentials belong in this file. Only a publishable key may be configured.
export function ready(c) {
  return c.enabled === true && /^sb_publishable_[A-Za-z0-9_-]+$/.test(c.publishableKey || '')
    && /^[a-f0-9-]{36}$/i.test(c.clientId || '') && c.siteUrl === 'https://johan-ultra-coaching.github.io/'
    && validRedirect(c.redirectUri);
}
export function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(value); }
export function validRedirect(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.hash; } catch { return false; }
}
export function validateDetails(d, aid, c) {
  return !!d && d.authorization_id === aid && d.client?.id === c.clientId
    && d.redirect_uri === c.redirectUri && validRedirect(d.redirect_uri)
    && typeof d.scope === 'string' && d.scope.split(/\s+/).filter(Boolean).every(x => ['openid','email','offline_access'].includes(x));
}
export function validateResult(value, c) {
  if (!validRedirect(value) || !validRedirect(c.redirectUri)) return false;
  const u = new URL(value), expected = new URL(c.redirectUri);
  if (u.origin !== expected.origin || u.pathname !== expected.pathname) return false;
  for (const [k,v] of expected.searchParams) if (u.searchParams.get(k) !== v) return false;
  const allowed = new Set([...expected.searchParams.keys(), 'code','state','error','error_description','iss']);
  return [...u.searchParams.keys()].every(k => allowed.has(k))
    && ['code','state','error','error_description','iss'].every(k => u.searchParams.getAll(k).length <= 1)
    && (!!u.searchParams.get('code') !== !!u.searchParams.get('error'));
}
export async function decision({supabase, aid, config, approved, explicitlyClicked}) {
  if (!explicitlyClicked || !ready(config) || !validId(aid)) throw new Error('BLOCKED');
  const user = await supabase.auth.getUser();
  if (user.error || !user.data?.user || user.data.user.is_anonymous) throw new Error('BLOCKED');
  const details = await supabase.auth.oauth.getAuthorizationDetails(aid);
  if (details.error || !validateDetails(details.data, aid, config)) throw new Error('BLOCKED');
  const answer = approved === true
    ? await supabase.auth.oauth.approveAuthorization(aid, {skipBrowserRedirect:true})
    : await supabase.auth.oauth.denyAuthorization(aid, {skipBrowserRedirect:true});
  if (answer.error || !validateResult(answer.data?.redirect_url, config)) throw new Error('BLOCKED');
  return answer.data.redirect_url;
}
