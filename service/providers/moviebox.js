const https = require('https');
const { URL } = require('url');
const { buildSignedHeaders } = require('../utils/crypto');
const auth = require('../auth/moviebox-auth');

function makeRequest(method, pathAndQuery, body = null, retry = 2) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await auth.getValidToken();
      const base = auth.getActiveHost();
      const fullUrl = base + pathAndQuery;
      const profile = auth.getProfile();
      const bodyStr = body ? JSON.stringify(body) : null;

      const headers = buildSignedHeaders({
        method,
        url: fullUrl,
        body: bodyStr,
        userAgent: profile.userAgent,
        clientInfo: profile.clientInfo,
        spoofedIp: profile.spoofedIp,
        authToken: token
      });

      const u = new URL(fullUrl);
      let finished = false;
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: method,
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          if (finished) return;
          finished = true;
          if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 407) {
            if (retry > 0) {
              auth.invalidateToken();
              auth.rotateHost();
              try {
                const refreshed = await makeRequest(method, pathAndQuery, body, retry - 1);
                return resolve(refreshed);
              } catch (e) {
                return reject(e);
              }
            }
          }

          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            resolve({ raw: data, statusCode: res.statusCode });
          }
        });
      });

      req.setTimeout(4000, () => {
        if (!finished) {
          finished = true;
          req.destroy(new Error(`Timeout connecting to ${u.hostname}`));
        }
      });

      req.on('error', async (err) => {
        if (finished) return;
        finished = true;
        auth.rotateHost();
        if (retry > 0) {
          try {
            const res = await makeRequest(method, pathAndQuery, body, retry - 1);
            return resolve(res);
          } catch (e) {
            return reject(e);
          }
        }
        reject(err);
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    } catch (err) {
      if (retry > 0) {
        auth.rotateHost();
        try {
          const res = await makeRequest(method, pathAndQuery, body, retry - 1);
          return resolve(res);
        } catch (e) {
          return reject(e);
        }
      }
      reject(err);
    }
  });
}

const MovieBoxProvider = {
  // Homepage / Trending tabs
  async getHomeTabs(page = 1, tabId = '0') {
    return makeRequest('GET', `/wefeed-mobile-bff/tab-operating?page=${page}&tabId=${tabId}&version=`);
  },

  // Search titles
  async search(keyword, page = 1, perPage = 20) {
    const body = {
      keyword: keyword,
      page: page,
      perPage: perPage,
      subjectType: 0
    };
    return makeRequest('POST', '/wefeed-mobile-bff/subject-api/search/v2', body);
  },

  // Title details
  async getDetails(subjectId) {
    return makeRequest('GET', `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`);
  },

  // Season info for TV Series
  async getSeasonInfo(subjectId) {
    return makeRequest('GET', `/wefeed-mobile-bff/subject-api/season-info?subjectId=${subjectId}`);
  },

  // Stream Play Info (DASH & MP4 manifests)
  async getPlayInfo(subjectId, season = 0, episode = 0) {
    let path = `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${subjectId}`;
    if (season > 0) {
      path += `&se=${season}&ep=${episode}`;
    }
    return makeRequest('GET', path);
  },

  // Resource list v2
  async getResourceV2(subjectId, season = 0, episode = 0) {
    const path = `/wefeed-mobile-bff/subject-api/resource/v2?subjectId=${subjectId}&page=1&perPage=20&all=0&startPosition=1&endPosition=1&pagerMode=2&resolution=0&se=${season}&epFrom=${episode}&epTo=${episode}&isVip=true`;
    return makeRequest('GET', path);
  },

  // Resource list v2 (relaxed query for failovers when strict season/episode returns 0)
  async getResourceV2Relaxed(subjectId) {
    const path = `/wefeed-mobile-bff/subject-api/resource/v2?subjectId=${subjectId}&page=1&perPage=20&all=1&pagerMode=2&isVip=true`;
    return makeRequest('GET', path);
  },

  // External Subtitles (SRT)
  async getCaptions(subjectId, resourceId) {
    return makeRequest('GET', `/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=${subjectId}&resourceId=${resourceId}`);
  },

  // Stream recovery failover
  async recoverStream(subjectId, resourceId, failUrl) {
    return makeRequest('GET', `/wefeed-mobile-bff/subject-api/resource-position/v2?subjectId=${subjectId}&resourceId=${resourceId}&failUrl=${encodeURIComponent(failUrl)}&failCode=404&resourceNum=0&isVip=true`);
  }
};

module.exports = MovieBoxProvider;
