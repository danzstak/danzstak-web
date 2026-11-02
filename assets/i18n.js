"use strict";
(() => {
 const supported=new Set((window.danzstakLanguages||[['en','English']]).map(([code])=>code));
 const dictionaries=window.danzstakTranslations||{en:{}};
 Object.assign(dictionaries.it||(dictionaries.it={}),{
  "Who can post on your profile?":"Chi può pubblicare sul tuo profilo?",
  "Just me":"Solo io",
  "Allow accepted friends to tag me in photos and videos":"Consenti agli amici accettati di taggarmi in foto e video",
  "Your display name and username must each be unique. If a name is taken, DanzStak will suggest a numbered alternative. Share only information you want members to see.":"Il nome visualizzato e il nome utente devono essere univoci. Se un nome è già in uso, DanzStak suggerirà un’alternativa numerata. Condividi solo le informazioni che vuoi mostrare agli altri membri.",
  "Profile posting and tagging":"Pubblicazione e tag sul profilo",
  "Allow friends to tag me":"Consenti agli amici di taggarmi",
  "Edit your name, username, and profile":"Modifica nome, nome utente e profilo"
  ,"More profile details":"Altri dettagli del profilo"
  ,"Photos and video":"Foto e video"
  ,"Privacy and tagging":"Privacy e tag"
  ,"Import from Facebook":"Importa da Facebook"
  ,"Choose Facebook export":"Scegli l’esportazione di Facebook"
  ,"Find people":"Trova persone"
  ,"Type their name. They do not need to be online.":"Scrivi il loro nome. Non devono essere online."
  ,"Name":"Nome"
  ,"Example: Liana":"Esempio: Liana"
  ,"Type at least 2 letters.":"Scrivi almeno 2 lettere."
  ,"Searching members…":"Ricerca dei membri…"
  ,"No matching members. Check the spelling of their profile name.":"Nessun membro trovato. Controlla il nome del profilo."
  ,"Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Cerca per nome oppure tocca Aggiungi amico accanto a una persona online. I tuoi amici restano nell’elenco anche quando sono offline."
  ,"Users online":"Utenti online"
  ,"Your friends":"I tuoi amici"
  ,"Add Friend":"Aggiungi amico"
  ,"Requested":"Richiesta inviata"
  ,"Friends":"Amici"
 });
 const friendGuidance={
  es:{"Find people":"Buscar personas","Type their name. They do not need to be online.":"Escribe su nombre. No necesitan estar en línea.","Name":"Nombre","Example: Liana":"Ejemplo: Liana","Type at least 2 letters.":"Escribe al menos 2 letras.","Searching members…":"Buscando miembros…","No matching members. Check the spelling of their profile name.":"No hay miembros coincidentes. Revisa el nombre de su perfil.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Busca por nombre o toca Añadir amigo junto a alguien conectado. Tus amigos siguen en la lista cuando están desconectados.","Users online":"Usuarios en línea","Your friends":"Tus amigos","Add Friend":"Añadir amigo","Requested":"Solicitud enviada"},
  fr:{"Find people":"Rechercher des personnes","Type their name. They do not need to be online.":"Saisissez leur nom. Ils n’ont pas besoin d’être en ligne.","Name":"Nom","Example: Liana":"Exemple : Liana","Type at least 2 letters.":"Saisissez au moins 2 lettres.","Searching members…":"Recherche de membres…","No matching members. Check the spelling of their profile name.":"Aucun membre trouvé. Vérifiez le nom de son profil.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Recherchez par nom ou touchez Ajouter comme ami près d’une personne en ligne. Vos amis restent dans la liste hors ligne.","Users online":"Utilisateurs en ligne","Your friends":"Vos amis","Add Friend":"Ajouter comme ami","Requested":"Demande envoyée"},
  de:{"Find people":"Personen finden","Type their name. They do not need to be online.":"Gib ihren Namen ein. Sie müssen nicht online sein.","Name":"Name","Example: Liana":"Beispiel: Liana","Type at least 2 letters.":"Gib mindestens 2 Buchstaben ein.","Searching members…":"Mitglieder werden gesucht…","No matching members. Check the spelling of their profile name.":"Keine passenden Mitglieder. Prüfe den Profilnamen.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Suche nach Namen oder tippe bei einer Online-Person auf Freund hinzufügen. Freunde bleiben auch offline in der Liste.","Users online":"Nutzer online","Your friends":"Deine Freunde","Add Friend":"Freund hinzufügen","Requested":"Anfrage gesendet"},
  pt:{"Find people":"Encontrar pessoas","Type their name. They do not need to be online.":"Digite o nome. A pessoa não precisa estar online.","Name":"Nome","Example: Liana":"Exemplo: Liana","Type at least 2 letters.":"Digite pelo menos 2 letras.","Searching members…":"Procurando membros…","No matching members. Check the spelling of their profile name.":"Nenhum membro encontrado. Confira o nome do perfil.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Pesquise pelo nome ou toque em Adicionar amigo ao lado de alguém online. Seus amigos continuam na lista quando estão offline.","Users online":"Usuários online","Your friends":"Seus amigos","Add Friend":"Adicionar amigo","Requested":"Solicitação enviada"},
  ko:{"Find people":"사람 찾기","Type their name. They do not need to be online.":"이름을 입력하세요. 온라인 상태일 필요는 없습니다.","Name":"이름","Example: Liana":"예: Liana","Type at least 2 letters.":"2글자 이상 입력하세요.","Searching members…":"회원 검색 중…","No matching members. Check the spelling of their profile name.":"일치하는 회원이 없습니다. 프로필 이름을 확인하세요.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"이름으로 찾거나 온라인 사용자 옆의 친구 추가를 누르세요. 친구는 오프라인이어도 목록에 남습니다.","Users online":"온라인 사용자","Your friends":"내 친구","Add Friend":"친구 추가","Requested":"요청 보냄"},
  ja:{"Find people":"人を探す","Type their name. They do not need to be online.":"名前を入力してください。相手がオンラインでなくても検索できます。","Name":"名前","Example: Liana":"例：Liana","Type at least 2 letters.":"2文字以上入力してください。","Searching members…":"メンバーを検索しています…","No matching members. Check the spelling of their profile name.":"該当するメンバーがいません。プロフィール名を確認してください。","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"名前で検索するか、オンラインの人の横にある「友達に追加」をタップします。友達はオフラインでも一覧に残ります。","Users online":"オンラインのユーザー","Your friends":"友達","Add Friend":"友達に追加","Requested":"リクエスト送信済み"},
  "zh-Hans":{"Find people":"查找用户","Type their name. They do not need to be online.":"输入对方的名字。对方无需在线。","Name":"名字","Example: Liana":"例如：Liana","Type at least 2 letters.":"请至少输入2个字符。","Searching members…":"正在查找成员…","No matching members. Check the spelling of their profile name.":"没有找到成员。请检查个人资料名字。","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"按名字查找，或点按在线用户旁的“添加好友”。好友离线时仍会保留在列表中。","Users online":"在线用户","Your friends":"你的好友","Add Friend":"添加好友","Requested":"已发送请求"},
  "zh-Hant":{"Find people":"尋找用戶","Type their name. They do not need to be online.":"輸入對方的名字。對方不需要在線。","Name":"名字","Example: Liana":"例如：Liana","Type at least 2 letters.":"請至少輸入2個字元。","Searching members…":"正在尋找成員…","No matching members. Check the spelling of their profile name.":"沒有找到成員。請檢查個人檔案名字。","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"按名字尋找，或點按在線用戶旁的「加入好友」。好友離線時仍會保留在列表中。","Users online":"在線用戶","Your friends":"你的好友","Add Friend":"加入好友","Requested":"已傳送請求"},
  fil:{"Find people":"Maghanap ng tao","Type their name. They do not need to be online.":"I-type ang pangalan nila. Hindi nila kailangang online.","Name":"Pangalan","Example: Liana":"Halimbawa: Liana","Type at least 2 letters.":"Mag-type ng hindi bababa sa 2 letra.","Searching members…":"Naghahanap ng mga miyembro…","No matching members. Check the spelling of their profile name.":"Walang katugmang miyembro. Suriin ang pangalan sa profile.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Maghanap ayon sa pangalan o i-tap ang Magdagdag ng kaibigan sa tabi ng online na tao. Nananatili sa listahan ang mga kaibigan kahit offline.","Users online":"Mga online na user","Your friends":"Mga kaibigan mo","Add Friend":"Magdagdag ng kaibigan","Requested":"Naipadala ang request"},
  hi:{"Find people":"लोग खोजें","Type their name. They do not need to be online.":"उनका नाम लिखें। उनका ऑनलाइन होना ज़रूरी नहीं है।","Name":"नाम","Example: Liana":"उदाहरण: Liana","Type at least 2 letters.":"कम से कम 2 अक्षर लिखें।","Searching members…":"सदस्य खोजे जा रहे हैं…","No matching members. Check the spelling of their profile name.":"कोई सदस्य नहीं मिला। प्रोफ़ाइल नाम की वर्तनी जाँचें।","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"नाम से खोजें या ऑनलाइन व्यक्ति के पास दोस्त जोड़ें दबाएँ। दोस्त ऑफलाइन होने पर भी सूची में रहेंगे।","Users online":"ऑनलाइन उपयोगकर्ता","Your friends":"आपके दोस्त","Add Friend":"दोस्त जोड़ें","Requested":"अनुरोध भेजा गया"},
  vi:{"Find people":"Tìm người","Type their name. They do not need to be online.":"Nhập tên của họ. Họ không cần phải trực tuyến.","Name":"Tên","Example: Liana":"Ví dụ: Liana","Type at least 2 letters.":"Nhập ít nhất 2 chữ cái.","Searching members…":"Đang tìm thành viên…","No matching members. Check the spelling of their profile name.":"Không tìm thấy thành viên. Hãy kiểm tra tên trang cá nhân.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Tìm theo tên hoặc chạm Thêm bạn bên cạnh người đang trực tuyến. Bạn bè vẫn ở trong danh sách khi ngoại tuyến.","Users online":"Người dùng trực tuyến","Your friends":"Bạn bè của bạn","Add Friend":"Thêm bạn","Requested":"Đã gửi lời mời"},
  th:{"Find people":"ค้นหาผู้คน","Type their name. They do not need to be online.":"พิมพ์ชื่อของพวกเขา ไม่จำเป็นต้องออนไลน์","Name":"ชื่อ","Example: Liana":"ตัวอย่าง: Liana","Type at least 2 letters.":"พิมพ์อย่างน้อย 2 ตัวอักษร","Searching members…":"กำลังค้นหาสมาชิก…","No matching members. Check the spelling of their profile name.":"ไม่พบสมาชิก โปรดตรวจสอบชื่อโปรไฟล์","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"ค้นหาด้วยชื่อหรือแตะ เพิ่มเพื่อน ข้างผู้ที่ออนไลน์ เพื่อนจะยังอยู่ในรายการเมื่อออฟไลน์","Users online":"ผู้ใช้ออนไลน์","Your friends":"เพื่อนของคุณ","Add Friend":"เพิ่มเพื่อน","Requested":"ส่งคำขอแล้ว"},
  id:{"Find people":"Temukan orang","Type their name. They do not need to be online.":"Ketik nama mereka. Mereka tidak harus online.","Name":"Nama","Example: Liana":"Contoh: Liana","Type at least 2 letters.":"Ketik minimal 2 huruf.","Searching members…":"Mencari anggota…","No matching members. Check the spelling of their profile name.":"Tidak ada anggota yang cocok. Periksa ejaan nama profilnya.","Search by name or tap Add Friend beside someone online. Your friends stay listed when they are offline.":"Cari berdasarkan nama atau ketuk Tambah teman di samping orang yang online. Teman tetap ada dalam daftar saat offline.","Users online":"Pengguna online","Your friends":"Teman Anda","Add Friend":"Tambah teman","Requested":"Permintaan terkirim"}
 };
 for(const [language,translations] of Object.entries(friendGuidance))Object.assign(dictionaries[language]||(dictionaries[language]={}),translations);
 const originalText=new WeakMap(),originalAttributes=new WeakMap();
 const excluded='script,style,textarea,[data-no-translate],.post-content,.post-header,.comment,.message:not(.system-message),.profile-bio,.profile-post-card p,.profile-post-meta,.profile-friend-card,.friend-details,.conversation-user,#conversationName,.news-card,.reel-details,.story-viewer-caption,.value,#profileName,#profileHandle,.facebook-import-items';
 let queued=false;
 function normalize(code){const raw=String(code||'');if(supported.has(raw))return raw;const lower=raw.toLowerCase();if(/^zh-(?:tw|hk|mo|hant)/.test(lower)&&supported.has('zh-Hant'))return'zh-Hant';if(/^zh/.test(lower)&&supported.has('zh-Hans'))return'zh-Hans';const exact=[...supported].find(value=>value.toLowerCase()===lower);if(exact)return exact;const base=lower.split('-')[0];return supported.has(base)?base:'en';}
 function translate(raw){
  const source=String(raw),trimmed=source.trim(),language=normalize(document.documentElement.lang),dictionary=dictionaries[language]||{};
  let result=dictionary[trimmed];
  if(!result){const count=trimmed.match(/^(Notifications|Friends|Messages) \((\d+)\)$/);if(count)result=(dictionary[count[1]]||count[1])+' ('+count[2]+')';}
  if(!result)return source;
  return source.slice(0,source.indexOf(trimmed))+result+source.slice(source.indexOf(trimmed)+trimmed.length);
 }
 function apply(){
  queued=false;if(!document.body)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let textNode;
  while((textNode=walker.nextNode())){
    if(!textNode.parentElement||textNode.parentElement.closest(excluded))continue;
    const old=originalText.get(textNode),current=textNode.nodeValue;
    const source=old&&old.rendered===current?old.source:current;
    const rendered=translate(source);originalText.set(textNode,{source,rendered});if(current!==rendered)textNode.nodeValue=rendered;
  }
  for(const element of document.body.querySelectorAll('[placeholder],[title],[aria-label]')){
    if(element.closest(excluded))continue;let records=originalAttributes.get(element);if(!records){records=new Map();originalAttributes.set(element,records);}
    for(const name of ['placeholder','title','aria-label']){if(!element.hasAttribute(name))continue;const current=element.getAttribute(name),old=records.get(name),source=old&&old.rendered===current?old.source:current,rendered=translate(source);records.set(name,{source,rendered});if(current!==rendered)element.setAttribute(name,rendered);}
  }
 }
 function schedule(){if(queued)return;queued=true;queueMicrotask(apply);}
 function setLanguage(code){const language=normalize(code);document.documentElement.lang=language;document.documentElement.dir='ltr';try{localStorage.setItem('danzstak_language',language);}catch{}apply();return language;}
 window.danzstakSetLanguage=setLanguage;window.danzstakTranslate=translate;
 function start(){
  let language=document.documentElement.lang||'en';
  let saved='';try{saved=localStorage.getItem('danzstak_language')||'';}catch{}
  let regional='';try{regional=(navigator.languages||[navigator.language]).map(normalize).find(code=>code!=='en')||normalize(navigator.language);}catch{}
  language=saved||regional||language;
  document.documentElement.lang=normalize(language);apply();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
  new MutationObserver(()=>{apply();for(const frame of document.querySelectorAll('iframe')){try{if(new URL(frame.src,location.href).origin===location.origin)frame.contentWindow?.postMessage({type:'danzstak-language',language:document.documentElement.lang},location.origin);}catch{}}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 addEventListener('storage',event=>{if(event.key==='danzstak_language')setLanguage(event.newValue);});
 addEventListener('message',event=>{if(event.source===window.parent&&event.origin===location.origin&&event.data?.type==='danzstak-language')setLanguage(event.data.language);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
