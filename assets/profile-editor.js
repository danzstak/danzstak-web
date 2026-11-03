"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
const profileApi = "https://api.danzstak.com";
const profileEditorCopy = {
  en: { edit:"Edit Profile",heading:"Edit your profile",name:"Name people see",nameHelp:"This is the name friends and other members will see.",advanced:"Username (optional)",handle:"Username",handleHelp:"You do not need to change this to change your visible name.",tap:"Tap your name to change it",cancel:"Cancel",save:"Save name and profile",note:"Choose the name you want other members to see. You can edit the rest of your profile whenever you want." },
  es: { edit:"Editar perfil",heading:"Edita tu perfil",name:"Nombre que verán los demás",nameHelp:"Este es el nombre que verán tus amigos y otros miembros.",advanced:"Nombre de usuario (opcional)",handle:"Nombre de usuario",handleHelp:"No necesitas cambiarlo para modificar tu nombre visible.",tap:"Toca tu nombre para cambiarlo",cancel:"Cancelar",save:"Guardar nombre y perfil",note:"Elige el nombre que quieres mostrar. Puedes editar el resto del perfil cuando quieras." },
  fr: { edit:"Modifier le profil",heading:"Modifiez votre profil",name:"Nom visible par les autres",nameHelp:"C’est le nom que vos amis et les autres membres verront.",advanced:"Nom d’utilisateur (facultatif)",handle:"Nom d’utilisateur",handleHelp:"Vous n’avez pas besoin de le modifier pour changer votre nom affiché.",tap:"Touchez votre nom pour le modifier",cancel:"Annuler",save:"Enregistrer le nom et le profil",note:"Choisissez le nom à afficher. Vous pourrez modifier le reste du profil à tout moment." },
  de: { edit:"Profil bearbeiten",heading:"Profil bearbeiten",name:"Sichtbarer Name",nameHelp:"Diesen Namen sehen Freunde und andere Mitglieder.",advanced:"Benutzername (optional)",handle:"Benutzername",handleHelp:"Du musst ihn nicht ändern, um deinen sichtbaren Namen zu ändern.",tap:"Tippe auf deinen Namen, um ihn zu ändern",cancel:"Abbrechen",save:"Name und Profil speichern",note:"Wähle den Namen, den andere sehen sollen. Den Rest deines Profils kannst du jederzeit bearbeiten." },
  pt: { edit:"Editar perfil",heading:"Edite seu perfil",name:"Nome que as pessoas verão",nameHelp:"Este é o nome que amigos e outros membros verão.",advanced:"Nome de usuário (opcional)",handle:"Nome de usuário",handleHelp:"Você não precisa alterá-lo para mudar seu nome visível.",tap:"Toque no seu nome para mudar",cancel:"Cancelar",save:"Salvar nome e perfil",note:"Escolha o nome que deseja mostrar. Você pode editar o restante do perfil quando quiser." },
  it: { edit:"Modifica profilo",heading:"Modifica il tuo profilo",name:"Nome visibile agli altri",nameHelp:"Questo è il nome che amici e altri membri vedranno.",advanced:"Nome utente (facoltativo)",handle:"Nome utente",handleHelp:"Non devi modificarlo per cambiare il nome visibile.",tap:"Tocca il tuo nome per cambiarlo",cancel:"Annulla",save:"Salva nome e profilo",note:"Scegli il nome che vuoi mostrare agli altri membri. Puoi modificare il resto del profilo quando vuoi." },
  ko: { edit:"프로필 편집",heading:"프로필 편집",name:"사람들에게 보일 이름",nameHelp:"친구와 다른 회원에게 이 이름이 표시됩니다.",advanced:"사용자 이름 (선택 사항)",handle:"사용자 이름",handleHelp:"표시 이름을 바꾸기 위해 이 항목을 변경할 필요는 없습니다.",tap:"이름을 눌러 변경",cancel:"취소",save:"이름과 프로필 저장",note:"다른 회원에게 보여 줄 이름을 선택하세요. 나머지 프로필은 언제든 수정할 수 있습니다." },
  ja: { edit:"プロフィールを編集",heading:"プロフィールを編集",name:"表示する名前",nameHelp:"友達やほかのメンバーにはこの名前が表示されます。",advanced:"ユーザー名（任意）",handle:"ユーザー名",handleHelp:"表示名を変えるために変更する必要はありません。",tap:"名前をタップして変更",cancel:"キャンセル",save:"名前とプロフィールを保存",note:"ほかのメンバーに表示する名前を選んでください。ほかのプロフィール項目はいつでも編集できます。" },
  "zh-Hans": { edit:"编辑个人资料",heading:"编辑个人资料",name:"向他人显示的名字",nameHelp:"好友和其他成员会看到这个名字。",advanced:"用户名（可选）",handle:"用户名",handleHelp:"更改显示名字时无需修改用户名。",tap:"点按名字进行更改",cancel:"取消",save:"保存名字和个人资料",note:"选择你想让其他成员看到的名字。其他资料可随时编辑。" },
  "zh-Hant": { edit:"編輯個人檔案",heading:"編輯個人檔案",name:"向他人顯示的名字",nameHelp:"好友和其他成員會看到這個名字。",advanced:"使用者名稱（選填）",handle:"使用者名稱",handleHelp:"更改顯示名字時不需要修改使用者名稱。",tap:"點按名字進行更改",cancel:"取消",save:"儲存名字和個人檔案",note:"選擇你想讓其他成員看到的名字。其他資料可隨時編輯。" },
  fil: { edit:"I-edit ang profile",heading:"I-edit ang iyong profile",name:"Pangalang makikita ng iba",nameHelp:"Ito ang pangalang makikita ng mga kaibigan at ibang miyembro.",advanced:"Username (opsyonal)",handle:"Username",handleHelp:"Hindi mo ito kailangang baguhin para palitan ang nakikitang pangalan.",tap:"I-tap ang pangalan para baguhin",cancel:"Kanselahin",save:"I-save ang pangalan at profile",note:"Piliin ang pangalang gusto mong ipakita. Maaari mong i-edit ang ibang detalye anumang oras." },
  hi: { edit:"प्रोफ़ाइल संपादित करें",heading:"अपनी प्रोफ़ाइल संपादित करें",name:"लोगों को दिखने वाला नाम",nameHelp:"दोस्तों और दूसरे सदस्यों को यही नाम दिखेगा।",advanced:"उपयोगकर्ता नाम (वैकल्पिक)",handle:"उपयोगकर्ता नाम",handleHelp:"दिखाई देने वाला नाम बदलने के लिए इसे बदलना ज़रूरी नहीं है।",tap:"नाम बदलने के लिए उस पर टैप करें",cancel:"रद्द करें",save:"नाम और प्रोफ़ाइल सहेजें",note:"वह नाम चुनें जो आप दूसरे सदस्यों को दिखाना चाहते हैं। बाकी प्रोफ़ाइल कभी भी बदल सकते हैं।" },
  vi: { edit:"Chỉnh sửa trang cá nhân",heading:"Chỉnh sửa trang cá nhân",name:"Tên mọi người sẽ thấy",nameHelp:"Bạn bè và các thành viên khác sẽ thấy tên này.",advanced:"Tên người dùng (không bắt buộc)",handle:"Tên người dùng",handleHelp:"Bạn không cần đổi mục này để thay tên hiển thị.",tap:"Chạm vào tên để thay đổi",cancel:"Hủy",save:"Lưu tên và trang cá nhân",note:"Chọn tên bạn muốn hiển thị. Bạn có thể chỉnh sửa phần còn lại bất cứ lúc nào." },
  th: { edit:"แก้ไขโปรไฟล์",heading:"แก้ไขโปรไฟล์ของคุณ",name:"ชื่อที่คนอื่นจะเห็น",nameHelp:"เพื่อนและสมาชิกคนอื่นจะเห็นชื่อนี้",advanced:"ชื่อผู้ใช้ (ไม่บังคับ)",handle:"ชื่อผู้ใช้",handleHelp:"ไม่ต้องเปลี่ยนส่วนนี้เพื่อเปลี่ยนชื่อที่แสดง",tap:"แตะชื่อเพื่อเปลี่ยน",cancel:"ยกเลิก",save:"บันทึกชื่อและโปรไฟล์",note:"เลือกชื่อที่ต้องการแสดง คุณแก้ไขข้อมูลส่วนอื่นได้ทุกเมื่อ" },
  id: { edit:"Edit profil",heading:"Edit profil Anda",name:"Nama yang dilihat orang lain",nameHelp:"Teman dan anggota lain akan melihat nama ini.",advanced:"Nama pengguna (opsional)",handle:"Nama pengguna",handleHelp:"Anda tidak perlu mengubahnya untuk mengganti nama tampilan.",tap:"Ketuk nama untuk mengubahnya",cancel:"Batal",save:"Simpan nama dan profil",note:"Pilih nama yang ingin ditampilkan. Anda dapat mengedit bagian profil lainnya kapan saja." }
};
function resolveProfileLanguage(value) {
  const raw = String(value || "en").trim().toLowerCase();
  if (/^zh-(?:tw|hk|mo|hant)/.test(raw)) return "zh-Hant";
  if (/^zh/.test(raw)) return "zh-Hans";
  const exact = Object.keys(profileEditorCopy).find(code => code.toLowerCase() === raw);
  if (exact) return exact;
  const base = raw.split("-")[0];
  return Object.prototype.hasOwnProperty.call(profileEditorCopy, base) ? base : "en";
}
const profileLanguageCode = (() => {
  try { return resolveProfileLanguage(localStorage.getItem("danzstak_language") || document.documentElement.lang || navigator.language || "en"); }
  catch { return resolveProfileLanguage(document.documentElement.lang || "en"); }
})();
const profileEditorWords = profileEditorCopy[profileLanguageCode] || profileEditorCopy.en;
const profileTranslate = value => window.danzstakTranslate?.(value) || value;
const profileToast = document.createElement("div");
profileToast.className = "profile-toast";
profileToast.hidden = true;
profileToast.setAttribute("role", "status");
profileToast.setAttribute("aria-live", "polite");
profileToast.setAttribute("aria-atomic", "true");
document.body.appendChild(profileToast);
let profileToastTimer = 0;
let profileToastHideTimer = 0;

function showProfileFeedback(message, { urgent = false, timeout = 4200 } = {}) {
  clearTimeout(profileToastTimer);
  clearTimeout(profileToastHideTimer);
  profileToast.textContent = String(message || profileTranslate("DanzStak could not complete that profile change."));
  profileToast.setAttribute("role", urgent ? "alert" : "status");
  profileToast.setAttribute("aria-live", urgent ? "assertive" : "polite");
  profileToast.hidden = false;
  profileToast.classList.remove("profile-toast-visible");
  requestAnimationFrame(() => profileToast.classList.add("profile-toast-visible"));
  profileToastTimer = setTimeout(() => {
    profileToast.classList.remove("profile-toast-visible");
    profileToastHideTimer = setTimeout(() => { profileToast.hidden = true; }, 180);
  }, timeout);
}
async function profileFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === "AbortError") throw new Error(profileTranslate("DanzStak is taking too long to respond. Try again."));
    throw new Error(profileTranslate("DanzStak cannot update your profile right now. Check your connection and try again."));
  } finally { clearTimeout(timeout); }
}
let viewingOtherProfile = Boolean(new URLSearchParams(location.search).get("user") || new URLSearchParams(location.search).get("member"));

async function saveCloudProfile(changes) {
  const response = await profileFetch(profileApi + "/profiles", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || profileTranslate("Profile could not be saved"));
  window.danzstakCurrentProfile = data.profile || window.danzstakCurrentProfile;
  return data.profile;
}

async function uploadCloudMedia(file) {
  const ticketResponse = await profileFetch(profileApi + "/stories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, purpose: "profile" })
  });
  if (!ticketResponse.ok) throw new Error(profileTranslate("Media upload could not start"));
  const ticket = await ticketResponse.json();
  const uploadDeadline = Math.max(120000, Math.ceil(file.size / (64 * 1024)) * 1000);
  const uploadResponse = await profileFetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }, uploadDeadline);
  if (!uploadResponse.ok) throw new Error(profileTranslate("Media upload failed"));
  return ticket.mediaKey;
}

async function uploadCloudProfileMedia(file, field) {
  const mediaKey = await uploadCloudMedia(file);
  // A lost save response can still mean the profile was committed. Retain the upload.
  return await saveCloudProfile({ [field]: mediaKey });
}

const bioElement = document.createElement("p");
bioElement.className = "profile-bio";
bioElement.textContent = "Add a short bio so people know more about you.";
handleElement.insertAdjacentElement("afterend", bioElement);

function detail(label, id) {
  const box = document.createElement("div");
  box.className = "detail";
  const title = document.createElement("span");
  title.className = "label";
  title.textContent = label;
  const value = document.createElement("span");
  value.className = "value";
  value.id = id;
  value.textContent = "Not added";
  box.append(title, value);
  details.appendChild(box);
}

function setProfileDetail(id, value) {
  const target = document.getElementById(id);
  const text = String(value || "").trim();
  target.textContent = text || "Not added";
  target.closest(".detail").hidden = viewingOtherProfile && !text;
}

detail("Location", "profileLocation");
detail("Work", "profileWork");
detail("Website", "profileWebsite");

const actions = document.createElement("div");
actions.className = "profile-actions";
const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "button";
editButton.textContent = profileEditorWords.edit;
actions.appendChild(editButton);
bioElement.insertAdjacentElement("afterend", actions);
const nameEditHint = document.createElement("button");
nameEditHint.type = "button";
nameEditHint.className = "profile-name-edit-hint";
nameEditHint.textContent = profileEditorWords.tap;
nameEditHint.hidden = true;
handleElement.insertAdjacentElement("afterend", nameEditHint);

const mediaTools = document.createElement("div");
mediaTools.className = "profile-media-tools";

function addProfileImageButton(label, target, field) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.mediaField = field;
  const input = document.createElement("input");
  input.dataset.mediaField = field;
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.hidden = true;
  button.addEventListener("click", async () => {
    if (await window.danzstakConfirm("Confirm that you created this image and it contains no third-party copyrighted material.", { title: "Use this image?", confirmLabel: "Choose image" })) input.click();
  });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showProfileFeedback("Profile images must be JPG, PNG, or WebP.", { urgent: true });
      input.value = "";
      return;
    }
    if (window.danzstakCurrentProfile?.cloudProfile) {
      button.disabled = true;
      try {
        const profile = await uploadCloudProfileMedia(file, field === "avatar" ? "avatarKey" : "coverKey");
        if (field === "avatar" && profile?.picture) { target.style.backgroundImage = `url("${profile.picture}")`; target.textContent = ""; }
        if (field === "cover" && profile?.cover) target.style.backgroundImage = `url("${profile.cover}")`;
        target.classList.add("has-photo");
      } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
      finally { button.disabled = false; input.value = ""; }
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const sessionUrl = URL.createObjectURL(file);
      target.style.backgroundImage = `url("${sessionUrl}")`;
      target.classList.add("has-photo");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
      saved[field] = reader.result;
      try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
      catch { showProfileFeedback("This image could not be saved in the browser. Choose a smaller file.", { urgent: true }); return; }
      applyProfileMedia(saved);
    });
    reader.readAsDataURL(file);
  });
  mediaTools.append(button, input);
}

function applyProfileMedia(saved) {
  const avatar = document.getElementById("profileInitial");
  const cover = document.querySelector(".cover");
  if (saved.avatar) { avatar.style.backgroundImage = `url("${saved.avatar}")`; avatar.classList.add("has-photo"); }
  if (saved.cover) {
    cover.style.backgroundImage = `url("${saved.cover}")`;
    cover.style.backgroundPosition = `${saved.coverX ?? 50}% ${saved.coverY ?? 50}%`;
    cover.style.backgroundSize = saved.coverFit ? "contain" : "cover";
    cover.style.backgroundRepeat = "no-repeat";
    cover.style.backgroundColor = "#0b0b12";
    cover.classList.add("has-photo");
  }
}

async function removeProfileImage(field, target) {
  const cloud = window.danzstakCurrentProfile?.cloudProfile;
  if (cloud) {
    const profile = await saveCloudProfile({ [field === "avatar" ? "avatarKey" : "coverKey"]: "" });
    applyProfile(profile || window.danzstakCurrentProfile);
  }
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  delete saved[field];
  try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
  catch (error) { if (!cloud) throw new Error("The photo could not be removed from browser storage. Please try again."); }
  if (!cloud) {
    target.style.backgroundImage = "";
    target.classList.remove("has-photo");
    if (field === "avatar") target.textContent = document.getElementById("profileName").textContent.trim().charAt(0).toUpperCase() || "D";
  }
}

function addRemoveImageButton(label, field, target) {
  const button = document.createElement("button");
  button.dataset.mediaField = field;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    if (!(await window.danzstakConfirm("This removes the image from your DanzStak profile.", { title: `${label}?`, confirmLabel: label, danger: true }))) return;
    button.disabled = true;
    try { await removeProfileImage(field, target); }
    catch (error) { showProfileFeedback(error.message, { urgent: true }); }
    finally { button.disabled = false; }
  });
  mediaTools.appendChild(button);
}

addProfileImageButton("Change Profile Photo", document.getElementById("profileInitial"), "avatar");
addProfileImageButton("Change Cover Photo", document.querySelector(".cover"), "cover");
addRemoveImageButton("Remove Profile Photo", "avatar", document.getElementById("profileInitial"));
addRemoveImageButton("Remove Cover Photo", "cover", document.querySelector(".cover"));
const coverElement = document.querySelector(".cover");
const repositionButton = document.createElement("button");
repositionButton.type = "button";
repositionButton.dataset.mediaField = "cover";
repositionButton.textContent = "Reposition Cover";
const finishReposition = document.createElement("button");
finishReposition.type = "button"; finishReposition.className = "cover-reposition-done"; finishReposition.textContent = "Done repositioning"; finishReposition.hidden = true;
coverElement.appendChild(finishReposition);
finishReposition.addEventListener("click", () => repositionButton.click());
let repositioning = false;
let dragStart = null;
let coverPositionSaving = false;
repositionButton.addEventListener("click", () => {
  if (!coverElement.classList.contains("has-photo")) { showProfileFeedback("Add a cover photo first.", { urgent: true }); return; }
  repositioning = !repositioning;
  repositionButton.classList.toggle("active", repositioning);
  repositionButton.textContent = repositioning ? "Done Repositioning" : "Reposition Cover";
  coverElement.classList.toggle("repositioning", repositioning);
  finishReposition.hidden = !repositioning;
  if (repositioning) coverElement.scrollIntoView({block:"center",behavior:"smooth"});
  else panel.scrollIntoView({block:"start",behavior:"smooth"});
});
coverElement.addEventListener("pointerdown", event => {
  if (!repositioning || coverPositionSaving || event.target.closest?.("button")) return;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  const cloud = window.danzstakCurrentProfile;
  dragStart = { x: event.clientX, y: event.clientY, coverX: cloud?.cloudProfile ? (cloud.coverX ?? 50) : (saved.coverX ?? 50), coverY: cloud?.cloudProfile ? (cloud.coverY ?? 50) : (saved.coverY ?? 50) };
  coverElement.dataset.coverX = String(dragStart.coverX);
  coverElement.dataset.coverY = String(dragStart.coverY);
  coverElement.setPointerCapture(event.pointerId);
});
coverElement.addEventListener("pointermove", event => {
  if (!repositioning || !dragStart) return;
  const rect = coverElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(0, Math.min(100, dragStart.coverX + ((event.clientX - dragStart.x) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, dragStart.coverY + ((event.clientY - dragStart.y) / rect.height) * 100));
  coverElement.style.backgroundPosition = `${x}% ${y}%`;
  coverElement.dataset.coverX = String(x);
  coverElement.dataset.coverY = String(y);
});
async function persistCoverPosition(position) {
  const cloud = window.danzstakCurrentProfile?.cloudProfile;
  if (cloud) await saveCloudProfile(position);
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  Object.assign(saved, position);
  try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); }
  catch { if (!cloud) throw new Error("Cover position could not be saved in this browser."); }
}
function restoreCoverPosition(position) {
  coverElement.style.backgroundPosition = `${position.coverX}% ${position.coverY}%`;
  coverElement.dataset.coverX = String(position.coverX);
  coverElement.dataset.coverY = String(position.coverY);
}
coverElement.addEventListener("pointerup", async () => {
  if (!dragStart) return;
  const previous = dragStart;
  dragStart = null;
  const position = {
    coverX: Number(coverElement.dataset.coverX ?? previous.coverX),
    coverY: Number(coverElement.dataset.coverY ?? previous.coverY)
  };
  if (position.coverX === previous.coverX && position.coverY === previous.coverY) return;
  coverPositionSaving = true;
  try { await persistCoverPosition(position); }
  catch (error) { restoreCoverPosition(previous); showProfileFeedback(error.message, { urgent: true }); }
  finally { coverPositionSaving = false; }
});
coverElement.addEventListener("pointercancel", () => {
  if (!dragStart) return;
  restoreCoverPosition(dragStart);
  dragStart = null;
});
mediaTools.appendChild(repositionButton);
const fitCoverButton = document.createElement("button");
fitCoverButton.type = "button";
fitCoverButton.dataset.mediaField = "cover";
fitCoverButton.textContent = "Fit Entire Cover";
async function toggleCoverFit() {
  if (!coverElement.classList.contains("has-photo")) { showProfileFeedback("Add a cover photo first.", { urgent: true }); return; }
  const saved = (() => { try { return JSON.parse(localStorage.getItem(profileMediaKey) || "{}"); } catch { return {}; } })();
  const cloud = window.danzstakCurrentProfile;
  const coverFit = !(cloud?.cloudProfile ? cloud.coverFit : saved.coverFit);
  fitCoverButton.disabled = true;
  try {
    if (cloud?.cloudProfile) await saveCloudProfile({ coverFit });
    saved.coverFit = coverFit;
    try { localStorage.setItem(profileMediaKey, JSON.stringify(saved)); } catch { /* Cloud save remains authoritative. */ }
    coverElement.style.backgroundSize = coverFit ? "contain" : "cover";
    coverElement.style.backgroundRepeat = "no-repeat";
    fitCoverButton.classList.toggle("active", coverFit);
    fitCoverButton.textContent = coverFit ? "Fill Cover Box" : "Fit Entire Cover";
  } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
  finally { fitCoverButton.disabled = false; }
}
fitCoverButton.addEventListener("click", toggleCoverFit);
try {
  const savedCover = JSON.parse(localStorage.getItem(profileMediaKey) || "{}");
  fitCoverButton.classList.toggle("active", Boolean(savedCover.coverFit));
  fitCoverButton.textContent = savedCover.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
} catch { /* Ignore corrupt local drafts. */ }
mediaTools.appendChild(fitCoverButton);
const videoButton = document.createElement("button");
videoButton.type = "button";
videoButton.dataset.mediaField = "video";
videoButton.textContent = "Add Profile Video";
videoButton.hidden = true;
const videoInput = document.createElement("input");
videoInput.dataset.mediaField = "video";
videoInput.type = "file";
videoInput.accept = "video/mp4,video/webm,video/quicktime";
videoInput.hidden = true;
videoButton.addEventListener("click", async () => {
  if (await window.danzstakConfirm("Confirm that you created this video and that any music in it is your original material. Standalone audio uploads are not allowed.", { title: "Use this video?", confirmLabel: "Choose video" })) videoInput.click();
});
videoInput.addEventListener("change", async () => {
  const file = videoInput.files[0];
  if (!file) return;
  if (!videoInput.accept.split(",").includes(file.type)) {
    showProfileFeedback("Profile videos must be MP4, WebM, or MOV.", { urgent: true });
    videoInput.value = "";
    return;
  }
  videoButton.disabled = true;
  removeVideoButton.disabled = true;
  videoButton.disabled = true;
  try {
    const mediaKey = await uploadCloudMedia(file);
    const response = await profileFetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be saved");
    setProfileVideoControls(mediaKey);
    showProfileFeedback("Profile video saved. Open the Media tab to view it.");
  } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
  finally { videoButton.disabled = false; removeVideoButton.disabled = false; videoInput.value = ""; }
});
mediaTools.append(videoButton, videoInput);
const removeVideoButton = document.createElement("button");
removeVideoButton.type = "button";
removeVideoButton.dataset.mediaField = "video";
removeVideoButton.textContent = "Remove Profile Video";
removeVideoButton.hidden = true;
removeVideoButton.addEventListener("click", async () => {
  if (!(await window.danzstakConfirm("This removes the video from your DanzStak profile.", { title: "Remove profile video?", confirmLabel: "Remove video", danger: true }))) return;
  removeVideoButton.disabled = true;
  try {
    const response = await profileFetch(profileApi + "/profile-video", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaKey: "" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile video could not be removed");
    setProfileVideoControls("");
    showProfileFeedback("Profile video removed from your profile.");
  } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
  finally { removeVideoButton.disabled = false; videoButton.disabled = false; }
});
mediaTools.appendChild(removeVideoButton);
let profileVideoControlsVersion = 0;
function setProfileVideoControls(mediaKey) {
  profileVideoControlsVersion++;
  videoButton.hidden = false;
  removeVideoButton.hidden = !mediaKey;
}
async function revealProfileVideoControls() {
  const version = ++profileVideoControlsVersion;
  try {
    const response = await profileFetch(profileApi + "/profile-video", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (version !== profileVideoControlsVersion) return;
    setProfileVideoControls(data.mediaKey);
  } catch { /* Keep the existing controls when the lookup is unavailable. */ }
}

actions.insertAdjacentElement("afterend", mediaTools);
if (viewingOtherProfile) {
  editButton.hidden = true;
  mediaTools.hidden = true;
}

const tabs = document.createElement("nav");
tabs.className = "profile-tabs";
tabs.setAttribute("aria-label", "Profile sections");
tabs.setAttribute("role", "tablist");
for (const name of ["Posts", "Featured", "Memories", "About", "Friends", "Media"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  if (name === "Memories") tab.hidden = true;
  tab.classList.toggle("active", name === "Posts");
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(name === "Posts"));
  tab.tabIndex = name === "Posts" ? 0 : -1;
  tabs.appendChild(tab);
}
const tabMessage = document.createElement("div");
tabMessage.className = "profile-tab-message";
tabMessage.hidden = false;
tabMessage.setAttribute("role", "tabpanel");
tabMessage.setAttribute("aria-live", "polite");
details.insertAdjacentElement("beforebegin", tabs);
details.insertAdjacentElement("afterend", tabMessage);
details.hidden = true;

async function refreshProfilePostMedia(post) {
  if (typeof post?.refreshMedia === "function") {
    const mediaUrl = await post.refreshMedia().catch(() => "");
    if (mediaUrl) post.mediaUrl = mediaUrl;
    return mediaUrl || "";
  }
  if (!/^[a-f0-9-]{36}$/.test(String(post?.postId || ""))) return "";
  const response = await profileFetch(profileApi + "/secure-posts", { credentials: "include", cache: "no-store" }).catch(() => null);
  if (!response?.ok) return "";
  const data = await response.json().catch(() => ({}));
  const refreshed = (data.posts || []).find(candidate => candidate.postId === post.postId);
  if (!refreshed?.mediaUrl || !["image", "video"].includes(refreshed.mediaType)) return "";
  post.mediaUrl = refreshed.mediaUrl;
  post.mediaType = refreshed.mediaType;
  return post.mediaUrl;
}

function installProfilePostMedia(article, post) {
  const recovery = document.createElement("div");
  recovery.className = "profile-media-recovery";
  const copy = document.createElement("span");
  copy.textContent = profileTranslate("Media is temporarily unavailable.");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary";
  retry.textContent = profileTranslate("Retry media");
  recovery.append(copy, retry);
  const insert = node => { const open = article.querySelector(".profile-post-open"); if (open) open.before(node); else article.appendChild(node); };
  const showRecovery = () => { article.querySelector(".profile-post-media")?.remove(); if (!recovery.parentNode) insert(recovery); };
  const install = async () => {
    retry.disabled = true;
    const mediaUrl = post.mediaUrl || await refreshProfilePostMedia(post);
    retry.disabled = false;
    if (!mediaUrl) { showRecovery(); return; }
    recovery.remove();
    const media = document.createElement(post.mediaType === "image" ? "img" : "video");
    media.className = "profile-post-media";
    media.addEventListener("error", () => { post.mediaUrl = ""; showRecovery(); }, { once: true });
    if (post.mediaType === "image") media.alt = post.content || "Profile post photo";
    else { media.controls = true; media.preload = "metadata"; media.setAttribute("aria-label", post.content ? "Video: " + post.content : "Profile post video"); }
    media.src = mediaUrl;
    insert(media);
  };
  retry.addEventListener("click", () => { post.mediaUrl = ""; void install(); });
  void install();
}

function profilePostCard(post) {
  const article = document.createElement("article");
  article.className = "profile-post-card";
  if (post.postId) { article.dataset.postId = post.postId; article.dataset.isOwner = String(post.isOwner === true); article.dataset.viewCount = String(post.viewCount || 0); }
  const meta = document.createElement("div");
  meta.className = "profile-post-meta";
  const time = document.createElement("time");
  const created = post.createdAt ? new Date(post.createdAt) : null;
  time.textContent = created && !Number.isNaN(created.valueOf()) ? created.toLocaleString() : "Recent post";
  const audience = document.createElement("span");
  audience.textContent = post.audience === "private" ? "Just me" : post.audience === "friends" ? "Friends" : "Public";
  meta.append(time, audience);
  const text = document.createElement("p");
  text.textContent = post.content || "Shared media";
  article.append(meta, text);
  if ((post.postId || typeof post.refreshMedia === "function") && ["image", "video"].includes(post.mediaType)) installProfilePostMedia(article, post);
  else if (post.mediaUrl && ["image", "video"].includes(post.mediaType)) {
    const media = document.createElement(post.mediaType === "image" ? "img" : "video");
    media.className = "profile-post-media"; media.src = post.mediaUrl;
    if (post.mediaType === "image") media.alt = post.content || "Profile post photo";
    else { media.controls = true; media.preload = "metadata"; media.setAttribute("aria-label", post.content ? "Video: " + post.content : "Profile post video"); }
    article.appendChild(media);
  }
  if (/^[a-f0-9-]{36}$/.test(String(post.postId || ""))) {
    const open = document.createElement("a");
    open.className = "secondary profile-post-open";
    open.href = "feed.html#post-" + encodeURIComponent(post.postId);
    open.textContent = "View in Your Mix";
    article.appendChild(open);
  }
  window.danzstakRenderSharedPost?.(article, post);
  window.danzstakRenderMediaTags?.(article, post);
  if (post.isOwner === true && post.postId) {
    const feature = document.createElement("button");
    feature.type = "button"; feature.className = "secondary";
    const paint = () => { feature.textContent = post.featured ? "Remove from Featured" : "Feature on profile"; feature.setAttribute("aria-pressed", String(post.featured === true)); };
    paint();
    feature.addEventListener("click", async () => {
      feature.disabled = true;
      try {
        const response = await profileFetch(profileApi + "/secure-posts/" + encodeURIComponent(post.postId), {method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({featured:!post.featured})});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Featured post could not be saved.");
        post.featured = !post.featured; paint();
        if (!post.featured && tabs.querySelector('[data-profile-tab="Featured"]').getAttribute("aria-selected") === "true") article.remove();
      } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
      finally { feature.disabled = false; }
    });
    article.appendChild(feature);
  }
  if (post.canRemoveFromProfile === true && post.postId) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary profile-wall-remove";
    remove.textContent = "Remove from my profile";
    remove.addEventListener("click", async () => {
      if (!(await window.danzstakConfirm("The post will no longer appear on your profile.", { title: "Remove this post from your profile?", confirmLabel: "Remove post", danger: true }))) return;
      remove.disabled = true;
      try {
        const response = await profileFetch(profileApi + "/secure-posts/" + encodeURIComponent(post.postId), { method: "DELETE", credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "The post could not be removed.");
        article.remove();
      } catch (error) { showProfileFeedback(error.message, { urgent: true }); }
      finally { remove.disabled = false; }
    });
    article.appendChild(remove);
  }
  return article;
}

function profileWallComposer(profile) {
  const section = document.createElement("section");
  section.className = "profile-wall-composer";
  if (!profile.canPostToProfile) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = profile.profilePostPermission === "friends" ? "Only accepted friends can post on this profile." : "Only this member can post on their profile.";
    section.appendChild(note);
    return section;
  }
  if (profile.isOwner) return section;
  const form = document.createElement("form");
  const heading = document.createElement("h3");
  const textarea = document.createElement("textarea");
  const certifyLabel = document.createElement("label");
  const certify = document.createElement("input");
  const submit = document.createElement("button");
  const status = document.createElement("p");
  heading.textContent = `Post on ${profile.name || "this member"}’s profile`;
  textarea.name = "content"; textarea.maxLength = 5000; textarea.required = true; textarea.placeholder = "Write something…";
  certify.type = "checkbox"; certify.required = true;
  certifyLabel.className = "profile-wall-certify";
  certifyLabel.append(certify, document.createTextNode("This is my original content and may be shared on DanzStak."));
  submit.type = "submit"; submit.className = "button"; submit.textContent = "Post";
  status.className = "muted"; status.setAttribute("role", "status");
  form.append(heading, textarea, certifyLabel, submit, status);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true; status.textContent = "Posting…";
    try {
      const response = await profileFetch(profileApi + "/secure-posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: textarea.value, audience: "public", originalContentCertified: true, profileMemberId: profile.memberId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The post could not be published.");
      textarea.value = ""; certify.checked = false; status.textContent = "Posted to this profile.";
      await loadProfilePosts(false);
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  section.appendChild(form);
  return section;
}

const profileTabRoutes = new Map([
  ["posts", "Posts"], ["featured", "Featured"], ["memories", "Memories"],
  ["about", "About"], ["friends", "Friends"], ["media", "Media"]
]);
function requestedProfileTab() {
  return profileTabRoutes.get(String(window.location?.hash || "").replace(/^#/, "").toLowerCase()) || "Posts";
}

let profileTabVersion = 0;
async function loadProfilePosts(mediaOnly = false, collection = "posts") {
  const version = profileTabVersion;
  tabMessage.textContent = mediaOnly ? "Loading media…" : "Loading posts…";
  try {
    const response = await profileFetch(profileApi + "/secure-posts", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Profile posts could not be loaded");
    const data = await response.json();
    if (version !== profileTabVersion) return;
    const profileMemberId = String(window.danzstakCurrentProfile?.memberId || "");
    let posts = window.danzstakProfileCollections.select(data.posts || [], collection, "", !viewingOtherProfile, new Date(), profileMemberId);
    if (mediaOnly) posts = posts.filter(post => post.mediaUrl && ["image", "video"].includes(post.mediaType));
    tabMessage.replaceChildren();
    if (collection === "posts" && !mediaOnly && window.danzstakCurrentProfile && typeof profileWallComposer === "function") tabMessage.appendChild(profileWallComposer(window.danzstakCurrentProfile));
    if (collection !== "posts") {
      const note = document.createElement("p"); note.className = "muted";
      note.textContent = collection === "memories" ? "Only you can see this Memories view. These are your posts from this day in previous years; their original audiences stay unchanged." : "Featured posts keep their original audience. Highlighting a post does not make it public.";
      tabMessage.appendChild(note);
      if (!posts.length) { const empty = document.createElement("p"); empty.textContent = collection === "memories" ? "No memories from this day yet." : "No featured posts to show yet."; tabMessage.appendChild(empty); }
    }
    for (const post of posts) tabMessage.appendChild(profilePostCard(post));
    if (mediaOnly) {
      const params = new URLSearchParams();
      const profileMemberId = String(window.danzstakCurrentProfile?.memberId || "");
      if (viewingOtherProfile && /^[a-f0-9-]{36}$/.test(profileMemberId)) params.set("member", profileMemberId);
      const refreshProfileVideo = async () => {
        const refreshedResponse = await profileFetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" }).catch(() => null);
        if (!refreshedResponse?.ok) return "";
        const refreshed = await refreshedResponse.json().catch(() => ({}));
        return refreshed.mediaUrl || "";
      };
      const profileVideoCard = mediaUrl => profilePostCard({ content: "Profile video", mediaType: "video", mediaUrl, refreshMedia: refreshProfileVideo });
      const videoResponse = await profileFetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" });
      if (version !== profileTabVersion) return;
      if (!videoResponse.ok && videoResponse.status !== 404) throw new Error("Profile video is temporarily unavailable.");
      if (videoResponse.ok) {
        const stored = await videoResponse.json();
        if (version !== profileTabVersion) return;
        if (stored.mediaUrl) {
          tabMessage.appendChild(profileVideoCard(stored.mediaUrl));
        } else if (stored.mediaKey && !viewingOtherProfile) {
          const viewResponse = await profileFetch(profileApi + "/stories", {
            method: "POST", credentials: "include", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view", mediaKey: stored.mediaKey, mediaType: "video" })
          });
          if (viewResponse.ok) {
            const view = await viewResponse.json();
            if (version !== profileTabVersion) return;
            tabMessage.appendChild(profileVideoCard(view.mediaUrl));
          }
        }
      }
    }
    if (!posts.length && !tabMessage.childElementCount) { tabMessage.textContent = mediaOnly ? "No photos or videos to show yet." : "No posts to show yet."; return; }
  } catch (error) {
    if (version !== profileTabVersion) return;
    if (tabMessage.childElementCount) {
      const notice = document.createElement("p");
      notice.className = "muted";
      notice.textContent = "Some profile media could not be loaded. Reopen Media to retry.";
      tabMessage.appendChild(notice);
    } else tabMessage.textContent = error.message;
  }
}

async function loadProfileFriends() {
  const version = profileTabVersion;
  if (viewingOtherProfile) { tabMessage.textContent = "This member’s friend list is private."; return; }
  tabMessage.textContent = "Loading friends…";
  try {
    const [friendsResult, directoryResult] = await Promise.allSettled([
      profileFetch(profileApi + "/friends", { credentials: "include", cache: "no-store" }),
      profileFetch(profileApi + "/calls/directory", { credentials: "include", cache: "no-store" })
    ]);
    const response = friendsResult.status === "fulfilled" ? friendsResult.value : null;
    if (!response?.ok) throw new Error("Friends could not be loaded");
    const data = await response.json();
    const directoryResponse = directoryResult.status === "fulfilled" ? directoryResult.value : null;
    const online = new Set(directoryResponse?.ok
      ? ((await directoryResponse.json()).users || [])
        .filter(user => user.online === true)
        .map(user => String(user.email || "").toLowerCase())
      : []);
    if (version !== profileTabVersion) return;
    tabMessage.replaceChildren();
    if (!(data.friends || []).length) { tabMessage.textContent = "No friends yet."; return; }
    const grid = document.createElement("div"); grid.className = "profile-friend-grid";
    for (const friend of data.friends) {
      const link = document.createElement("a"); link.className = "profile-friend-card"; link.href = "profile.html?member=" + encodeURIComponent(friend.memberId);
      const avatar = friend.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
      if (friend.picture) { avatar.src = friend.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
      else { avatar.textContent = (friend.name || "DanzStak member").charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
      const copy = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = friend.name || "DanzStak member";
      const status = document.createElement("span");
      const isOnline = online.has(String(friend.email || "").toLowerCase());
      status.className = isOnline ? "profile-friend-presence online" : "profile-friend-presence";
      status.title = isOnline ? "Online" : "Offline";
      status.setAttribute("aria-hidden", "true");
      const availability = document.createElement("small"); availability.textContent = isOnline ? "Online" : "Offline";
      copy.append(name, availability); link.append(avatar, copy, status); grid.appendChild(link);
    }
    tabMessage.appendChild(grid);
  } catch (error) { if (version === profileTabVersion) tabMessage.textContent = error.message; }
}

tabs.addEventListener("click", async event => {
  const tab = event.target.closest("[data-profile-tab]");
  if (!tab) return;
  profileTabVersion += 1;
  tabs.querySelectorAll("button").forEach(button => { const selected = button === tab; button.classList.toggle("active", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
  const name = tab.dataset.profileTab;
  window.history?.replaceState?.(null, "", "#" + name.toLowerCase());
  details.hidden = name !== "About";
  tabMessage.hidden = name === "About";
  if (name === "Posts") await loadProfilePosts(false);
  else if (name === "Featured") await loadProfilePosts(false, "featured");
  else if (name === "Memories" && !viewingOtherProfile) await loadProfilePosts(false, "memories");
  else if (name === "Friends") await loadProfileFriends();
  else if (name === "Media") await loadProfilePosts(true);
});
tabs.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = [...tabs.querySelectorAll('[role="tab"]:not([hidden])')];
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus();
  buttons[next].click();
});

const panel = document.createElement("form");
panel.className = "edit-profile-panel";
panel.hidden = true;
panel.innerHTML = '<h2>' + profileEditorWords.heading + '</h2>' +
  '<div class="profile-identity-fields"><label>' + profileEditorWords.name + '<input name="name" minlength="2" maxlength="80" autocomplete="name" required><small>' + profileEditorWords.nameHelp + '</small></label></div>' +
  '<details class="profile-edit-section profile-username"><summary>' + profileEditorWords.advanced + '</summary><div class="profile-edit-section-body"><label>' + profileEditorWords.handle + '<input name="handle" minlength="3" maxlength="24" pattern="[A-Za-z0-9._]+"><small>' + profileEditorWords.handleHelp + '</small></label></div></details>' +
  '<details class="profile-edit-section"><summary>More profile details</summary><div class="profile-edit-section-body">' +
  '<label>Bio<textarea name="bio" maxlength="160"></textarea></label>' +
  '<label>Location<input name="location" maxlength="80"></label>' +
  '<label>Work<input name="work" maxlength="100"></label>' +
  '<label>Website<input name="website" type="url" maxlength="200" placeholder="https://"></label>' +
  '<label>DanzStak language<select name="language" data-profile-language></select></label></div></details>' +
  '<details class="profile-edit-section" data-profile-privacy><summary>Privacy and tagging</summary><div class="profile-edit-section-body">' +
  '<label>Who can post on your profile?<select name="profilePostPermission"><option value="owner">Just me</option><option value="friends">Friends</option><option value="anyone">Public</option></select></label>' +
  '<label class="profile-tag-setting"><input name="allowTags" type="checkbox">Allow accepted friends to tag me in photos and videos</label></div></details>' +
  '<p class="edit-note">' + profileEditorWords.note + '</p>' +
  '<div class="edit-actions"><button class="secondary" type="button" data-cancel>' + profileEditorWords.cancel + '</button><button class="button" type="submit">' + profileEditorWords.save + '</button></div>' +
  '<details class="profile-edit-section profile-import"><summary>Import from Facebook</summary><div class="profile-edit-section-body"><button type="button" data-facebook-import>Choose Facebook export</button><p>Preview your export, set Public, Friends, or Just me in batches, and review shared-source posts before copying them.</p></div></details>';
// Keep profile controls beside the profile actions instead of after the entire
// post history.  Appending the form to the card made a deep profile timeline
// push the editor off-screen while the edit route was trying to focus it.
actions.insertAdjacentElement("afterend", panel);
const profileLanguage = panel.querySelector("[data-profile-language]");
for (const [code, label] of (window.danzstakLanguages || [["en", "English"]])) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = label;
  profileLanguage.appendChild(option);
}
const mediaItems = [...mediaTools.children];
for (const [field,label] of [["avatar","Profile photo"],["cover","Cover photo"],["video","Profile video"]]) {
  const menu = document.createElement("details"); menu.className = "profile-media-menu";
  const summary = document.createElement("summary"); summary.textContent = label; menu.appendChild(summary);
  for (const control of mediaItems) if (control.dataset.mediaField === field) menu.appendChild(control);
  mediaTools.appendChild(menu);
}
const mediaSection = document.createElement("details");
mediaSection.className = "profile-edit-section";
const mediaSummary = document.createElement("summary");
mediaSummary.textContent = "Photos and video";
const mediaBody = document.createElement("div");
mediaBody.className = "profile-edit-section-body";
mediaBody.appendChild(mediaTools);
mediaSection.append(mediaSummary, mediaBody);
panel.querySelector(".profile-identity-fields").insertAdjacentElement("afterend", mediaSection);
panel.querySelector("[data-facebook-import]").addEventListener("click", event => window.openDanzStakFacebookImport?.(event.currentTarget));

function savedProfile() {
  try { return JSON.parse(localStorage.getItem(profileKey) || "{}"); }
  catch { return {}; }
}

function renderProfileWebsite(value) {
  const target = document.getElementById("profileWebsite");
  const text = String(value || "").trim();
  target.replaceChildren();
  if (!text) { target.textContent = "Not added"; return; }
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported website scheme");
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer nofollow ugc";
    link.referrerPolicy = "no-referrer";
    link.textContent = text;
    link.setAttribute("aria-label", "Open " + text + " in a new tab");
    target.appendChild(link);
  } catch { target.textContent = text; }
}

function applyProfile(profile) {
  if (profile.name) document.getElementById("profileName").textContent = profile.name;
  if (profile.handle) handleElement.textContent = "@" + profile.handle;
  bioElement.textContent = profile.bio || "Add a short bio so people know more about you.";
  setProfileDetail("profileLocation", profile.location);
  setProfileDetail("profileWork", profile.work);
  renderProfileWebsite(profile.website);
  document.getElementById("profileWebsite").closest(".detail").hidden = viewingOtherProfile && !String(profile.website || "").trim();
  details.hidden = viewingOtherProfile && ![...details.querySelectorAll(".detail")].some(box => !box.hidden);
  const name = document.getElementById("profileName").textContent.trim();
  const avatar = document.getElementById("profileInitial");
  if (profile.picture) { avatar.style.backgroundImage = `url("${profile.picture}")`; avatar.classList.add("has-photo"); avatar.textContent = ""; }
  else { avatar.style.backgroundImage = ""; avatar.classList.remove("has-photo"); avatar.textContent = name.charAt(0).toUpperCase() || "D"; }
  const cover = document.querySelector(".cover");
  if (profile.cover) {
    cover.style.backgroundImage = `url("${profile.cover}")`;
    cover.style.backgroundPosition = `${profile.coverX ?? 50}% ${profile.coverY ?? 50}%`;
    cover.style.backgroundSize = profile.coverFit ? "contain" : "cover";
    cover.style.backgroundRepeat = "no-repeat";
    cover.classList.add("has-photo");
  } else if (viewingOtherProfile || profile.cloudProfile) {
    cover.style.backgroundImage = "";
    cover.classList.remove("has-photo");
  }
}

editButton.addEventListener("click", () => {
  const profile = window.danzstakCurrentProfile?.cloudProfile ? window.danzstakCurrentProfile : savedProfile();
  panel.elements.name.value = profile.name || document.getElementById("profileName").textContent;
  panel.elements.handle.value = profile.handle || handleElement.textContent.replace(/^@/, "");
  panel.elements.bio.value = profile.bio || "";
  panel.elements.location.value = profile.location || "";
  panel.elements.work.value = profile.work || "";
  panel.elements.website.value = profile.website || "";
  panel.elements.profilePostPermission.value = profile.profilePostPermission || "owner";
  panel.elements.allowTags.checked = profile.allowTags !== false;
  panel.elements.language.value = (() => { try { return localStorage.getItem("danzstak_language") || document.documentElement.lang || "en"; } catch { return document.documentElement.lang || "en"; } })();
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
});
nameEditHint.addEventListener("click", () => {
  editButton.click();
  requestAnimationFrame(() => panel.elements.name.focus({ preventScroll: true }));
});
document.getElementById("profileName").addEventListener("click", () => {
  if (viewingOtherProfile || editButton.hidden) return;
  nameEditHint.click();
});

panel.querySelector("[data-cancel]").addEventListener("click", () => { panel.hidden = true; repositioning = false; finishReposition.hidden = true; coverElement.classList.remove("repositioning"); repositionButton.classList.remove("active"); repositionButton.textContent = "Reposition Cover"; });
panel.addEventListener("submit", async event => {
  event.preventDefault();
  if (!panel.reportValidity()) return;
  const profile = Object.fromEntries(new FormData(panel).entries());
  profile.allowTags = panel.elements.allowTags.checked;
  profile.handle = (profile.handle || "").replace(/^@/, "") || (window.danzstakCurrentProfile?.handle || handleElement.textContent.replace(/^@/, ""));
  const language = profile.language;
  delete profile.language;
  if (window.danzstakSetLanguage) window.danzstakSetLanguage(language);
  const status = document.getElementById("profileStatus");
  const submit = panel.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    if (window.danzstakCurrentProfile?.cloudProfile) {
      const saved = await saveCloudProfile(profile);
      applyProfile(saved || profile);
      status.textContent = profileTranslate("Profile saved to your DanzStak account.");
    } else {
      localStorage.setItem(profileKey, JSON.stringify(profile));
      applyProfile(profile);
      status.textContent = profileTranslate("Profile saved in this browser. Cloud sync is temporarily unavailable.");
    }
    panel.hidden = true;
  } catch (error) {
    status.textContent = error.message;
  } finally { submit.disabled = false; }
  status.hidden = false;
});

if (!viewingOtherProfile) {
  applyProfile(savedProfile());
  try { applyProfileMedia(JSON.parse(localStorage.getItem(profileMediaKey) || "{}")); } catch { /* Ignore corrupt local drafts. */ }
}
function applyLoadedProfile(profile = {}) {
  tabs.querySelector('[data-profile-tab="Memories"]').hidden = profile.isOwner !== true;
  if (profile.isOwner === true) {
    viewingOtherProfile = false;
    editButton.hidden = false;
    nameEditHint.hidden = false;
    const profileName = document.getElementById("profileName");
    profileName.classList.add("profile-name-editable");
    profileName.tabIndex = 0;
    profileName.setAttribute("role", "button");
    profileName.setAttribute("aria-label", profileEditorWords.tap);
    profileName.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      nameEditHint.click();
    }, { once: false });
    mediaTools.hidden = false;
    const requestedEdit = new URLSearchParams(location.search).get("edit");
    if (["identity", "privacy"].includes(requestedEdit) && panel.dataset.routeOpened !== "true") {
      panel.dataset.routeOpened = "true";
      editButton.click();
      requestAnimationFrame(() => {
        const requestedControl = requestedEdit === "privacy" ? panel.elements.profilePostPermission : panel.elements.name;
        const requestedSection = requestedControl.closest("details");
        if (requestedSection) requestedSection.open = true;
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        requestedControl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        requestedControl.focus({ preventScroll: true });
      });
    }
  }
  applyProfile(profile.cloudProfile ? profile : savedProfile());
  if (profile.cloudProfile) {
    fitCoverButton.classList.toggle("active", Boolean(profile.coverFit));
    fitCoverButton.textContent = profile.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
    if (!viewingOtherProfile) revealProfileVideoControls();
  }
  if (tabs.dataset.initialized !== "true") {
    tabs.dataset.initialized = "true";
    const requested = requestedProfileTab();
    const target = requested === "Memories" && profile.isOwner !== true ? "Posts" : requested;
    tabs.querySelector(`[data-profile-tab="${target}"]`).click();
  }
}
window.addEventListener("danzstak:profile-loaded", event => applyLoadedProfile(event.detail || {}));
if (window.danzstakCurrentProfile) applyLoadedProfile(window.danzstakCurrentProfile);
