"use strict";

const profileKey = "danzstak_profile_draft";
const profileCard = document.querySelector(".card");
const profileContent = document.getElementById("profileContent");
const details = profileContent.querySelector(".details");
const handleElement = document.getElementById("profileHandle");
const profileMediaKey = "danzstak_profile_media";
const profileApi = "https://api.danzstak.com";
const profileEditorCopy = {
  en: { edit:"Edit Profile",heading:"Edit your profile",name:"Name people see",nameHelp:"This is the name friends and other members will see.",language:"DanzStak language",advanced:"Username (optional)",handle:"Username",handleHelp:"You do not need to change this to change your visible name.",tap:"Tap your name to change it",cancel:"Cancel",save:"Save name and profile",note:"Choose the name you want other members to see. You can edit the rest of your profile whenever you want." },
  es: { edit:"Editar perfil",heading:"Edita tu perfil",name:"Nombre que verán los demás",nameHelp:"Este es el nombre que verán tus amigos y otros miembros.",language:"Idioma de DanzStak",advanced:"Nombre de usuario (opcional)",handle:"Nombre de usuario",handleHelp:"No necesitas cambiarlo para modificar tu nombre visible.",tap:"Toca tu nombre para cambiarlo",cancel:"Cancelar",save:"Guardar nombre y perfil",note:"Elige el nombre que quieres mostrar. Puedes editar el resto del perfil cuando quieras." },
  fr: { edit:"Modifier le profil",heading:"Modifiez votre profil",name:"Nom visible par les autres",nameHelp:"C’est le nom que vos amis et les autres membres verront.",language:"Langue de DanzStak",advanced:"Nom d’utilisateur (facultatif)",handle:"Nom d’utilisateur",handleHelp:"Vous n’avez pas besoin de le modifier pour changer votre nom affiché.",tap:"Touchez votre nom pour le modifier",cancel:"Annuler",save:"Enregistrer le nom et le profil",note:"Choisissez le nom à afficher. Vous pourrez modifier le reste du profil à tout moment." },
  de: { edit:"Profil bearbeiten",heading:"Profil bearbeiten",name:"Sichtbarer Name",nameHelp:"Diesen Namen sehen Freunde und andere Mitglieder.",language:"DanzStak-Sprache",advanced:"Benutzername (optional)",handle:"Benutzername",handleHelp:"Du musst ihn nicht ändern, um deinen sichtbaren Namen zu ändern.",tap:"Tippe auf deinen Namen, um ihn zu ändern",cancel:"Abbrechen",save:"Name und Profil speichern",note:"Wähle den Namen, den andere sehen sollen. Den Rest deines Profils kannst du jederzeit bearbeiten." },
  pt: { edit:"Editar perfil",heading:"Edite seu perfil",name:"Nome que as pessoas verão",nameHelp:"Este é o nome que amigos e outros membros verão.",language:"Idioma do DanzStak",advanced:"Nome de usuário (opcional)",handle:"Nome de usuário",handleHelp:"Você não precisa alterá-lo para mudar seu nome visível.",tap:"Toque no seu nome para mudar",cancel:"Cancelar",save:"Salvar nome e perfil",note:"Escolha o nome que deseja mostrar. Você pode editar o restante do perfil quando quiser." },
  it: { edit:"Modifica profilo",heading:"Modifica il tuo profilo",name:"Nome visibile agli altri",nameHelp:"Questo è il nome che amici e altri membri vedranno.",language:"Lingua di DanzStak",advanced:"Nome utente (facoltativo)",handle:"Nome utente",handleHelp:"Non devi modificarlo per cambiare il nome visibile.",tap:"Tocca il tuo nome per cambiarlo",cancel:"Annulla",save:"Salva nome e profilo",note:"Scegli il nome che vuoi mostrare agli altri membri. Puoi modificare il resto del profilo quando vuoi." },
  ko: { edit:"프로필 편집",heading:"프로필 편집",name:"사람들에게 보일 이름",nameHelp:"친구와 다른 회원에게 이 이름이 표시됩니다.",language:"DanzStak 언어",advanced:"사용자 이름 (선택 사항)",handle:"사용자 이름",handleHelp:"표시 이름을 바꾸기 위해 이 항목을 변경할 필요는 없습니다.",tap:"이름을 눌러 변경",cancel:"취소",save:"이름과 프로필 저장",note:"다른 회원에게 보여 줄 이름을 선택하세요. 나머지 프로필은 언제든 수정할 수 있습니다." },
  ja: { edit:"プロフィールを編集",heading:"プロフィールを編集",name:"表示する名前",nameHelp:"友達やほかのメンバーにはこの名前が表示されます。",language:"DanzStakの言語",advanced:"ユーザー名（任意）",handle:"ユーザー名",handleHelp:"表示名を変えるために変更する必要はありません。",tap:"名前をタップして変更",cancel:"キャンセル",save:"名前とプロフィールを保存",note:"ほかのメンバーに表示する名前を選んでください。ほかのプロフィール項目はいつでも編集できます。" },
  "zh-Hans": { edit:"编辑个人资料",heading:"编辑个人资料",name:"向他人显示的名字",nameHelp:"好友和其他成员会看到这个名字。",language:"DanzStak语言",advanced:"用户名（可选）",handle:"用户名",handleHelp:"更改显示名字时无需修改用户名。",tap:"点按名字进行更改",cancel:"取消",save:"保存名字和个人资料",note:"选择你想让其他成员看到的名字。其他资料可随时编辑。" },
  "zh-Hant": { edit:"編輯個人檔案",heading:"編輯個人檔案",name:"向他人顯示的名字",nameHelp:"好友和其他成員會看到這個名字。",language:"DanzStak語言",advanced:"使用者名稱（選填）",handle:"使用者名稱",handleHelp:"更改顯示名字時不需要修改使用者名稱。",tap:"點按名字進行更改",cancel:"取消",save:"儲存名字和個人檔案",note:"選擇你想讓其他成員看到的名字。其他資料可隨時編輯。" },
  fil: { edit:"I-edit ang profile",heading:"I-edit ang iyong profile",name:"Pangalang makikita ng iba",nameHelp:"Ito ang pangalang makikita ng mga kaibigan at ibang miyembro.",language:"Wika ng DanzStak",advanced:"Username (opsyonal)",handle:"Username",handleHelp:"Hindi mo ito kailangang baguhin para palitan ang nakikitang pangalan.",tap:"I-tap ang pangalan para baguhin",cancel:"Kanselahin",save:"I-save ang pangalan at profile",note:"Piliin ang pangalang gusto mong ipakita. Maaari mong i-edit ang ibang detalye anumang oras." },
  hi: { edit:"प्रोफ़ाइल संपादित करें",heading:"अपनी प्रोफ़ाइल संपादित करें",name:"लोगों को दिखने वाला नाम",nameHelp:"दोस्तों और दूसरे सदस्यों को यही नाम दिखेगा।",language:"DanzStak की भाषा",advanced:"उपयोगकर्ता नाम (वैकल्पिक)",handle:"उपयोगकर्ता नाम",handleHelp:"दिखाई देने वाला नाम बदलने के लिए इसे बदलना ज़रूरी नहीं है।",tap:"नाम बदलने के लिए उस पर टैप करें",cancel:"रद्द करें",save:"नाम और प्रोफ़ाइल सहेजें",note:"वह नाम चुनें जो आप दूसरे सदस्यों को दिखाना चाहते हैं। बाकी प्रोफ़ाइल कभी भी बदल सकते हैं।" },
  vi: { edit:"Chỉnh sửa trang cá nhân",heading:"Chỉnh sửa trang cá nhân",name:"Tên mọi người sẽ thấy",nameHelp:"Bạn bè và các thành viên khác sẽ thấy tên này.",language:"Ngôn ngữ DanzStak",advanced:"Tên người dùng (không bắt buộc)",handle:"Tên người dùng",handleHelp:"Bạn không cần đổi mục này để thay tên hiển thị.",tap:"Chạm vào tên để thay đổi",cancel:"Hủy",save:"Lưu tên và trang cá nhân",note:"Chọn tên bạn muốn hiển thị. Bạn có thể chỉnh sửa phần còn lại bất cứ lúc nào." },
  th: { edit:"แก้ไขโปรไฟล์",heading:"แก้ไขโปรไฟล์ของคุณ",name:"ชื่อที่คนอื่นจะเห็น",nameHelp:"เพื่อนและสมาชิกคนอื่นจะเห็นชื่อนี้",language:"ภาษาของ DanzStak",advanced:"ชื่อผู้ใช้ (ไม่บังคับ)",handle:"ชื่อผู้ใช้",handleHelp:"ไม่ต้องเปลี่ยนส่วนนี้เพื่อเปลี่ยนชื่อที่แสดง",tap:"แตะชื่อเพื่อเปลี่ยน",cancel:"ยกเลิก",save:"บันทึกชื่อและโปรไฟล์",note:"เลือกชื่อที่ต้องการแสดง คุณแก้ไขข้อมูลส่วนอื่นได้ทุกเมื่อ" },
  id: { edit:"Edit profil",heading:"Edit profil Anda",name:"Nama yang dilihat orang lain",nameHelp:"Teman dan anggota lain akan melihat nama ini.",language:"Bahasa DanzStak",advanced:"Nama pengguna (opsional)",handle:"Nama pengguna",handleHelp:"Anda tidak perlu mengubahnya untuk mengganti nama tampilan.",tap:"Ketuk nama untuk mengubahnya",cancel:"Batal",save:"Simpan nama dan profil",note:"Pilih nama yang ingin ditampilkan. Anda dapat mengedit bagian profil lainnya kapan saja." }
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
// Fix-it 18 (owner 2026-11-17): no instructional placeholder. Visitors see nothing until there is a bio; the owner
// gets one small "+ bio" icon that opens the editor.
bioElement.hidden = true;
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
editButton.dataset.icon = "edit"; editButton.setAttribute("aria-label", profileEditorWords.edit);
actions.appendChild(editButton);
const shopManagementLink = document.createElement("a");
shopManagementLink.className = "button";
shopManagementLink.href = "store.html?manage=1";
shopManagementLink.textContent = "Open my shop";
shopManagementLink.setAttribute("role", "button"); shopManagementLink.dataset.icon = "store"; shopManagementLink.setAttribute("aria-label", "Open my shop");
shopManagementLink.hidden = viewingOtherProfile;
actions.appendChild(shopManagementLink);
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
for (const name of ["Posts", "About", "Friends", "Photos", "Videos", "More"]) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.textContent = name;
  tab.dataset.profileTab = name;
  tab.classList.toggle("active", name === "Posts");
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(name === "Posts"));
  tab.tabIndex = name === "Posts" ? 0 : -1;
  if (name === "More") tab.hidden = true; // shown (as "Shop") only when the member has a shop
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
  const insert = node => {
    const engagement = article.querySelector(".profile-post-engagement");
    const tools = article.querySelector(".profile-post-tools");
    if (engagement) engagement.before(node);
    else if (tools) tools.before(node);
    else article.appendChild(node);
  };
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
    else { media.preload = "metadata"; media.muted = true; media.playsInline = true; media.setAttribute("aria-label", post.content ? "Video: " + post.content : "Profile post video"); }
    media.src = mediaUrl;
    // Fix-it 18 (owner 2026-11-17): like a familiar feed. No browser controls (media-visibility.js autoplays muted at 50%
    // and adds the mute toggle); tap opens the photo or video whole, full screen.
    media.tabIndex = 0;
    media.setAttribute("role", "button");
    const openWhole = event => {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest?.(".danzstak-audio-toggle")) return;
      event.preventDefault();
      window.danzstakProfileDailies?.openMedia?.([{ mediaType: post.mediaType, mediaUrl, label: post.content || (post.mediaType === "video" ? profileTranslate("Profile post video") : profileTranslate("Profile post photo")) }], 0, media);
    };
    media.addEventListener("click", openWhole);
    media.addEventListener("keydown", openWhole);
    insert(media);
  };
  retry.addEventListener("click", () => { post.mediaUrl = ""; void install(); });
  void install();
}

function profilePostCard(post) {
  const article = document.createElement("article");
  article.className = "profile-post-card";
  if (post.postId) {
    article.dataset.postId = post.postId;
    article.dataset.isOwner = String(post.isOwner === true);
    article.dataset.viewCount = String(post.viewCount || 0);
    article.dataset.audience = post.audience || "public";
  }
  const currentProfile = window.danzstakCurrentProfile || {};
  const header = document.createElement("header");
  header.className = "profile-post-header";
  const authorPicture = String(post.authorPicture || currentProfile.picture || "").trim();
  const authorName = String(post.authorName || currentProfile.name || "DanzStak member").trim() || "DanzStak member";
  const avatar = document.createElement(authorPicture ? "img" : "span");
  avatar.className = "profile-post-avatar";
  if (authorPicture) {
    avatar.alt = "";
    avatar.src = authorPicture;
    avatar.referrerPolicy = "no-referrer";
    window.danzstakIdentityMedia?.install(avatar, { name: authorName, picture: authorPicture });
  } else {
    avatar.textContent = authorName.charAt(0).toUpperCase() || "D";
    avatar.setAttribute("aria-hidden", "true");
  }
  const authorDetails = document.createElement("div");
  authorDetails.className = "profile-post-author-details";
  const author = document.createElement("strong");
  author.className = "profile-post-author";
  author.textContent = authorName;
  const meta = document.createElement("div");
  meta.className = "profile-post-meta";
  const time = document.createElement("time");
  const created = post.createdAt ? new Date(post.createdAt) : null;
  time.textContent = created && !Number.isNaN(created.valueOf()) ? created.toLocaleString() : "Recent post";
  const audience = document.createElement("span");
  audience.textContent = post.audience === "private" ? "Just me" : post.audience === "friends" ? "Friends" : "Public";
  meta.append(time, document.createTextNode(" · "), audience);
  authorDetails.append(author, meta);
  header.append(avatar, authorDetails);
  const text = document.createElement("p");
  text.className = "profile-post-content";
  const postContent = String(post.content || "Shared media");
  window.danzstakRenderUserText?.(text, post.content || "Shared media") || (text.textContent = postContent);
  article.append(header, text);
  if (postContent.trim().length > 280) {
    text.classList.add("is-collapsed");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "profile-post-text-toggle";
    toggle.textContent = profileTranslate("See more");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      text.classList.toggle("is-collapsed", expanded);
      toggle.textContent = profileTranslate(expanded ? "See more" : "See less");
    });
    article.appendChild(toggle);
  }
  if ((post.postId || typeof post.refreshMedia === "function") && ["image", "video"].includes(post.mediaType)) installProfilePostMedia(article, post);
  else if (post.mediaUrl && ["image", "video"].includes(post.mediaType)) {
    const media = document.createElement(post.mediaType === "image" ? "img" : "video");
    media.className = "profile-post-media"; media.src = post.mediaUrl;
    if (post.mediaType === "image") media.alt = post.content || "Profile post photo";
    else { media.preload = "metadata"; media.muted = true; media.playsInline = true; media.setAttribute("aria-label", post.content ? "Video: " + post.content : "Profile post video"); }
    article.appendChild(media);
  }
  const tools = document.createElement("div");
  tools.className = "profile-post-tools";
  window.danzstakRenderSharedPost?.(article, post);
  window.danzstakRenderMediaTags?.(article, post);
  // Fix-it 18 (owner 2026-11-17): no big text buttons on the profile. The post is already in context (no open-in-Mix link),
  // Featured is gone from profiles (no feature toggle), and removing someone else's wall post is a slim icon.
  if (post.canRemoveFromProfile === true && post.postId) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "profile-wall-remove";
    remove.dataset.icon = "trash";
    remove.setAttribute("aria-label", profileTranslate("Remove from my profile"));
    remove.title = remove.getAttribute("aria-label");
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
    tools.appendChild(remove);
  }
  if (tools.childElementCount) article.appendChild(tools);
  window.danzstakEnhanceProfilePost?.(article, post);
  return article;
}

function profileWallComposer(profile) {
  const section = document.createElement("section");
  section.className = "profile-wall-composer";
  if (!profile.canPostToProfile && profile.isOwner !== true) {
    // Fix-it 18: no instructional copy where there is nothing to do; a visitor who can't post simply sees no composer.
    section.hidden = true;
    return section;
  }
  section.classList.toggle("profile-wall-composer-owner", profile.isOwner === true);
  const compact = document.createElement("div");
  compact.className = "profile-create-row";
  const compactAvatar = document.createElement("span");
  compactAvatar.className = "profile-create-avatar";
  compactAvatar.textContent = String(profile.isOwner ? profile.name || "" : "").trim().charAt(0).toUpperCase() || "·"; // never the DanzStak "D"
  compactAvatar.setAttribute("aria-hidden", "true");
  const installCompactAvatar = viewer => {
    const name = String(viewer?.name || "DanzStak member");
    const picture = String(viewer?.picture || "");
    if (!picture) { compactAvatar.textContent = name.charAt(0).toUpperCase() || "D"; return; }
    const image = document.createElement("img");
    image.className = compactAvatar.className;
    image.src = picture;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    window.danzstakIdentityMedia?.install(image, viewer);
    compactAvatar.replaceWith(image);
  };
  // Owner 2026-11-18: the composer shows the member's own profile photo. The wall can render before the profile
  // photo arrives, so the owner's photo is fetched too when it isn't in hand yet.
  if (profile.isOwner && profile.picture) installCompactAvatar(profile);
  else profileFetch(profileApi + "/profiles", { credentials: "include", cache: "no-store" })
    .then(async response => { if (response.ok) installCompactAvatar((await response.json()).profile || {}); })
    .catch(() => {});
  const opener = document.createElement("button");
  opener.type = "button";
  opener.className = "profile-create-opener";
  opener.textContent = profile.isOwner ? "What’s on your mind?" : `Write something to ${profile.name || "this member"}…`;
  opener.setAttribute("aria-expanded", "false");
  compact.append(compactAvatar, opener);

  const shortcuts = document.createElement("div");
  shortcuts.className = "profile-create-shortcuts";
  const form = document.createElement("form");
  form.className = "profile-create-form";
  form.hidden = true;
  const textarea = document.createElement("textarea");
  textarea.name = "content";
  textarea.maxLength = 5000;
  textarea.placeholder = profile.isOwner ? "What’s on your mind?" : `Write something to ${profile.name || "this member"}…`;
  textarea.setAttribute("aria-label", textarea.placeholder);
  const audience = document.createElement("select");
  audience.name = "audience";
  audience.setAttribute("aria-label", "Who can see this post");
  for (const [value, label] of [["public", "Public"], ["friends", "Friends"], ["private", "Just me"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    audience.appendChild(option);
  }
  if (!profile.isOwner) { audience.value = "public"; audience.hidden = true; }
  const mediaInput = document.createElement("input");
  mediaInput.type = "file";
  mediaInput.accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
  mediaInput.hidden = true;
  const preview = document.createElement("div");
  preview.className = "profile-create-preview";
  preview.hidden = true;
  let selectedMedia = null;
  const clearMedia = () => {
    if (selectedMedia?.previewUrl) URL.revokeObjectURL(selectedMedia.previewUrl);
    selectedMedia = null;
    mediaInput.value = "";
    preview.replaceChildren();
    preview.hidden = true;
  };
  mediaInput.addEventListener("change", () => {
    const file = mediaInput.files?.[0];
    if (!file) return;
    const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "";
    if (!mediaType || mediaType === "video" && file.size > 100 * 1024 * 1024) {
      mediaInput.value = "";
      showProfileFeedback(mediaType === "video" ? "Video must be smaller than 100 MB." : "Choose a supported photo or video.", { urgent: true });
      return;
    }
    clearMedia();
    selectedMedia = { file, mediaType, previewUrl: URL.createObjectURL(file) };
    const media = document.createElement(mediaType === "image" ? "img" : "video");
    media.src = selectedMedia.previewUrl;
    media.alt = "";
    if (mediaType === "video") { media.controls = true; media.muted = true; media.playsInline = true; }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remove media";
    remove.addEventListener("click", clearMedia);
    preview.append(media, remove);
    preview.hidden = false;
    form.hidden = false;
    opener.setAttribute("aria-expanded", "true");
  });
  const addShortcut = (label, icon, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-create-shortcut";
    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = icon;
    button.setAttribute("aria-label", label); button.title = label;
    button.dataset.icon = icon; // icon-buttons.js draws it
    button.append(symbol);
    button.addEventListener("click", handler);
    shortcuts.appendChild(button);
  };
  addShortcut("Add a video", "video", () => { mediaInput.accept = "video/mp4,video/webm,video/quicktime"; mediaInput.click(); });
  addShortcut("Add a photo or video", "image", () => { mediaInput.accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"; mediaInput.click(); });
  const eventLink = document.createElement("a");
  eventLink.className = "profile-create-shortcut";
  eventLink.href = "feed.html?view=feed#events";
  eventLink.setAttribute("role", "button"); eventLink.dataset.icon = "calendar"; eventLink.setAttribute("aria-label", "Add an event"); eventLink.title = "Add an event";
  shortcuts.appendChild(eventLink);

  const certifyLabel = document.createElement("label");
  const certify = document.createElement("input");
  certify.type = "checkbox";
  certify.required = true;
  certifyLabel.className = "profile-wall-certify";
  certifyLabel.append(certify, document.createTextNode("This is my original content and may be shared on DanzStak."));
  const formActions = document.createElement("div");
  formActions.className = "profile-create-form-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary";
  cancel.textContent = "Cancel";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button";
  submit.textContent = "Post";
  const status = document.createElement("p");
  status.className = "muted profile-create-status";
  status.setAttribute("role", "status");
  formActions.append(cancel, submit);
  form.append(textarea, audience, mediaInput, preview, certifyLabel, formActions, status);
  const closeForm = () => {
    form.hidden = true;
    opener.setAttribute("aria-expanded", "false");
    textarea.value = "";
    certify.checked = false;
    status.textContent = "";
    clearMedia();
  };
  opener.addEventListener("click", () => {
    form.hidden = !form.hidden;
    opener.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) textarea.focus();
  });
  cancel.addEventListener("click", closeForm);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!textarea.value.trim() && !selectedMedia) return textarea.focus();
    if (!form.reportValidity()) return;
    submit.disabled = true; status.textContent = "Posting…";
    let uploadedMediaKey = "";
    try {
      let mediaKey = "", mediaType = "";
      if (selectedMedia) {
        const ticketResponse = await profileFetch(profileApi + "/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: selectedMedia.file.type, purpose: "post" }) }, 15000);
        const ticket = await ticketResponse.json().catch(() => ({}));
        if (!ticketResponse.ok || !ticket.uploadUrl || !ticket.mediaKey) throw new Error(ticket.error || "Media upload could not start.");
        const uploadDeadline = Math.max(120000, Math.ceil(selectedMedia.file.size / (64 * 1024)) * 1000);
        const uploadResponse = await profileFetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": selectedMedia.file.type }, body: selectedMedia.file }, uploadDeadline);
        if (!uploadResponse.ok) throw new Error("Media upload failed.");
        mediaKey = ticket.mediaKey;
        mediaType = ticket.mediaType;
        uploadedMediaKey = mediaKey;
      }
      // T0-A1: every posted video goes to The Roll (the server also adds Dailies by itself).
      const body = { content: textarea.value.trim() || "Shared media", audience: audience.value, originalContentCertified: true, mediaKey, mediaType, reel: mediaType === "video" };
      if (!profile.isOwner) body.profileMemberId = profile.memberId;
      const response = await profileFetch(profileApi + "/secure-posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The post could not be published.");
      uploadedMediaKey = "";
      closeForm();
      showProfileFeedback("Posted to this profile.");
      await loadProfilePosts(false);
    } catch (error) {
      if (uploadedMediaKey) profileFetch(profileApi + "/stories", { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard", mediaKey: uploadedMediaKey }) }, 5000).catch(() => {});
      status.textContent = error.message;
    }
    finally { submit.disabled = false; }
  });
  section.append(compact, shortcuts, form);
  return section;
}

const profileTabRoutes = new Map([
  ["posts", "Posts"], ["about", "About"], ["friends", "Friends"], ["photos", "Photos"], ["videos", "Videos"], ["more", "More"],
  ["shop", "More"]
]);
function requestedProfileTab() {
  return profileTabRoutes.get(String(window.location?.hash || "").replace(/^#/, "").toLowerCase()) || "Posts";
}
function requestedProfileMoreSection() {
  const route = String(window.location?.hash || "").replace(/^#/, "").toLowerCase();
  return new Map([["shop", "Shop"]]).get(route) || "";
}

let profileTabVersion = 0;
async function loadProfilePosts(mediaOnly = false, collection = "posts", mediaType = "") {
  const version = profileTabVersion;
  tabMessage.textContent = mediaOnly ? "Loading media…" : "Loading posts…";
  try {
    const response = await profileFetch(profileApi + "/secure-posts", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Profile posts could not be loaded");
    const data = await response.json();
    if (version !== profileTabVersion) return;
    const profileMemberId = String(window.danzstakCurrentProfile?.memberId || "");
    let posts = window.danzstakProfileCollections.select(data.posts || [], collection, "", !viewingOtherProfile, new Date(), profileMemberId);
    if (mediaOnly) posts = posts.filter(post => post.mediaUrl && ["image", "video"].includes(post.mediaType) && (!mediaType || post.mediaType === mediaType));
    tabMessage.replaceChildren();
    if (collection === "posts" && !mediaOnly && window.danzstakCurrentProfile && typeof profileWallComposer === "function") tabMessage.appendChild(profileWallComposer(window.danzstakCurrentProfile)); if (collection === "posts" && !mediaOnly) window.danzstakProfileDailies?.mount(tabMessage, profileMemberId);
    if (collection !== "posts") {
      const note = document.createElement("p"); note.className = "muted";
      note.textContent = collection === "memories" ? "Only you can see this Memories view. These are your posts from this day in previous years; their original audiences stay unchanged." : "Featured posts keep their original audience. Highlighting a post does not make it public.";
      tabMessage.appendChild(note);
      if (!posts.length) { const empty = document.createElement("p"); empty.textContent = collection === "memories" ? "No memories from this day yet." : "No featured posts to show yet."; tabMessage.appendChild(empty); }
    }
    // Owner 2026-11-18: the Videos tab is videos only (no captions, likes or comments); tap → full-screen vertical player.
    // Owner 2026-11-18: Photos the same way: photos only, tap → full screen, scroll through all of them.
    const videoGrid = mediaOnly && (mediaType === "video" || mediaType === "image") && window.danzstakProfileVideos ? window.danzstakProfileVideos.createGrid({ kind: mediaType }) : null;
    const addVideo = item => { if (!videoGrid) return false; videoGrid.add(item); if (videoGrid.items.length && !videoGrid.element.isConnected) tabMessage.appendChild(videoGrid.element); return true; };
    for (const post of posts) if (!addVideo({ mediaUrl: post.mediaUrl, content: post.content || "", refresh: () => refreshProfilePostMedia(post) })) tabMessage.appendChild(profilePostCard(post));
    if (mediaOnly && mediaType !== "image") {
      const params = new URLSearchParams();
      const profileMemberId = String(window.danzstakCurrentProfile?.memberId || "");
      if (viewingOtherProfile && /^[a-f0-9-]{36}$/.test(profileMemberId)) params.set("member", profileMemberId);
      const refreshProfileVideo = async () => {
        const refreshedResponse = await profileFetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" }).catch(() => null);
        if (!refreshedResponse?.ok) return "";
        const refreshed = await refreshedResponse.json().catch(() => ({}));
        return refreshed.mediaUrl || "";
      };
      const profileVideoCard = mediaUrl => addVideo({ mediaUrl, content: "Profile video", refresh: refreshProfileVideo }) ? videoGrid.element : profilePostCard({ content: "Profile video", mediaType: "video", mediaUrl, refreshMedia: refreshProfileVideo });
      const videoResponse = await profileFetch(profileApi + "/profile-video?" + params, { credentials: "include", cache: "no-store" });
      if (version !== profileTabVersion) return;
      if (!videoResponse.ok && videoResponse.status !== 404) throw new Error("Profile video is temporarily unavailable.");
      if (videoResponse.ok) {
        const stored = await videoResponse.json();
        if (version !== profileTabVersion) return;
        if (stored.mediaUrl) {
          { const card = profileVideoCard(stored.mediaUrl); if (!card.isConnected) tabMessage.appendChild(card); }
        } else if (stored.mediaKey && !viewingOtherProfile) {
          const viewResponse = await profileFetch(profileApi + "/stories", {
            method: "POST", credentials: "include", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view", mediaKey: stored.mediaKey, mediaType: "video" })
          });
          if (viewResponse.ok) {
            const view = await viewResponse.json();
            if (version !== profileTabVersion) return;
            { const card = profileVideoCard(view.mediaUrl); if (!card.isConnected) tabMessage.appendChild(card); }
          }
        }
      }
    }
    // Fix-it 18: an empty wall says so in one friendly line, below the composer and any Dailies.
    if (!posts.length && !mediaOnly && collection === "posts" && tabMessage.childElementCount) { const empty = document.createElement("p"); empty.className = "profile-empty-wall"; empty.textContent = profileTranslate("No posts yet"); tabMessage.appendChild(empty); return; }
    if (!posts.length && !tabMessage.childElementCount) { tabMessage.textContent = mediaOnly ? `No ${mediaType === "image" ? "photos" : mediaType === "video" ? "videos" : "photos or videos"} to show yet.` : "No posts to show yet."; return; }
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
    const onlineDirectory = directoryResponse?.ok ? ((await directoryResponse.json()).users || []).filter(user => user.online === true) : [];
    const online = new Set(onlineDirectory.map(user => String(user.email || "").toLowerCase()));
    if (version !== profileTabVersion) return;
    tabMessage.replaceChildren();
    const friendEmails = new Set((data.friends || []).map(friend => String(friend.email || "").toLowerCase()));
    const sortedFriends = [...(data.friends || [])].sort((a, b) => Number(online.has(String(b.email || "").toLowerCase())) - Number(online.has(String(a.email || "").toLowerCase())) || String(a.name || "").localeCompare(String(b.name || "")));
    const friendsHeading = document.createElement("h3"); friendsHeading.className = "profile-friends-heading"; friendsHeading.textContent = `Friends · ${sortedFriends.length}`;
    tabMessage.appendChild(friendsHeading);
    if (!sortedFriends.length) { const none = document.createElement("p"); none.className = "muted"; none.textContent = "No friends yet."; tabMessage.appendChild(none); }
    const grid = document.createElement("div"); grid.className = "profile-friend-grid";
    for (const friend of sortedFriends) {
      const link = document.createElement("a"); link.className = "profile-friend-card"; link.href = "profile.html?member=" + encodeURIComponent(friend.memberId);
      const avatar = friend.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
      if (friend.picture) { avatar.src = friend.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; window.danzstakIdentityMedia?.install(avatar, friend); }
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
    if (sortedFriends.length) tabMessage.appendChild(grid);
    // Owner 2026-11-17: pending requests live on the Friends tab too — incoming to answer, sent ones marked "Request sent".
    appendProfileFriendRequests(data.incoming, "incoming");
    appendProfileFriendRequests(data.outgoing, "outgoing");
    // Members online now (not already friends), like a familiar "active now" list.
    const onlineMembers = onlineDirectory.filter(user => !friendEmails.has(String(user.email || "").toLowerCase()) && /^[a-f0-9-]{36}$/.test(String(user.memberId || "")));
    if (onlineMembers.length) {
      const onlineHeading = document.createElement("h3"); onlineHeading.className = "profile-friends-heading"; onlineHeading.textContent = `Online now · ${onlineMembers.length}`;
      const onlineGrid = document.createElement("div"); onlineGrid.className = "profile-friend-grid";
      for (const member of onlineMembers) {
        const link = document.createElement("a"); link.className = "profile-friend-card"; link.href = "profile.html?member=" + encodeURIComponent(member.memberId);
        const avatar = member.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
        if (member.picture) { avatar.src = member.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; }
        else { avatar.textContent = (member.name || "DanzStak member").charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
        const copy = document.createElement("span"); const name = document.createElement("strong"); name.textContent = member.name || "DanzStak member";
        const availability = document.createElement("small"); availability.textContent = "Online";
        const status = document.createElement("span"); status.className = "profile-friend-presence online"; status.title = "Online"; status.setAttribute("aria-hidden", "true");
        copy.append(name, availability); link.append(avatar, copy, status); onlineGrid.appendChild(link);
      }
      tabMessage.append(onlineHeading, onlineGrid);
    }
  } catch (error) { if (version === profileTabVersion) tabMessage.textContent = error.message; }
}

function appendProfileFriendRequests(people, relationship) {
  const list = (Array.isArray(people) ? people : []).filter(person => /^[a-f0-9-]{36}$/.test(String(person.memberId || "")));
  if (!list.length) return;
  const heading = document.createElement("h3"); heading.className = "profile-friends-heading";
  heading.textContent = `${relationship === "incoming" ? "Friend requests" : "Requests sent"} · ${list.length}`;
  const grid = document.createElement("div"); grid.className = "profile-friend-grid";
  for (const person of [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))) {
    const displayName = person.name || "DanzStak member";
    const card = document.createElement("div"); card.className = "profile-friend-card profile-friend-request"; card.dataset.relationship = relationship;
    const link = document.createElement("a"); link.className = "profile-friend-request-link"; link.href = "profile.html?member=" + encodeURIComponent(person.memberId);
    const avatar = person.picture ? document.createElement("img") : document.createElement("span"); avatar.className = "profile-friend-avatar";
    if (person.picture) { avatar.src = person.picture; avatar.alt = ""; avatar.referrerPolicy = "no-referrer"; window.danzstakIdentityMedia?.install(avatar, person); }
    else { avatar.textContent = displayName.charAt(0).toUpperCase(); avatar.setAttribute("aria-hidden", "true"); }
    const copy = document.createElement("span"); const name = document.createElement("strong"); name.textContent = displayName;
    const detail = document.createElement("small"); detail.textContent = relationship === "incoming" ? "Wants to be friends" : "Request sent";
    copy.append(name, detail); link.append(avatar, copy); card.appendChild(link);
    if (relationship === "incoming") {
      const actions = document.createElement("span"); actions.className = "profile-friend-request-actions";
      for (const [accept, label, icon] of [[true, "Accept", "person-check"], [false, "Decline", "close"]]) {
        const button = document.createElement("button"); button.type = "button"; button.dataset.icon = icon;
        button.className = accept ? "profile-friend-accept" : "profile-friend-decline";
        button.setAttribute("aria-label", `${label}: ${displayName}`); button.title = button.getAttribute("aria-label"); button.textContent = label;
        button.addEventListener("click", async () => {
          actions.querySelectorAll("button").forEach(item => { item.disabled = true; });
          try {
            const response = await profileFetch(profileApi + "/friends/respond", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: person.email, accept }) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || "Friend request could not be updated.");
            window.danzstakShowFeedback?.(accept ? "You are now friends." : "Friend request declined.");
            void loadProfileFriends();
          } catch (error) {
            actions.querySelectorAll("button").forEach(item => { item.disabled = false; });
            window.danzstakShowFeedback?.(error.message, { urgent: true });
          }
        });
        actions.appendChild(button);
      }
      card.appendChild(actions);
    }
    grid.appendChild(card);
  }
  tabMessage.append(heading, grid);
  window.danzstakIcons?.enhance?.(grid);
}

let profileShop = null;
// Owner 2026-11-18: the Shop tab looks like the member's shop: a shop header, then the products as a 2-column grid
// of square photos with title, price and shipping. Tap a product to open it. Every word and image is the seller's.
function renderProfileShop(shop = {}, profile = {}) {
  const own = profile.isOwner === true;
  const money = cents => new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: "USD" }).format(Math.max(0, Number(cents || 0)) / 100);
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = el("section", "profile-shop"); root.setAttribute("aria-label", profileTranslate("Shop"));
  const head = el("header", "profile-shop-head");
  const kicker = el("p", "profile-shop-kicker", `${shop.name || profile.name || ""} · ${profileTranslate("Shop")}`.toUpperCase());
  head.append(kicker);
  if (own) {
    const manage = el("a", "ds-icon-button profile-shop-manage"); manage.href = "store.html?manage=1";
    manage.setAttribute("aria-label", profileTranslate("Manage shop")); manage.title = manage.getAttribute("aria-label");
    manage.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    head.append(manage);
  }
  root.append(head);
  if (shop.description) root.append(el("p", "profile-shop-about", shop.description));
  const products = (shop.products || []).filter(item => own || item.available);
  if (!products.length) { root.append(el("p", "profile-shop-empty", profileTranslate(own ? "No products yet. Add your first one in Manage shop." : "Nothing for sale right now."))); return root; }
  const grid = el("div", "profile-shop-grid");
  for (const item of products) {
    const card = el("a", "profile-shop-card"); card.href = `product.html?id=${encodeURIComponent(item.id)}`;
    const frame = el("span", "profile-shop-image");
    if (item.imageUrl) { const image = document.createElement("img"); image.src = item.imageUrl; image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer"; image.addEventListener("error", () => image.remove(), { once: true }); frame.append(image); }
    const badge = !item.available ? (own && item.status === "draft" ? "DRAFT" : "SOLD OUT") : "";
    if (badge) frame.append(el("span", "profile-shop-badge", profileTranslate(badge)));
    card.append(frame, el("strong", "profile-shop-title", item.title));
    card.append(el("span", "profile-shop-detail", item.shippingCents ? `+${money(item.shippingCents)} ${profileTranslate("shipping")}` : profileTranslate("Free shipping")));
    card.append(el("span", "profile-shop-price", money(item.priceCents)));
    grid.append(card);
  }
  root.append(grid);
  return root;
}

// Owner 2026-11-18 (profile screenshot): "The big white space should be the user's shop with a preview."
// The empty space beside the avatar, under the cover, shows the shop name and up to 3 product photos; tapping it
// opens the Shop tab. Only items for sale with a photo; nothing is shown when there are none.
function renderProfileShopPreview(shop = {}, profile = {}, shopTab = null) {
  document.querySelector(".profile-shop-preview")?.remove();
  const items = (shop?.products || []).filter(item => item.available && item.imageUrl).slice(0, 3);
  const avatar = document.getElementById("profileInitial");
  if (!avatar) return null;
  // Owner 2026-11-18: no shop items → the space holds a photo the member picks ("a picture of their dog or
  // something"); the owner is asked to fill it (photo or shop). Visitors see the photo, or nothing.
  if (!items.length) return renderProfileShowcase(shop, profile);
  const preview = document.createElement("button");
  preview.type = "button"; preview.className = "profile-shop-preview";
  const name = String(shop.name || profile.name || "").trim();
  preview.setAttribute("aria-label", `${profileTranslate("Open shop")}: ${name}`);
  const label = document.createElement("span"); label.className = "profile-shop-preview-label";
  const title = document.createElement("strong"); title.textContent = name; title.setAttribute("data-no-translate", "");
  const kicker = document.createElement("span"); kicker.textContent = `${profileTranslate("Shop")} ›`;
  label.append(kicker, title);
  const strip = document.createElement("span"); strip.className = "profile-shop-preview-items"; strip.setAttribute("aria-hidden", "true");
  for (const item of items) {
    const image = document.createElement("img"); image.src = item.imageUrl; image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    strip.append(image);
  }
  preview.append(label, strip);
  preview.addEventListener("click", () => {
    const tab = shopTab || tabs.querySelector('[data-profile-tab="More"]');
    tab?.click();
    tabs.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  avatar.insertAdjacentElement("afterend", preview);
  placeProfileShopPreview(preview);
  return preview;
}

function renderProfileShowcase(shop, profile = {}) {
  document.querySelector(".profile-shop-preview")?.remove();
  const avatar = document.getElementById("profileInitial");
  const owner = profile.isOwner === true && !viewingOtherProfile;
  const photo = String(profile.showcase || "").trim();
  if (!avatar || (!photo && !owner)) return null;
  const box = document.createElement("div");
  box.className = "profile-shop-preview profile-showcase";
  const picker = document.createElement("input");
  picker.type = "file"; picker.accept = "image/jpeg,image/png,image/webp,image/gif"; picker.hidden = true;
  picker.setAttribute("aria-label", profileTranslate("Choose a photo for this space"));
  const save = async changes => {
    box.setAttribute("aria-busy", "true");
    try {
      const saved = await saveCloudProfile(changes);
      const next = { ...(window.danzstakCurrentProfile || profile), ...(saved || {}) };
      window.danzstakCurrentProfile = next;
      renderProfileShowcase(shop, next);
    } catch (error) { showProfileFeedback?.(error.message || profileTranslate("That photo could not be saved."), { urgent: true }); box.removeAttribute("aria-busy"); }
  };
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0]; picker.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 15 * 1024 * 1024) { showProfileFeedback?.(profileTranslate("Choose a JPG, PNG, WebP or GIF photo up to 15 MB."), { urgent: true }); return; }
    box.setAttribute("aria-busy", "true");
    try { const mediaKey = await uploadCloudMedia(file); await save({ showcaseKey: mediaKey }); }
    catch (error) { showProfileFeedback?.(error.message || profileTranslate("That photo could not be uploaded."), { urgent: true }); box.removeAttribute("aria-busy"); }
  });
  if (photo) {
    const image = document.createElement("img"); image.className = "profile-showcase-photo"; image.src = photo; image.alt = profileTranslate("Photo chosen by this member"); image.decoding = "async"; image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    box.append(image);
    if (owner) {
      const tools = document.createElement("span"); tools.className = "profile-showcase-tools";
      const change = document.createElement("button"); change.type = "button"; change.className = "profile-showcase-change"; change.dataset.icon = "edit";
      change.setAttribute("aria-label", profileTranslate("Change this photo")); change.title = change.getAttribute("aria-label");
      change.addEventListener("click", () => picker.click());
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "profile-showcase-remove"; remove.dataset.icon = "trash";
      remove.setAttribute("aria-label", profileTranslate("Remove this photo")); remove.title = remove.getAttribute("aria-label");
      remove.addEventListener("click", () => void save({ showcaseKey: "" }));
      tools.append(change, remove);
      box.prepend(tools);
      window.danzstakIcons?.enhance?.(tools);
    }
  } else {
    const add = document.createElement("button"); add.type = "button"; add.className = "profile-showcase-add";
    add.innerHTML = '<span class="profile-shop-preview-plus" aria-hidden="true">+</span>';
    const text = document.createElement("span"); text.className = "profile-shop-preview-label";
    const kicker = document.createElement("span"); kicker.textContent = profileTranslate("Fill this space");
    const line = document.createElement("strong"); line.textContent = profileTranslate("Add a photo: your dog, your rig, anything");
    text.append(kicker, line); add.prepend(text);
    add.addEventListener("click", () => picker.click());
    const shopLink = document.createElement("a"); shopLink.className = "profile-showcase-shop"; shopLink.href = "store.html?manage=1";
    shopLink.textContent = profileTranslate(shop ? "or add a shop item" : "or open your shop");
    box.append(add, shopLink);
  }
  box.append(picker);
  avatar.insertAdjacentElement("afterend", box);
  placeProfileShopPreview(box);
  return box;
}

// Sit in the white space under the cover, never on top of the cover photo.
function placeProfileShopPreview(preview) {
  const place = () => { const cover = document.querySelector(".cover"), box = preview.offsetParent; if (!cover || !box) return; preview.style.top = Math.max(8, Math.round(cover.getBoundingClientRect().bottom - box.getBoundingClientRect().top) + 10) + "px"; };
  place(); requestAnimationFrame(place);
  if (!window.__danzstakShopPreviewResize) { window.__danzstakShopPreviewResize = true; window.addEventListener("resize", () => { const current = document.querySelector(".profile-shop-preview"); if (current) current.dispatchEvent(new Event("danzstak:place")); }); }
  preview.addEventListener("danzstak:place", place);
}

async function loadProfileShop() {
  const version = profileTabVersion;
  tabMessage.textContent = "Loading shop…";
  try {
    const profile = window.danzstakCurrentProfile || {};
    const endpoint = profile.isOwner === true ? "/marketplace/shop" : `/marketplace/shop/${encodeURIComponent(profile.memberId || "")}`;
    const response = await profileFetch(profileApi + endpoint, { credentials:"include", cache:"no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This shop could not be loaded.");
    if (version !== profileTabVersion) return;
    profileShop = data.shop;
    tabMessage.replaceChildren(renderProfileShop(profileShop, profile));
  } catch (error) { if (version === profileTabVersion) tabMessage.textContent = error.message; }
}

async function configureProfileShop(profile = {}) {
  if (!profile.memberId) return;
  try {
    const endpoint = profile.isOwner === true ? "/marketplace/shop" : `/marketplace/shop/${encodeURIComponent(profile.memberId)}`;
    const response = await profileFetch(profileApi + endpoint, { credentials:"include", cache:"no-store" });
    if (!response.ok) { if (response.status === 404) renderProfileShowcase(null, profile); return; }
    const data = await response.json().catch(() => ({}));
    if (!data.shop) { renderProfileShowcase(null, profile); return; }
    profileShop = data.shop;
    shopManagementLink.setAttribute("aria-label", "Manage my shop"); shopManagementLink.title = "Manage my shop";
    const moreTab = tabs.querySelector('[data-profile-tab="More"]'); if (moreTab) { moreTab.hidden = false; moreTab.textContent = "Shop"; }
    // Owner 2026-11-19 (two screenshots): his own profile had a shop button, a member's shop profile seen by a visitor did
    // not. Visitors get the same shop icon in the action row; it opens that member's Shop tab (the owner's opens Manage shop).
    if (profile.isOwner !== true && viewingOtherProfile) {
      const visitorLabel = `${profileTranslate("Open shop")}: ${profileShop.name || profile.name || ""}`.trim();
      shopManagementLink.href = "#shop"; shopManagementLink.setAttribute("aria-label", visitorLabel); shopManagementLink.title = visitorLabel;
      shopManagementLink.hidden = false;
      if (!shopManagementLink.dataset.visitorShop) {
        shopManagementLink.dataset.visitorShop = "true";
        shopManagementLink.addEventListener("click", event => { event.preventDefault(); (moreTab || tabs.querySelector('[data-profile-tab="More"]'))?.click(); tabs.scrollIntoView({ behavior: "smooth", block: "start" }); });
      }
      const row = shopManagementLink.parentElement, moreWrap = row?.querySelector(".profile-more-wrap");
      if (row && moreWrap) row.insertBefore(shopManagementLink, moreWrap);
    }
    renderProfileShopPreview(profileShop, profile, moreTab);
    if (requestedProfileMoreSection() === "Shop" && tabs.dataset.initialized === "true") void openProfileMoreSection("Shop");
  } catch { /* A shop is optional; leave the tab hidden when unavailable. */ }
}

function profileMoreNavigation(active = "") {
  const navigation = document.createElement("div");
  navigation.className = "profile-more-navigation";
  navigation.setAttribute("aria-label", "More profile sections");
  const choices = profileShop ? ["Shop"] : [];
  for (const name of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = name;
    button.classList.toggle("active", name === active);
    button.setAttribute("aria-pressed", String(name === active));
    button.addEventListener("click", () => void openProfileMoreSection(name));
    navigation.appendChild(button);
  }
  return navigation;
}

async function openProfileMoreSection(name = "") {
  profileTabVersion += 1;
  tabMessage.dataset.profileMoreSection = name;
  details.hidden = true;
  tabMessage.hidden = false;
  window.history?.replaceState?.(null, "", "#" + (name || "more").toLowerCase());
  if (!name) {
    tabMessage.replaceChildren(profileMoreNavigation());
    const note = document.createElement("p");
    note.className = "muted profile-more-note";
    note.textContent = profileShop ? "" : "Nothing here yet.";
    tabMessage.appendChild(note);
    return;
  }
  if (name === "Featured") await loadProfilePosts(false, "featured");
  else if (name === "Memories" && window.danzstakCurrentProfile?.isOwner === true) await loadProfilePosts(false, "memories");
  else if (name === "Friends") await loadProfileFriends();
  else if (name === "Media") await loadProfilePosts(true);
  else if (name === "Shop" && profileShop) await loadProfileShop();
  if (tabMessage.dataset.profileMoreSection === name && name !== "Shop") tabMessage.prepend(profileMoreNavigation(name)); // the Shop tab is the shop itself, no extra "Shop" button
}

tabs.addEventListener("click", async event => {
  const tab = event.target.closest("[data-profile-tab]");
  if (!tab) return;
  profileTabVersion += 1;
  tabs.querySelectorAll("button").forEach(button => { const selected = button === tab; button.classList.toggle("active", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
  const name = tab.dataset.profileTab;
  const requestedMoreSection = name === "More" ? (tab.dataset.openSection || requestedProfileMoreSection()) : "";
  delete tab.dataset.openSection;
  window.history?.replaceState?.(null, "", "#" + (requestedMoreSection || name).toLowerCase());
  tabMessage.dataset.profileMoreSection = "";
  details.hidden = name !== "About";
  tabMessage.hidden = name === "About";
  if (name === "Posts") await loadProfilePosts(false);
  else if (name === "Photos") await loadProfilePosts(true, "posts", "image");
  else if (name === "Videos") await loadProfilePosts(true, "posts", "video");
  else if (name === "Friends") await loadProfileFriends();
  else if (name === "More") await openProfileMoreSection(profileShop ? "Shop" : requestedMoreSection);
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
  '<div class="profile-identity-fields"><label>' + profileEditorWords.name + '<input name="name" minlength="2" maxlength="80" autocomplete="name" required><small>' + profileEditorWords.nameHelp + '</small></label><label>' + profileEditorWords.language + '<select name="language" data-profile-language></select></label></div>' +
  '<details class="profile-edit-section profile-username"><summary>' + profileEditorWords.advanced + '</summary><div class="profile-edit-section-body"><label>' + profileEditorWords.handle + '<input name="handle" minlength="3" maxlength="24" pattern="[A-Za-z0-9._]+"><small>' + profileEditorWords.handleHelp + '</small></label></div></details>' +
  '<details class="profile-edit-section"><summary>More profile details</summary><div class="profile-edit-section-body">' +
  '<label>Bio<textarea name="bio" maxlength="160"></textarea></label>' +
  '<label>Location<input name="location" maxlength="80"></label>' +
  '<label>Work<input name="work" maxlength="100"></label>' +
  '<label>Website<input name="website" type="text" inputmode="url" maxlength="200" placeholder="yourband.com"></label></div></details>' +
  '<details class="profile-edit-section" data-profile-privacy><summary>Privacy and tagging</summary><div class="profile-edit-section-body">' +
  '<label>Who can post on your profile?<select name="profilePostPermission"><option value="owner">Just me</option><option value="friends">Friends</option><option value="anyone">Public</option></select></label>' +
  '<label class="profile-tag-setting"><input name="allowTags" type="checkbox">Allow accepted friends to tag me in photos and videos</label></div></details>' +
  '<p class="edit-note">' + profileEditorWords.note + '</p>' +
  '<div class="edit-actions"><button class="secondary" type="button" data-cancel>' + profileEditorWords.cancel + '</button><button class="button" type="submit">' + profileEditorWords.save + '</button></div>' +
  '<details class="profile-edit-section profile-import"><summary>Pivot — Moving Day</summary><div class="profile-edit-section-body"><button id="profilePivotButton" class="profile-pivot-button" type="button" data-pivot-trigger data-icon-layout="label" aria-label="Open Moving Day to choose what to move"><span data-menu-icon="refresh" aria-hidden="true"></span><span>Open Moving Day</span></button><p>Pivot away from billionaire platforms. Preview your export and choose what to move to DanzStak, where you own your data.</p></div></details>';
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
    const href = window.danzstakNormalizeUserUrl?.(text);
    if (!href) throw new Error("Unsupported website address");
    const link = document.createElement("a");
    link.href = href;
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
  // Owner 2026-11-19 (A12): no @username line under the name; the friends facepile (#572) sits there instead.
  // The element stays (hidden) because the editor reads the handle from it.
  handleElement.hidden = true;
  bioElement.textContent = profile.bio || "";
  bioElement.hidden = !profile.bio;
  // Owner 2026-11-19: no "+ bio" button in the profile header — it duplicated Edit profile ("4 of those 5 buttons do
  // the same thing") and once leaked to visitors. The long-form bio is added from the About tab (#556).
  window.danzstakLinkifyUserText?.(bioElement);
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

// Only the account holder can open or save the editor (owner 2026-11-18: "when I click on it I can edit a profile
// that is not mine" — the form filled with the other member's details and Save would have written them to your own).
const canEditThisProfile = () => !viewingOtherProfile && window.danzstakCurrentProfile?.isOwner !== false;
editButton.addEventListener("click", () => {
  if (!canEditThisProfile()) return;
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
panel.elements.website.addEventListener("input", () => panel.elements.website.setCustomValidity(""));
document.getElementById("profileName").addEventListener("click", () => {
  if (viewingOtherProfile || editButton.hidden) return;
  nameEditHint.click();
});

panel.querySelector("[data-cancel]").addEventListener("click", () => { panel.hidden = true; repositioning = false; finishReposition.hidden = true; coverElement.classList.remove("repositioning"); repositionButton.classList.remove("active"); repositionButton.textContent = "Reposition Cover"; });
panel.addEventListener("submit", async event => {
  event.preventDefault();
  if (!canEditThisProfile()) { panel.hidden = true; return; }
  if (!panel.reportValidity()) return;
  const profile = Object.fromEntries(new FormData(panel).entries());
  if (String(profile.website || "").trim()) {
    const website = window.danzstakNormalizeUserUrl?.(profile.website);
    if (!website) {
      panel.elements.website.setCustomValidity("Enter a valid website address, such as yourband.com.");
      panel.elements.website.reportValidity();
      return;
    }
    panel.elements.website.setCustomValidity("");
    profile.website = website;
  } else panel.elements.website.setCustomValidity("");
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
  if (profile.isOwner === true) {
    viewingOtherProfile = false;
    editButton.hidden = false;
    nameEditHint.hidden = true; // owner 2026-11-16: no "tap your name" instruction; the name is tappable
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
  void configureProfileShop(profile);
  if (profile.cloudProfile) {
    fitCoverButton.classList.toggle("active", Boolean(profile.coverFit));
    fitCoverButton.textContent = profile.coverFit ? "Fill Cover Box" : "Fit Entire Cover";
    if (!viewingOtherProfile) revealProfileVideoControls();
  }
  if (tabs.dataset.initialized !== "true") {
    tabs.dataset.initialized = "true";
    const requested = requestedProfileTab();
    const requestedTab = tabs.querySelector(`[data-profile-tab="${requested}"]`);
    let target = requested;
    if (requestedTab?.hidden) target = "Posts";
    if (target === "More") tabs.querySelector('[data-profile-tab="More"]').dataset.openSection = requestedProfileMoreSection();
    tabs.querySelector(`[data-profile-tab="${target}"]`).click();
  }
}
window.addEventListener("danzstak:profile-loaded", event => applyLoadedProfile(event.detail || {}));
if (window.danzstakCurrentProfile) applyLoadedProfile(window.danzstakCurrentProfile);
