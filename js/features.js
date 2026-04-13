/**
 * features.js — Carousel, Shorts, Profile
 * Подключается ПОСЛЕ app.js. Не переопределяет существующие функции.
 */

// =============================================
// CAROUSEL
// =============================================
const carouselState = {
  index: 0,
  category: 'all',
  itemWidth: 196,
  channels: [],
};

function carousel_getChannels() {
  const all = getAllSelectableChannels();
  return carouselState.category === 'all'
    ? all
    : all.filter(ch => ch.category === carouselState.category);
}

function carousel_renderCats() {
  const wrap = document.getElementById('carousel-cats');
  if (!wrap) return;
  const all = getAllSelectableChannels();
  const cats = ['all', ...Array.from(new Set(all.map(c => c.category).filter(Boolean)))];
  wrap.innerHTML = cats.map(c => {
    const label = c === 'all' ? 'Все' : c;
    return `<button class="carousel-cat-btn${carouselState.category === c ? ' active' : ''}" data-cat="${c}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.carousel-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      carouselState.category = btn.dataset.cat;
      carouselState.index = 0;
      carousel_renderCats();
      carousel_renderTrack();
    });
  });
}

function carousel_renderTrack() {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  carouselState.channels = carousel_getChannels();
  const channels = carouselState.channels;

  if (!channels.length) {
    track.innerHTML = '<p style="color:var(--text3);padding:20px 0">Нет каналов</p>';
    return;
  }

  track.innerHTML = channels.map((ch, i) => {
    const favKey = ch.key;
    const isFav = Boolean(state.profile.favorites[favKey]);
    let thumbHtml;
    if (ch.type === 'stream' && ch.payload.thumbnail_url) {
      thumbHtml = `<img src="${ch.payload.thumbnail_url}" alt="${escapeAttr(ch.title)}" loading="lazy" onerror="this.style.display='none'">`;
    } else if (ch.type === 'iptv' && ch.payload.logo) {
      thumbHtml = `<img src="${ch.payload.logo}" alt="${escapeAttr(ch.title)}" loading="lazy" onerror="this.style.display='none'">`;
    } else {
      thumbHtml = getChannelEmoji(ch.title, ch.payload && ch.payload.channel_type || 'tv');
    }
    return `<div class="carousel-card" data-idx="${i}" role="button" tabindex="0" aria-label="Смотреть ${escapeAttr(ch.title)}">
      <div class="carousel-thumb">${thumbHtml}
        <span class="carousel-live-badge"><span class="carousel-live-dot"></span>LIVE</span>
      </div>
      <div class="carousel-info">
        <div class="carousel-name">${ch.title}</div>
        <div class="carousel-sub">${ch.category || ''}</div>
      </div>
      <button class="carousel-fav${isFav ? ' active' : ''}"
        data-key="${escapeAttr(favKey)}"
        data-title="${escapeAttr(ch.title)}"
        data-ctype="${ch.type}"
        aria-label="Избранное"
        type="button">
        ${isFav ? '★' : '☆'}
      </button>
    </div>`;
  }).join('');

  track.querySelectorAll('.carousel-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      const ch = carouselState.channels[idx];
      if (ch) openAnyChannel(ch);
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); });
  });

  track.querySelectorAll('.carousel-fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.key, { title: btn.dataset.title, type: btn.dataset.ctype });
      carousel_renderTrack();
      profile_updateCount();
    });
  });

  carousel_scrollTo(carouselState.index, false);
}

function carousel_getVisible() {
  const outer = document.querySelector('.carousel-track-outer');
  if (!outer) return 4;
  return Math.max(1, Math.floor(outer.offsetWidth / carouselState.itemWidth));
}

function carousel_scrollTo(idx, animate) {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  const count = carouselState.channels.length;
  const visible = carousel_getVisible();
  const max = Math.max(0, count - visible);
  const clamped = Math.min(Math.max(0, idx), max);
  carouselState.index = clamped;
  if (animate === false) {
    track.style.transition = 'none';
    track.style.transform = `translateX(-${clamped * carouselState.itemWidth}px)`;
    requestAnimationFrame(() => { track.style.transition = ''; });
  } else {
    track.style.transform = `translateX(-${clamped * carouselState.itemWidth}px)`;
  }
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  if (prev) prev.disabled = clamped === 0;
  if (next) next.disabled = clamped >= count - visible;
}

function carousel_refresh() {
  carouselState.channels = carousel_getChannels();
  carousel_renderCats();
  carousel_renderTrack();
}

function setupCarousel() {
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');

  if (prev) prev.addEventListener('click', () => {
    carousel_scrollTo(carouselState.index - carousel_getVisible());
  });
  if (next) next.addEventListener('click', () => {
    carousel_scrollTo(carouselState.index + carousel_getVisible());
  });

  // Swipe
  const track = document.getElementById('carousel-track');
  if (track) {
    let startX = 0;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        carousel_scrollTo(carouselState.index + (diff > 0 ? carousel_getVisible() : -carousel_getVisible()));
      }
    });
  }

  // View toggle
  const btnCarousel = document.getElementById('btn-carousel-view');
  const btnGrid = document.getElementById('btn-grid-view');
  if (btnCarousel && btnGrid) {
    btnCarousel.addEventListener('click', () => {
      btnCarousel.classList.add('active'); btnGrid.classList.remove('active');
      const cw = document.getElementById('carousel-wrap');
      const allSec = document.getElementById('all-channels');
      if (cw) cw.style.display = '';
      if (allSec) allSec.style.display = 'none';
    });
    btnGrid.addEventListener('click', () => {
      btnGrid.classList.add('active'); btnCarousel.classList.remove('active');
      const cw = document.getElementById('carousel-wrap');
      const allSec = document.getElementById('all-channels');
      if (cw) cw.style.display = 'none';
      if (allSec) allSec.style.display = '';
    });
  }

  window.addEventListener('resize', () => carousel_scrollTo(carouselState.index, false));
}

// =============================================
// SHORTS
// =============================================
let shortsPage = 0;
const SHORTS_PER_PAGE = 24;

function shorts_render(append) {
  const feed = document.getElementById('shorts-feed');
  const moreBtn = document.getElementById('shorts-load-more');
  if (!feed) return;

  const channels = state.iptvChannels;
  if (!channels.length) {
    if (!append) feed.innerHTML = '<p class="shorts-empty">Загружаем IPTV каналы...</p>';
    return;
  }

  const start = shortsPage * SHORTS_PER_PAGE;
  const slice = channels.slice(start, start + SHORTS_PER_PAGE);

  const html = slice.map(ch => {
    const name = ch.channel_name || ch.channel || 'IPTV';
    const logo = ch.logo || '';
    const country = ch.country || '';
    const favKey = `iptv:${slugify(name)}`;
    const isFav = Boolean(state.profile.favorites[favKey]);
    const bgContent = logo
      ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(name)}" loading="lazy" onerror="this.parentElement.innerHTML='🌐'">`
      : '🌐';
    // Encode for onclick safety
    const safeUrl = escapeAttr(ch.url || '');
    const safeName = escapeAttr(name);
    const safeLogo = escapeAttr(logo);
    return `<article class="shorts-card"
        aria-label="Смотреть ${safeName}"
        itemscope itemtype="https://schema.org/BroadcastChannel"
        data-name="${safeName}" data-url="${safeUrl}" data-logo="${safeLogo}">
      <meta itemprop="name" content="${safeName}">
      <div class="shorts-card-bg">${bgContent}</div>
      <div class="shorts-card-overlay">
        <div class="shorts-card-name">${name}</div>
        ${country ? `<div class="shorts-card-country">${country}</div>` : ''}
      </div>
      <span class="shorts-card-live"><span class="shorts-live-dot"></span>LIVE</span>
      <div class="shorts-card-play">▶</div>
      <button class="shorts-card-fav${isFav ? ' active' : ''}"
        type="button"
        data-key="${escapeAttr(favKey)}"
        data-title="${safeName}"
        aria-label="Избранное">
        ${isFav ? '★' : '☆'}
      </button>
    </article>`;
  }).join('');

  if (append) {
    feed.insertAdjacentHTML('beforeend', html);
  } else {
    feed.innerHTML = html;
  }

  // Bind click events
  const cards = append
    ? Array.from(feed.querySelectorAll('.shorts-card')).slice(-slice.length)
    : feed.querySelectorAll('.shorts-card');

  cards.forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.shorts-card-fav')) return;
      openIptvChannel(card.dataset.name, card.dataset.url, card.dataset.logo);
    });
  });

  feed.querySelectorAll('.shorts-card-fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.key, { title: btn.dataset.title, type: 'iptv' });
      btn.classList.toggle('active');
      btn.textContent = btn.classList.contains('active') ? '★' : '☆';
      profile_updateCount();
    });
  });

  shortsPage++;
  const loaded = shortsPage * SHORTS_PER_PAGE;
  if (moreBtn) {
    const done = loaded >= channels.length;
    moreBtn.disabled = done;
    moreBtn.textContent = done ? 'Все каналы загружены' : 'Загрузить ещё';
  }
}

function setupShorts() {
  const moreBtn = document.getElementById('shorts-load-more');
  if (moreBtn) moreBtn.addEventListener('click', () => shorts_render(true));

  const navShorts = document.getElementById('nav-shorts');
  if (navShorts) navShorts.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('shorts-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  const mobileShorts = document.getElementById('mobile-shorts-btn');
  if (mobileShorts) mobileShorts.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('shorts-section')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// =============================================
// PROFILE MODAL
// =============================================
let profileActiveTab = 'favorites';

function profile_updateCount() {
  const el = document.getElementById('profile-fav-count');
  if (!el) return;
  const count = Object.keys(state.profile.favorites || {}).length;
  el.textContent = count > 99 ? '99+' : count;
  el.style.display = count > 0 ? 'flex' : 'none';

  const sub = document.getElementById('profile-modal-sub');
  if (sub) {
    const s = count === 1 ? 'канал' : count < 5 ? 'канала' : 'каналов';
    sub.textContent = `${count} избранных ${s}`;
  }
}

function profile_open() {
  const overlay = document.getElementById('profile-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  profile_renderContent();
  profile_updateCount();
}

function profile_close() {
  const overlay = document.getElementById('profile-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function profile_renderContent() {
  const content = document.getElementById('profile-tab-content');
  if (!content) return;

  if (profileActiveTab === 'favorites') {
    const favKeys = Object.keys(state.profile.favorites || {});
    if (!favKeys.length) {
      content.innerHTML = `<div class="profile-empty">
        <div class="profile-empty-icon">⭐</div>
        <h3>Нет избранных каналов</h3>
        <p>Нажмите ☆ на карточке канала, чтобы добавить</p>
      </div>`;
      return;
    }
    const allCh = getAllSelectableChannels();
    const items = favKeys.map(k => {
      const ch = allCh.find(c => c.key === k);
      const meta = state.profile.favorites[k];
      return ch || { key: k, title: meta?.title || k, type: meta?.type || 'stream', payload: {} };
    });

    content.innerHTML = `<div class="profile-channel-list">` +
      items.map(ch => {
        let iconHtml = getChannelEmoji(ch.title, ch.payload && ch.payload.channel_type);
        if (ch.payload && ch.payload.thumbnail_url) {
          iconHtml = `<img src="${ch.payload.thumbnail_url}" alt="${escapeAttr(ch.title)}" onerror="this.style.display='none'">`;
        } else if (ch.payload && ch.payload.logo) {
          iconHtml = `<img src="${ch.payload.logo}" alt="${escapeAttr(ch.title)}" onerror="this.style.display='none'">`;
        }
        return `<div class="profile-channel-item" data-key="${escapeAttr(ch.key)}" role="button" tabindex="0">
          <div class="profile-channel-icon">${iconHtml}</div>
          <span class="profile-channel-name">${ch.title}</span>
          <span class="profile-channel-type">${ch.type === 'iptv' ? 'IPTV' : 'ТВ'}</span>
          <button class="profile-channel-remove" data-key="${escapeAttr(ch.key)}" type="button" aria-label="Удалить">✕</button>
        </div>`;
      }).join('') +
    `</div>`;

    content.querySelectorAll('.profile-channel-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.profile-channel-remove')) return;
        const k = item.dataset.key;
        const ch = allCh.find(c => c.key === k);
        if (ch) { profile_close(); openAnyChannel(ch); }
      });
    });
    content.querySelectorAll('.profile-channel-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        delete state.profile.favorites[btn.dataset.key];
        saveProfile();
        profile_updateCount();
        profile_renderContent();
      });
    });
    return;
  }

  if (profileActiveTab === 'history') {
    const last = state.profile.lastOpened;
    if (!last) {
      content.innerHTML = `<div class="profile-empty"><div class="profile-empty-icon">🕐</div><h3>История пуста</h3><p>Начните смотреть каналы!</p></div>`;
      return;
    }
    const allCh = getAllSelectableChannels();
    const ch = allCh.find(c => c.key === last.key);
    const title = ch ? ch.title : last.key;
    content.innerHTML = `<div class="profile-channel-list">
      <div class="profile-channel-item" id="profile-last-ch" role="button" tabindex="0">
        <div class="profile-channel-icon">${ch ? getChannelEmoji(title, ch.payload && ch.payload.channel_type) : '📺'}</div>
        <span class="profile-channel-name">${title}</span>
        <span class="profile-channel-type">Последний</span>
      </div>
    </div>`;
    document.getElementById('profile-last-ch')?.addEventListener('click', () => {
      if (ch) { profile_close(); openAnyChannel(ch); }
    });
    return;
  }

  if (profileActiveTab === 'settings') {
    const isDark = document.body.dataset.theme === 'dark';
    const favCount = Object.keys(state.profile.favorites || {}).length;
    content.innerHTML = `<div class="profile-settings">
      <div class="profile-setting-row">
        <div>
          <div class="profile-setting-label">Тёмная тема</div>
          <div class="profile-setting-desc">Переключить оформление</div>
        </div>
        <button class="profile-toggle${isDark ? ' on' : ''}" id="setting-dark-toggle" type="button"></button>
      </div>
      <div class="profile-setting-row">
        <div>
          <div class="profile-setting-label">Текущий домен</div>
          <div class="profile-setting-desc">${window.location.hostname} — SEO авто ✓</div>
        </div>
      </div>
      <div class="profile-setting-row">
        <div>
          <div class="profile-setting-label">Избранных каналов</div>
          <div class="profile-setting-desc">Сохранено в браузере</div>
        </div>
        <span style="font-size:0.9rem;color:var(--accent);font-weight:700">${favCount}</span>
      </div>
      <div class="profile-setting-row">
        <div>
          <div class="profile-setting-label">Очистить избранное</div>
          <div class="profile-setting-desc">Удалить все сохранённые каналы</div>
        </div>
        <button id="btn-clear-favs" type="button" class="profile-clear-btn">Очистить</button>
      </div>
    </div>`;

    document.getElementById('setting-dark-toggle')?.addEventListener('click', function() {
      const cur = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      state.profile.theme = next;
      saveProfile();
      this.classList.toggle('on', next === 'dark');
    });

    document.getElementById('btn-clear-favs')?.addEventListener('click', () => {
      if (!confirm('Удалить все избранные каналы?')) return;
      state.profile.favorites = {};
      saveProfile();
      profile_updateCount();
      profile_renderContent();
    });
  }
}

function setupProfile() {
  const btn = document.getElementById('profile-btn');
  const overlay = document.getElementById('profile-overlay');
  const closeBtn = document.getElementById('profile-close');
  const mobileFavBtn = document.getElementById('mobile-open-favorites');

  if (btn) btn.addEventListener('click', profile_open);
  if (closeBtn) closeBtn.addEventListener('click', profile_close);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) profile_close(); });
  if (mobileFavBtn) {
    // Replace old handler — clone removes old listeners
    const newBtn = mobileFavBtn.cloneNode(true);
    mobileFavBtn.parentNode.replaceChild(newBtn, mobileFavBtn);
    newBtn.addEventListener('click', profile_open);
  }

  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      profileActiveTab = tab.dataset.tab;
      profile_renderContent();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const ov = document.getElementById('profile-overlay');
      if (ov && ov.classList.contains('open')) profile_close();
    }
  });
}

// =============================================
// INIT — called from app.js DOMContentLoaded extension
// =============================================
function initFeatures() {
  setupCarousel();
  setupShorts();
  setupProfile();
  profile_updateCount();
}

// Called after channels load
function onChannelsLoaded() {
  carousel_refresh();
}

// Called after IPTV loads
function onIptvLoaded() {
  if (state.iptvChannels.length && shortsPage === 0) {
    shorts_render(false);
  }
}
