"use strict";

// Present DanzStak's own product names instead of translating them back into
// generic social-network labels such as Feed, Stories, Reels, and Groups.
// Internal API and storage names remain unchanged for compatibility.
const danzstakBrandNames = {
  en: ["Your Mix", "Flashes", "The Roll", "Tribes"],
  es: ["Tu Mix", "Flashes", "The Roll", "Tribus"],
  fr: ["Votre Mix", "Flashes", "The Roll", "Tribus"],
  de: ["Dein Mix", "Flashes", "The Roll", "Tribes"],
  pt: ["Seu Mix", "Flashes", "The Roll", "Tribos"],
  it: ["Il tuo Mix", "Flash", "The Roll", "Tribù"],
  ko: ["나의 믹스", "플래시", "더 롤", "트라이브"],
  ja: ["あなたのミックス", "フラッシュ", "ザ・ロール", "トライブ"],
  "zh-Hans": ["你的混音", "闪现", "The Roll", "部落"],
  "zh-Hant": ["你的混音", "閃現", "The Roll", "部落"],
  fil: ["Iyong Mix", "Flashes", "The Roll", "Mga Tribo"],
  hi: ["आपका मिक्स", "फ्लैश", "The Roll", "समूह"],
  vi: ["Bản Mix của bạn", "Khoảnh khắc", "The Roll", "Bộ lạc"],
  th: ["มิกซ์ของคุณ", "แฟลช", "The Roll", "เผ่า"],
  id: ["Mix Anda", "Kilas", "The Roll", "Suku"]
};
for (const [language, dictionary] of Object.entries(window.danzstakTranslations || {})) {
  const [mix, flashes, roll, tribes] = danzstakBrandNames[language] || danzstakBrandNames.en;
  dictionary["Your Mix"] = mix;
  dictionary.Flashes = flashes;
  dictionary["The Roll"] = roll;
  dictionary.Tribes = tribes;
  dictionary["Just me"] ||= dictionary["Only me"] || "Just me";
  dictionary["Back to Your Mix"] ||= dictionary["Back to Feed"] || "Back to Your Mix";
  dictionary["Tribe name"] ||= dictionary["Group name"] || "Tribe name";
  dictionary["Create Tribe"] ||= dictionary["Create Group"] || "Create Tribe";
  dictionary["Join Tribe"] ||= dictionary["Join Group"] || "Join Tribe";
  dictionary["Leave Tribe"] ||= dictionary["Leave Group"] || "Leave Tribe";
  dictionary["Add to The Roll"] ||= dictionary["Add Reel"] || "Add to The Roll";
}
