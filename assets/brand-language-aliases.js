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
