"use strict";
(() => {
  const panel = document.getElementById("profileOnboarding");
  const form = document.getElementById("profileOnboardingForm");
  if (!panel || !form) return;
  const nameInput = document.getElementById("profileOnboardingName");
  const handleInput = document.getElementById("profileOnboardingHandle");
  const save = document.getElementById("profileOnboardingSave");
  const status = document.getElementById("profileOnboardingStatus");
  const next = document.getElementById("profileOnboardingNext");
  const findPeople = document.getElementById("profileOnboardingFindPeople");
  const done = document.getElementById("profileOnboardingDone");
  const copy = {
    en: { title: "What should people call you?", help: "Enter the name you want people to see. DanzStak handles the username for you.", name: "Name people see", save: "Use this name", saving: "Saving your name…", saved: "Your name is ready. Find people who are online and add your first friends.", later: "You can change this later in Settings → Edit Profile.", find: "Find people", done: "Not now" },
    es: { title: "¿Cómo quieres que te llamen?", help: "Escribe el nombre que quieres mostrar. DanzStak crea tu nombre de usuario automáticamente.", name: "Nombre que verán los demás", save: "Usar este nombre", saving: "Guardando tu nombre…", saved: "Tu nombre está listo. Busca personas y añade tus primeros amigos.", later: "Puedes cambiarlo después en Configuración → Editar perfil.", find: "Buscar personas", done: "Ahora no" },
    fr: { title: "Comment voulez-vous être appelé ?", help: "Saisissez le nom à afficher. DanzStak crée automatiquement votre nom d’utilisateur.", name: "Nom visible par les autres", save: "Utiliser ce nom", saving: "Enregistrement du nom…", saved: "Votre nom est prêt. Recherchez des personnes et ajoutez vos premiers amis.", later: "Vous pourrez le modifier dans Paramètres → Modifier le profil.", find: "Rechercher des personnes", done: "Pas maintenant" },
    de: { title: "Wie sollen dich andere nennen?", help: "Gib den Namen ein, den andere sehen sollen. DanzStak erstellt den Benutzernamen automatisch.", name: "Sichtbarer Name", save: "Diesen Namen verwenden", saving: "Name wird gespeichert…", saved: "Dein Name ist bereit. Finde Personen und füge deine ersten Freunde hinzu.", later: "Du kannst ihn später unter Einstellungen → Profil bearbeiten ändern.", find: "Personen finden", done: "Nicht jetzt" },
    pt: { title: "Como você quer ser chamado?", help: "Digite o nome que deseja mostrar. O DanzStak cria seu nome de usuário automaticamente.", name: "Nome que as pessoas verão", save: "Usar este nome", saving: "Salvando seu nome…", saved: "Seu nome está pronto. Encontre pessoas e adicione seus primeiros amigos.", later: "Você pode mudar depois em Configurações → Editar perfil.", find: "Encontrar pessoas", done: "Agora não" },
    it: { title: "Come vuoi farti chiamare?", help: "Inserisci il nome che vuoi mostrare. DanzStak crea automaticamente il nome utente.", name: "Nome visibile agli altri", save: "Usa questo nome", saving: "Salvataggio del nome…", saved: "Il tuo nome è pronto. Trova persone e aggiungi i tuoi primi amici.", later: "Puoi cambiarlo in seguito in Impostazioni → Modifica profilo.", find: "Trova persone", done: "Non ora" },
    ko: { title: "사람들이 뭐라고 부르면 좋을까요?", help: "다른 사람에게 보여 줄 이름을 입력하세요. 사용자 이름은 DanzStak이 자동으로 만듭니다.", name: "사람들에게 보일 이름", save: "이 이름 사용", saving: "이름 저장 중…", saved: "이름이 준비되었습니다. 사람을 찾아 첫 친구를 추가하세요.", later: "나중에 설정 → 프로필 편집에서 변경할 수 있습니다.", find: "사람 찾기", done: "나중에" },
    ja: { title: "何と呼ばれたいですか？", help: "ほかの人に表示する名前を入力してください。ユーザー名はDanzStakが自動で作成します。", name: "表示する名前", save: "この名前を使う", saving: "名前を保存しています…", saved: "名前を設定しました。人を探して最初の友達を追加しましょう。", later: "後で 設定 → プロフィールを編集 から変更できます。", find: "人を探す", done: "後で" },
    "zh-Hans": { title: "希望大家怎么称呼你？", help: "输入你想让别人看到的名字。DanzStak 会自动创建用户名。", name: "向他人显示的名字", save: "使用此名字", saving: "正在保存名字…", saved: "名字已设置。查找用户并添加你的第一批好友。", later: "以后可在“设置 → 编辑个人资料”中更改。", find: "查找用户", done: "暂时不要" },
    "zh-Hant": { title: "希望大家怎麼稱呼你？", help: "輸入你想讓別人看到的名字。DanzStak 會自動建立使用者名稱。", name: "向他人顯示的名字", save: "使用此名字", saving: "正在儲存名字…", saved: "名字已設定。尋找用戶並加入你的第一批好友。", later: "之後可在「設定 → 編輯個人檔案」中更改。", find: "尋找用戶", done: "暫時不要" },
    fil: { title: "Ano ang gusto mong itawag sa iyo?", help: "Ilagay ang pangalang gusto mong makita ng iba. Awtomatikong gagawa ang DanzStak ng username.", name: "Pangalang makikita ng iba", save: "Gamitin ang pangalang ito", saving: "Sine-save ang pangalan…", saved: "Handa na ang pangalan mo. Maghanap ng tao at idagdag ang una mong mga kaibigan.", later: "Mababago mo ito sa Mga setting → I-edit ang profile.", find: "Maghanap ng tao", done: "Hindi muna" },
    hi: { title: "लोग आपको किस नाम से बुलाएँ?", help: "वह नाम लिखें जो आप दूसरों को दिखाना चाहते हैं। DanzStak उपयोगकर्ता नाम अपने आप बनाता है।", name: "लोगों को दिखने वाला नाम", save: "यह नाम उपयोग करें", saving: "नाम सहेजा जा रहा है…", saved: "आपका नाम तैयार है। लोगों को खोजें और अपने पहले दोस्त जोड़ें।", later: "आप इसे बाद में सेटिंग्स → प्रोफ़ाइल संपादित करें में बदल सकते हैं।", find: "लोग खोजें", done: "अभी नहीं" },
    vi: { title: "Bạn muốn mọi người gọi mình là gì?", help: "Nhập tên bạn muốn người khác nhìn thấy. DanzStak tự động tạo tên người dùng.", name: "Tên mọi người sẽ thấy", save: "Dùng tên này", saving: "Đang lưu tên…", saved: "Tên của bạn đã sẵn sàng. Hãy tìm người và thêm những người bạn đầu tiên.", later: "Bạn có thể đổi sau trong Cài đặt → Chỉnh sửa trang cá nhân.", find: "Tìm người", done: "Để sau" },
    th: { title: "อยากให้คนอื่นเรียกคุณว่าอะไร?", help: "ใส่ชื่อที่ต้องการให้คนอื่นเห็น DanzStak จะสร้างชื่อผู้ใช้ให้อัตโนมัติ", name: "ชื่อที่คนอื่นจะเห็น", save: "ใช้ชื่อนี้", saving: "กำลังบันทึกชื่อ…", saved: "ตั้งชื่อเรียบร้อยแล้ว ค้นหาผู้คนและเพิ่มเพื่อนกลุ่มแรกของคุณ", later: "เปลี่ยนภายหลังได้ที่ การตั้งค่า → แก้ไขโปรไฟล์", find: "ค้นหาผู้คน", done: "ไว้ทีหลัง" },
    id: { title: "Anda ingin dipanggil apa?", help: "Masukkan nama yang ingin dilihat orang lain. DanzStak membuat nama pengguna secara otomatis.", name: "Nama yang dilihat orang lain", save: "Gunakan nama ini", saving: "Menyimpan nama…", saved: "Nama Anda sudah siap. Temukan orang dan tambahkan teman pertama Anda.", later: "Anda dapat mengubahnya nanti di Pengaturan → Edit profil.", find: "Temukan orang", done: "Nanti saja" }
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
  document.getElementById("profileOnboardingTitle").textContent = words.title;
  document.getElementById("profileOnboardingHelp").textContent = words.help;
  document.getElementById("profileOnboardingNameLabel").textContent = words.name;
  document.getElementById("profileOnboardingLater").textContent = words.later;
  save.textContent = words.save;
  findPeople.textContent = words.find;
  done.textContent = words.done;

  const closeOnboarding = () => { panel.hidden = true; };
  findPeople.addEventListener("click", () => {
    closeOnboarding();
    document.querySelector('.topnav [data-feature="Friends"]')?.click();
  });
  done.addEventListener("click", closeOnboarding);

  const suggestedHandle = value => {
    const base = String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24) || "member";
    return base.length < 3 ? `${base}.1`.slice(0, 24) : base;
  };
  nameInput.addEventListener("input", () => {
    handleInput.value = suggestedHandle(nameInput.value);
  });

  async function request(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch (error) {
      if (error.name === "AbortError") throw new Error("DanzStak is taking too long. Try again.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function load() {
    try {
      const response = await request("https://api.danzstak.com/profiles", { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      const profile = (await response.json()).profile || {};
      const normalizedName = String(profile.name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
      const normalizedHandle = String(profile.handle || "").trim().replace(/^@/, "").toLocaleLowerCase();
      const genericName = !normalizedName || ["danzstak member", "danzstak user", "new member"].includes(normalizedName);
      const genericHandle = !normalizedHandle || ["danzstak-member", "danzstak.member", "danzstak_member", "member", "new-member"].includes(normalizedHandle);
      if (!genericName && !genericHandle) return;
      nameInput.value = genericName ? "" : profile.name;
      handleInput.value = genericHandle ? suggestedHandle(nameInput.value) : profile.handle;
      panel.hidden = false;
      nameInput.focus({ preventScroll: true });
    } catch { /* Profile editing remains available if onboarding cannot load. */ }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled || !form.reportValidity()) return;
    const name = nameInput.value.trim();
    const handle = suggestedHandle(handleInput.value || name);
    save.disabled = true;
    status.textContent = words.saving;
    try {
      let response = await request("https://api.danzstak.com/profiles", {
        method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, handle })
      });
      let data = await response.json().catch(() => ({}));
      if (!response.ok && data.suggestion && !/display name/i.test(data.error || "")) {
        handleInput.value = data.suggestion;
        response = await request("https://api.danzstak.com/profiles", {
          method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, handle: data.suggestion })
        });
        data = await response.json().catch(() => ({}));
      }
      if (!response.ok) {
        if (data.suggestion) {
          if (/display name/i.test(data.error || "")) nameInput.value = data.suggestion;
          else handleInput.value = data.suggestion;
        }
        throw new Error(data.error || "Your name could not be saved. Try again.");
      }
      status.textContent = words.saved;
      const composerAvatar = document.querySelector(".composer-avatar");
      if (composerAvatar) composerAvatar.textContent = name.charAt(0).toUpperCase() || "D";
      form.hidden = true;
      document.getElementById("profileOnboardingLater").hidden = true;
      next.hidden = false;
      findPeople.focus({ preventScroll: true });
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });

  load();
})();
