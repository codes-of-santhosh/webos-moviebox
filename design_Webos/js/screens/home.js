// js/screens/home.js
// Enhanced with McMaster-Carr In-Memory Caching & Figma TV Hero Layout

const HomeScreen = {
  _dataCache: null,

  render(container) {
    container.innerHTML = `
      <div class="screen-content home-content">
        <header class="home-header">
          <div class="logo-area">
            <span class="logo-mark">MB</span>
            <span class="logo-title">MovieBox</span>
          </div>
          <nav class="top-nav">
            <button class="nav-btn focusable active" tabindex="0" onclick="App.navigate('home')">Home</button>
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

    // 0ms McMaster-Carr cache hit: render immediately if previously loaded
    if (this._dataCache) {
      this.populateUI(this._dataCache);
    } else {
      this.loadData();
    }
  },

  async loadData() {
    try {
      const res = await API.getHome(1, '0');
      const data = res?.data?.data || {};
      this._dataCache = data;
      this.populateUI(data);
    } catch (err) {
      console.error('Home loadData error:', err);
      const sectionsContainer = document.getElementById('homeSections');
      if (sectionsContainer && !this._dataCache) {
        sectionsContainer.innerHTML = '<div class="empty-state">Unable to connect to streaming catalog. Please check network.</div>';
      }
    }
  },

  populateUI(data) {
    const items = data.items || [];
    const sectionsContainer = document.getElementById('homeSections');
    const heroBanner = document.getElementById('heroBanner');

    if (!items.length || !sectionsContainer) return;

    // Feature top billboard matching Figma reference
    const bannerItem = items.find(i => i.type === 'BANNER' && i.banner?.banners?.length);
    if (bannerItem && heroBanner) {
      const topBanner = bannerItem.banner.banners[0];
      heroBanner.innerHTML = `
        <div class="hero-backdrop" style="background-image: url('${topBanner.image?.url || ''}')"></div>
        <div class="hero-gradient"></div>
        <div class="hero-info">
          <div class="hero-trend-badge">
            <span class="badge-dot"></span>
            #1 in TV Shows Today
          </div>
          <h1 class="hero-title">${topBanner.content || 'Featured Release'}</h1>
          <div class="hero-meta-row tabular-nums">
            <span class="meta-tag meta-tag-rating">★ 4.8</span>
            <span class="meta-tag">2024</span>
            <span class="meta-tag">4K ULTRA HD</span>
            <span class="meta-tag">TV-MA</span>
          </div>
          <p class="hero-desc">Stream the latest blockbuster movies and trending TV series in pristine 4K definition with zero ad interruptions.</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-large focusable" tabindex="0" onclick="App.navigate('search')">
              <span class="btn-play-icon">▶</span> Search & Watch
            </button>
            <button class="btn btn-secondary btn-large focusable" tabindex="0" onclick="App.navigate('favorites')">
              <span class="btn-fav-icon">+</span> View My List
            </button>
          </div>
        </div>
      `;
    }

    // Strict 10-foot TV Optimization: 3 categories, 7 tiles per category (21 cards total)
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
          <div class="row-header">
            <h2 class="row-title">${item.title || 'Trending Releases'}</h2>
            <span class="row-count tabular-nums">7 TITLES</span>
          </div>
          <div class="row-carousel">
            ${visibleSubjects.map(s => `
              <div class="card focusable" tabindex="0" data-subject-id="${s.subjectId}" onclick="App.openDetail('${s.subjectId}', 'moviebox')">
                <div class="card-poster-wrap">
                  <img class="card-poster" src="${s.cover?.url || ''}" loading="lazy" decoding="async" alt="" />
                  <span class="card-badge">${s.subjectType === 2 ? 'SERIES' : 'MOVIE'}</span>
                </div>
                <div class="card-title">${s.title || ''}</div>
                <div class="card-meta tabular-nums">
                  <span>${s.releaseDate ? s.releaseDate.slice(0, 4) : '2024'}</span>
                  <span class="card-rating">★ 4.8</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    sectionsContainer.innerHTML = html;
    Navigation.setFocus(document.querySelector('.focusable'));
  }
};
