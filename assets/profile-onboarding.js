"use strict";
(() => {
  const panel = document.getElementById("profileOnboarding");
  const form = document.getElementById("profileOnboardingForm");
  if (!panel || !form) return;
  const nameInput = document.getElementById("profileOnboardingName");
  const save = document.getElementById("profileOnboardingSave");
  const skip = document.getElementById("profileOnboardingSkip");
  const status = document.getElementById("profileOnboardingStatus");
  const menuProfileName = document.getElementById("menuProfileName");
  const menuProfileImage = document.getElementById("menuProfileImage");
  const menuProfileFallback = document.getElementById("menuProfileFallback");
  const newsFeedView = document.getElementById("newsFeedView");
  const featureView = document.getElementById("featureView");
  let currentProfile = {};
  let onboardingEligible = false;
  let onboardingDismissed = false;
  function syncOnboardingVisibility() {
    const homeIsActive = newsFeedView && featureView && !newsFeedView.hidden && featureView.hidden;
    panel.hidden = onboardingDismissed || !onboardingEligible || !homeIsActive;
  }
  if (newsFeedView && featureView) {
    const routeObserver = new MutationObserver(syncOnboardingVisibility);
    routeObserver.observe(newsFeedView, { attributes: true, attributeFilter: ["hidden"] });
    routeObserver.observe(featureView, { attributes: true, attributeFilter: ["hidden"] });
  }
  function updateMenuProfile(profile = {}) {
    const name = String(profile.name || "").trim() || "My Profile";
    if (menuProfileName) menuProfileName.textContent = name;
    if (menuProfileFallback) {
      menuProfileFallback.textContent = name.charAt(0).toUpperCase() || "D";
      menuProfileFallback.hidden = false;
    }
    if (!menuProfileImage) return;
    const picture = String(profile.picture || "").trim();
    menuProfileImage.hidden = true;
    menuProfileImage.removeAttribute("src");
    if (!picture) return;
    menuProfileImage.onload = () => { menuProfileImage.hidden = false; if (menuProfileFallback) menuProfileFallback.hidden = true; };
    menuProfileImage.onerror = () => { menuProfileImage.hidden = true; if (menuProfileFallback) menuProfileFallback.hidden = false; };
    menuProfileImage.src = picture;
    window.danzstakIdentityMedia?.install(menuProfileImage, profile);
  }
  const copy = {
    en: { title: "What should people call you?", help: "Choose the name people see. Your sign-in and username stay unchanged.", name: "Name people see", save: "Use this name", saving: "Saving your name…", saved: "Your name is ready.", later: "You can change this later in Settings → Edit Profile.", find: "Find people", done: "Not now" },
    es: { title: "¿Cómo quieres que te llamen?", help: "Elige el nombre que verán los demás. Tu inicio de sesión y nombre de usuario no cambian.", name: "Nombre que verán los demás", save: "Usar este nombre", saving: "Guardando tu nombre…", saved: "Tu nombre está listo. Busca personas y añade tus primeros amigos.", later: "Puedes cambiarlo después en Configuración → Editar perfil.", find: "Buscar personas", done: "Ahora no" },
    fr: { title: "Comment voulez-vous être appelé ?", help: "Choisissez le nom visible par les autres. Votre identifiant et votre nom d’utilisateur restent inchangés.", name: "Nom visible par les autres", save: "Utiliser ce nom", saving: "Enregistrement du nom…", saved: "Votre nom est prêt. Recherchez des personnes et ajoutez vos premiers amis.", later: "Vous pourrez le modifier dans Paramètres → Modifier le profil.", find: "Rechercher des personnes", done: "Pas maintenant" },
    de: { title: "Wie sollen dich andere nennen?", help: "Wähle den Namen, den andere sehen. Anmeldung und Benutzername bleiben unverändert.", name: "Sichtbarer Name", save: "Diesen Namen verwenden", saving: "Name wird gespeichert…", saved: "Dein Name ist bereit. Finde Personen und füge deine ersten Freunde hinzu.", later: "Du kannst ihn später unter Einstellungen → Profil bearbeiten ändern.", find: "Personen finden", done: "Nicht jetzt" },
    pt: { title: "Como você quer ser chamado?", help: "Escolha o nome que as pessoas verão. Seu login e nome de usuário não mudam.", name: "Nome que as pessoas verão", save: "Usar este nome", saving: "Salvando seu nome…", saved: "Seu nome está pronto. Encontre pessoas e adicione seus primeiros amigos.", later: "Você pode mudar depois em Configurações → Editar perfil.", find: "Encontrar pessoas", done: "Agora não" },
    it: { title: "Come vuoi farti chiamare?", help: "Scegli il nome visibile agli altri. L’accesso e il nome utente restano invariati.", name: "Nome visibile agli altri", save: "Usa questo nome", saving: "Salvataggio del nome…", saved: "Il tuo nome è pronto. Trova persone e aggiungi i tuoi primi amici.", later: "Puoi cambiarlo in seguito in Impostazioni → Modifica profilo.", find: "Trova persone", done: "Non ora" },
    ko: { title: "사람들이 뭐라고 부르면 좋을까요?", help: "다른 사람에게 보일 이름을 선택하세요. 로그인과 사용자 이름은 변경되지 않습니다.", name: "사람들에게 보일 이름", save: "이 이름 사용", saving: "이름 저장 중…", saved: "이름이 준비되었습니다. 사람을 찾아 첫 친구를 추가하세요.", later: "나중에 설정 → 프로필 편집에서 변경할 수 있습니다.", find: "사람 찾기", done: "나중에" },
    ja: { title: "何と呼ばれたいですか？", help: "ほかの人に表示する名前を選んでください。ログインとユーザー名は変更されません。", name: "表示する名前", save: "この名前を使う", saving: "名前を保存しています…", saved: "名前を設定しました。人を探して最初の友達を追加しましょう。", later: "後で 設定 → プロフィールを編集 から変更できます。", find: "人を探す", done: "後で" },
    "zh-Hans": { title: "希望大家怎么称呼你？", help: "选择他人看到的名字。你的登录方式和用户名保持不变。", name: "向他人显示的名字", save: "使用此名字", saving: "正在保存名字…", saved: "名字已设置。查找用户并添加你的第一批好友。", later: "以后可在“设置 → 编辑个人资料”中更改。", find: "查找用户", done: "暂时不要" },
    "zh-Hant": { title: "希望大家怎麼稱呼你？", help: "選擇他人看到的名字。你的登入方式和使用者名稱保持不變。", name: "向他人顯示的名字", save: "使用此名字", saving: "正在儲存名字…", saved: "名字已設定。尋找用戶並加入你的第一批好友。", later: "之後可在「設定 → 編輯個人檔案」中更改。", find: "尋找用戶", done: "暫時不要" },
    fil: { title: "Ano ang gusto mong itawag sa iyo?", help: "Piliin ang pangalang makikita ng iba. Hindi magbabago ang iyong pag-sign in at username.", name: "Pangalang makikita ng iba", save: "Gamitin ang pangalang ito", saving: "Sine-save ang pangalan…", saved: "Handa na ang pangalan mo. Maghanap ng tao at idagdag ang una mong mga kaibigan.", later: "Mababago mo ito sa Mga setting → I-edit ang profile.", find: "Maghanap ng tao", done: "Hindi muna" },
    hi: { title: "लोग आपको किस नाम से बुलाएँ?", help: "लोगों को दिखने वाला नाम चुनें। आपका साइन-इन और उपयोगकर्ता नाम नहीं बदलेगा।", name: "लोगों को दिखने वाला नाम", save: "यह नाम उपयोग करें", saving: "नाम सहेजा जा रहा है…", saved: "आपका नाम तैयार है। लोगों को खोजें और अपने पहले दोस्त जोड़ें।", later: "आप इसे बाद में सेटिंग्स → प्रोफ़ाइल संपादित करें में बदल सकते हैं।", find: "लोग खोजें", done: "अभी नहीं" },
    vi: { title: "Bạn muốn mọi người gọi mình là gì?", help: "Chọn tên mọi người sẽ thấy. Thông tin đăng nhập và tên người dùng không thay đổi.", name: "Tên mọi người sẽ thấy", save: "Dùng tên này", saving: "Đang lưu tên…", saved: "Tên của bạn đã sẵn sàng. Hãy tìm người và thêm những người bạn đầu tiên.", later: "Bạn có thể đổi sau trong Cài đặt → Chỉnh sửa trang cá nhân.", find: "Tìm người", done: "Để sau" },
    th: { title: "อยากให้คนอื่นเรียกคุณว่าอะไร?", help: "เลือกชื่อที่คนอื่นจะเห็น การเข้าสู่ระบบและชื่อผู้ใช้ของคุณจะไม่เปลี่ยนแปลง", name: "ชื่อที่คนอื่นจะเห็น", save: "ใช้ชื่อนี้", saving: "กำลังบันทึกชื่อ…", saved: "ตั้งชื่อเรียบร้อยแล้ว ค้นหาผู้คนและเพิ่มเพื่อนกลุ่มแรกของคุณ", later: "เปลี่ยนภายหลังได้ที่ การตั้งค่า → แก้ไขโปรไฟล์", find: "ค้นหาผู้คน", done: "ไว้ทีหลัง" },
    id: { title: "Anda ingin dipanggil apa?", help: "Pilih nama yang akan dilihat orang lain. Login dan nama pengguna Anda tidak berubah.", name: "Nama yang dilihat orang lain", save: "Gunakan nama ini", saving: "Menyimpan nama…", saved: "Nama Anda sudah siap. Temukan orang dan tambahkan teman pertama Anda.", later: "Anda dapat mengubahnya nanti di Pengaturan → Edit profil.", find: "Temukan orang", done: "Nanti saja" }
  };
  const feedback = {
    en: { welcome: "Welcome to DanzStak", slow: "DanzStak is taking too long. Try again.", offline: "DanzStak cannot connect right now. Check your connection and try again.", taken: "That name is already used. Try the suggested name.", failed: "Your name could not be saved. Try again." },
    es: { welcome: "Te damos la bienvenida a DanzStak", slow: "DanzStak está tardando demasiado. Inténtalo de nuevo.", offline: "DanzStak no puede conectarse ahora. Comprueba tu conexión e inténtalo de nuevo.", taken: "Ese nombre ya está en uso. Prueba el nombre sugerido.", failed: "No se pudo guardar tu nombre. Inténtalo de nuevo." },
    fr: { welcome: "Bienvenue sur DanzStak", slow: "DanzStak met trop de temps à répondre. Réessayez.", offline: "DanzStak ne peut pas se connecter. Vérifiez votre connexion et réessayez.", taken: "Ce nom est déjà utilisé. Essayez le nom proposé.", failed: "Votre nom n’a pas pu être enregistré. Réessayez." },
    de: { welcome: "Willkommen bei DanzStak", slow: "DanzStak braucht zu lange. Versuche es erneut.", offline: "DanzStak kann gerade keine Verbindung herstellen. Prüfe deine Verbindung und versuche es erneut.", taken: "Dieser Name wird bereits verwendet. Probiere den vorgeschlagenen Namen.", failed: "Dein Name konnte nicht gespeichert werden. Versuche es erneut." },
    pt: { welcome: "Boas-vindas ao DanzStak", slow: "O DanzStak está demorando demais. Tente novamente.", offline: "O DanzStak não consegue se conectar agora. Verifique sua conexão e tente novamente.", taken: "Esse nome já está em uso. Tente o nome sugerido.", failed: "Não foi possível salvar seu nome. Tente novamente." },
    it: { welcome: "Benvenuto su DanzStak", slow: "DanzStak sta impiegando troppo tempo. Riprova.", offline: "DanzStak non riesce a connettersi. Controlla la connessione e riprova.", taken: "Questo nome è già in uso. Prova quello suggerito.", failed: "Impossibile salvare il nome. Riprova." },
    ko: { welcome: "DanzStak에 오신 것을 환영합니다", slow: "DanzStak 응답이 지연되고 있습니다. 다시 시도하세요.", offline: "지금 DanzStak에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.", taken: "이미 사용 중인 이름입니다. 추천 이름을 사용해 보세요.", failed: "이름을 저장하지 못했습니다. 다시 시도하세요." },
    ja: { welcome: "DanzStakへようこそ", slow: "DanzStakの応答に時間がかかっています。もう一度お試しください。", offline: "現在DanzStakに接続できません。接続を確認してもう一度お試しください。", taken: "その名前はすでに使われています。候補の名前をお試しください。", failed: "名前を保存できませんでした。もう一度お試しください。" },
    "zh-Hans": { welcome: "欢迎使用 DanzStak", slow: "DanzStak 响应时间过长，请重试。", offline: "DanzStak 目前无法连接，请检查网络后重试。", taken: "该名字已被使用，请尝试建议的名字。", failed: "无法保存名字，请重试。" },
    "zh-Hant": { welcome: "歡迎使用 DanzStak", slow: "DanzStak 回應時間過長，請重試。", offline: "DanzStak 目前無法連線，請檢查網路後重試。", taken: "該名字已被使用，請嘗試建議的名字。", failed: "無法儲存名字，請重試。" },
    fil: { welcome: "Maligayang pagdating sa DanzStak", slow: "Masyadong matagal ang DanzStak. Subukan muli.", offline: "Hindi makakonekta ang DanzStak ngayon. Suriin ang koneksyon at subukan muli.", taken: "Ginagamit na ang pangalang iyon. Subukan ang iminungkahing pangalan.", failed: "Hindi na-save ang pangalan mo. Subukan muli." },
    hi: { welcome: "DanzStak में आपका स्वागत है", slow: "DanzStak बहुत समय ले रहा है। फिर कोशिश करें।", offline: "DanzStak अभी कनेक्ट नहीं हो पा रहा है। अपना कनेक्शन जाँचें और फिर कोशिश करें।", taken: "यह नाम पहले से उपयोग में है। सुझाया गया नाम आज़माएँ।", failed: "आपका नाम सहेजा नहीं जा सका। फिर कोशिश करें।" },
    vi: { welcome: "Chào mừng đến với DanzStak", slow: "DanzStak phản hồi quá lâu. Hãy thử lại.", offline: "DanzStak hiện không thể kết nối. Hãy kiểm tra kết nối rồi thử lại.", taken: "Tên này đã được sử dụng. Hãy thử tên được đề xuất.", failed: "Không thể lưu tên của bạn. Hãy thử lại." },
    th: { welcome: "ยินดีต้อนรับสู่ DanzStak", slow: "DanzStak ใช้เวลานานเกินไป โปรดลองอีกครั้ง", offline: "DanzStak เชื่อมต่อไม่ได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง", taken: "ชื่อนี้มีผู้ใช้แล้ว โปรดลองชื่อที่แนะนำ", failed: "บันทึกชื่อของคุณไม่ได้ โปรดลองอีกครั้ง" },
    id: { welcome: "Selamat datang di DanzStak", slow: "DanzStak terlalu lama merespons. Coba lagi.", offline: "DanzStak tidak dapat terhubung saat ini. Periksa koneksi Anda lalu coba lagi.", taken: "Nama itu sudah digunakan. Coba nama yang disarankan.", failed: "Nama Anda tidak dapat disimpan. Coba lagi." }
  };
  function identityLanguage(value) {
    const raw = String(value || "en").trim().toLowerCase();
    if (/^zh-(?:tw|hk|mo|hant)/.test(raw)) return "zh-Hant";
    if (/^zh/.test(raw)) return "zh-Hans";
    const exact = Object.keys(copy).find(code => code.toLowerCase() === raw);
    if (exact) return exact;
    const base = raw.split("-")[0];
    return Object.prototype.hasOwnProperty.call(copy, base) ? base : "en";
  }
  let language = "en";
  try { language = identityLanguage(localStorage.getItem("danzstak_language") || document.documentElement.lang || navigator.language || "en"); } catch { language = identityLanguage(document.documentElement.lang || "en"); }
  const words = copy[language] || copy.en;
  const messages = feedback[language] || feedback.en;
  document.querySelector(".profile-onboarding-kicker").textContent = messages.welcome;
  document.getElementById("profileOnboardingTitle").textContent = words.title;
  document.getElementById("profileOnboardingHelp").textContent = words.help;
  document.getElementById("profileOnboardingNameLabel").textContent = words.name;
  document.getElementById("profileOnboardingLater").textContent = words.later;
  save.textContent = words.save;
  skip.textContent = words.done;

  const closeOnboarding = (remember = true) => {
    onboardingDismissed = true;
    if (remember && currentProfile.memberId) {
      try { localStorage.setItem(`danzstak_name_prompt_dismissed_${currentProfile.memberId}`, "1"); } catch { /* Private browsing may block local storage. */ }
    }
    syncOnboardingVisibility();
  };
  skip.addEventListener("click", () => closeOnboarding(true));

  function needsIdentityOnboarding(profile = {}) {
    const normalizedName = String(profile.name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const genericName = !normalizedName || ["danzstak member", "danzstak user", "new member"].includes(normalizedName);
    return genericName;
  }

  async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error(messages.slow);
      throw new Error(messages.offline);
    } finally { clearTimeout(timeout); }
  }

  async function load() {
    try {
      const response = await request("https://api.danzstak.com/profiles", { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      const profile = (await response.json()).profile || {};
      currentProfile = profile;
      updateMenuProfile(profile);
      if (!needsIdentityOnboarding(profile)) return;
      try { if (localStorage.getItem(`danzstak_name_prompt_dismissed_${profile.memberId}`) === "1") return; } catch { /* Continue with a dismissible prompt. */ }
      onboardingEligible = true;
      nameInput.value = "";
      syncOnboardingVisibility();
      if (!panel.hidden) nameInput.focus({ preventScroll: true });
    } catch { /* Profile editing remains available if onboarding cannot load. */ }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled || !form.reportValidity()) return;
    const name = nameInput.value.trim();
    save.disabled = true;
    status.textContent = words.saving;
    try {
      let response = await request("https://api.danzstak.com/profiles", {
        method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name })
      });
      let data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messages.failed);
      status.textContent = words.saved;
      currentProfile = { ...currentProfile, ...(data.profile || {}), name };
      updateMenuProfile(currentProfile);
      const composerAvatar = document.querySelector(".composer-avatar");
      if (composerAvatar) composerAvatar.textContent = name.charAt(0).toUpperCase() || "D";
      closeOnboarding(true);
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });

  load();
})();
