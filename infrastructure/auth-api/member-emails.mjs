// LANG part 4d (owner 2026-11-25: "Italian has to be Italian the whole thing French has to be French the whole thing
// Spanish has to be Spanish the whole thing"): the emails DanzStak itself sends to a member, and the Cognito sign-in and
// sign-up pages, in the member's language. Venue-facing booking mail carries the artist's own words and is not here.

export const EMAIL_LANGUAGES = ["en", "it", "fr", "es", "de", "pt"];

// The language a member saved (Settings, or the app language sent with their notification subscription), else the
// browser's Accept-Language, else English. Codes outside EMAIL_LANGUAGES fall back to English.
export function memberLanguage({ saved = "", acceptLanguage = "" } = {}) {
  const base = String(saved || "").toLowerCase().split(/[-_]/)[0];
  if (EMAIL_LANGUAGES.includes(base)) return base;
  return languageFromHeader(acceptLanguage, EMAIL_LANGUAGES) || "en";
}

export function languageFromHeader(header, allowed = EMAIL_LANGUAGES) {
  const tags = String(header || "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
    return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1, index };
  }).filter(item => item.tag && item.tag !== "*" && item.q > 0).sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of tags) {
    if (allowed.includes(tag)) return tag;
    const base = tag.split(/[-_]/)[0];
    if (allowed.includes(base)) return base;
  }
  return "";
}

// Cognito managed login's own languages (its `lang` parameter). Classic hosted pages ignore it.
const COGNITO_LANGS = { en: "en", it: "it", fr: "fr", es: "es", de: "de", pt: "pt-BR", ja: "ja", ko: "ko", id: "id", "zh-cn": "zh-CN", "zh-hans": "zh-CN", "zh-sg": "zh-CN", "zh-tw": "zh-TW", "zh-hant": "zh-TW", "zh-hk": "zh-TW", zh: "zh-CN" };
export function cognitoLanguage(acceptLanguage) {
  const tags = String(acceptLanguage || "").split(",").map(part => part.split(";")[0].trim().toLowerCase()).filter(Boolean);
  for (const tag of tags) {
    if (COGNITO_LANGS[tag]) return COGNITO_LANGS[tag];
    const base = tag.split(/[-_]/)[0];
    if (base !== "zh" && COGNITO_LANGS[base]) return COGNITO_LANGS[base];
    if (base === "zh") return COGNITO_LANGS.zh;
  }
  return "";
}

const DEVICE_WORDS = {
  en: { on: "on", device: "device", Browser: "Browser", "iPhone or iPad": "iPhone or iPad" },
  it: { on: "su", device: "dispositivo", Browser: "browser", "iPhone or iPad": "iPhone o iPad" },
  fr: { on: "sur", device: "appareil", Browser: "navigateur", "iPhone or iPad": "iPhone ou iPad" },
  es: { on: "en", device: "dispositivo", Browser: "navegador", "iPhone or iPad": "iPhone o iPad" },
  de: { on: "auf", device: "Gerät", Browser: "Browser", "iPhone or iPad": "iPhone oder iPad" },
  pt: { on: "no", device: "aparelho", Browser: "navegador", "iPhone or iPad": "iPhone ou iPad" }
};

// sessionDeviceLabel() writes "<browser> on <device>" in English; say it in the member's words.
export function localDeviceLabel(label, language) {
  const words = DEVICE_WORDS[language] || DEVICE_WORDS.en;
  const match = /^(.*) on (.*)$/.exec(String(label || ""));
  if (!match) return String(label || "");
  const [, browser, device] = match;
  return `${words[browser] || browser} ${words.on} ${words[device] || device}`;
}

const SIGN_IN = {
  en: ["New DanzStak sign-in", "A new sign-in to your DanzStak account was completed using {device}.", "Review signed-in devices in DanzStak Settings. If this was not you, sign out that device and change your password.", "DanzStak never asks for your password or verification code by email."],
  it: ["Nuovo accesso a DanzStak", "È stato effettuato un nuovo accesso al tuo account DanzStak da {device}.", "Controlla i dispositivi connessi nelle Impostazioni di DanzStak. Se non sei stato tu, disconnetti quel dispositivo e cambia la password.", "DanzStak non ti chiede mai la password o il codice di verifica via email."],
  fr: ["Nouvelle connexion à DanzStak", "Une nouvelle connexion à ton compte DanzStak a eu lieu depuis {device}.", "Vérifie les appareils connectés dans les Réglages de DanzStak. Si ce n’était pas toi, déconnecte cet appareil et change ton mot de passe.", "DanzStak ne te demande jamais ton mot de passe ni ton code de vérification par e-mail."],
  es: ["Nuevo inicio de sesión en DanzStak", "Se ha iniciado sesión en tu cuenta de DanzStak desde {device}.", "Revisa los dispositivos conectados en Ajustes de DanzStak. Si no fuiste tú, cierra la sesión en ese dispositivo y cambia tu contraseña.", "DanzStak nunca te pide tu contraseña ni tu código de verificación por correo electrónico."],
  de: ["Neue Anmeldung bei DanzStak", "Dein DanzStak-Konto wurde gerade über {device} angemeldet.", "Prüfe die angemeldeten Geräte in den DanzStak-Einstellungen. Wenn du das nicht warst, melde dieses Gerät ab und ändere dein Passwort.", "DanzStak fragt dich nie per E-Mail nach deinem Passwort oder Bestätigungscode."],
  pt: ["Novo acesso ao DanzStak", "Foi feito um novo acesso à sua conta DanzStak em {device}.", "Confira os aparelhos conectados nas Configurações do DanzStak. Se não foi você, desconecte esse aparelho e troque sua senha.", "O DanzStak nunca pede sua senha nem seu código de verificação por e-mail."]
};

export function signInAlertEmail(language, deviceLabel) {
  const lang = SIGN_IN[language] ? language : "en", [subject, line, review, never] = SIGN_IN[lang];
  return { subject, text: `${line.replace("{device}", localDeviceLabel(deviceLabel, lang))}\n\n${review}\n\n${never}` };
}

const TICKETS = {
  en: { label: "DanzStak ticket", subject: "Your tickets: {title}", heading: "Your tickets for {title}", ticket: "Ticket {n}", named: "Named ticket: non-transferable. Bring photo ID that matches the name.", transferable: "This ticket is transferable.", door: "Show the QR code or tell the door your ticket code.", order: "Order {id}", sold: "Sold through DanzStak. The promoter runs the event.", qr: "QR code for ticket {code}", tier: "Ticket" },
  it: { label: "Biglietto DanzStak", subject: "I tuoi biglietti: {title}", heading: "I tuoi biglietti per {title}", ticket: "Biglietto {n}", named: "Biglietto nominativo: non trasferibile. Porta un documento con foto che corrisponda al nome.", transferable: "Questo biglietto è trasferibile.", door: "Mostra il codice QR o di’ all’ingresso il codice del biglietto.", order: "Ordine {id}", sold: "Venduto tramite DanzStak. L’evento è organizzato dal promoter.", qr: "Codice QR del biglietto {code}", tier: "Biglietto" },
  fr: { label: "Billet DanzStak", subject: "Tes billets : {title}", heading: "Tes billets pour {title}", ticket: "Billet {n}", named: "Billet nominatif : non transférable. Apporte une pièce d’identité avec photo au même nom.", transferable: "Ce billet est transférable.", door: "Montre le code QR ou donne ton code de billet à l’entrée.", order: "Commande {id}", sold: "Vendu via DanzStak. L’événement est organisé par le promoteur.", qr: "Code QR du billet {code}", tier: "Billet" },
  es: { label: "Entrada DanzStak", subject: "Tus entradas: {title}", heading: "Tus entradas para {title}", ticket: "Entrada {n}", named: "Entrada nominativa: no transferible. Lleva un documento con foto que coincida con el nombre.", transferable: "Esta entrada es transferible.", door: "Muestra el código QR o dile tu código de entrada a la puerta.", order: "Pedido {id}", sold: "Vendida a través de DanzStak. El evento lo organiza el promotor.", qr: "Código QR de la entrada {code}", tier: "Entrada" },
  de: { label: "DanzStak-Ticket", subject: "Deine Tickets: {title}", heading: "Deine Tickets für {title}", ticket: "Ticket {n}", named: "Personalisiertes Ticket: nicht übertragbar. Bring einen Lichtbildausweis mit, der zum Namen passt.", transferable: "Dieses Ticket ist übertragbar.", door: "Zeig den QR-Code oder nenne am Einlass deinen Ticketcode.", order: "Bestellung {id}", sold: "Verkauft über DanzStak. Der Veranstalter führt das Event durch.", qr: "QR-Code für Ticket {code}", tier: "Ticket" },
  pt: { label: "Ingresso DanzStak", subject: "Seus ingressos: {title}", heading: "Seus ingressos para {title}", ticket: "Ingresso {n}", named: "Ingresso nominal: intransferível. Leve um documento com foto que corresponda ao nome.", transferable: "Este ingresso é transferível.", door: "Mostre o código QR ou diga na entrada o código do seu ingresso.", order: "Pedido {id}", sold: "Vendido pelo DanzStak. O evento é organizado pelo promotor.", qr: "Código QR do ingresso {code}", tier: "Ingresso" }
};
const LOCALES = { en: "en-US", it: "it-IT", fr: "fr-FR", es: "es-ES", de: "de-DE", pt: "pt-BR" };

export function ticketEmailWords(language) {
  const lang = TICKETS[language] ? language : "en", words = TICKETS[lang];
  const fill = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), words[key]);
  return { language: lang, locale: LOCALES[lang], fill, tier: name => (!name || name === "Ticket" ? words.tier : name) };
}

export function ticketWhen(startsAt, timeZone, language) {
  try { return new Intl.DateTimeFormat(LOCALES[language] || LOCALES.en, { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(startsAt)); }
  catch {
    try { return new Intl.DateTimeFormat(LOCALES[language] || LOCALES.en, { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(startsAt)); }
    catch { return ""; }
  }
}
