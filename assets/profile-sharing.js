"use strict";
(() => {
  let dialog, shareExtra = () => null;
  // `own` adds, on the member's own profile, the link preview they are about to share and the switch for it (SHARE,
  // spec 44). The link field always holds the link to share; Copy and Share read it when tapped.
  function show(title, url, message, opener, extra = null, own = null) {
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'profile-share-dialog'; document.body.appendChild(dialog); }
    dialog.replaceChildren();
    const heading = document.createElement('h2'); heading.id = 'profileShareTitle'; heading.textContent = title; dialog.setAttribute('aria-labelledby', heading.id);
    const description = document.createElement('p'); description.textContent = message;
    const link = document.createElement('input'); link.type = 'url'; link.readOnly = true; link.value = url; link.setAttribute('aria-label', 'Shareable link'); link.addEventListener('click', () => link.select());
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const actions = document.createElement('div'); actions.className = 'profile-share-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
    copy.addEventListener('click', async () => {
      copy.disabled = true; let timeout;
      try { await Promise.race([navigator.clipboard.writeText(link.value), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Clipboard unavailable')), 3000); })]); feedback.textContent = 'Link copied.'; }
      catch { link.focus(); link.select(); feedback.textContent = 'Select and copy the link above.'; }
      finally { clearTimeout(timeout); copy.disabled = false; }
    });
    actions.appendChild(copy);
    if (extra) { const more = document.createElement('button'); more.type = 'button'; more.className = 'profile-share-switch'; more.textContent = extra.label; more.addEventListener('click', extra.run); actions.appendChild(more); }
    if (navigator.share) { const share = document.createElement('button'); share.type = 'button'; share.textContent = 'Share'; share.addEventListener('click', async () => { try { await navigator.share({title:'DanzStak',text:message,url:link.value}); } catch (error) { if (error.name !== 'AbortError') feedback.textContent = 'Use Copy link to share this link.'; } }); actions.appendChild(share); }
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => dialog.close()); actions.appendChild(close);
    dialog.append(heading, description, ...(own ? own.build(link, feedback) : []), link, feedback, actions); dialog.onclose = () => { own?.closed(); opener.focus(); }; dialog.showModal();
  }
  const profileLink = member => { const url = new URL('profile.html', location.href); url.search = ''; url.searchParams.set('member', member); return url.href; };

  // SHARE (owner 2026-11-21: "When a user share their profile it should show just like the image I uploaded"). On your own
  // profile the sheet shows the card your link will show and a switch, on unless you turned it off. With it on, the link is
  // danzstak.com/@username and previews as your card; off, it is the plain profile link with the general DanzStak card.
  function ownPreview(fallback) {
    let preview = null;
    const forget = () => { if (preview) URL.revokeObjectURL(preview); preview = null; };
    return {
      closed: forget,
      build(link, feedback) {
        const card = window.danzstakShareCard;
        if (!card) return [];
        const figure = document.createElement('figure'); figure.className = 'profile-share-preview'; figure.hidden = true;
        const image = document.createElement('img'); image.alt = window.danzstakTranslate?.('Your link preview') || 'Your link preview'; image.width = 1200; image.height = 630; figure.append(image);
        const toggle = document.createElement('label'); toggle.className = 'profile-share-toggle';
        const input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch');
        const text = document.createElement('span'); text.textContent = 'Show my photo and name in link previews';
        toggle.append(input, text);
        const note = document.createElement('p'); note.className = 'profile-share-note'; note.textContent = 'Anyone you send this link to sees your name, photo and cover.';
        const showCard = blob => { forget(); preview = URL.createObjectURL(blob); image.src = preview; figure.hidden = false; };
        const useLink = profile => { link.value = profile?.shareUrl || fallback; };
        const prepare = async () => {
          input.disabled = true; feedback.textContent = 'Preparing your link preview…';
          try { const { profile, blob } = await card.ready(window.danzstakCurrentProfile || {}); showCard(blob); useLink(profile); feedback.textContent = ''; }
          catch { feedback.textContent = "The link preview couldn't be saved. Your link still works."; useLink(null); input.checked = window.danzstakCurrentProfile?.shareCard === true; figure.hidden = !input.checked || !preview; }
          finally { input.disabled = false; }
        };
        input.addEventListener('change', async () => {
          if (input.checked) return prepare();
          input.disabled = true; figure.hidden = true; useLink(null); feedback.textContent = '';
          try { await card.turnOff(); }
          catch { feedback.textContent = "The link preview couldn't be saved. Your link still works."; input.checked = true; figure.hidden = !preview; useLink(window.danzstakCurrentProfile); }
          finally { input.disabled = false; }
        });
        input.checked = window.danzstakCurrentProfile?.shareCard !== false;
        if (input.checked) prepare();
        return [figure, toggle, note];
      }
    };
  }
  // The same invite sheet opens from the Friends screen's Invite (5a3).
  window.danzstakInvitePeople = opener => show('Invite People', new URL('./', location.href).href, 'Join me on DanzStak. Create an account to connect and share your original content.', opener);
  function start() {
    const actions = document.querySelector('.profile-actions'); if (!actions) return;
    // UIKIT 4b part 2: a quiet kit icon button in the profile's action row (ds-icon.js).
    const share = document.createElement('button'); share.type = 'button'; share.dataset.icon = 'share'; share.hidden = true;
    const label = window.danzstakTranslate?.('Share profile') || 'Share profile';
    if (window.danzstakIconButton) window.danzstakIconButton(share, 'share', label, 'quiet'); else { share.textContent = label; share.setAttribute('aria-label', label); }
    share.addEventListener('click', () => {
      const profile = window.danzstakCurrentProfile || {}, member = profile.memberId; if (!/^[a-f0-9-]{36}$/.test(member || '')) return;
      const fallback = profileLink(member), own = profile.isOwner === true ? ownPreview(fallback) : null;
      show('Share Profile', profile.shareUrl || fallback, 'Share this profile with friends and people in your Tribes on DanzStak.', share, shareExtra(), own);
    });
    // Owner 2026-11-19: Share and Invite People were two buttons doing the same job. One Share button; on your own
    // profile its sheet also offers the plain DanzStak invite link.
    const inviteSheet = () => window.danzstakInvitePeople(share);
    shareExtra = () => window.danzstakCurrentProfile?.isOwner === true ? { label: 'Invite People', run: inviteSheet } : null;
    actions.append(share);
    const update = () => { share.hidden = share.classList.contains('profile-share-hidden') || !/^[a-f0-9-]{36}$/.test(window.danzstakCurrentProfile?.memberId || ''); }; // a visitor's Share lives in ⋯ (profile-nav.js)
    window.addEventListener('danzstak:profile-loaded', update); update();
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
