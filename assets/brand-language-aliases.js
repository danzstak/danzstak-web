"use strict";

// Present DanzStak's own product names instead of translating them back into
// generic social-network labels such as Feed, Stories, Reels, and Groups.
// Internal API and storage names remain unchanged for compatibility.
const danzstakBrandNames = {
  en: ["Your Mix", "Flashes", "The Roll", "Tribes", "Back to Your Mix"],
  es: ["Tu Mix", "Flashes", "The Roll", "Tribus", "Volver a Tu Mix"],
  fr: ["Votre Mix", "Flashes", "The Roll", "Tribus", "Retour à Votre Mix"],
  de: ["Dein Mix", "Flashes", "The Roll", "Tribes", "Zurück zu Dein Mix"],
  pt: ["Seu Mix", "Flashes", "The Roll", "Tribos", "Voltar ao Seu Mix"],
  it: ["Il tuo Mix", "Flash", "The Roll", "Tribù", "Torna al tuo Mix"],
  ko: ["나의 믹스", "플래시", "더 롤", "트라이브", "나의 믹스로 돌아가기"],
  ja: ["あなたのミックス", "フラッシュ", "ザ・ロール", "トライブ", "あなたのミックスに戻る"],
  "zh-Hans": ["你的混音", "闪现", "The Roll", "部落", "返回你的混音"],
  "zh-Hant": ["你的混音", "閃現", "The Roll", "部落", "返回你的混音"],
  fil: ["Iyong Mix", "Flashes", "The Roll", "Mga Tribo", "Bumalik sa Iyong Mix"],
  hi: ["आपका मिक्स", "फ्लैश", "The Roll", "समूह", "अपने मिक्स पर वापस जाएँ"],
  vi: ["Bản Mix của bạn", "Khoảnh khắc", "The Roll", "Bộ lạc", "Quay lại Bản Mix của bạn"],
  th: ["มิกซ์ของคุณ", "แฟลช", "The Roll", "เผ่า", "กลับไปที่มิกซ์ของคุณ"],
  id: ["Mix Anda", "Kilas", "The Roll", "Suku", "Kembali ke Mix Anda"]
};
for (const [language, dictionary] of Object.entries(window.danzstakTranslations || {})) {
  const [mix, flashes, roll, tribes, backToMix] = danzstakBrandNames[language] || danzstakBrandNames.en;
  dictionary["Your Mix"] = mix;
  dictionary.Flashes = flashes;
  dictionary["The Roll"] = roll;
  dictionary.Tribes = tribes;
  dictionary["Just me"] ||= dictionary["Only me"] || "Just me";
  dictionary["Back to Your Mix"] = backToMix;
  dictionary["Tribe name"] ||= dictionary["Group name"] || "Tribe name";
  dictionary["Create Tribe"] ||= dictionary["Create Group"] || "Create Tribe";
  dictionary["Join Tribe"] ||= dictionary["Join Group"] || "Join Tribe";
  dictionary["Leave Tribe"] ||= dictionary["Leave Group"] || "Leave Tribe";
  dictionary["Add to The Roll"] ||= dictionary["Add Reel"] || "Add to The Roll";
}

// Privacy-sensitive device choices must be understandable before a member
// consents. Keep these exact source strings aligned with device-settings.js.
const offlineSettingKeys = [
  "Offline access",
  "Keep recent posts and chats available offline on this device",
  "Off by default. Turning this on saves recently viewed private content and unsent text posts or messages only on this device. Turning it off or signing out deletes that saved content.",
  "Offline access is on for this device.",
  "Offline access is off. Saved offline content was deleted."
];
const offlineSettingTranslations = {
  es: ["Acceso sin conexión", "Mantener disponibles sin conexión los posts y chats recientes en este dispositivo", "Desactivado de forma predeterminada. Al activarlo, se guardan en este dispositivo el contenido privado visto recientemente y los posts o mensajes de texto no enviados. Al desactivarlo o cerrar sesión, se elimina ese contenido guardado.", "El acceso sin conexión está activado en este dispositivo.", "El acceso sin conexión está desactivado. Se eliminó el contenido sin conexión guardado."],
  fr: ["Accès hors connexion", "Garder les posts et discussions récents disponibles hors connexion sur cet appareil", "Désactivé par défaut. L’activation enregistre sur cet appareil le contenu privé récemment consulté ainsi que les posts ou messages texte non envoyés. La désactivation ou la déconnexion supprime ce contenu enregistré.", "L’accès hors connexion est activé sur cet appareil.", "L’accès hors connexion est désactivé. Le contenu hors connexion enregistré a été supprimé."],
  de: ["Offline-Zugriff", "Neuere Beiträge und Chats auf diesem Gerät offline verfügbar halten", "Standardmäßig deaktiviert. Beim Aktivieren werden kürzlich angesehene private Inhalte und nicht gesendete Textbeiträge oder Nachrichten nur auf diesem Gerät gespeichert. Beim Deaktivieren oder Abmelden werden diese gespeicherten Inhalte gelöscht.", "Der Offline-Zugriff ist auf diesem Gerät aktiviert.", "Der Offline-Zugriff ist deaktiviert. Gespeicherte Offline-Inhalte wurden gelöscht."],
  pt: ["Acesso offline", "Manter posts e conversas recentes disponíveis offline neste dispositivo", "Desativado por padrão. Ao ativar, o conteúdo privado visto recentemente e os posts ou mensagens de texto não enviados são salvos somente neste dispositivo. Desativar ou sair exclui esse conteúdo salvo.", "O acesso offline está ativado neste dispositivo.", "O acesso offline está desativado. O conteúdo offline salvo foi excluído."],
  it: ["Accesso offline", "Mantieni disponibili offline su questo dispositivo i post e le chat recenti", "Disattivato per impostazione predefinita. Attivandolo, i contenuti privati visualizzati di recente e i post o messaggi di testo non inviati vengono salvati solo su questo dispositivo. Disattivandolo o uscendo, tali contenuti salvati vengono eliminati.", "L’accesso offline è attivo su questo dispositivo.", "L’accesso offline è disattivato. I contenuti offline salvati sono stati eliminati."],
  ko: ["오프라인 액세스", "이 기기에서 최근 게시물과 채팅을 오프라인으로 사용", "기본적으로 꺼져 있습니다. 켜면 최근에 본 비공개 콘텐츠와 보내지 않은 텍스트 게시물 또는 메시지가 이 기기에만 저장됩니다. 끄거나 로그아웃하면 저장된 콘텐츠가 삭제됩니다.", "이 기기에서 오프라인 액세스가 켜졌습니다.", "오프라인 액세스가 꺼졌습니다. 저장된 오프라인 콘텐츠가 삭제되었습니다."],
  ja: ["オフラインアクセス", "この端末で最近の投稿やチャットをオフラインでも利用できるようにする", "初期設定ではオフです。オンにすると、最近表示した非公開コンテンツと未送信のテキスト投稿やメッセージがこの端末にのみ保存されます。オフにするかログアウトすると、保存された内容は削除されます。", "この端末でオフラインアクセスがオンになっています。", "オフラインアクセスはオフです。保存されたオフラインコンテンツを削除しました。"],
  "zh-Hans": ["离线访问", "在此设备上离线查看最近的帖子和聊天", "默认关闭。开启后，最近查看的私密内容以及未发送的文字帖子或消息只会保存在此设备上。关闭此功能或退出登录会删除这些已保存内容。", "此设备已开启离线访问。", "离线访问已关闭，保存的离线内容已删除。"],
  "zh-Hant": ["離線存取", "在此裝置上離線查看最近的貼文和聊天", "預設關閉。開啟後，最近查看的私人內容以及未傳送的文字貼文或訊息只會儲存在此裝置上。關閉此功能或登出會刪除這些已儲存內容。", "此裝置已開啟離線存取。", "離線存取已關閉，已刪除儲存的離線內容。"],
  fil: ["Pag-access offline", "Panatilihing available offline sa device na ito ang mga kamakailang post at chat", "Naka-off bilang default. Kapag in-on, sa device na ito lamang mase-save ang kamakailang tiningnang pribadong content at hindi pa naipadalang text post o mensahe. Kapag in-off o nag-log out, mabubura ang naka-save na content.", "Naka-on ang offline access sa device na ito.", "Naka-off ang offline access. Binura ang naka-save na offline content."],
  hi: ["ऑफ़लाइन एक्सेस", "इस डिवाइस पर हाल की पोस्ट और चैट ऑफ़लाइन उपलब्ध रखें", "यह डिफ़ॉल्ट रूप से बंद है। इसे चालू करने पर हाल में देखी गई निजी सामग्री और न भेजी गई टेक्स्ट पोस्ट या संदेश केवल इस डिवाइस पर सहेजे जाते हैं। इसे बंद करने या साइन आउट करने पर सहेजी गई सामग्री मिटा दी जाती है।", "इस डिवाइस पर ऑफ़लाइन एक्सेस चालू है।", "ऑफ़लाइन एक्सेस बंद है। सहेजी गई ऑफ़लाइन सामग्री मिटा दी गई।"],
  vi: ["Truy cập ngoại tuyến", "Giữ các bài viết và cuộc trò chuyện gần đây để dùng ngoại tuyến trên thiết bị này", "Mặc định tắt. Khi bật, nội dung riêng tư vừa xem và bài viết hoặc tin nhắn văn bản chưa gửi chỉ được lưu trên thiết bị này. Tắt tính năng hoặc đăng xuất sẽ xóa nội dung đã lưu.", "Truy cập ngoại tuyến đã bật trên thiết bị này.", "Truy cập ngoại tuyến đã tắt. Nội dung ngoại tuyến đã lưu đã được xóa."],
  th: ["การเข้าถึงแบบออฟไลน์", "เก็บโพสต์และแชทล่าสุดไว้ใช้งานแบบออฟไลน์บนอุปกรณ์นี้", "ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด ระบบจะบันทึกเนื้อหาส่วนตัวที่เพิ่งดูและโพสต์หรือข้อความที่ยังไม่ได้ส่งไว้บนอุปกรณ์นี้เท่านั้น การปิดหรือออกจากระบบจะลบเนื้อหาที่บันทึกไว้", "เปิดการเข้าถึงแบบออฟไลน์บนอุปกรณ์นี้แล้ว", "ปิดการเข้าถึงแบบออฟไลน์แล้ว เนื้อหาออฟไลน์ที่บันทึกไว้ถูกลบแล้ว"],
  id: ["Akses offline", "Simpan postingan dan obrolan terbaru agar tersedia offline di perangkat ini", "Nonaktif secara default. Saat diaktifkan, konten pribadi yang baru dilihat serta postingan atau pesan teks yang belum terkirim hanya disimpan di perangkat ini. Menonaktifkan fitur atau keluar akan menghapus konten tersimpan tersebut.", "Akses offline aktif di perangkat ini.", "Akses offline nonaktif. Konten offline tersimpan telah dihapus."]
};
for (const [language, values] of Object.entries(offlineSettingTranslations)) {
  const dictionary = window.danzstakTranslations?.[language];
  if (dictionary) offlineSettingKeys.forEach((key, index) => { dictionary[key] = values[index]; });
}
