// Client bridge talking to com.moviebox.webos.service via Luna Bus
const API = {
  call(method, parameters = {}) {
    return new Promise((resolve, reject) => {
      if (window.webOS && window.webOS.service) {
        console.log(`[MovieBox] Luna Call -> luna://com.moviebox.webos.service/${method}`, parameters);
        window.webOS.service.request('luna://com.moviebox.webos.service', {
          method: method,
          parameters: parameters,
          onSuccess: (res) => {
            console.log(`[MovieBox] Luna Success <- ${method}:`, res);
            if (res.returnValue === false) {
              reject(new Error(res.error || res.errorText || 'Luna call returned false'));
            } else {
              resolve(res);
            }
          },
          onFailure: (err) => {
            console.error(`[MovieBox] Luna Failure <- ${method}:`, err);
            reject(new Error(err.errorText || err.message || 'Luna bridge failure'));
          }
        });
      } else {
        console.warn('[MovieBox] webOS service bridge not present on window.webOS');
        reject(new Error('webOS service bridge not available on this platform'));
      }
    });
  },

  // MovieBox endpoints
  getHome: (page = 1, tabId = '0') => API.call('home', { page, tabId }),
  search: (keyword, page = 1) => API.call('search', { keyword, page }),
  getDetails: (subjectId) => API.call('details', { subjectId }),
  getSeasonInfo: (subjectId) => API.call('seasonInfo', { subjectId }),
  getPlayInfo: (subjectId, season = 0, episode = 0, title = '') => API.call('playInfo', { subjectId, season, episode, title }),
  getCaptions: (subjectId, resourceId, title = '', season = 0, episode = 0) => API.call('captions', { subjectId, resourceId, title, season, episode }),

  // Dramachi
  dramachiSearch: (keyword) => API.call('dramachiSearch', { keyword }),
  dramachiDetails: (id) => API.call('dramachiDetails', { id }),
  dramachiStream: (fid, disk) => API.call('dramachiStream', { fid, disk }),

  // Stremio
  stremioManifest: (manifestUrl) => API.call('stremioManifest', { manifestUrl }),
  stremioStreams: (baseUrl, type, id) => API.call('stremioStreams', { baseUrl, type, id }),

  // Service daemon keep-alive subscription
  _keepAliveReq: null,
  startKeepAlive() {
    if (this._keepAliveReq) return;
    if (window.webOS && window.webOS.service) {
      try {
        this._keepAliveReq = window.webOS.service.request('luna://com.moviebox.webos.service', {
          method: 'keepAlive',
          parameters: { subscribe: true },
          resubscribe: true,
          onSuccess: (res) => console.log('[MovieBox] Service keepAlive active'),
          onFailure: (err) => console.warn('[MovieBox] Service keepAlive notice:', err)
        });
      } catch (e) {
        console.warn('keepAlive registration error:', e);
      }
    }
  }
};
