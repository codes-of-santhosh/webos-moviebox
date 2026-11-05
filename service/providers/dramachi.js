const https = require('https');

const BASE_URL = 'https://api.nodeobjects.com';
const THUMB_BASE = 'https://static.nodeobjects.com/thumbnail/';

function getJson(path) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE_URL}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

const DramachiProvider = {
  async search(keyword) {
    if (!keyword || !keyword.trim()) return [];
    const term = keyword.trim();
    const data = await getJson(`/?interface=search&q=${encodeURIComponent(term)}`);
    const rawList = Array.isArray(data?.data) ? data.data : [];

    // Filter to ensure relevance so random catalog dumps are not shown
    const cleanTerm = term.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const termWords = cleanTerm.split(/\s+/).filter(w => w.length > 2);

    const filtered = rawList.filter(item => {
      if (!item || !item.title) return false;
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes(cleanTerm)) return true;
      if (termWords.length > 0 && termWords.some(w => titleLower.includes(w))) return true;
      return false;
    });

    return filtered.map(item => ({
      id: item.id,
      title: item.title,
      year: item.year,
      poster: item.thumb ? `${THUMB_BASE}${item.thumb}` : null,
      category: item.category,
      provider: 'dramachi'
    }));
  },

  async getDetails(id) {
    return await getJson(`/?interface=title_v2&id=${id}`);
  },

  async getEpisodeList(id, rip = 'hd Rip') {
    return await getJson(`/?interface=episode_list&id=${id}&rip=${encodeURIComponent(rip)}`);
  },

  async getStream(fid, disk) {
    const data = await getJson(`/?interface=file_stream&fid=${fid}&disk=${disk}`);
    if (data?.hostInfo?.host && data?.fileInfo?.[0]?.url) {
      return {
        url: `https://${data.hostInfo.host}/cdn/${data.fileInfo[0].url}`,
        direct: true
      };
    }
    return null;
  }
};

module.exports = DramachiProvider;
