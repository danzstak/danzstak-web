"use strict";
(() => {
 const form=document.getElementById("supportForm"),message=document.getElementById("supportMessage"),count=document.getElementById("supportCount"),status=document.getElementById("supportStatus"),button=form.querySelector("button[type=submit]");
 async function supportFetch(options={},timeoutMs=10000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch("https://api.danzstak.com/support-tickets",{...options,signal:controller.signal});}catch(error){if(error?.name==="AbortError")throw Error("Support took too long to respond. Check your connection and try again.");throw error;}finally{clearTimeout(timer);}}
 message.addEventListener("input",()=>{count.textContent=String(message.value.length);});
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!form.reportValidity())return;button.disabled=true;status.textContent="Sending your request…";
  try{
   const response=await supportFetch({method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:document.getElementById("supportCategory").value,subject:document.getElementById("supportSubject").value,message:message.value})});
   const data=await response.json().catch(()=>({}));
   if(response.status===401){location.href="/?return=support.html";return;}
   if(!response.ok)throw Error(data.error||"Your support request could not be sent. Please try again.");
   form.reset();count.textContent="0";status.textContent=`Received. Your DanzStak support ticket is ${data.ticketId}. Save this number.`;
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
})();
