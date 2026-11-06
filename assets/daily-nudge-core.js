"use strict";

((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DanzStakDailyNudgeCore = api;
})(typeof window === "object" ? window : null, () => {
  const locales = ["en", "es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];
  const labels = {
    en: ["Daily Nudge", "Dismiss Daily Nudge", "Dismiss"], es: ["Idea del día", "Cerrar la idea del día", "Cerrar"], fr: ["Pensée du jour", "Fermer la pensée du jour", "Fermer"], de: ["Gedanke des Tages", "Gedanken des Tages schließen", "Schließen"], pt: ["Toque do dia", "Fechar o toque do dia", "Fechar"], it: ["Pensiero del giorno", "Chiudi il pensiero del giorno", "Chiudi"], ko: ["오늘의 한마디", "오늘의 한마디 닫기", "닫기"], ja: ["今日のひとこと", "今日のひとことを閉じる", "閉じる"], "zh-Hans": ["今日小提醒", "关闭今日小提醒", "关闭"], "zh-Hant": ["今日小提醒", "關閉今日小提醒", "關閉"], fil: ["Munting paalala ngayon", "Isara ang munting paalala", "Isara"], hi: ["आज की छोटी बात", "आज की छोटी बात बंद करें", "बंद करें"], vi: ["Lời nhắc hôm nay", "Đóng lời nhắc hôm nay", "Đóng"], th: ["ข้อคิดวันนี้", "ปิดข้อคิดวันนี้", "ปิด"], id: ["Sapaan hari ini", "Tutup sapaan hari ini", "Tutup"]
  };
  const prompts = [
    {
      en: "Did you say buongiorno to the lady at the deli?", es: "¿Saludaste a la señora de la tienda?", fr: "Avez-vous dit bonjour à la dame de l’épicerie ?", de: "Hast du der Dame im Laden Hallo gesagt?", pt: "Você deu bom-dia para a senhora da mercearia?", it: "Hai detto buongiorno alla signora della gastronomia?", ko: "가게 아주머니께 인사했나요?", ja: "お店の人に「こんにちは」と言いましたか？", "zh-Hans": "今天跟店里的阿姨打招呼了吗？", "zh-Hant": "今天跟店裡的阿姨打招呼了嗎？", fil: "Binati mo ba ang tindera sa deli?", hi: "क्या आपने दुकान वाली आंटी को नमस्ते कहा?", vi: "Hôm nay bạn đã chào cô ở cửa hàng chưa?", th: "วันนี้ทักทายคุณป้าที่ร้านหรือยัง?", id: "Sudah menyapa ibu di toko hari ini?"
    },
    {
      en: "Don't forget to take your favorite person for gelato.", es: "No olvides invitar a tu persona favorita a un helado.", fr: "N’oubliez pas d’emmener votre personne préférée manger une glace.", de: "Vergiss nicht, mit deinem Lieblingsmenschen ein Eis essen zu gehen.", pt: "Não esqueça de levar sua pessoa favorita para tomar sorvete.", it: "Non dimenticare di portare la tua persona preferita a mangiare un gelato.", ko: "좋아하는 사람과 젤라토 먹으러 가는 걸 잊지 마세요.", ja: "大切な人とジェラートを食べに行くのを忘れずに。", "zh-Hans": "别忘了和你喜欢的人去吃个冰淇淋。", "zh-Hant": "別忘了和你喜歡的人去吃個冰淇淋。", fil: "Huwag kalimutang ilibre ng gelato ang paborito mong tao.", hi: "अपने पसंदीदा इंसान के साथ आइसक्रीम खाना मत भूलिए।", vi: "Đừng quên rủ người bạn quý mến đi ăn kem.", th: "อย่าลืมชวนคนโปรดไปกินไอศกรีมด้วยกัน", id: "Jangan lupa ajak orang kesayangan makan gelato."
    },
    {
      en: "Did you go for a walk after dinner?", es: "¿Saliste a caminar después de cenar?", fr: "Êtes-vous allé vous promener après le dîner ?", de: "Warst du nach dem Abendessen spazieren?", pt: "Você caminhou depois do jantar?", it: "Hai fatto una passeggiata dopo cena?", ko: "저녁 식사 후에 산책했나요?", ja: "夕食のあと、散歩しましたか？", "zh-Hans": "晚饭后出去走走了吗？", "zh-Hant": "晚飯後出去走走了嗎？", fil: "Naglakad-lakad ka ba pagkatapos kumain?", hi: "क्या आप रात के खाने के बाद टहलने गए?", vi: "Bạn có đi dạo sau bữa tối không?", th: "หลังอาหารเย็นได้ออกไปเดินเล่นไหม?", id: "Sudah jalan-jalan setelah makan malam?"
    },
    {
      en: "Put down the remote and start jamming.", es: "Suelta el mando y ponte a tocar.", fr: "Posez la télécommande et commencez à jouer.", de: "Leg die Fernbedienung weg und mach Musik.", pt: "Largue o controle e comece a tocar.", it: "Posa il telecomando e comincia a suonare.", ko: "리모컨을 내려놓고 연주를 시작해요.", ja: "リモコンを置いて、音を鳴らそう。", "zh-Hans": "放下遥控器，开始玩音乐吧。", "zh-Hant": "放下遙控器，開始玩音樂吧。", fil: "Ibaba ang remote at magsimulang tumugtog.", hi: "रिमोट नीचे रखिए और संगीत बजाइए।", vi: "Đặt điều khiển xuống và chơi nhạc thôi.", th: "วางรีโมตแล้วมาเล่นดนตรีกัน", id: "Letakkan remote dan mulai bermusik."
    },
    {
      en: "The next hit song might be inside you.", es: "Tu próxima gran canción puede estar dentro de ti.", fr: "Votre prochain grand morceau est peut-être déjà en vous.", de: "Der nächste Hit steckt vielleicht schon in dir.", pt: "O próximo sucesso pode estar dentro de você.", it: "La prossima canzone di successo potrebbe essere dentro di te.", ko: "다음 히트곡은 이미 당신 안에 있을지도 몰라요.", ja: "次のヒット曲は、もうあなたの中にあるかも。", "zh-Hans": "下一首好歌也许已经在你心里。", "zh-Hant": "下一首好歌也許已經在你心裡。", fil: "Baka nasa loob mo na ang susunod na hit na kanta.", hi: "अगला हिट गीत शायद आपके अंदर ही है।", vi: "Bài hát đình đám tiếp theo có thể đang ở trong bạn.", th: "เพลงฮิตเพลงต่อไปอาจอยู่ในตัวคุณแล้ว", id: "Lagu hit berikutnya mungkin sudah ada dalam dirimu."
    },
    {
      en: "Dreams become goals. Goals become reality.", es: "Los sueños se vuelven metas. Las metas se vuelven realidad.", fr: "Les rêves deviennent des objectifs. Les objectifs deviennent réalité.", de: "Träume werden Ziele. Ziele werden Wirklichkeit.", pt: "Sonhos viram metas. Metas viram realidade.", it: "I sogni diventano obiettivi. Gli obiettivi diventano realtà.", ko: "꿈은 목표가 되고, 목표는 현실이 됩니다.", ja: "夢は目標に。目標は現実に。", "zh-Hans": "梦想变成目标，目标变成现实。", "zh-Hant": "夢想變成目標，目標變成現實。", fil: "Ang pangarap ay nagiging layunin. Ang layunin ay nagiging realidad.", hi: "सपने लक्ष्य बनते हैं। लक्ष्य हकीकत बनते हैं।", vi: "Ước mơ thành mục tiêu. Mục tiêu thành hiện thực.", th: "ความฝันกลายเป็นเป้าหมาย เป้าหมายกลายเป็นจริง", id: "Mimpi menjadi tujuan. Tujuan menjadi kenyataan."
    },
    {
      en: "You can't stop reality from being real.", es: "No puedes impedir que la realidad sea real.", fr: "On ne peut pas empêcher la réalité d’être réelle.", de: "Du kannst die Wirklichkeit nicht davon abhalten, wirklich zu sein.", pt: "Não dá para impedir a realidade de ser real.", it: "Non puoi impedire alla realtà di essere reale.", ko: "현실이 현실인 것을 막을 수는 없어요.", ja: "現実が現実であることは止められない。", "zh-Hans": "现实就是现实，谁也拦不住。", "zh-Hant": "現實就是現實，誰也攔不住。", fil: "Hindi mo mapipigilang maging totoo ang realidad.", hi: "हकीकत को हकीकत होने से नहीं रोका जा सकता।", vi: "Bạn không thể ngăn thực tế là thực tế.", th: "คุณหยุดความจริงไม่ให้เป็นจริงไม่ได้", id: "Kamu tidak bisa menghentikan kenyataan menjadi nyata."
    },
    {
      en: "Could you plant something today?", es: "¿Podrías plantar algo hoy?", fr: "Pourriez-vous planter quelque chose aujourd’hui ?", de: "Könntest du heute etwas pflanzen?", pt: "Que tal plantar alguma coisa hoje?", it: "Potresti piantare qualcosa oggi?", ko: "오늘 무언가를 심어보는 건 어때요?", ja: "今日は何かを植えてみませんか？", "zh-Hans": "今天要不要种点什么？", "zh-Hant": "今天要不要種點什麼？", fil: "May maitanim ka kaya ngayon?", hi: "क्या आज आप कुछ लगा सकते हैं?", vi: "Hôm nay bạn có thể trồng một thứ gì đó không?", th: "วันนี้ลองปลูกอะไรสักอย่างไหม?", id: "Bisakah kamu menanam sesuatu hari ini?"
    },
    {
      en: "Make something fresh with what you have.", es: "Prepara algo fresco con lo que tengas.", fr: "Préparez quelque chose de frais avec ce que vous avez.", de: "Mach etwas Frisches aus dem, was du hast.", pt: "Prepare algo fresco com o que você tem.", it: "Prepara qualcosa di fresco con quello che hai.", ko: "지금 있는 재료로 신선한 걸 만들어 보세요.", ja: "今あるもので、何か新鮮なものを作ろう。", "zh-Hans": "用手边的东西做点新鲜的吧。", "zh-Hant": "用手邊的東西做點新鮮的吧。", fil: "Gumawa ng sariwa gamit ang mayroon ka.", hi: "जो आपके पास है, उससे कुछ ताज़ा बनाइए।", vi: "Làm món gì đó tươi ngon từ những gì bạn có.", th: "ทำของสดใหม่จากสิ่งที่มีอยู่กัน", id: "Buat sesuatu yang segar dari apa yang ada."
    },
    {
      en: "Did you breathe some fresh air today?", es: "¿Respiraste un poco de aire fresco hoy?", fr: "Avez-vous respiré un peu d’air frais aujourd’hui ?", de: "Hast du heute frische Luft geatmet?", pt: "Você respirou um pouco de ar fresco hoje?", it: "Hai respirato un po’ d’aria fresca oggi?", ko: "오늘 신선한 공기를 마셨나요?", ja: "今日は新鮮な空気を吸いましたか？", "zh-Hans": "今天呼吸过新鲜空气吗？", "zh-Hant": "今天呼吸過新鮮空氣嗎？", fil: "Nakalanghap ka ba ng sariwang hangin ngayon?", hi: "क्या आज आपने थोड़ी ताज़ी हवा ली?", vi: "Hôm nay bạn đã hít thở chút không khí trong lành chưa?", th: "วันนี้ได้สูดอากาศสดชื่นบ้างไหม?", id: "Sudah menghirup udara segar hari ini?"
    },
    {
      en: "When was the last time you smelled a daisy?", es: "¿Cuándo fue la última vez que oliste una margarita?", fr: "Quand avez-vous senti une marguerite pour la dernière fois ?", de: "Wann hast du zuletzt an einem Gänseblümchen gerochen?", pt: "Quando foi a última vez que você sentiu o perfume de uma margarida?", it: "Quando hai annusato una margherita l’ultima volta?", ko: "마지막으로 데이지 향기를 맡은 게 언제였나요?", ja: "最後にデイジーの香りをかいだのはいつ？", "zh-Hans": "你上次闻雏菊是什么时候？", "zh-Hant": "你上次聞雛菊是什麼時候？", fil: "Kailan ka huling nakaamoy ng bulaklak?", hi: "आपने आखिरी बार किसी फूल की खुशबू कब ली थी?", vi: "Lần cuối bạn ngửi hương một bông cúc là khi nào?", th: "ครั้งสุดท้ายที่ได้กลิ่นดอกไม้คือเมื่อไร?", id: "Kapan terakhir kali kamu mencium aroma bunga?"
    },
    {
      en: "Did you hear the river today, or just your notifications?", es: "¿Hoy escuchaste el río o solo tus notificaciones?", fr: "Avez-vous entendu la rivière aujourd’hui, ou seulement vos notifications ?", de: "Hast du heute den Fluss gehört oder nur deine Benachrichtigungen?", pt: "Hoje você ouviu o rio ou só as notificações?", it: "Oggi hai sentito il fiume o solo le notifiche?", ko: "오늘 강물 소리를 들었나요, 아니면 알림 소리만 들었나요?", ja: "今日は川の音を聞いた？ それとも通知音だけ？", "zh-Hans": "今天听见河水了吗，还是只听见了通知？", "zh-Hant": "今天聽見河水了嗎，還是只聽見了通知？", fil: "Narinig mo ba ang ilog ngayon, o puro notification lang?", hi: "आज नदी की आवाज़ सुनी या सिर्फ़ नोटिफ़िकेशन?", vi: "Hôm nay bạn nghe tiếng sông hay chỉ nghe thông báo?", th: "วันนี้ได้ยินเสียงแม่น้ำหรือได้ยินแต่เสียงแจ้งเตือน?", id: "Hari ini mendengar sungai, atau hanya notifikasi?"
    },
    {
      en: "Have you seen someone you care about somewhere other than a screen?", es: "¿Has visto a alguien que te importa fuera de una pantalla?", fr: "Avez-vous vu quelqu’un qui compte pour vous ailleurs que sur un écran ?", de: "Hast du einen lieben Menschen mal außerhalb eines Bildschirms gesehen?", pt: "Você viu alguém de quem gosta fora de uma tela?", it: "Hai visto una persona a cui tieni fuori da uno schermo?", ko: "소중한 사람을 화면 밖에서 만났나요?", ja: "大切な人に、画面の外で会いましたか？", "zh-Hans": "你在屏幕之外见过在乎的人了吗？", "zh-Hant": "你在螢幕之外見過在乎的人了嗎？", fil: "Nakita mo ba nang personal ang isang taong mahalaga sa iyo?", hi: "क्या आपने किसी अपने को स्क्रीन के बाहर देखा?", vi: "Bạn đã gặp người mình quý ở ngoài màn hình chưa?", th: "ได้เจอคนที่คุณใส่ใจนอกหน้าจอบ้างไหม?", id: "Sudah bertemu orang yang kamu sayangi di luar layar?"
    },
    {
      en: "Go make a memory nobody needs to photograph.", es: "Ve a crear un recuerdo que nadie necesite fotografiar.", fr: "Allez créer un souvenir que personne n’a besoin de photographier.", de: "Mach eine Erinnerung, die niemand fotografieren muss.", pt: "Vá criar uma lembrança que ninguém precise fotografar.", it: "Vai a creare un ricordo che nessuno debba fotografare.", ko: "사진으로 남길 필요 없는 추억을 만들러 가요.", ja: "写真にしなくても残る思い出を作りに行こう。", "zh-Hans": "去创造一个不需要拍照的回忆吧。", "zh-Hant": "去創造一個不需要拍照的回憶吧。", fil: "Gumawa ng alaalang hindi kailangang kunan ng litrato.", hi: "ऐसी याद बनाइए जिसकी तस्वीर लेने की ज़रूरत न हो।", vi: "Hãy tạo một kỷ niệm không cần phải chụp ảnh.", th: "ไปสร้างความทรงจำที่ไม่ต้องถ่ายรูปกัน", id: "Ciptakan kenangan yang tak perlu difoto."
    }
  ];

  function normalizeLocale(value) {
    const raw = String(value || "en").replace(/_/g, "-");
    if (locales.includes(raw)) return raw;
    const lower = raw.toLowerCase();
    if (lower === "zh-cn" || lower === "zh-sg" || lower === "zh-hans") return "zh-Hans";
    if (lower.startsWith("zh")) return "zh-Hant";
    const base = lower.split("-")[0];
    return locales.includes(base) ? base : "en";
  }

  function localDay(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return { key: `${year}-${month}-${day}`, ordinal: Math.floor(Date.UTC(year, date.getMonth(), date.getDate()) / 86400000) };
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.codePointAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function chooseIndex(seed, dayKey, recent = []) {
    const blocked = new Set((Array.isArray(recent) ? recent : []).map(Number).filter(Number.isInteger).slice(-3));
    let index = hash(`${seed}:${dayKey}`) % prompts.length;
    for (let offset = 0; offset < prompts.length && blocked.has(index); offset += 1) index = (index + 1) % prompts.length;
    return index;
  }

  function text(index, locale) {
    const prompt = prompts[Number(index)] || prompts[0];
    return prompt[normalizeLocale(locale)] || prompt.en;
  }

  function uiLabels(locale) { return labels[normalizeLocale(locale)] || labels.en; }

  return Object.freeze({ locales: Object.freeze(locales), prompts: Object.freeze(prompts), normalizeLocale, localDay, chooseIndex, text, uiLabels });
});
