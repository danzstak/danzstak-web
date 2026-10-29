"use strict";
(() => {
  let dialog;
  async function shareFetch(path, options = {}, timeoutMs = 10000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch('https://api.danzstak.com' + path, { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === 'AbortError') throw new Error('Sharing took too long. Check your connection and try again.'); throw error; }
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
  async function openShareDialog(post) {
    if (post.dataset.audience !== 'public') return;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'post-share-dialog'; document.body.appendChild(dialog); }
    dialog.replaceChildren();
    const title = document.createElement('h2'); title.id = 'postShareTitle'; title.textContent = 'Share post'; dialog.setAttribute('aria-labelledby', title.id);
    const note = document.createElement('p'); note.textContent = 'The original author stays credited. The shared content disappears if the original is removed or becomes unavailable to the viewer.';
    const comment = document.createElement('textarea'); comment.maxLength = 5000; comment.placeholder = 'Add your own comment (optional)'; comment.setAttribute('aria-label', 'Your comment on the shared post');
    const destinationLabel = document.createElement('label'); destinationLabel.textContent = 'Share to';
    const destination = document.createElement('select'); destination.setAttribute('aria-label', 'Share destination');
    const ownFeed = document.createElement('option'); ownFeed.value = ''; ownFeed.textContent = 'Your DanzStak feed'; destination.appendChild(ownFeed);
    destinationLabel.appendChild(destination);
    const audienceLabel = document.createElement('label'); audienceLabel.textContent = 'Who can see this on your feed';
    const audience = document.createElement('select'); audience.setAttribute('aria-label', 'Shared post audience');
    for (const [value,label] of [['friends','Friends'],['public','Public'],['private','Only me']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; audience.appendChild(option); }
    audienceLabel.appendChild(audience);
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const publish = document.createElement('button'); publish.type = 'button'; publish.className = 'primary'; publish.textContent = 'Share to your DanzStak feed';
    destination.addEventListener('change', () => {
      const tribe = destination.selectedOptions[0]?.dataset.tribeName || '';
      audienceLabel.hidden = Boolean(destination.value);
      publish.textContent = tribe ? `Share to ${tribe}` : 'Share to your DanzStak feed';
    });
    publish.addEventListener('click', async () => {
      publish.disabled = true; comment.disabled = true; audience.disabled = true; destination.disabled = true; feedback.textContent = 'Sharing…';
      try {
        const tribe = destination.selectedOptions[0]?.dataset.tribeName || '';
        const response = await shareFetch('/secure-posts', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:comment.value.trim(),sharedPostId:post.dataset.postId,...(destination.value ? {groupId:destination.value} : {audience:audience.value})})});
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'The post could not be shared.');
        feedback.textContent = tribe ? `Shared to ${tribe}.` : 'Shared to your feed.'; if (typeof window.loadPosts === 'function') await window.loadPosts();
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
      feedback.textContent = tribes.length ? 'Choose your feed or one of your Tribes.' : 'Your joined Tribes will appear here.';
    } catch { feedback.textContent = 'Your feed is ready. Tribes could not be loaded right now.'; }
  }
  window.danzstakSharePost = post => { void openShareDialog(post); };
  window.danzstakRenderSharedPost = (article, post) => {
    if (!post.sharedPostId || article.querySelector(".shared-post-card")) return;
    const card = document.createElement('div'); card.className = 'shared-post-card';
    if (!post.sharedPost) card.textContent = 'The original post is no longer available to you.';
    else {
      const source = post.sharedPost, memberId = String(source.authorMemberId || ''), validMemberId = /^[a-f0-9-]{36}$/.test(memberId), name = document.createElement(validMemberId ? 'a' : 'strong'); name.textContent = source.authorName;
      if (validMemberId) { name.href = 'profile.html?member=' + encodeURIComponent(memberId); name.className = 'shared-post-author'; }
      const body = document.createElement('p'); body.textContent = source.content; card.append(name,body);
      if (source.mediaUrl && ['image','video'].includes(source.mediaType)) { const media = document.createElement(source.mediaType === 'image' ? 'img' : 'video'); media.src = source.mediaUrl; media.className = 'shared-post-media'; if (source.mediaType === 'image') { media.alt = 'Photo by ' + source.authorName; media.loading = 'lazy'; } else { media.controls = true; media.playsInline = true; media.preload = 'metadata'; } card.appendChild(media); }
      const original = document.createElement('a'); original.href = 'feed.html#post-' + encodeURIComponent(source.postId); original.textContent = 'View original post'; card.appendChild(original);
    }
    const actions = article.querySelector('.post-actions'); if (actions) actions.before(card); else article.appendChild(card);
  };
})();
