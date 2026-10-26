"use strict";
(() => {
 const refreshEvery=5*60*1000;
 let lastRefresh=0,refreshing=false,presenceUpdating=false;
 async function refreshSession(){
  if(document.hidden||refreshing||Date.now()-lastRefresh<refreshEvery)return;
  refreshing=true;
  try{const response=await fetch('https://api.danzstak.com/auth/refresh',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});if(response.ok)lastRefresh=Date.now();else if(response.status===401)location.replace('./');}
  catch{/* Retry after connectivity returns; inactivity never signs the user out. */}
  finally{refreshing=false;}
 }
 async function refreshPresence(){
  if(document.hidden||presenceUpdating)return;presenceUpdating=true;
  try{const response=await fetch('https://api.danzstak.com/calls/presence',{method:'POST',credentials:'include',cache:'no-store'});if(response.ok)dispatchEvent(new CustomEvent('danzstak-presence-updated'));}
  catch{/* Presence can retry without ending the login session. */}
  finally{presenceUpdating=false;}
 }
 function resume(){if(!document.hidden){refreshSession();refreshPresence();}}
 refreshSession();refreshPresence();setInterval(refreshSession,60000);setInterval(refreshPresence,30000);addEventListener('focus',resume);addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
})();
