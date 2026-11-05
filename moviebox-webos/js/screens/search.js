const SearchScreen = {
  render(container) {
    container.innerHTML = `
      <div class="screen-content search-content">
        <header class="search-header">
          <button class="btn btn-secondary focusable" tabindex="0" onclick="App.navigate('home')">← Back to home</button>
          <div class="search-input-wrapper">
            <input type="text" id="searchInput" class="search-input focusable" tabindex="0" placeholder="Search movies, TV shows, and anime..." />
          </div>
          <button class="btn btn-primary focusable" tabindex="0" id="searchSubmitBtn" onclick="SearchScreen.performSearch()">Search</button>
        </header>

        <div class="provider-filter">
          <span style="font-size: 20px; color: var(--ink-muted); margin-right: 8px;">Source:</span>
          <button class="filter-chip active focusable" tabindex="0" data-p="all" onclick="SearchScreen.setProvider('all', this)">All Sources</button>
          <button class="filter-chip focusable" tabindex="0" data-p="moviebox" onclick="SearchScreen.setProvider('moviebox', this)">MovieBox</button>
          <button class="filter-chip focusable" tabindex="0" data-p="dramachi" onclick="SearchScreen.setProvider('dramachi', this)">Dramachi</button>
        </div>

        <div class="search-results-grid" id="searchResults">
          <div class="empty-state">Enter a movie or series title above to start searching.</div>
        </div>
      </div>
    `;

    const input = document.getElementById('searchInput');
    input.addEventListener('keydown', (e) => {
      if (e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
        this.performSearch();
      }
    });

    // When virtual keyboard closes or input is blurred, focus on Search submit button
    input.addEventListener('blur', () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          const submitBtn = document.getElementById('searchSubmitBtn');
          if (submitBtn) Navigation.setFocus(submitBtn);
        }
      }, 50);
    });

    Navigation.setFocus(input);
  },

  activeProvider: 'all',

  setProvider(provider, el) {
    this.activeProvider = provider;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    this.performSearch();
  },

  async performSearch() {
    const input = document.getElementById('searchInput');
    const q = input?.value?.trim();
    if (!q) return;

    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="loading-indicator">Searching movies & series...</div>';

    let allResults = [];

    try {
      if (this.activeProvider === 'all' || this.activeProvider === 'moviebox') {
        const mbRes = await API.search(q, 1);
        const subjects = mbRes?.data?.data?.results?.[0]?.subjects || mbRes?.data?.data?.list || [];
        allResults = allResults.concat(subjects.map(s => ({
          id: s.subjectId,
          title: s.title,
          poster: s.cover?.url,
          year: s.releaseDate,
          provider: 'moviebox'
        })));
      }

      if (this.activeProvider === 'all' || this.activeProvider === 'dramachi') {
        try {
          const dcRes = await API.dramachiSearch(q);
          const list = dcRes?.results || [];
          allResults = allResults.concat(list);
        } catch (e) {}
      }

      if (!allResults.length) {
        resultsContainer.innerHTML = `<div class="empty-state">No movies or TV shows found matching "${q}".</div>`;
        return;
      }

      // Deduplicate results by normalized title
      const seenTitles = new Set();
      const uniqueResults = [];
      for (const item of allResults) {
        if (!item || !item.title) continue;
        const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          uniqueResults.push(item);
        }
      }

      // Limit results to 24 to keep TV DOM ultra lightweight
      const displayResults = uniqueResults.slice(0, 24);

      resultsContainer.innerHTML = displayResults.map(item => `
        <div class="card focusable" tabindex="0" onclick="App.openDetail('${item.id}', '${item.provider}')">
          <img class="card-poster" src="${item.poster || ''}" loading="lazy" decoding="async" alt="" />
          <div class="card-title">${item.title || ''}</div>
          <div class="card-meta tabular-nums">
            <span>${item.year ? item.year.slice(0, 4) : ''}</span>
            <span>• ${item.provider}</span>
          </div>
        </div>
      `).join('');

      Navigation.setFocus(resultsContainer.querySelector('.focusable'));
    } catch (err) {
      resultsContainer.innerHTML = `<div class="error-state">Search failed: ${err.message}</div>`;
    }
  }
};
