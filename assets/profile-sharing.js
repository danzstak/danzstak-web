"use strict";
(() => {
  let dialog;
  function show(title, url, message, opener) {
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
      try { await Promise.race([navigator.clipboard.writeText(url), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Clipboard unavailable')), 3000); })]); feedback.textContent = 'Link copied.'; }
      catch { link.focus(); link.select(); feedback.textContent = 'Select and copy the link above.'; }
      finally { clearTimeout(timeout); copy.disabled = false; }
    });
    actions.appendChild(copy);
    if (navigator.share) { const share = document.createElement('button'); share.type = 'button'; share.textContent = 'Share'; share.addEventListener('click', async () => { try { await navigator.share({title:'DanzStak',text:message,url}); } catch (error) { if (error.name !== 'AbortError') feedback.textContent = 'Use Copy link to share this link.'; } }); actions.appendChild(share); }
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => dialog.close()); actions.appendChild(close);
    dialog.append(heading, description, link, feedback, actions); dialog.onclose = () => opener.focus(); dialog.showModal();
  }
  function start() {
    const actions = document.querySelector('.profile-actions'); if (!actions) return;
    const share = document.createElement('button'); share.type = 'button'; share.textContent = 'Share Profile'; share.hidden = true;
    share.addEventListener('click', () => {
      const member = window.danzstakCurrentProfile?.memberId; if (!/^[a-f0-9-]{36}$/.test(member || '')) return;
      const url = new URL('profile.html', location.href); url.search = ''; url.searchParams.set('member', member);
      show('Share Profile', url.href, 'Share this profile with friends and people in your Tribes on DanzStak.', share);
    });
    const invite = document.createElement('button'); invite.type = 'button'; invite.textContent = 'Invite People';
    invite.hidden = Boolean(new URLSearchParams(location.search).get('user') || new URLSearchParams(location.search).get('member'));
    invite.addEventListener('click', () => show('Invite People', new URL('./', location.href).href, 'Join me on DanzStak. Create an account to connect and share your original content.', invite));
    actions.append(share, invite);
    const update = () => { share.hidden = !/^[a-f0-9-]{36}$/.test(window.danzstakCurrentProfile?.memberId || ''); if (window.danzstakCurrentProfile?.isOwner === true) invite.hidden = false; };
    window.addEventListener('danzstak:profile-loaded', update); update();
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
