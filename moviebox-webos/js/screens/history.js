const HistoryScreen = {
  render(container) {
    const history = Storage.getHistory();

    container.innerHTML = `
      <div class="screen-content history-content" style="padding: 48px 64px;">
        <header class="page-header" style="padding: 0 0 32px 0; margin-bottom: 32px;">
          <div style="display: flex; align-items: baseline; gap: 20px;">
            <button class="btn btn-secondary focusable" tabindex="0" onclick="App.navigate('home')">← Back to home</button>
            <h1 style="font-size: 36px; font-weight: 800; letter-spacing: -0.02em;">Playback History</h1>
          </div>
          <span class="tabular-nums" style="font-size: 20px; color: var(--ink-muted);">${history.length} logged sessions</span>
        </header>

        <div class="history-list">
          ${!history.length ? '<div class="empty-state">No playback history recorded yet. Completed and in-progress titles will appear here.</div>' : ''}
          ${history.map(item => `
            <div class="history-item focusable" tabindex="0" onclick="App.openPlayer('${item.id}', ${item.season || 0}, ${item.episode || 0}, '${item.title}')">
              <div class="hist-left">
                <span style="font-size: 22px; color: var(--accent-action);">▶</span>
                <span class="hist-title">${item.title}</span>
              </div>
              <span class="hist-time tabular-nums">${new Date(item.updatedAt).toLocaleDateString()} ${new Date(item.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.focusable'));
  }
};
