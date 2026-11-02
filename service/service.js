const Service = require('webos-service');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const MovieBoxProvider = require('./providers/moviebox');
const DramachiProvider = require('./providers/dramachi');
const StremioProvider = require('./providers/stremio');
const { parseDashManifest } = require('./proxy/stream-proxy');

const service = new Service('com.moviebox.webos.service');

// Prevent webOS 5-second dynamic service idle teardown
try {
  if (service.activityManager) {
    service.activityManager.idleTimeout = 86400; // 24 hours
  }
} catch (_) {}

// ── Service KeepAlive (Allows client to hold active subscription & keep proxy alive) ──
service.register('keepAlive', (message) => {
  message.respond({ returnValue: true, status: 'alive' });
});

// ── Persistent Connection Agents (Prevents TLS Re-Handshake Stalls on webOS ARM) ──
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 30000
});

// ── Local HTTP Stream Proxy (Bypasses WebKit Forbidden Header Sandbox & Spoofs Android UA) ──
const PROXY_PORT = 8888;
const proxyServer = http.createServer((req, res) => {
  try {
    // Handle CORS & Private Network Access preflight immediately
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-private-network': 'true',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET, HEAD, OPTIONS'
      });
      return res.end();
    }

    const reqUrl = new URL(req.url, `http://127.0.0.1:${PROXY_PORT}`);
    if (reqUrl.pathname.startsWith('/video') || reqUrl.pathname.startsWith('/stream')) {
      const targetUrl = reqUrl.searchParams.get('url');
      const cookieHeader = reqUrl.searchParams.get('cookies') || '';
      const referer = reqUrl.searchParams.get('referer') || '';

      if (!targetUrl) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        return res.end('Missing stream URL');
      }

      const headers = {
        'User-Agent': 'com.community.oneroom/50020119 (Linux; U; Android 13; en_US; 2201117TY; Build/TQ2A.230405.003; Cronet/135.0.7012.3)',
        'Accept': '*/*',
        'Accept-Encoding': 'identity' // Strictly disable compression to prevent corrupting byte-range chunk streaming
      };

      const isMp4 = targetUrl.includes('.mp4') || targetUrl.includes('hakunaymatata.com') || targetUrl.includes('aoneroom.com');
      if (cookieHeader) headers['Cookie'] = cookieHeader;
      // Do NOT send Referer to MP4 CDN endpoints to avoid HTTP 429 throttling
      if (referer && !isMp4) headers['Referer'] = referer;
      if (req.headers['range']) headers['Range'] = req.headers['range'];

      const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
      const isHttps = targetUrl.startsWith('https');
      const client = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      let activeUpstreamReq = null;
      let activeUpstreamRes = null;
      let isClientClosed = false;

      const abortUpstream = () => {
        isClientClosed = true;
        if (activeUpstreamReq && !activeUpstreamReq.destroyed) {
          try { activeUpstreamReq.destroy(); } catch (_) {}
        }
        if (activeUpstreamRes && !activeUpstreamRes.destroyed) {
          try { activeUpstreamRes.destroy(); } catch (_) {}
        }
        activeUpstreamReq = null;
        activeUpstreamRes = null;
      };

      req.on('close', abortUpstream);
      res.on('close', abortUpstream);

      // Connect upstream
      const proxyReq = client.get(targetUrl, { headers: headers, agent: agent }, (proxyRes) => {
        activeUpstreamRes = proxyRes;
        // Disable initial connection timeout once headers arrive
        proxyReq.setTimeout(0);

        // 120-second idle timer: only kills truly dead connections, not TV hardware decoder buffer pauses
        let streamIdleTimer = null;
        const pingActivity = () => {
          clearTimeout(streamIdleTimer);
          streamIdleTimer = setTimeout(() => {
            console.warn('[StreamProxy] Upstream video stream idle for 120s, terminating connection');
            try { proxyRes.destroy(); } catch (_) {}
          }, 120000);
        };
        pingActivity();
        proxyRes.on('data', pingActivity);
        proxyRes.on('end', () => clearTimeout(streamIdleTimer));
        proxyRes.on('close', () => clearTimeout(streamIdleTimer));

        proxyRes.on('error', (err) => {
          clearTimeout(streamIdleTimer);
          if (!res.writableEnded) {
            try { res.destroy(); } catch (_) {}
          }
        });

        // Handle redirect if CDN switches edge servers
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          clearTimeout(streamIdleTimer);
          activeUpstreamRes = null;
          try { proxyRes.destroy(); } catch (_) {}

          let redirUrl;
          try {
            redirUrl = new URL(proxyRes.headers.location, targetUrl).href;
          } catch (_) {
            redirUrl = proxyRes.headers.location;
          }

          const redirHttps = redirUrl.startsWith('https');
          const redirClient = redirHttps ? https : http;
          const redirAgent = redirHttps ? httpsAgent : httpAgent;

          const redirReq = redirClient.get(redirUrl, { headers: headers, agent: redirAgent }, (redirRes) => {
            activeUpstreamRes = redirRes;
            const cleanHeaders = {};
            for (const [k, v] of Object.entries(redirRes.headers)) {
              const lk = k.toLowerCase();
              if (HOP_BY_HOP.includes(lk) || lk === 'content-disposition') continue;
              cleanHeaders[lk] = v;
            }
            cleanHeaders['connection'] = 'keep-alive';
            cleanHeaders['access-control-allow-origin'] = '*';
            cleanHeaders['access-control-allow-private-network'] = 'true';
            cleanHeaders['access-control-allow-headers'] = '*';
            cleanHeaders['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
            if (!cleanHeaders['accept-ranges']) cleanHeaders['accept-ranges'] = 'bytes';
            if (!cleanHeaders['content-type']) cleanHeaders['content-type'] = 'video/mp4';

            if (!res.headersSent && !res.writableEnded) {
              res.writeHead(redirRes.statusCode, cleanHeaders);
              redirRes.pipe(res);
            }
          });

          activeUpstreamReq = redirReq;
          redirReq.on('error', (err) => {
            abortUpstream();
            if (!res.headersSent && !res.writableEnded && !res.finished) {
              try {
                res.writeHead(502, { 'content-type': 'text/plain' });
                res.end(err.message);
              } catch (_) {}
            }
          });
          return;
        }

        // Clean & forward headers to TV WebKit video element
        const cleanHeaders = {};
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          const lk = k.toLowerCase();
          if (HOP_BY_HOP.includes(lk) || lk === 'content-disposition') continue;
          cleanHeaders[lk] = v;
        }
        cleanHeaders['connection'] = 'keep-alive';
        cleanHeaders['access-control-allow-origin'] = '*';
        cleanHeaders['access-control-allow-private-network'] = 'true';
        cleanHeaders['access-control-allow-headers'] = '*';
        cleanHeaders['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
        if (!cleanHeaders['accept-ranges']) cleanHeaders['accept-ranges'] = 'bytes';
        if (!cleanHeaders['content-type']) cleanHeaders['content-type'] = 'video/mp4';

        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(proxyRes.statusCode, cleanHeaders);
          proxyRes.pipe(res);
        }
      });

      activeUpstreamReq = proxyReq;

      // 18-second header acquisition timeout
      proxyReq.setTimeout(18000, () => {
        console.warn('[StreamProxy] Upstream connection timed out waiting for headers');
        try { proxyReq.destroy(new Error('Upstream header timeout')); } catch (_) {}
      });

      proxyReq.on('error', (err) => {
        if (isClientClosed) return; // Silent cleanup on seek abort
        abortUpstream();
        if (!res.headersSent && !res.writableEnded && !res.finished) {
          try {
            res.writeHead(502, { 'content-type': 'text/plain' });
            res.end(err.message);
          } catch (_) {}
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  } catch (e) {
    if (!res.headersSent && !res.writableEnded && !res.finished) {
      try {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(e.message);
      } catch (_) {}
    }
  }
});

proxyServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[MovieBox Service] Proxy port ${PROXY_PORT} already in use. Retaining existing socket.`);
  } else {
    console.error('[MovieBox Service] Proxy server error:', err);
  }
});

proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[MovieBox Service] Local Streaming Proxy listening on http://0.0.0.0:${PROXY_PORT}`);
});

// ── 1. MovieBox Home Feed ──
service.register('home', async (message) => {
  try {
    const page = message.payload.page || 1;
    const tabId = message.payload.tabId || '0';
    const data = await MovieBoxProvider.getHomeTabs(page, tabId);
    message.respond({ returnValue: true, data: data });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 2. MovieBox Search ──
service.register('search', async (message) => {
  try {
    const keyword = message.payload.keyword || '';
    const page = message.payload.page || 1;
    const data = await MovieBoxProvider.search(keyword, page);
    message.respond({ returnValue: true, data: data });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 3. MovieBox Details ──
service.register('details', async (message) => {
  try {
    const subjectId = message.payload.subjectId;
    const data = await MovieBoxProvider.getDetails(subjectId);
    message.respond({ returnValue: true, data: data });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 4. MovieBox Season Info (Series) ──
service.register('seasonInfo', async (message) => {
  try {
    const subjectId = message.payload.subjectId;
    const data = await MovieBoxProvider.getSeasonInfo(subjectId);
    message.respond({ returnValue: true, data: data });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── Helper: Detect Deprecation Notice Video ──
function isNoticeUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return lower.includes('1c7de0bd3393702d9191801f15f88f8d')
    || lower.includes('80da52722ee7de7a4303290af6783424')
    || lower.includes('macdn.aoneroom.com/other/')
    || lower.includes('notice.mp4');
}

function parseResolutionFromLink(link) {
  if (!link) return null;
  const m = link.match(/(\d{3,4})[pP]/);
  return m ? parseInt(m[1], 10) : null;
}

function extractDetectorStreams(detailsData, season = 0, episode = 0) {
  const data = detailsData?.data || detailsData || {};
  const detectors = data.resourceDetectors || [];
  const streams = [];
  const seenUrls = new Set();

  for (const detector of detectors) {
    const list = detector.resolutionList || [];
    if (list.length > 0) {
      for (const item of list) {
        const itemSe = Number(item.se !== undefined ? item.se : 0);
        const itemEp = Number(item.ep !== undefined ? item.ep : (item.episode !== undefined ? item.episode : 0));
        if (itemSe !== Number(season) || itemEp !== Number(episode)) continue;

        const url = item.resourceLink || item.downloadUrl;
        if (!url || isNoticeUrl(url)) continue;

        const cleanBase = url.split('?')[0];
        if (seenUrls.has(cleanBase)) continue;
        seenUrls.add(cleanBase);

        const res = item.resolution || parseResolutionFromLink(item.sourceUrl || item.resourceLink) || 720;
        streams.push({
          type: 'mp4',
          url: url,
          cookies: {},
          referer: null,
          quality: res ? `${res}P` : 'HD',
          id: item.resourceId || detector.resourceId || '',
          codec: item.codecName || detector.codecName || 'hevc',
          size: item.size || detector.firstSize || 0,
          duration: item.duration || detector.duration || 0,
          source: 'detector_resolution_list'
        });
      }
    } else if (detector.downloadUrl) {
      const url = detector.downloadUrl;
      if (!isNoticeUrl(url)) {
        const cleanBase = url.split('?')[0];
        if (!seenUrls.has(cleanBase)) {
          seenUrls.add(cleanBase);
          const res = parseResolutionFromLink(detector.resourceLink) || 720;
          streams.push({
            type: 'mp4',
            url: url,
            cookies: {},
            referer: null,
            quality: res ? `${res}P` : 'HD',
            id: detector.resourceId || '',
            codec: detector.codecName || 'hevc',
            size: detector.firstSize || detector.totalSize || 0,
            duration: detector.duration || 0,
            source: 'detector_single'
          });
        }
      }
    }
  }

  return streams;
}

// ── 5. MovieBox Stream Play Info with Multi-Stage Failover Recovery ──
service.register('playInfo', async (message) => {
  try {
    const { subjectId, season = 0, episode = 0, title = '' } = message.payload;
    let resolvedStreams = [];
    let mediaTitle = title;

    // Stage 0 (Highest Priority - Upstream fix): Subject details resourceDetectors
    try {
      const details = await MovieBoxProvider.getDetails(subjectId);
      if (details?.data) {
        mediaTitle = details.data.title || mediaTitle;
        const detStreams = extractDetectorStreams(details, season, episode);
        if (detStreams.length > 0) {
          console.log(`[MovieBox Service] Found ${detStreams.length} genuine streams from resourceDetectors`);
          resolvedStreams.push(...detStreams);
        }
      }
    } catch (e) {
      console.warn('[MovieBox Service] getDetails detector extraction error:', e.message);
    }

    // Stage 1: Standard play-info (DASH manifests & MP4s)
    if (!resolvedStreams.length) {
      try {
        const data = await MovieBoxProvider.getPlayInfo(subjectId, season, episode);
        const streams = data?.data?.streams || [];
        for (const s of streams) {
          if (s.url && isNoticeUrl(s.url)) continue;
          const parsed = parseDashManifest(s);
          if (parsed && !isNoticeUrl(parsed.url)) {
            resolvedStreams.push({
              ...parsed,
              id: s.id,
              codec: s.codecName || 'hevc',
              size: s.size,
              duration: s.duration
            });
          }
        }
      } catch (e) {
        console.warn('[MovieBox Service] getPlayInfo error:', e.message);
      }
    }

    // Stage 2: Resource list v2 (strict season & episode)
    if (!resolvedStreams.length) {
      try {
        let resV2 = await MovieBoxProvider.getResourceV2(subjectId, season, episode);
        let list = resV2?.data?.list || [];

        // Stage 3: Relaxed Resource list v2 (all=1 without restrictive ep filters)
        if (!list.length) {
          console.log(`[MovieBox Service] Strict getResourceV2 empty for se=${season}, ep=${episode}. Retrying relaxed all=1 query...`);
          resV2 = await MovieBoxProvider.getResourceV2Relaxed(subjectId);
          list = resV2?.data?.list || [];
        }

        // Match episode if series list returned
        if (season > 0 && list.length > 1) {
          const matched = list.filter(item => {
            const itemSe = Number(item.se);
            const itemEp = Number(item.ep !== undefined ? item.ep : item.episode);
            return (itemSe === Number(season) || itemSe === 0) && (itemEp === Number(episode) || itemEp === 0);
          });
          if (matched.length > 0) list = matched;
        }

        const recoveredItems = await Promise.all(list.map(async (item) => {
          if (!item.resourceLink) return null;

          if (isNoticeUrl(item.resourceLink)) {
            try {
              const pos = await MovieBoxProvider.recoverStream(subjectId, item.resourceId, item.resourceLink);
              const posList = pos?.data?.list || [];
              const valid = posList.find(p => p.resourceLink && !isNoticeUrl(p.resourceLink));
              if (valid) {
                return {
                  type: 'mp4',
                  url: valid.resourceLink,
                  cookies: {},
                  referer: null,
                  quality: (valid.resolution || item.resolution) ? `${valid.resolution || item.resolution}P` : 'HD',
                  id: valid.resourceId || item.resourceId,
                  codec: valid.codecName || item.codecName || 'hevc',
                  size: valid.size || item.size,
                  duration: valid.duration || item.duration
                };
              }
            } catch (e) {
              console.error('Single stream recovery failed:', e.message);
            }
            return null;
          } else {
            return {
              type: 'mp4',
              url: item.resourceLink,
              cookies: {},
              referer: null,
              quality: item.resolution ? `${item.resolution}P` : 'HD',
              id: item.resourceId,
              codec: item.codecName || 'hevc',
              size: item.size,
              duration: item.duration
            };
          }
        }));

        resolvedStreams = recoveredItems.filter(Boolean);
      } catch (e) {
        console.error('Resource failover recovery error:', e.message);
      }
    }

    // Stage 4: Multi-Provider Fallback to Dramachi (if MovieBox returned 0 playable streams)
    if (!resolvedStreams.length && mediaTitle) {
      try {
        console.log(`[MovieBox Service] Native MovieBox has 0 streams for "${mediaTitle}". Attempting Dramachi fallback...`);
        const dramachiResults = await DramachiProvider.search(mediaTitle);
        if (dramachiResults && dramachiResults.length > 0) {
          const topMatch = dramachiResults[0];
          console.log(`[MovieBox Service] Found Dramachi match: ${topMatch.title} (ID: ${topMatch.id})`);
          const epData = await DramachiProvider.getEpisodeList(topMatch.id);
          const epList = epData?.data || [];
          const targetEp = epList[episode > 0 ? (episode - 1) : 0] || epList[0];
          if (targetEp) {
            const stream = await DramachiProvider.getStream(targetEp.fid, targetEp.disk);
            if (stream && stream.url) {
              console.log(`[MovieBox Service] Successfully resolved Dramachi stream: ${stream.url.substring(0, 60)}...`);
              resolvedStreams.push({
                type: 'mp4',
                url: stream.url,
                cookies: {},
                referer: null,
                quality: 'HD',
                id: targetEp.fid || topMatch.id,
                codec: 'h264',
                size: 0,
                duration: 0,
                source: 'dramachi'
              });
            }
          }
        }
      } catch (e) {
        console.warn('[MovieBox Service] Dramachi fallback error:', e.message);
      }
    }

    // Sort streams highest resolution first (e.g. 1080P, 720P, 480P)
    resolvedStreams.sort((a, b) => {
      const resA = parseInt(a.quality) || 0;
      const resB = parseInt(b.quality) || 0;
      return resB - resA;
    });

    // Attach verified local proxy URLs so TV WebKit bypasses 428 and forbidden sandbox
    resolvedStreams = resolvedStreams.map(st => {
      const cookieStr = Object.entries(st.cookies || {}).map(([k, v]) => `${k}=${v}`).join('; ');
      return {
        ...st,
        proxyUrl: `http://127.0.0.1:${PROXY_PORT}/video.mp4?url=${encodeURIComponent(st.url)}&cookies=${encodeURIComponent(cookieStr)}&referer=${encodeURIComponent(st.referer || '')}`
      };
    });

    message.respond({
      returnValue: true,
      streams: resolvedStreams,
      title: mediaTitle || title || '',
      proxyPort: PROXY_PORT
    });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 6. Multi-Language Subtitles Aggregator (MovieBox Native + OpenSubtitles v3) ──
const LANG_MAP = {
  eng: 'English', en: 'English',
  spa: 'Spanish', es: 'Spanish',
  fre: 'French', fra: 'French', fr: 'French',
  ger: 'German', deu: 'German', de: 'German',
  ita: 'Italian', it: 'Italian',
  por: 'Portuguese', pob: 'Portuguese (Brazil)', pt: 'Portuguese',
  hin: 'Hindi', hi: 'Hindi',
  ara: 'Arabic', ar: 'Arabic',
  rus: 'Russian', ru: 'Russian',
  jpn: 'Japanese', ja: 'Japanese',
  kor: 'Korean', ko: 'Korean',
  zho: 'Chinese', chi: 'Chinese', zh: 'Chinese',
  tur: 'Turkish', tr: 'Turkish',
  ind: 'Indonesian', id: 'Indonesian',
  vie: 'Vietnamese', vi: 'Vietnamese',
  heb: 'Hebrew', he: 'Hebrew',
  pol: 'Polish', pl: 'Polish',
  dan: 'Danish', da: 'Danish',
  nld: 'Dutch', nl: 'Dutch',
  swe: 'Swedish', sv: 'Swedish',
  nor: 'Norwegian', no: 'Norwegian',
  fin: 'Finnish', fi: 'Finnish',
  ces: 'Czech', cs: 'Czech',
  ell: 'Greek', el: 'Greek',
  hun: 'Hungarian', hu: 'Hungarian',
  ron: 'Romanian', ro: 'Romanian',
  ukr: 'Ukrainian', uk: 'Ukrainian'
};

async function fetchExternalSubtitles(title, season = 0, episode = 0) {
  if (!title) return [];
  try {
    const cleanTitle = title.replace(/\[.*?\]|\(.*?\)/g, '').trim();
    const type = season > 0 ? 'series' : 'movie';
    const searchUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(cleanTitle)}.json`;

    const metaRes = await new Promise((resolve) => {
      const req = https.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (_) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });

    const imdbId = metaRes?.metas?.[0]?.id;
    if (!imdbId) return [];

    const subQuery = season > 0 ? `${imdbId}:${season}:${episode}` : imdbId;
    const subUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(subQuery)}.json`;

    const subRes = await new Promise((resolve) => {
      const req = https.get(subUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (_) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });

    const list = subRes?.subtitles || [];
    const byLang = new Map();

    for (const s of list) {
      const rawLang = (s.lang || 'eng').toLowerCase();
      const langName = LANG_MAP[rawLang] || rawLang.toUpperCase();
      if (!byLang.has(langName) && s.url) {
        byLang.set(langName, {
          id: s.id || rawLang,
          lan: rawLang,
          lanName: langName,
          url: s.url,
          source: 'opensubtitles'
        });
      }
    }

    return Array.from(byLang.values());
  } catch (err) {
    console.warn('[External Subtitle Fetch Error]:', err.message);
    return [];
  }
}

service.register('captions', async (message) => {
  try {
    const { subjectId, resourceId, title = '', season = 0, episode = 0 } = message.payload;
    const allCaptions = [];
    const seenLangs = new Set();

    // 1. MovieBox native caption
    if (subjectId) {
      try {
        const data = await MovieBoxProvider.getCaptions(subjectId, resourceId || 0);
        const ext = data?.data?.extCaptions || [];
        for (const c of ext) {
          const lCode = (c.lan || 'en').toLowerCase();
          const lName = c.lanName || LANG_MAP[lCode] || 'English';
          seenLangs.add(lName);
          allCaptions.push({
            id: `mb_${lCode}`,
            lan: lCode,
            lanName: lName,
            url: c.url,
            source: 'moviebox'
          });
        }
      } catch (e) {
        console.warn('Native caption fetch error:', e);
      }
    }

    // 2. OpenSubtitles Multi-Language tracks
    if (title) {
      const externalSubs = await fetchExternalSubtitles(title, season, episode);
      for (const sub of externalSubs) {
        if (!seenLangs.has(sub.lanName)) {
          seenLangs.add(sub.lanName);
          allCaptions.push(sub);
        }
      }
    }

    // Sort alphabetically by language name for easy TV D-pad navigation
    allCaptions.sort((a, b) => a.lanName.localeCompare(b.lanName));

    message.respond({ returnValue: true, captions: allCaptions });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 7. Dramachi Endpoints ──
service.register('dramachiSearch', async (message) => {
  try {
    const { keyword } = message.payload;
    const results = await DramachiProvider.search(keyword);
    message.respond({ returnValue: true, results: results });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

service.register('dramachiDetails', async (message) => {
  try {
    const { id } = message.payload;
    const data = await DramachiProvider.getDetails(id);
    message.respond({ returnValue: true, data: data });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

service.register('dramachiStream', async (message) => {
  try {
    const { fid, disk } = message.payload;
    const stream = await DramachiProvider.getStream(fid, disk);
    message.respond({ returnValue: true, stream: stream });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

// ── 8. Stremio Add-on Endpoints ──
service.register('stremioManifest', async (message) => {
  try {
    const { manifestUrl } = message.payload;
    const manifest = await StremioProvider.getManifest(manifestUrl);
    message.respond({ returnValue: true, manifest: manifest });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

service.register('stremioStreams', async (message) => {
  try {
    const { baseUrl, type, id } = message.payload;
    const streams = await StremioProvider.getStreams(baseUrl, type, id);
    message.respond({ returnValue: true, streams: streams });
  } catch (err) {
    message.respond({ returnValue: false, error: err.message });
  }
});

console.log('MovieBox WebOS Luna Service daemon initialized and listening.');
