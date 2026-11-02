const FavoritesScreen = {
  render(container) {
    const favs = Storage.getFavorites();

    container.innerHTML = `
      <div class="screen-content favorites-content" style="padding: 48px 64px;">
        <header class="page-header" style="padding: 0 0 32px 0; margin-bottom: 32px;">
          <div style="display: flex; align-items: baseline; gap: 20px;">
            <button class="btn btn-secondary focusable" tabindex="0" onclick="App.navigate('home')">← Back to home</button>
            <h1 style="font-size: 36px; font-weight: 800; letter-spacing: -0.02em;">My List</h1>
          </div>
          <span class="tabular-nums" style="font-size: 20px; color: var(--ink-muted);">${favs.length} saved</span>
        </header>

        <div class="cards-grid">
          ${!favs.length ? '<div class="empty-state">Your list is currently empty. Add movies and TV series to watch them later.</div>' : ''}
          ${favs.map(item => `
            <div class="card focusable" tabindex="0" onclick="App.openDetail('${item.id}', '${item.provider || 'moviebox'}')">
              <img class="card-poster" src="${item.poster || ''}" loading="lazy" decoding="async" alt="" />
              <div class="card-title">${item.title || ''}</div>
              <div class="card-meta tabular-nums">${item.year ? item.year.slice(0, 4) : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.focusable'));
  }
};
