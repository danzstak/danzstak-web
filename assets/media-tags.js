"use strict";
(() => {
  let dialog, generation = 0;
  const memberId = value => /^[a-f0-9-]{36}$/.test(String(value || ''));
  async function tagFetch(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch('https://api.danzstak.com' + path, { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === 'AbortError') throw new Error('Tagging took too long. Check your connection and try again.'); throw error; }
    finally { clearTimeout(timer); }
  }
  async function patch(postId, body) {
    const response = await tagFetch('/secure-posts/' + encodeURIComponent(postId), {method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Tags could not be saved.'); return result;
  }
  window.danzstakRenderMediaTags = (article, post) => {
    article.querySelector('.post-tags')?.remove();
    const media = article.querySelector('.post-media,.profile-post-media');
    const tags = (post.taggedUsers || []).filter(tag => memberId(tag.memberId)); article.dataset.taggedUsers = JSON.stringify(tags);
    if (!tags.length) { if (media) media._danzstakRemoveOwnTag = null; return; }
    const row = document.createElement('div'); row.className = 'post-tags'; row.appendChild(document.createTextNode('Tagged: '));
    tags.forEach((tag,index) => { if (index) row.appendChild(document.createTextNode(', ')); const link = document.createElement('a'); link.href = tag.isMe ? 'profile.html' : 'profile.html?member=' + encodeURIComponent(tag.memberId); link.textContent = tag.name; link.setAttribute('data-no-translate',''); row.appendChild(link); });
    if (tags.some(tag => tag.isMe)) {
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove my tag';
      remove.addEventListener('click', async () => {
        if (!confirm('Remove your tag from this post? The original post will stay in place.')) return;
        remove.disabled = true;
        try { await patch(post.postId,{removeOwnTag:true}); post.taggedUsers = tags.filter(tag => !tag.isMe); window.danzstakRenderMediaTags(article,post); }
        catch (error) { remove.disabled = false; let status = row.querySelector('[role="status"]'); if (!status) { status = document.createElement('span'); status.setAttribute('role','status'); row.appendChild(status); } status.textContent = error.message; }
      }); row.appendChild(remove);
      if (media) {
        media._danzstakRemoveOwnTag = () => remove.click();
        media.title = 'Press and hold to remove your tag';
        if (!media.dataset.tagLongPressBound) {
          media.dataset.tagLongPressBound = 'true';
          let timer = 0, startX = 0, startY = 0, activated = false;
          const cancel = () => { clearTimeout(timer); timer = 0; };
          media.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !media._danzstakRemoveOwnTag) return;
            activated = false; startX = event.clientX; startY = event.clientY; cancel();
            timer = setTimeout(() => { timer = 0; activated = true; navigator.vibrate?.(20); media._danzstakRemoveOwnTag?.(); }, 650);
          });
          media.addEventListener('pointermove', event => { if (Math.hypot(event.clientX-startX,event.clientY-startY) > 10) cancel(); });
          media.addEventListener('pointerup', cancel); media.addEventListener('pointercancel', cancel); media.addEventListener('lostpointercapture', cancel);
          media.addEventListener('contextmenu', event => { if (activated) { event.preventDefault(); activated = false; } });
        }
      }
    }
    const header = article.querySelector('.post-header'); if (header) header.appendChild(row); else article.appendChild(row);
  };
  window.danzstakOpenMediaTags = async post => {
    const version = ++generation;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'media-tags-dialog'; document.body.appendChild(dialog); }
    dialog.replaceChildren();
    const title = document.createElement('h2'); title.id = 'mediaTagsTitle'; title.textContent = 'Tag people'; dialog.setAttribute('aria-labelledby',title.id);
    const note = document.createElement('p'); note.textContent = 'Tag accepted friends who allow tagging. Each person can remove their own tag. Removed tags cannot be added back to this post.';
    const list = document.createElement('div'); list.className = 'media-tags-people';
    const status = document.createElement('p'); status.setAttribute('role','status'); status.textContent = 'Loading friends…';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = 'Save tags'; save.disabled = true;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cancel'; close.addEventListener('click',()=>dialog.close());
    const actions = document.createElement('div'); actions.className = 'media-tags-actions'; actions.append(close,save); dialog.append(title,note,list,status,actions); dialog.showModal();
    let existing; try { existing = JSON.parse(post.dataset.taggedUsers || '[]'); } catch { existing = []; }
    const selected = new Set(existing.map(tag => tag.memberId));
    try {
      const response = await tagFetch('/friends',{credentials:'include',cache:'no-store'}); if (!response.ok) throw new Error('Friends could not be loaded. Close and retry.');
      const members = new Map((await response.json()).friends?.filter(person => memberId(person.memberId)).map(person => [person.memberId,person]) || []);
      for (const person of existing) if (!members.has(person.memberId)) members.set(person.memberId,person);
      if (!dialog.open || version !== generation) return;
      for (const person of [...members.values()].sort((a,b)=>String(a.name || '').localeCompare(String(b.name || '')))) {
        const label = document.createElement('label'); label.className = 'media-tags-person'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(person.memberId);
        checkbox.addEventListener('change',()=>{ if (checkbox.checked && selected.size >= 10) { checkbox.checked = false; status.textContent = 'Choose at most 10 people.'; return; } checkbox.checked ? selected.add(person.memberId) : selected.delete(person.memberId); status.textContent = selected.size + ' people selected'; });
        const name = document.createElement('span'); name.textContent = person.name || 'DanzStak member'; name.setAttribute('data-no-translate',''); label.append(checkbox,name); list.appendChild(label);
      }
      status.textContent = members.size ? 'Choose up to 10 people.' : 'Add accepted friends before tagging people.'; save.disabled = !members.size;
    } catch (error) { status.textContent = error.message; }
    if (version !== generation || !dialog.open) return;
    save.addEventListener('click', async () => {
      save.disabled = true; close.disabled = true; list.querySelectorAll('input').forEach(input => input.disabled = true);
      try { await patch(post.dataset.postId,{taggedMembers:[...selected]}); status.textContent = 'Tags saved.'; if (typeof window.loadPosts === 'function') await window.loadPosts(); if (version === generation && dialog.open) dialog.close(); }
      catch (error) { status.textContent = error.message; save.disabled = false; }
      finally { close.disabled = false; list.querySelectorAll('input').forEach(input => input.disabled = false); }
    });
    dialog.onclose = () => post.querySelector('.post-menu-toggle')?.focus();
  };
})();
