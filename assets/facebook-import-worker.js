"use strict";
importScripts('vendor/fflate-0.8.3.js','facebook-import-core.js');
self.onmessage=event=>{try{const result=self.DanzStakFacebookImport.readArchive(event.data.buffer,event.data.name);const transfers=[...new Set(result.media.map(file=>file.bytes.buffer))];self.postMessage({ok:true,result},transfers);}catch(error){self.postMessage({ok:false,error:error.message||'The Facebook export could not be read.'});}};
