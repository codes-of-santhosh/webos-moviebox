const Storage = {
  get(key, defaultVal = null) {
    try {
      const v = localStorage.getItem(`moviebox_${key}`);
      return v ? JSON.parse(v) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  },

  set(key, val) {
    try {
      localStorage.setItem(`moviebox_${key}`, JSON.stringify(val));
    } catch (e) {}
  },

  getFavorites() {
    return Storage.get('favorites', []);
  },

  toggleFavorite(item) {
    let favs = Storage.getFavorites();
    const idx = favs.findIndex(f => f.id === item.id);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.unshift(item);
    }
    Storage.set('favorites', favs);
    return idx === -1; // true if added
  },

  isFavorite(id) {
    const favs = Storage.getFavorites();
    return favs.some(f => f.id === id);
  },

  getHistory() {
    return Storage.get('history', []);
  },

  addHistory(entry) {
    let hist = Storage.getHistory();
    hist = hist.filter(h => !(h.id === entry.id && h.season === entry.season && h.episode === entry.episode));
    hist.unshift({
      ...entry,
      updatedAt: Date.now()
    });
    // Keep max 50 items
    if (hist.length > 50) hist.pop();
    Storage.set('history', hist);
  },

  getSettings() {
    return Storage.get('settings', {
      theme: 'tokyo-night',
      providerMoviebox: true,
      providerDramachi: true,
      providerStremio: true,
      defaultQuality: '1080',
      stremioAddons: [
        'https://v3-cinemeta.strem.io/manifest.json'
      ]
    });
  },

  saveSettings(newSettings) {
    Storage.set('settings', newSettings);
  }
};
