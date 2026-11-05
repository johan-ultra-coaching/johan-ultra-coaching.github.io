import {ready} from './consent.mjs';
// Deliberately closed until the exact client, callback and login flow are verified.
const config = Object.freeze({enabled:false, clientId:null, redirectUri:null, publishableKey:null,
  siteUrl:'https://johan-ultra-coaching.github.io/'});
if (!ready(config)) document.getElementById('status').textContent =
  'Veilig geblokkeerd: de OAuth-client en aanmeldprocedure moeten nog worden verbonden. Er is geen toestemming verleend.';
