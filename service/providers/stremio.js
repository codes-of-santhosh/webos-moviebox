const https = require('https');
const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (SmartTV; webOS) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const StremioProvider = {
  // Read manifest.json of any stremio add-on
  async getManifest(manifestUrl) {
    return await fetchJson(manifestUrl);
  },

  // Fetch catalog (e.g. movies or series)
  async getCatalog(baseUrl, type, id, query = null) {
    const cleanBase = baseUrl.replace('/manifest.json', '');
    let url = `${cleanBase}/catalog/${type}/${id}`;
    if (query) {
      url += `/search=${encodeURIComponent(query)}.json`;
    } else {
      url += '.json';
    }
    return await fetchJson(url);
  },

  // Fetch stream URLs
  async getStreams(baseUrl, type, id) {
    const cleanBase = baseUrl.replace('/manifest.json', '');
    const url = `${cleanBase}/stream/${type}/${encodeURIComponent(id)}.json`;
    const data = await fetchJson(url);
    return data?.streams || [];
  }
};

module.exports = StremioProvider;
