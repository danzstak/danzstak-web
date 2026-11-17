"use strict";
// SYNC device verification texts (Twilio Verify, owner 2026-11-17): error and status messages in the member's language.
// Same pattern as i18n-music.js: exact English text -> translation; load before i18n.js.
(() => {
 const t=window.danzstakTranslations||(window.danzstakTranslations={en:{}});
 const add={
"it": {
"That mobile number isn't valid. Check the country code and number.": "Questo numero di cellulare non è valido. Controlla prefisso e numero.",
"Too many codes were sent to this number. Try again later.": "Sono stati inviati troppi codici a questo numero. Riprova più tardi.",
"Too many incorrect codes. Request a new text later.": "Troppi codici errati. Richiedi un nuovo SMS più tardi.",
"Texts to this number are blocked to prevent fraud. Use another mobile number.": "Gli SMS verso questo numero sono bloccati per prevenire frodi. Usa un altro numero.",
"SYNC can't send verification texts to this country yet.": "SYNC non può ancora inviare SMS di verifica in questo paese.",
"That code expired. Request a new text.": "Il codice è scaduto. Richiedi un nuovo SMS.",
"Too many verification attempts. Try again later.": "Troppi tentativi di verifica. Riprova più tardi.",
"Wait before requesting another verification text.": "Attendi prima di richiedere un altro SMS di verifica.",
"That code is incorrect.": "Il codice non è corretto.",
"SYNC verification texts aren't available yet. No text was sent.": "Gli SMS di verifica SYNC non sono ancora disponibili. Nessun SMS è stato inviato.",
"SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified.": "Gli SMS di verifica SYNC non sono ancora disponibili. Non verrà inviato alcun SMS e nessun dispositivo sarà verificato.",
"The verification text could not be sent. No number was verified.": "Non è stato possibile inviare l'SMS di verifica. Nessun numero è stato verificato.",
"That code is incorrect. Request a new code.": "Il codice non è corretto. Richiedi un nuovo codice.",
"This verification request is no longer active.": "Questa richiesta di verifica non è più attiva.",
"You can resend once. Try again in 10 minutes.": "Puoi richiedere un nuovo invio una sola volta. Riprova tra 10 minuti."
},
"fr": {
"That mobile number isn't valid. Check the country code and number.": "Ce numéro de mobile n'est pas valide. Vérifie l'indicatif et le numéro.",
"Too many codes were sent to this number. Try again later.": "Trop de codes ont été envoyés à ce numéro. Réessaie plus tard.",
"Too many incorrect codes. Request a new text later.": "Trop de codes incorrects. Demande un nouveau SMS plus tard.",
"Texts to this number are blocked to prevent fraud. Use another mobile number.": "Les SMS vers ce numéro sont bloqués pour éviter la fraude. Utilise un autre numéro.",
"SYNC can't send verification texts to this country yet.": "SYNC ne peut pas encore envoyer de SMS de vérification dans ce pays.",
"That code expired. Request a new text.": "Ce code a expiré. Demande un nouveau SMS.",
"Too many verification attempts. Try again later.": "Trop de tentatives de vérification. Réessaie plus tard.",
"Wait before requesting another verification text.": "Attends avant de demander un autre SMS de vérification.",
"That code is incorrect.": "Ce code est incorrect.",
"SYNC verification texts aren't available yet. No text was sent.": "Les SMS de vérification SYNC ne sont pas encore disponibles. Aucun SMS n'a été envoyé.",
"SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified.": "Les SMS de vérification SYNC ne sont pas encore disponibles. Aucun SMS ne sera envoyé et aucun appareil ne sera vérifié.",
"The verification text could not be sent. No number was verified.": "Le SMS de vérification n'a pas pu être envoyé. Aucun numéro n'a été vérifié.",
"That code is incorrect. Request a new code.": "Ce code est incorrect. Demande un nouveau code.",
"This verification request is no longer active.": "Cette demande de vérification n'est plus active.",
"You can resend once. Try again in 10 minutes.": "Tu peux renvoyer une seule fois. Réessaie dans 10 minutes."
},
"es": {
"That mobile number isn't valid. Check the country code and number.": "Ese número de móvil no es válido. Revisa el prefijo y el número.",
"Too many codes were sent to this number. Try again later.": "Se enviaron demasiados códigos a este número. Inténtalo más tarde.",
"Too many incorrect codes. Request a new text later.": "Demasiados códigos incorrectos. Pide un nuevo SMS más tarde.",
"Texts to this number are blocked to prevent fraud. Use another mobile number.": "Los SMS a este número están bloqueados para evitar fraudes. Usa otro número.",
"SYNC can't send verification texts to this country yet.": "SYNC todavía no puede enviar SMS de verificación a este país.",
"That code expired. Request a new text.": "Ese código caducó. Pide un nuevo SMS.",
"Too many verification attempts. Try again later.": "Demasiados intentos de verificación. Inténtalo más tarde.",
"Wait before requesting another verification text.": "Espera antes de pedir otro SMS de verificación.",
"That code is incorrect.": "Ese código es incorrecto.",
"SYNC verification texts aren't available yet. No text was sent.": "Los SMS de verificación de SYNC aún no están disponibles. No se envió ningún SMS.",
"SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified.": "Los SMS de verificación de SYNC aún no están disponibles. No se enviará ningún SMS ni se verificará ningún dispositivo.",
"The verification text could not be sent. No number was verified.": "No se pudo enviar el SMS de verificación. No se verificó ningún número.",
"That code is incorrect. Request a new code.": "Ese código es incorrecto. Pide un código nuevo.",
"This verification request is no longer active.": "Esta solicitud de verificación ya no está activa.",
"You can resend once. Try again in 10 minutes.": "Solo puedes reenviar una vez. Inténtalo de nuevo en 10 minutos."
},
"de": {
"That mobile number isn't valid. Check the country code and number.": "Diese Handynummer ist ungültig. Prüfe Ländervorwahl und Nummer.",
"Too many codes were sent to this number. Try again later.": "An diese Nummer wurden zu viele Codes gesendet. Versuche es später erneut.",
"Too many incorrect codes. Request a new text later.": "Zu viele falsche Codes. Fordere später eine neue SMS an.",
"Texts to this number are blocked to prevent fraud. Use another mobile number.": "SMS an diese Nummer sind zum Schutz vor Betrug gesperrt. Nutze eine andere Nummer.",
"SYNC can't send verification texts to this country yet.": "SYNC kann noch keine Bestätigungs-SMS in dieses Land senden.",
"That code expired. Request a new text.": "Dieser Code ist abgelaufen. Fordere eine neue SMS an.",
"Too many verification attempts. Try again later.": "Zu viele Bestätigungsversuche. Versuche es später erneut.",
"Wait before requesting another verification text.": "Warte, bevor du eine weitere Bestätigungs-SMS anforderst.",
"That code is incorrect.": "Dieser Code ist falsch.",
"SYNC verification texts aren't available yet. No text was sent.": "SYNC-Bestätigungs-SMS sind noch nicht verfügbar. Es wurde keine SMS gesendet.",
"SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified.": "SYNC-Bestätigungs-SMS sind noch nicht verfügbar. Es wird keine SMS gesendet und kein Gerät bestätigt.",
"The verification text could not be sent. No number was verified.": "Die Bestätigungs-SMS konnte nicht gesendet werden. Keine Nummer wurde bestätigt.",
"That code is incorrect. Request a new code.": "Dieser Code ist falsch. Fordere einen neuen Code an.",
"This verification request is no longer active.": "Diese Bestätigungsanfrage ist nicht mehr aktiv.",
"You can resend once. Try again in 10 minutes.": "Du kannst nur einmal erneut senden. Versuche es in 10 Minuten erneut."
},
"pt": {
"That mobile number isn't valid. Check the country code and number.": "Esse número de celular não é válido. Confira o código do país e o número.",
"Too many codes were sent to this number. Try again later.": "Muitos códigos foram enviados para este número. Tente mais tarde.",
"Too many incorrect codes. Request a new text later.": "Muitos códigos incorretos. Peça um novo SMS mais tarde.",
"Texts to this number are blocked to prevent fraud. Use another mobile number.": "SMS para este número estão bloqueados para evitar fraudes. Use outro número.",
"SYNC can't send verification texts to this country yet.": "O SYNC ainda não pode enviar SMS de verificação para este país.",
"That code expired. Request a new text.": "Esse código expirou. Peça um novo SMS.",
"Too many verification attempts. Try again later.": "Muitas tentativas de verificação. Tente mais tarde.",
"Wait before requesting another verification text.": "Aguarde antes de pedir outro SMS de verificação.",
"That code is incorrect.": "Esse código está incorreto.",
"SYNC verification texts aren't available yet. No text was sent.": "Os SMS de verificação do SYNC ainda não estão disponíveis. Nenhum SMS foi enviado.",
"SYNC verification texts aren't available yet. No text will be sent and no device will be marked verified.": "Os SMS de verificação do SYNC ainda não estão disponíveis. Nenhum SMS será enviado e nenhum dispositivo será verificado.",
"The verification text could not be sent. No number was verified.": "Não foi possível enviar o SMS de verificação. Nenhum número foi verificado.",
"That code is incorrect. Request a new code.": "Esse código está incorreto. Peça um novo código.",
"This verification request is no longer active.": "Este pedido de verificação não está mais ativo.",
"You can resend once. Try again in 10 minutes.": "Você pode reenviar só uma vez. Tente de novo em 10 minutos."
}
};
 for(const [lang,words] of Object.entries(add))Object.assign(t[lang]||(t[lang]={}),words);
})();
