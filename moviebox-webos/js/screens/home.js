const HomeScreen = {
  render(container) {
    container.innerHTML = `
      <div class="screen-content home-content">
        <header class="home-header">
          <div class="logo-area">
            <span class="logo-mark">MB</span>
            <span class="logo-title">MovieBox</span>
          </div>
          <nav class="top-nav">
            <button class="nav-btn focusable" tabindex="0" onclick="App.navigate('home')">Home</button>
            <button class="nav-btn focusable" tabindex="0" onclick="App.navigate('search')">Search</button>
            <button class="nav-btn focusable" tabindex="0" onclick="App.navigate('favorites')">My List</button>
            <button class="nav-btn focusable" tabindex="0" onclick="App.navigate('history')">History</button>
            <button class="nav-btn focusable" tabindex="0" onclick="App.navigate('settings')">Settings</button>
          </nav>
        </header>

        <section class="hero-banner" id="heroBanner">
          <div class="loading-indicator">Loading featured title...</div>
        </section>

        <div class="sections-container" id="homeSections">
          <div class="loading-indicator">Loading movies & series...</div>
        </div>
      </div>
    `;

    this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getHome(1, '0');
      const data = res?.data?.data || {};
      const items = data.items || [];

      const sectionsContainer = document.getElementById('homeSections');
      const heroBanner = document.getElementById('heroBanner');

      if (!items.length) {
        sectionsContainer.innerHTML = '<div class="empty-state">No catalog items available. Check network connection.</div>';
        return;
      }

      // Feature top banner item
      const bannerItem = items.find(i => i.type === 'BANNER' && i.banner?.banners?.length);
      if (bannerItem) {
        const topBanner = bannerItem.banner.banners[0];
        heroBanner.innerHTML = `
          <div class="hero-backdrop" style="background-image: url('${topBanner.image?.url || ''}')"></div>
          <div class="hero-gradient"></div>
          <div class="hero-info">
            <h1 class="hero-title">${topBanner.content || 'Featured Release'}</h1>
            <p class="hero-desc">Stream the latest blockbuster movies and trending TV series in high definition.</p>
            <div class="hero-actions">
              <button class="btn btn-primary focusable" tabindex="0" onclick="App.navigate('search')">
                Search Movies & TV Shows
              </button>
            </div>
          </div>
        `;
      }

      // Strict TV Optimization: Exactly 3 categories, 7 tiles per category (21 cards total)
      let html = '';
      let rowCount = 0;
      for (const item of items) {
        const subjects = item.subjects || [];
        if (!subjects.length) continue;

        rowCount++;
        if (rowCount > 3) break;

        const visibleSubjects = subjects.slice(0, 7);

        html += `
          <div class="row-section">
            <h2 class="row-title">${item.title || 'Trending Releases'}</h2>
            <div class="row-carousel">
              ${visibleSubjects.map(s => `
                <div class="card focusable" tabindex="0" onclick="App.openDetail('${s.subjectId}', 'moviebox')">
                  <img class="card-poster" src="${s.cover?.url || ''}" loading="lazy" decoding="async" alt="" />
                  <div class="card-title">${s.title || ''}</div>
                  <div class="card-meta tabular-nums">
                    <span>${s.releaseDate ? s.releaseDate.slice(0, 4) : ''}</span>
                    <span>${s.subjectType === 2 ? '• TV Series' : '• Movie'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      sectionsContainer.innerHTML = html;
      Navigation.setFocus(document.querySelector('.focusable'));
    } catch (err) {
      console.error(err);
      const sectionsContainer = document.getElementById('homeSections');
      if (sectionsContainer) {
        sectionsContainer.innerHTML = `<div class="error-state">Failed to load movies: ${err.message}</div>`;
      }
    }
  }
};
