import {config} from './config.mjs';
import {ready,validId,validateDetails,decision} from './consent.mjs';
import {transientStorage} from './storage.mjs';
const $=id=>document.getElementById(id);
const message=text=>{$('status').textContent=text;};
const pendingKey='uc-pending-authorization';
const base='https://zgfbbxcnmiwojkykrhuw.supabase.co';
let busy=false;
function closeConsent(){$('consent').hidden=true;}
function fail(){closeConsent();message('De aanvraag is veilig geblokkeerd. Er is geen toestemming verleend. Start opnieuw vanuit je coachingkoppeling.');}
async function exclusive(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn();}catch{fail();}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;}}
async function main(){
 if(!ready(config)){message('Veilig geblokkeerd: de vaste OAuth-client en Supabase-aanmeldinstellingen zijn nog niet volledig ingesteld. Er is geen toestemming verleend.');return;}
 if(location.origin!==new URL(config.siteUrl).origin||location.protocol!=='https:'){fail();return;}
 const query=new URLSearchParams(location.search);
 let aid=query.get('authorization_id');
 if(aid){if(!validId(aid)){fail();return;}localStorage.setItem(pendingKey,JSON.stringify({aid,expires:Date.now()+600000}));}
 else {try{const pending=JSON.parse(localStorage.getItem(pendingKey)||'null');if(pending?.expires>Date.now())aid=pending.aid;}catch{}}
 if(!validId(aid)){localStorage.removeItem(pendingKey);message('Geen geldige toestemmingsaanvraag. Start de aanmelding vanuit je coachingkoppeling.');return;}
 const {AuthClient}=await import('./auth-sdk.mjs');
 const auth=new AuthClient({url:base+'/auth/v1',headers:{apikey:config.publishableKey},storageKey:'uc-auth',storage:transientStorage(localStorage),flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,debug:false,fetch:(input,options)=>fetch(input,{...options,signal:AbortSignal.timeout(12000)})});
 const supabase={auth};
 await auth.getSession();
 // The SDK consumes the PKCE callback. Remove callback parameters from browser history.
 history.replaceState(null,'',location.pathname+'?authorization_id='+encodeURIComponent(aid));
 async function inspect(){
  closeConsent();
  const user=await auth.getUser();
  if(user.error||!user.data?.user||user.data.user.is_anonymous){$('login').hidden=false;message('Vraag een eenmalige aanmeldlink aan. Open de link in dezelfde browser. Deel de link niet in de chat.');return;}
  $('login').hidden=true;$('signout').hidden=false;
  const details=await auth.oauth.getAuthorizationDetails(aid);
  if(details.error||!validateDetails(details.data,aid,config)||details.data.user?.id!==user.data.user.id){fail();return;}
  $('details').textContent=JSON.stringify({toepassing:details.data.client.name,client_id:details.data.client.id,terugkeeradres:details.data.redirect_uri,gevraagde_rechten:details.data.scope},null,2);
  $('consent').hidden=false;message('Controleer de toepassing en de gevraagde rechten. Je beslist zelf of je toegang toestaat.');
 }
 $('send').onclick=()=>exclusive(async()=>{
  const email=$('email').value.trim();if(!email||!$('email').checkValidity()){message('Vul een geldig e-mailadres in.');return;}
  const response=await auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:config.siteUrl}});
  $('email').value='';
  if(response.error){fail();return;}
  message('Als de aanvraag kan worden verwerkt, ontvang je een aanmeldlink. Open die binnen tien minuten in dezelfde browser. Er is nog geen toestemming verleend.');
 });
 for(const [id,approved] of [['approve',true],['deny',false]])$(id).onclick=()=>exclusive(async()=>{
  const target=await decision({supabase,aid,config,approved,explicitlyClicked:true});
  localStorage.removeItem(pendingKey);closeConsent();location.replace(target);
 });
 $('signout').onclick=()=>exclusive(async()=>{await auth.signOut({scope:'local'});localStorage.removeItem(pendingKey);closeConsent();$('signout').hidden=true;$('login').hidden=true;message('Afgemeld. Start een nieuwe aanvraag vanuit je coachingkoppeling.');});
 await inspect();
}
main().catch(fail);
