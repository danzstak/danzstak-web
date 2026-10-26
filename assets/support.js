"use strict";
(() => {
 const form=document.getElementById("supportForm"),message=document.getElementById("supportMessage"),count=document.getElementById("supportCount"),status=document.getElementById("supportStatus"),button=form.querySelector("button[type=submit]");
 message.addEventListener("input",()=>{count.textContent=String(message.value.length);});
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!form.reportValidity())return;button.disabled=true;status.textContent="Sending your request…";
  try{
   const response=await fetch("https://api.danzstak.com/support-tickets",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:document.getElementById("supportCategory").value,subject:document.getElementById("supportSubject").value,message:message.value})});
   const data=await response.json().catch(()=>({}));
   if(response.status===401){location.href="/?return=support.html";return;}
   if(!response.ok)throw Error(data.error||"Your support request could not be sent. Please try again.");
   form.reset();count.textContent="0";status.textContent=`Received. Your DanzStak support ticket is ${data.ticketId}. Save this number.`;
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
})();
