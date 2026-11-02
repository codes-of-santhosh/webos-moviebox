// js/screens/favorites.js
const FavoritesScreen = {
  render(container) {
    const favs = Storage.getFavorites();

    container.innerHTML = `
      <div class="screen-content favorites-content" style="padding: 48px 64px;">
        <header class="page-header" style="padding: 0 0 32px 0; margin-bottom: 32px;">
          <div style="display: flex; align-items: baseline; gap: 20px;">
            <button class="btn btn-secondary focusable" tabindex="0" onclick="App.navigate('home')">
              <span class="btn-icon">←</span> Home
            </button>
            <h1 style="font-size: 36px; font-weight: 800; letter-spacing: -0.02em;">My List</h1>
          </div>
          <span class="tabular-nums" style="font-size: 20px; color: var(--ink-muted);">${favs.length} SAVED</span>
        </header>

        <div class="search-results-grid" style="padding: 0;">
          ${!favs.length ? '<div class="empty-state">Your list is currently empty. Add movies and series from detail pages.</div>' : ''}
          ${favs.map(item => `
            <div class="card focusable" tabindex="0" data-subject-id="${item.id}" onclick="App.openDetail('${item.id}', '${item.provider || 'moviebox'}')">
              <div class="card-poster-wrap">
                <img class="card-poster" src="${item.poster || ''}" loading="lazy" decoding="async" alt="" />
                <span class="card-badge">SAVED</span>
              </div>
              <div class="card-title">${item.title || ''}</div>
              <div class="card-meta tabular-nums">
                <span>${item.year ? item.year.slice(0, 4) : '2024'}</span>
                <span class="card-rating">★ 4.8</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.focusable'));
  }
};
