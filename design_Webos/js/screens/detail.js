// js/screens/detail.js
// Enhanced with McMaster-Carr in-memory caching & Figma Design tokens

const DetailScreen = {
  currentSubjectId: null,
  currentProvider: 'moviebox',
  currentDetails: null,
  seasonsList: [],

  // In-Memory Caches for Instant 0ms Load
  _detailsCache: new Map(),
  _seasonsCache: new Map(),

  // Intent Prefetching called on D-Pad Focus (140ms hover)
  prefetch(subjectId, provider = 'moviebox') {
    if (!subjectId || this._detailsCache.has(subjectId)) return;
    if (provider === 'moviebox') {
      API.getDetails(subjectId).then(res => {
        const details = res?.data?.data?.subject || res?.data?.data;
        if (details && details.title) {
          this._detailsCache.set(subjectId, details);
          const isSeries = details.subjectType === 2 || (details.seNum && details.seNum > 0);
          if (isSeries) {
            API.getSeasonInfo(subjectId).then(sRes => {
              const seasons = sRes?.data?.data?.seasons || [];
              if (seasons.length) {
                this._seasonsCache.set(subjectId, seasons);
              }
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    }
  },

  async render(container, subjectId, provider = 'moviebox') {
    this.currentSubjectId = subjectId;
    this.currentProvider = provider;

    // Check if we have an instant in-memory cached version
    const cachedDetails = this._detailsCache.get(subjectId);

    container.innerHTML = `
      <div class="screen-content detail-content">
        <div class="detail-header-bar">
          <button class="btn btn-secondary back-top focusable" tabindex="0" onclick="App.handleBack()">
            <span class="btn-icon">←</span> Back
          </button>
        </div>
        <div class="loading-indicator" id="detailLoading" ${cachedDetails ? 'style="display:none;"' : ''}>Loading title details...</div>
        <div class="detail-container" id="detailBody" ${cachedDetails ? 'style="display:flex;"' : 'style="display:none;"'}></div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.back-top'));

    // If cached, render immediately (0ms instant transition)
    if (cachedDetails && provider === 'moviebox') {
      this.currentDetails = cachedDetails;
      this.renderMovieBoxDetails(cachedDetails);
    }

    try {
      if (provider === 'moviebox') {
        const res = await API.getDetails(subjectId);
        const details = res?.data?.data?.subject || res?.data?.data;
        if (details && details.title) {
          this._detailsCache.set(subjectId, details);
          this.currentDetails = details;
          this.renderMovieBoxDetails(details);
        }
      } else if (provider === 'dramachi') {
        const res = await API.dramachiDetails(subjectId);
        this.renderDramachiDetails(res?.data);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
      const loadingEl = document.getElementById('detailLoading');
      if (loadingEl && !this.currentDetails) {
        loadingEl.innerHTML = `<div class="error-state">Failed to load details: ${err.message}</div>`;
      }
    }
  },

  renderMovieBoxDetails(d) {
    if (!d || !d.title) {
      const loadingEl = document.getElementById('detailLoading');
      if (loadingEl) loadingEl.innerHTML = '<div class="error-state">Details unavailable for this movie.</div>';
      return;
    }

    const loadingEl = document.getElementById('detailLoading');
    if (loadingEl) loadingEl.style.display = 'none';

    const body = document.getElementById('detailBody');
    if (!body) return;
    body.style.display = 'flex';

    const isSeries = d.subjectType === 2 || (d.seNum && d.seNum > 0);
    const isFav = Storage.isFavorite(d.subjectId);

    body.innerHTML = `
      <div class="detail-left">
        <div class="poster-frame">
          <img class="detail-poster" src="${d.cover?.url || ''}" loading="eager" decoding="async" alt="" />
        </div>
      </div>
      <div class="detail-right">
        <div class="detail-meta-top">
          <span class="detail-badge-type">${isSeries ? 'TV SERIES' : 'FEATURE FILM'}</span>
          ${d.imdbRatingValue ? `<span class="detail-badge-rating tabular-nums">★ ${d.imdbRatingValue}</span>` : ''}
          <span class="detail-badge-quality">4K ULTRA HD</span>
          <span class="detail-badge-quality">HDR10</span>
        </div>

        <h1 class="detail-title">${d.title || ''}</h1>

        <div class="detail-tags tabular-nums">
          ${d.releaseDate ? `<span class="meta-tag">${d.releaseDate.slice(0, 4)}</span>` : ''}
          ${d.duration ? `<span class="meta-tag">${d.duration}</span>` : ''}
          ${d.genre ? `<span class="meta-tag">${d.genre}</span>` : ''}
          <span class="meta-tag meta-tag-audio">5.1 SURROUND</span>
        </div>

        <p class="detail-description">${d.description || 'No synopsis available.'}</p>
        
        <div class="detail-actions">
          <button class="btn btn-primary btn-large focusable" tabindex="0" id="playBtn" onclick="DetailScreen.startPlay()">
            <span class="btn-play-icon">▶</span>
            ${isSeries ? 'Play S1 E1' : 'Watch Movie'}
          </button>
          <button class="btn btn-secondary btn-large focusable" tabindex="0" id="favBtn" onclick="DetailScreen.toggleFav()">
            <span class="btn-fav-icon">${isFav ? '✓' : '+'}</span>
            ${isFav ? 'In My List' : 'Add to My List'}
          </button>
        </div>

        ${isSeries ? `
          <div class="episodes-section" id="episodesSection">
            <h2 class="section-heading">Seasons & Episodes</h2>
            <div class="season-selector" id="seasonSelector">
              <span class="loading-indicator">Loading seasons...</span>
            </div>
            <div class="episodes-grid" id="episodesGrid"></div>
          </div>
        ` : ''}
      </div>
    `;

    if (isSeries) {
      this.loadSeasons(d.subjectId);
    }

    Navigation.setFocus(document.getElementById('playBtn'));
  },

  async loadSeasons(subjectId) {
    try {
      let seasons = this._seasonsCache.get(subjectId);
      if (!seasons) {
        const res = await API.getSeasonInfo(subjectId);
        seasons = res?.data?.data?.seasons || [];
        if (seasons.length) {
          this._seasonsCache.set(subjectId, seasons);
        }
      }
      this.seasonsList = seasons;

      const selector = document.getElementById('seasonSelector');
      if (!selector) return;

      if (!seasons.length) {
        selector.innerHTML = '<span class="empty-state">No episodes cataloged for this series.</span>';
        return;
      }

      selector.innerHTML = seasons.map((s, idx) => `
        <button class="season-tab focusable ${idx === 0 ? 'active' : ''}" tabindex="0" onclick="DetailScreen.selectSeason(${idx}, this)">
          ${s.se === 0 ? 'Specials' : 'Season ' + s.se}
        </button>
      `).join('');

      this.renderEpisodes(seasons[0]);
    } catch (e) {
      console.error('Seasons loading error:', e);
    }
  },

  selectSeason(idx, btn) {
    document.querySelectorAll('.season-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const s = this.seasonsList[idx];
    if (s) this.renderEpisodes(s);
  },

  renderEpisodes(s) {
    const grid = document.getElementById('episodesGrid');
    if (!grid || !s) return;

    let episodes = [];
    if (s.allEp && s.allEp.trim()) {
      episodes = s.allEp.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    } else {
      const max = s.maxEp || 1;
      const count = Math.min(max, 100);
      episodes = Array.from({ length: count }, (_, i) => i + 1);
    }

    const seasonNum = s.se || 1;
    const cleanTitle = (this.currentDetails?.title || 'Episode').replace(/'/g, "\\'");

    grid.innerHTML = episodes.map(ep => `
      <div class="episode-card focusable" tabindex="0" onclick="App.openPlayer('${this.currentSubjectId}', ${seasonNum}, ${ep}, '${cleanTitle} S${seasonNum}E${ep}')">
        <div class="ep-badge-wrap">
          <span class="ep-num tabular-nums">E${ep}</span>
          <span class="ep-duration tabular-nums">25m</span>
        </div>
        <div class="ep-info">
          <div class="ep-title">${cleanTitle} • S${seasonNum} E${ep}</div>
        </div>
      </div>
    `).join('');
  },

  startPlay() {
    if (this._isStartingPlay) return;
    this._isStartingPlay = true;
    setTimeout(() => { this._isStartingPlay = false; }, 2000);

    const title = this.currentDetails?.title || 'MovieBox';
    const isSeries = this.currentDetails?.subjectType === 2 || (this.currentDetails?.seNum && this.currentDetails.seNum > 0);
    if (isSeries && this.seasonsList && this.seasonsList.length > 0) {
      const s0 = this.seasonsList[0];
      const se = s0.se !== undefined ? s0.se : 1;
      let ep = 1;
      if (s0.allEp && s0.allEp.trim()) {
        const eps = s0.allEp.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
        if (eps.length) ep = eps[0];
      }
      App.openPlayer(this.currentSubjectId, se, ep, `${title} S${se}E${ep}`);
    } else {
      App.openPlayer(this.currentSubjectId, 0, 0, title);
    }
  },

  toggleFav() {
    if (!this.currentDetails) return;
    const added = Storage.toggleFavorite({
      id: this.currentDetails.subjectId,
      title: this.currentDetails.title,
      poster: this.currentDetails.cover?.url,
      year: this.currentDetails.releaseDate,
      provider: 'moviebox'
    });
    const btn = document.getElementById('favBtn');
    if (btn) {
      btn.innerHTML = `
        <span class="btn-fav-icon">${added ? '✓' : '+'}</span>
        ${added ? 'In My List' : 'Add to My List'}
      `;
    }
  }
};
