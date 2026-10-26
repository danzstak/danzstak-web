"use strict";
(() => {
  let dialog;
  window.danzstakSharePost = post => {
    if (post.dataset.audience !== 'public') return;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'post-share-dialog'; document.body.appendChild(dialog); }
    dialog.replaceChildren();
    const title = document.createElement('h2'); title.id = 'postShareTitle'; title.textContent = 'Share post'; dialog.setAttribute('aria-labelledby', title.id);
    const note = document.createElement('p'); note.textContent = 'The original author stays credited. The shared content disappears if the original is removed or becomes unavailable to the viewer.';
    const comment = document.createElement('textarea'); comment.maxLength = 5000; comment.placeholder = 'Add your own comment (optional)'; comment.setAttribute('aria-label', 'Your comment on the shared post');
    const audience = document.createElement('select'); audience.setAttribute('aria-label', 'Shared post audience');
    for (const [value,label] of [['friends','Friends'],['public','Public'],['private','Only me']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; audience.appendChild(option); }
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const publish = document.createElement('button'); publish.type = 'button'; publish.className = 'primary'; publish.textContent = 'Share to your DanzStak feed';
    publish.addEventListener('click', async () => {
      publish.disabled = true; comment.disabled = true; audience.disabled = true; feedback.textContent = 'Sharing…';
      try {
        const response = await fetch('https://api.danzstak.com/secure-posts', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:comment.value.trim(),sharedPostId:post.dataset.postId,audience:audience.value})});
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'The post could not be shared.');
        feedback.textContent = 'Shared to your feed.'; if (typeof window.loadPosts === 'function') await window.loadPosts();
      } catch (error) { feedback.textContent = error.message; publish.disabled = false; comment.disabled = false; audience.disabled = false; }
    });
    const url = new URL('feed.html', location.href); url.search = ''; url.hash = 'post-' + post.dataset.postId;
    const link = document.createElement('input'); link.type = 'url'; link.readOnly = true; link.value = url.href; link.setAttribute('aria-label', 'Post link'); link.addEventListener('click', () => link.select());
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
    copy.addEventListener('click', async () => { let timer; copy.disabled = true; try { await Promise.race([navigator.clipboard.writeText(url.href),new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Clipboard unavailable')),3000); })]); feedback.textContent = 'Link copied.'; } catch { link.focus(); link.select(); feedback.textContent = 'Select and copy the post link.'; } finally { clearTimeout(timer); copy.disabled = false; } });
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => dialog.close());
    const actions = document.createElement('div'); actions.className = 'post-share-actions'; actions.append(copy,close);
    dialog.append(title,note,comment,audience,publish,feedback,link,actions); dialog.onclose = () => post.querySelector('.shareBtn')?.focus(); dialog.showModal();
  };
  window.danzstakRenderSharedPost = (article, post) => {
    if (!post.sharedPostId || article.querySelector(".shared-post-card")) return;
    const card = document.createElement('div'); card.className = 'shared-post-card';
    if (!post.sharedPost) card.textContent = 'The original post is no longer available to you.';
    else {
      const source = post.sharedPost, name = document.createElement('strong'); name.textContent = source.authorName;
      const body = document.createElement('p'); body.textContent = source.content; card.append(name,body);
      if (source.mediaUrl && ['image','video'].includes(source.mediaType)) { const media = document.createElement(source.mediaType === 'image' ? 'img' : 'video'); media.src = source.mediaUrl; media.className = 'shared-post-media'; if (source.mediaType === 'image') { media.alt = 'Photo by ' + source.authorName; media.loading = 'lazy'; } else { media.controls = true; media.playsInline = true; media.preload = 'metadata'; } card.appendChild(media); }
      const original = document.createElement('a'); original.href = 'feed.html#post-' + encodeURIComponent(source.postId); original.textContent = 'View original post'; card.appendChild(original);
    }
    const actions = article.querySelector('.post-actions'); if (actions) actions.before(card); else article.appendChild(card);
  };
})();
