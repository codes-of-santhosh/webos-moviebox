const https = require('https');
const { buildSignedHeaders } = require('../utils/crypto');
const { generateDeviceProfile } = require('../utils/device-spoof');

let cachedToken = null;
let tokenExpiresAt = 0;
let currentProfile = generateDeviceProfile();

// Primary working host pool - aoneroom CDN hosts prioritized for global low-latency
const HOST_POOL = [
  'https://api4.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api6.aoneroom.com',
  'https://api3.aoneroom.com',
  'https://api.inmoviebox.com'
];

let hostIndex = 0;

function getActiveHost() {
  return HOST_POOL[hostIndex % HOST_POOL.length];
}

function rotateHost() {
  hostIndex = (hostIndex + 1) % HOST_POOL.length;
  return getActiveHost();
}

async function requestVisitorToken() {
  let lastErr = null;
  for (let attempt = 0; attempt < HOST_POOL.length; attempt++) {
    const base = getActiveHost();
    try {
      const token = await new Promise((resolve, reject) => {
        const path = '/wefeed-mobile-bff/user-api/visitor-login';
        const fullUrl = base + path;
        const bodyStr = '{}';

        const headers = buildSignedHeaders({
          method: 'POST',
          url: fullUrl,
          body: bodyStr,
          userAgent: currentProfile.userAgent,
          clientInfo: currentProfile.clientInfo,
          spoofedIp: currentProfile.spoofedIp
        });

        const u = new URL(fullUrl);
        let finished = false;
        const req = https.request({
          hostname: u.hostname,
          path: u.pathname,
          method: 'POST',
          headers: headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (finished) return;
            finished = true;
            try {
              const parsed = JSON.parse(data);
              const tok = parsed?.data?.token;
              if (tok) {
                resolve(tok);
              } else {
                reject(new Error(parsed?.message || 'Visitor login returned no token'));
              }
            } catch (e) {
              reject(e);
            }
          });
        });

        req.setTimeout(5000, () => {
          if (!finished) {
            finished = true;
            req.destroy(new Error(`Timeout connecting to ${base}`));
          }
        });

        req.on('error', (err) => {
          if (!finished) {
            finished = true;
            reject(err);
          }
        });

        req.write(bodyStr);
        req.end();
      });

      if (token) {
        cachedToken = token;
        tokenExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
        return cachedToken;
      }
    } catch (err) {
      lastErr = err;
      rotateHost();
    }
  }
  throw lastErr || new Error('All MovieBox hosts failed visitor login');
}

async function getValidToken() {
  if (cachedToken && Date.now() < (tokenExpiresAt - 60000)) {
    return cachedToken;
  }
  return await requestVisitorToken();
}

function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
  currentProfile = generateDeviceProfile();
}

module.exports = {
  getValidToken,
  invalidateToken,
  getActiveHost,
  rotateHost,
  getProfile: () => currentProfile
};
