function parseDashManifest(stream) {
  const cookie = stream.signCookie || '';
  let result = null;

  // Format 1: CloudFront-Policy=<b64json>
  const policyMatch = cookie.match(/CloudFront-Policy=([^;]+)/);
  if (policyMatch) {
    try {
      const decodedPolicy = JSON.parse(Buffer.from(policyMatch[1], 'base64').toString('utf8'));
      const resource = decodedPolicy?.Statement?.[0]?.Resource || '';
      if (resource.includes('/dash/')) {
        const streamBase = resource.replace('/*', '');
        result = {
          type: 'dash',
          url: streamBase.endsWith('/') ? `${streamBase}index.mpd` : `${streamBase}/index.mpd`,
          cookies: {
            'CloudFront-Policy': policyMatch[1],
            'CloudFront-Signature': (cookie.match(/CloudFront-Signature=([^;]+)/) || [])[1] || '',
            'CloudFront-Key-Pair-Id': (cookie.match(/CloudFront-Key-Pair-Id=([^;]+)/) || [])[1] || ''
          },
          referer: 'https://sportslive.wine',
          quality: stream.resolutions || stream.format || 'HD'
        };
      }
    } catch (e) {
      // Ignore JSON parse error and fallback
    }
  }

  // Format 2: Edge-Cache-Cookie=urlprefix=<b64>:sign=...:t=...
  if (!result) {
    const edgeMatch = cookie.match(/urlprefix=([^:]+)/);
    if (edgeMatch) {
      try {
        const prefix = Buffer.from(edgeMatch[1], 'base64').toString('utf8');
        if (prefix.includes('/dash/')) {
          result = {
            type: 'dash',
            url: prefix.endsWith('/') ? `${prefix}index.mpd` : `${prefix}/index.mpd`,
            cookies: { 'Edge-Cache-Cookie': cookie },
            referer: 'https://sportslive.wine',
            quality: stream.resolutions || stream.format || 'HD'
          };
        }
      } catch (e) {
        // Fallback
      }
    }
  }

  // Fallback: Direct MP4 (Filter out notices)
  if (!result && stream.url) {
    const isNotice = stream.url.includes('macdn.aoneroom.com/other/') || stream.url.includes('notice.mp4');
    if (!isNotice) {
      result = {
        type: 'mp4',
        url: stream.url,
        cookies: {},
        referer: null, // Critical: DO NOT send referer for MP4 to avoid 429
        quality: stream.resolutions || stream.format || 'Standard'
      };
    }
  }

  return result;
}

module.exports = {
  parseDashManifest
};
