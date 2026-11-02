const DetailScreen = {
  currentSubjectId: null,
  currentProvider: 'moviebox',
  currentDetails: null,

  async render(container, subjectId, provider = 'moviebox') {
    this.currentSubjectId = subjectId;
    this.currentProvider = provider;

    container.innerHTML = `
      <div class="screen-content detail-content">
        <button class="btn btn-secondary back-top focusable" tabindex="0" onclick="App.handleBack()">← Back</button>
        <div class="loading-indicator" id="detailLoading">Loading movie details...</div>
        <div class="detail-container" id="detailBody" style="display: none;"></div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.back-top'));

    try {
      if (provider === 'moviebox') {
        const res = await API.getDetails(subjectId);
        const details = res?.data?.data?.subject || res?.data?.data;
        this.currentDetails = details;
        this.renderMovieBoxDetails(details);
      } else if (provider === 'dramachi') {
        const res = await API.dramachiDetails(subjectId);
        this.renderDramachiDetails(res?.data);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
      const loadingEl = document.getElementById('detailLoading');
      if (loadingEl) {
        loadingEl.innerHTML = `<div class="error-state">Failed to load movie details: ${err.message}</div>`;
      }
    }
  },

  renderMovieBoxDetails(d) {
    const loadingEl = document.getElementById('detailLoading');
    if (!d || !d.title) {
      if (loadingEl) loadingEl.innerHTML = '<div class="error-state">Details unavailable for this movie.</div>';
      return;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    const body = document.getElementById('detailBody');
    if (!body) return;
    body.style.display = 'flex';

    const isSeries = d.subjectType === 2 || (d.seNum && d.seNum > 0);
    const isFav = Storage.isFavorite(d.subjectId);

    body.innerHTML = `
      <div class="detail-left">
        <img class="detail-poster" src="${d.cover?.url || ''}" loading="eager" alt="" />
      </div>
      <div class="detail-right">
        <h1 class="detail-title">${d.title || ''}</h1>
        <div class="detail-tags">
          ${d.releaseDate ? `<span class="meta-tag tabular-nums">${d.releaseDate.slice(0, 4)}</span>` : ''}
          ${d.duration ? `<span class="meta-tag tabular-nums">${d.duration}</span>` : ''}
          ${d.imdbRatingValue ? `<span class="meta-tag meta-tag-rating tabular-nums">★ ${d.imdbRatingValue}</span>` : ''}
          ${d.genre ? `<span class="meta-tag">${d.genre}</span>` : ''}
          <span class="meta-tag">${isSeries ? 'TV Series' : 'Movie'}</span>
        </div>
        <p class="detail-description">${d.description || 'No synopsis available.'}</p>
        
        <div class="detail-actions">
          <button class="btn btn-primary btn-large focusable" tabindex="0" id="playBtn" onclick="DetailScreen.startPlay()">
            ${isSeries ? 'Watch Series' : 'Watch Movie'}
          </button>
          <button class="btn btn-secondary btn-large focusable" tabindex="0" id="favBtn" onclick="DetailScreen.toggleFav()">
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

  seasonsList: [],

  async loadSeasons(subjectId) {
    try {
      const res = await API.getSeasonInfo(subjectId);
      const seasons = res?.data?.data?.seasons || [];
      this.seasonsList = seasons;
      const selector = document.getElementById('seasonSelector');
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
      // Cap initial display to 50 for TV DOM performance if vast series
      const count = Math.min(max, 100);
      episodes = Array.from({ length: count }, (_, i) => i + 1);
    }

    const seasonNum = s.se || 1;
    const cleanTitle = (this.currentDetails?.title || 'Episode').replace(/'/g, "\\'");

    grid.innerHTML = episodes.map(ep => `
      <div class="episode-card focusable" tabindex="0" onclick="App.openPlayer('${this.currentSubjectId}', ${seasonNum}, ${ep}, '${cleanTitle} S${seasonNum}E${ep}')">
        <div class="ep-num tabular-nums">Episode ${ep}</div>
        <div class="ep-info">
          <div class="ep-title">${cleanTitle} • Ep ${ep}</div>
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
    btn.innerHTML = added ? 'In My List' : 'Add to My List';
  }
};
