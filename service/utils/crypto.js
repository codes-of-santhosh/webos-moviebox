const crypto = require('crypto');
const { URL } = require('url');

// 30-byte HMAC-MD5 signing secret from MovieBox-Tui source
const SECRET = Buffer.from(
  'efa891974eecd3148df63aa611602defd101259ba521022c57ae0566bd8e',
  'hex'
);

function md5Hex(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return crypto.createHash('md5').update(buf).digest('hex');
}

function sortedQueryString(fullUrl) {
  try {
    const u = new URL(fullUrl);
    const searchParams = u.searchParams;
    const map = new Map();
    for (const [k, v] of searchParams.entries()) {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(v);
    }
    const sortedKeys = Array.from(map.keys()).sort();
    const parts = [];
    for (const k of sortedKeys) {
      for (const val of map.get(k)) {
        parts.push(k + '=' + val);
      }
    }
    return parts.join('&');
  } catch (e) {
    return '';
  }
}

function buildCanonicalString(method, accept, contentType, fullUrl, body, ts) {
  let canonicalUrl = fullUrl;
  try {
    const u = new URL(fullUrl);
    const p = u.pathname;
    const q = sortedQueryString(fullUrl);
    canonicalUrl = q ? (p + '?' + q) : p;
  } catch (e) {}

  let bodyHash = '';
  let bodyLength = '';

  if (body !== null && body !== undefined && body !== '') {
    const bytes = Buffer.from(body, 'utf8');
    bodyLength = bytes.length.toString();
    const truncated = bytes.slice(0, 102400);
    bodyHash = md5Hex(truncated);
  }

  return [
    method.toUpperCase(),
    accept || '',
    contentType || '',
    bodyLength,
    ts.toString(),
    bodyHash,
    canonicalUrl
  ].join('\n');
}

function generateXTrSignature(method, accept, contentType, fullUrl, body, ts) {
  const canonical = buildCanonicalString(method, accept, contentType, fullUrl, body, ts);
  const hmac = crypto.createHmac('md5', SECRET).update(canonical, 'utf8').digest('base64');
  return ts + '|2|' + hmac;
}

function generateXClientToken(ts) {
  const s = ts.toString();
  const rev = s.split('').reverse().join('');
  const hash = md5Hex(Buffer.from(rev, 'utf8'));
  return s + ',' + hash;
}

function buildSignedHeaders({ method, url, body = null, accept = 'application/json', contentType = 'application/json', userAgent, clientInfo, spoofedIp, authToken = null }) {
  const ts = Date.now();
  const sig = generateXTrSignature(method, accept, contentType, url, body, ts);
  const clientToken = generateXClientToken(ts);

  const headers = {
    'User-Agent': userAgent,
    'Accept': accept,
    'Content-Type': contentType,
    'Connection': 'keep-alive',
    'x-client-token': clientToken,
    'x-tr-signature': sig,
    'x-client-info': clientInfo,
    'x-client-status': '0',
    'x-forwarded-for': spoofedIp
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
}

module.exports = {
  md5Hex,
  buildSignedHeaders
};
