"use strict";
(() => {
  const input = document.querySelector('.search'), feed = document.getElementById('feed');
  if (!input || !feed) return;
  const section = document.createElement('section');
  section.className = 'panel user-search-results'; section.hidden = true;
  section.setAttribute('aria-label', 'Matching users');
  const heading = document.createElement('h3'); heading.textContent = 'Users';
  const status = document.createElement('p'); status.className = 'muted'; status.setAttribute('role', 'status');
  const list = document.createElement('div'); list.className = 'user-search-list';
  section.append(heading, status, list); feed.insertAdjacentElement('beforebegin', section);
  let generation = 0, timer, pending, directory = [], loadedAt = 0, failed = false;
  async function loadPeople() {
    if (Date.now() - loadedAt < 60000) return directory;
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('https://api.danzstak.com/calls/directory', {credentials:'include', signal:controller.signal});
        if (!response.ok) throw new Error('User search unavailable');
        directory = (await response.json()).users || []; loadedAt = Date.now(); failed = false;
      } catch { failed = true; }
      finally { clearTimeout(timeout); pending = null; }
      return directory;
    })();
    return pending;
  }
  function collectPeople() {
    const people = new Map();
    for (const member of directory) {
      if (!member.email || (member.friendStatus !== 'friends' && !member.sharedGroup)) continue;
      if (!/^[a-f0-9-]{36}$/.test(String(member.memberId || ''))) continue;
      const href = 'profile.html?member=' + encodeURIComponent(member.memberId);
      people.set(href, {name:member.name || 'DanzStak member', detail:'', href});
    }
    for (const anchor of document.querySelectorAll('#feed .post .post-header a')) {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin || !url.pathname.endsWith('/profile.html')) continue;
        const href = 'profile.html' + url.search;
        if (!people.has(href)) people.set(href, {name:anchor.textContent.trim(), detail:'', href});
      } catch { /* Ignore malformed author links. */ }
    }
    return [...people.values()];
  }
  async function searchPeople() {
    const version = ++generation, query = input.value.trim().toLocaleLowerCase();
    clearTimeout(timer); section.hidden = !query; list.replaceChildren();
    if (!query) { status.textContent = ''; return; }
    window.dispatchEvent(new CustomEvent('danzstak:show-search'));
    status.textContent = 'Searching users…';
    timer = setTimeout(async () => {
      await loadPeople();
      if (version !== generation) return;
      const matches = collectPeople().filter(person => (person.name + ' ' + person.detail).toLocaleLowerCase().includes(query)).slice(0,20);
      for (const person of matches) {
        const link = document.createElement('a'); link.className = 'user-search-result'; link.href = person.href;
        link.setAttribute('data-no-translate', '');
        const name = document.createElement('strong'); name.textContent = person.name;
        link.appendChild(name); list.appendChild(link);
      }
      status.textContent = matches.length ? `${matches.length} matching user${matches.length === 1 ? '' : 's'}.` : failed ? 'User directory unavailable. Showing matching post authors when available.' : 'No matching users in Your Mix or contacts.';
    }, 250);
  }
  input.addEventListener('input', searchPeople);
  window.addEventListener('danzstak:posts-loaded', searchPeople);
})();
