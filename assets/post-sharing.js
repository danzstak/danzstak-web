"use strict";
(() => {
  let dialog;
  async function shareFetch(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch('https://api.danzstak.com' + path, { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === 'AbortError') throw new Error('Sharing took too long. Check your connection and try again.'); throw new Error('DanzStak cannot share this post right now. Check your connection and try again.'); }
    finally { clearTimeout(timer); }
  }
  const defaultTribes = ["Visual Artist", "DJs & Producers", "Fans", "Venues", "Events", "Scenes", "Bands", "Industry", "Politics", "Religion"]
    .map((name, index) => ({ id: `default-${index}`, name }));
  async function joinedTribes() {
    const [groupsResponse, membershipResponse] = await Promise.all([
      shareFetch('/groups', { credentials: 'include', cache: 'no-store' }),
      shareFetch('/groups/membership', { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) })
    ]);
    const groupsData = await groupsResponse.json().catch(() => ({}));
    const membershipData = await membershipResponse.json().catch(() => ({}));
    if (!groupsResponse.ok || !membershipResponse.ok) return [];
    const memberships = new Set(Array.isArray(membershipData.groupIds) ? membershipData.groupIds : []);
    const groups = [...defaultTribes, ...(Array.isArray(groupsData.groups) ? groupsData.groups : [])];
    return groups.filter(group => memberships.has(group.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  async function refreshSharedPostMedia(source) {
    if (!source?.postId) return '';
    const response = await shareFetch('/secure-posts', { credentials: 'include', cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return '';
    const data = await response.json().catch(() => ({}));
    const original = (data.posts || []).find(post => post.postId === source.postId);
    if (!original?.mediaUrl || !['image','video'].includes(original.mediaType)) return '';
    source.mediaUrl = original.mediaUrl;
    source.mediaType = original.mediaType;
    return source.mediaUrl;
  }
  function installSharedPostMedia(card, source) {
    const recovery = document.createElement('div'); recovery.className = 'shared-post-recovery';
    const copy = document.createElement('span'); copy.textContent = window.danzstakTranslate?.('Media is temporarily unavailable.') || 'Media is temporarily unavailable.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = window.danzstakTranslate?.('Retry media') || 'Retry media';
    recovery.append(copy,retry);
    const insert = node => { const original = card.querySelector('a[href*="#post-"]'); if (original) original.before(node); else card.appendChild(node); };
    const showRecovery = () => { card.querySelector('.shared-post-media')?.remove(); if (!recovery.parentNode) insert(recovery); };
    const install = async () => {
      retry.disabled = true;
      const mediaUrl = source.mediaUrl || await refreshSharedPostMedia(source);
      retry.disabled = false;
      if (!mediaUrl) { showRecovery(); return; }
      recovery.remove();
      const media = document.createElement(source.mediaType === 'image' ? 'img' : 'video'); media.className = 'shared-post-media';
      media.addEventListener('error', () => { source.mediaUrl = ''; showRecovery(); }, { once:true });
      if (source.mediaType === 'image') { media.alt = 'Photo by ' + source.authorName; media.loading = 'lazy'; }
      else { media.controls = true; media.playsInline = true; media.preload = 'metadata'; media.setAttribute('aria-label', 'Video by ' + source.authorName); }
      media.src = mediaUrl; insert(media);
    };
    retry.addEventListener('click', () => { source.mediaUrl = ''; void install(); });
    void install();
  }
  async function openShareDialog(post) {
    if (post.dataset.audience !== 'public') return;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'post-share-dialog'; document.body.appendChild(dialog); }
    dialog.replaceChildren();
    const title = document.createElement('h2'); title.id = 'postShareTitle'; title.textContent = 'Share post'; dialog.setAttribute('aria-labelledby', title.id);
    const note = document.createElement('p'); note.textContent = 'The original author stays credited. Removing one placement keeps authorized shares working. If the creator deletes the original everywhere, your own comment can remain with a small removed-content notice.';
    const comment = document.createElement('textarea'); comment.maxLength = 5000; comment.placeholder = 'Add your own comment (optional)'; comment.setAttribute('aria-label', 'Your comment on the shared post');
    const destinationLabel = document.createElement('label'); destinationLabel.textContent = 'Share to';
    const destination = document.createElement('select'); destination.setAttribute('aria-label', 'Share destination');
    const ownFeed = document.createElement('option'); ownFeed.value = ''; ownFeed.textContent = 'Your Mix'; destination.appendChild(ownFeed);
    destinationLabel.appendChild(destination);
    const audienceLabel = document.createElement('label'); audienceLabel.textContent = 'Who can see this in Your Mix';
    const audience = document.createElement('select'); audience.setAttribute('aria-label', 'Shared post audience');
    for (const [value,label] of [['friends','Friends'],['public','Public'],['private','Just me']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; audience.appendChild(option); }
    audienceLabel.appendChild(audience);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const publish = document.createElement('button'); publish.type = 'button'; publish.className = 'primary'; publish.textContent = 'Share to Your Mix';
    destination.addEventListener('change', () => {
      const tribe = destination.selectedOptions[0]?.dataset.tribeName || '';
      audienceLabel.hidden = Boolean(destination.value);
      publish.textContent = tribe ? `Share to ${tribe}` : 'Share to Your Mix';
    });
    publish.addEventListener('click', async () => {
      publish.disabled = true; comment.disabled = true; audience.disabled = true; destination.disabled = true; feedback.textContent = 'Sharing…';
      try {
        const tribe = destination.selectedOptions[0]?.dataset.tribeName || '';
        const response = await shareFetch('/secure-posts', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:comment.value.trim(),sharedPostId:post.dataset.postId,...(destination.value ? {groupId:destination.value} : {audience:audience.value})})});
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'The post could not be shared.');
        feedback.textContent = tribe ? `Shared to ${tribe}.` : 'Shared to Your Mix.'; if (typeof window.loadPosts === 'function') await window.loadPosts();
      } catch (error) { feedback.textContent = error.message; publish.disabled = false; comment.disabled = false; audience.disabled = false; destination.disabled = false; }
    });
    const url = new URL('feed.html', location.href); url.search = ''; url.hash = 'post-' + post.dataset.postId;
    const link = document.createElement('input'); link.type = 'url'; link.readOnly = true; link.value = url.href; link.setAttribute('aria-label', 'Post link'); link.addEventListener('click', () => link.select());
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
    copy.addEventListener('click', async () => { let timer; copy.disabled = true; try { await Promise.race([navigator.clipboard.writeText(url.href),new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Clipboard unavailable')),3000); })]); feedback.textContent = 'Link copied.'; } catch { link.focus(); link.select(); feedback.textContent = 'Select and copy the post link.'; } finally { clearTimeout(timer); copy.disabled = false; } });
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => dialog.close());
    const actions = document.createElement('div'); actions.className = 'post-share-actions'; actions.append(copy,close);
    dialog.append(title,note,comment,destinationLabel,audienceLabel,publish,feedback,link,actions); dialog.onclose = () => post.querySelector('.shareBtn')?.focus(); dialog.showModal();
    feedback.textContent = 'Loading your Tribes…';
    try {
      const tribes = await joinedTribes();
      for (const tribe of tribes) { const option = document.createElement('option'); option.value = tribe.id; option.textContent = tribe.name; option.dataset.tribeName = tribe.name; destination.appendChild(option); }
      feedback.textContent = tribes.length ? 'Choose Your Mix or one of your Tribes.' : 'Your joined Tribes will appear here.';
    } catch { feedback.textContent = 'Your Mix is ready. Tribes could not be loaded right now.'; }
  }
  window.danzstakSharePost = post => { void openShareDialog(post); };
  function renderUnavailableOriginal(card, state) {
    card.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'shared-post-unavailable';
    notice.textContent = state === 'creator_deleted'
      ? (window.danzstakTranslate?.('Original content removed by its creator.') || 'Original content removed by its creator.')
      : (window.danzstakTranslate?.('Content unavailable') || 'Content unavailable');
    card.appendChild(notice);
  }
  window.danzstakRenderSharedPost = (article, post) => {
    if (!post.sharedPostId || article.querySelector(".shared-post-card")) return;
    const card = document.createElement('div'); card.className = 'shared-post-card';
    card.dataset.sourcePostId = post.sharedPostId;
    if (!post.sharedPost) renderUnavailableOriginal(card, post.sharedPostState);
    else {
      const source = post.sharedPost, memberId = String(source.authorMemberId || ''), validMemberId = /^[a-f0-9-]{36}$/.test(memberId), name = document.createElement(validMemberId ? 'a' : 'strong'); name.textContent = source.authorName;
      if (validMemberId) { name.href = 'profile.html?member=' + encodeURIComponent(memberId); name.className = 'shared-post-author'; }
      const body = document.createElement('p'); window.danzstakRenderUserText?.(body, source.content) || (body.textContent = source.content); card.append(name,body);
      if (['image','video'].includes(source.mediaType)) installSharedPostMedia(card, source);
      const original = document.createElement('a'); original.href = 'feed.html#post-' + encodeURIComponent(source.postId); original.textContent = 'View original post'; card.appendChild(original);
    }
    const actions = article.querySelector('.post-actions'); if (actions) actions.before(card); else article.appendChild(card);
  };
  const renderLoadedShares = posts => {
    for (const post of Array.isArray(posts) ? posts : []) {
      if (!post?.sharedPostId) continue;
      const article = document.getElementById('post-' + post.postId);
      if (article) window.danzstakRenderSharedPost(article, post);
    }
  };
  window.addEventListener('danzstak:posts-loaded', event => renderLoadedShares(event.detail?.posts));
  queueMicrotask(() => renderLoadedShares(window.danzstakLoadedPosts));
  window.addEventListener('danzstak:source-revoked', event => {
    const sourcePostId = String(event.detail?.postId || '');
    if (!sourcePostId) return;
    document.querySelectorAll('.shared-post-card').forEach(card => {
      if (card.dataset.sourcePostId === sourcePostId) renderUnavailableOriginal(card, 'creator_deleted');
    });
  });
})();
