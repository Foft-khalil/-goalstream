import { NextRequest, NextResponse } from 'next/server';

// ─── Constants ────────────────────────────────────────────────────────────────
const FETCH_TIMEOUT = 12_000; // 12 seconds per fetch
const MAX_CHAIN_DEPTH = 4; // Prevent infinite iframe chains

const COMMON_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5,es;q=0.3',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Known m3u8 URL patterns
const M3U8_PATTERNS = [
  /\.m3u8[\?\/]/i,
  /\.m3u8$/i,
  /mainstreams\.pro\/hls\//i,
  /fubohd\.com/i,
  /\/hls\/.*\.m3u8/i,
  /stream\..*\.m3u8/i,
  /live\/.*\.m3u8/i,
];

// Known stream provider domains that use the decrypt chain
const DECRYPT_CHAIN_DOMAINS = [
  'streams.center',
  'streamcenter.pro',
  'kora-api.top',
  '000007.mov',
];

// ─── Helper: decode URL (handles base64 + URL-encoding) ──────────────────────
function decodeInputUrl(raw: string): string {
  let url = raw.trim();

  // Try base64 decode (common for embed URLs)
  try {
    const decoded = atob(url);
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch {
    // Not valid base64, continue
  }

  // Try URL-decoded base64
  try {
    const decoded = atob(decodeURIComponent(url));
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch {
    // Not valid, continue
  }

  // Try URL decode
  try {
    const decoded = decodeURIComponent(url);
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch {
    // Not valid, continue
  }

  return url;
}

// ─── Helper: resolve a potentially relative URL against a base ────────────────
function resolveUrl(target: string, baseUrl: string): string {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target;
  }
  if (target.startsWith('//')) {
    return `https:${target}`;
  }
  try {
    const base = new URL(baseUrl);
    if (target.startsWith('/')) {
      return `${base.origin}${target}`;
    }
    // Relative path
    const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return `${base.origin}${basePath}${target}`;
  } catch {
    return target;
  }
}

// ─── Helper: find m3u8 URL in text ──────────────────────────────────────────
function findM3u8InText(text: string): string | null {
  // Pattern 1: Full URLs containing .m3u8
  const m3u8UrlRegex = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
  const urlMatch = m3u8UrlRegex.exec(text);
  if (urlMatch) return urlMatch[0];

  // Pattern 2: Known CDN patterns (without requiring .m3u8 extension)
  const cdnPatterns = [
    /https?:\/\/[^\s"'<>\\]*mainstreams\.pro\/hls\/[^\s"'<>\\]*/gi,
    /https?:\/\/[^\s"'<>\\]*fubohd\.com[^\s"'<>\\]*/gi,
  ];
  for (const pattern of cdnPatterns) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }

  return null;
}

// ─── Helper: find m3u8 URL in JavaScript variable assignments ────────────────
function findM3u8InJS(text: string): string | null {
  // Look for patterns like: var source = "https://...m3u8..."
  // or: src: "https://...m3u8..."
  // or: url: "https://...m3u8..."
  const jsVarPatterns = [
    /(?:var|let|const)\s+\w+\s*=\s*["']([^"']*\.m3u8[^"']*)["']/gi,
    /(?:src|source|url|stream|file|path)\s*[:=]\s*["']([^"']*\.m3u8[^"']*)["']/gi,
  ];

  for (const pattern of jsVarPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) return match[1];
  }

  return null;
}

// ─── Helper: extract iframe src URLs from HTML ───────────────────────────────
function extractIframeSrcs(html: string, baseUrl: string): string[] {
  const srcs: string[] = [];
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    srcs.push(resolveUrl(match[1], baseUrl));
  }
  return srcs;
}

// ─── Helper: extract stream ID from a URL ────────────────────────────────────
function extractStreamIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const streamParam = parsed.searchParams.get('stream');
    if (streamParam) return streamParam;
  } catch {
    // Not a valid URL
  }

  // Pattern: ?stream=XXXX or &stream=XXXX
  const streamParamRegex = /[?&]stream=([^&"'\s]+)/i;
  const streamParamMatch = streamParamRegex.exec(url);
  if (streamParamMatch) return streamParamMatch[1];

  return null;
}

// ─── Helper: extract stream ID from HTML/JS ──────────────────────────────────
function extractStreamId(html: string): string | null {
  // Pattern: ?stream=XXXX or &stream=XXXX
  const streamParamRegex = /[?&]stream=([^&"'\s]+)/i;
  const streamParamMatch = streamParamRegex.exec(html);
  if (streamParamMatch) return streamParamMatch[1];

  // Pattern: stream: 'XXXX' or stream: "XXXX" in JavaScript
  const streamJsRegex = /stream\s*:\s*["']([^"']+)["']/gi;
  const streamJsMatch = streamJsRegex.exec(html);
  if (streamJsMatch) return streamJsMatch[1];

  // Pattern: var stream = 'XXXX' or let stream = "XXXX"
  const streamVarRegex = /(?:var|let|const)\s+stream\s*=\s*["']([^"']+)["']/gi;
  const streamVarMatch = streamVarRegex.exec(html);
  if (streamVarMatch) return streamVarMatch[1];

  return null;
}

// ─── Helper: find decrypt fetch pattern and extract parameters ───────────────
interface DecryptCall {
  url: string; // The decrypt endpoint URL
  body: string; // The POST body to send
  contentType: string; // Content-Type for the POST
}

function findDecryptCall(html: string, baseUrl: string): DecryptCall | null {
  // ─── Strategy 1: Standard fetch() with string URL ──────────────────────────
  // Matches: fetch('decrypt.php', { method: 'POST', body: 'stream=XXXX' })
  // Also matches: fetch("decrypt.php", {...}), fetch('./decrypt.php', {...}), etc.
  const fetchPatterns = [
    // fetch with .php endpoint
    /fetch\s*\(\s*["']([^"']*(?:decrypt|token|getlink|resolve|api|get_url|geturl|get_stream)[^"']*\.php[^"']*)["']\s*,\s*\{([^}]*)\}\s*\)/gi,
    // fetch with any endpoint containing 'decrypt'
    /fetch\s*\(\s*["']([^"']*decrypt[^"']*)["']\s*,\s*\{([^}]*)\}\s*\)/gi,
    // fetch with any endpoint containing 'token' or 'getlink'
    /fetch\s*\(\s*["']([^"']*(?:token|getlink|get_stream)[^"']*)["']\s*,\s*\{([^}]*)\}\s*\)/gi,
  ];

  for (const pattern of fetchPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const fetchUrl = resolveUrl(match[1], baseUrl);
      const optionsStr = match[2];

      const isPost = /method\s*:\s*["']?POST/i.test(optionsStr);

      let body = '';
      const bodyMatch = /body\s*:\s*["']([^"']+)["']/i.exec(optionsStr);
      if (bodyMatch) {
        body = bodyMatch[1];
      }

      let contentType = 'application/x-www-form-urlencoded';
      const ctMatch = /(?:content-type|Content-Type)\s*:\s*["']([^"']+)["']/i.exec(optionsStr);
      if (ctMatch) {
        contentType = ctMatch[1];
      }

      // If body references a variable (e.g., body: formData), try to resolve it
      if (!body) {
        // Look for FormData .append() patterns
        const appendRegex = /\.append\s*\(\s*["'](\w+)["']\s*,\s*([^)]+)\)/gi;
        const params: string[] = [];
        let appendMatch;
        while ((appendMatch = appendRegex.exec(html)) !== null) {
          const key = appendMatch[1];
          const value = appendMatch[2].trim();
          // If the value is a string literal
          const strMatch = /^["']([^"']+)["']$/.exec(value);
          if (strMatch) {
            params.push(`${key}=${encodeURIComponent(strMatch[1])}`);
          } else {
            // It's a variable reference — try to find its value
            const varValRegex = new RegExp(`(?:var|let|const)\\s+${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*["']([^"']+)["']`, 'i');
            const varValMatch = varValRegex.exec(html);
            if (varValMatch) {
              params.push(`${key}=${encodeURIComponent(varValMatch[1])}`);
            } else {
              // If we can't resolve the variable, use it as-is for the stream ID
              const streamId = extractStreamId(html) || extractStreamIdFromUrl(baseUrl);
              if (streamId && (key === 'stream' || key === 'id' || key === 'code')) {
                params.push(`${key}=${encodeURIComponent(streamId)}`);
              }
            }
          }
        }
        if (params.length > 0) {
          body = params.join('&');
        }
      }

      // If we still don't have a body but have a stream ID, construct one
      if (!body) {
        const streamId = extractStreamId(html) || extractStreamIdFromUrl(baseUrl);
        if (streamId) {
          body = `stream=${encodeURIComponent(streamId)}`;
        }
      }

      if (isPost || body) {
        return { url: fetchUrl, body, contentType };
      }
    }
  }

  // ─── Strategy 2: jQuery $.ajax / $.post patterns ───────────────────────────
  const ajaxPatterns = [
    /\$\.(?:post|ajax)\s*\(\s*["']([^"']*(?:decrypt|token|getlink)[^"']*)["']\s*,\s*\{([^}]*)\}\s*\)/gi,
  ];

  for (const pattern of ajaxPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const fetchUrl = resolveUrl(match[1], baseUrl);
      const optionsStr = match[2];

      const streamId = extractStreamId(html) || extractStreamIdFromUrl(baseUrl);
      let body = '';
      const dataMatch = /(?:data|body)\s*:\s*["']([^"']+)["']/i.exec(optionsStr);
      if (dataMatch) {
        body = dataMatch[1];
      } else if (streamId) {
        body = `stream=${encodeURIComponent(streamId)}`;
      }

      return { url: fetchUrl, body, contentType: 'application/x-www-form-urlencoded' };
    }
  }

  // ─── Strategy 3: XMLHttpRequest patterns ────────────────────────────────────
  const xhrPatterns = [
    /\.open\s*\(\s*["']POST["']\s*,\s*["']([^"']*(?:decrypt|token|getlink)[^"']*)["']/gi,
  ];

  for (const pattern of xhrPatterns) {
    const match = pattern.exec(html);
    if (match) {
      const fetchUrl = resolveUrl(match[1], baseUrl);
      const streamId = extractStreamId(html) || extractStreamIdFromUrl(baseUrl);
      const body = streamId ? `stream=${encodeURIComponent(streamId)}` : '';
      return { url: fetchUrl, body, contentType: 'application/x-www-form-urlencoded' };
    }
  }

  return null;
}

// ─── Helper: try a single POST to a decrypt endpoint and check the response ─
async function tryDecryptPost(
  decryptUrl: string,
  body: string,
  contentType: string,
  referer: string
): Promise<string | null> {
  try {
    const origin = (() => {
      try { return new URL(referer).origin; } catch { return ''; }
    })();

    const response = await fetch(decryptUrl, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': contentType,
        Referer: referer,
        ...(origin ? { Origin: origin } : {}),
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const text = await response.text();

    // Skip obvious error responses
    if (text.toLowerCase().includes('error') && text.length < 100) {
      console.log(`[Resolve Stream] Decrypt returned error: ${text}`);
      return null;
    }

    // Check if response contains m3u8 URL
    const m3u8 = findM3u8InText(text) || findM3u8InJS(text);
    if (m3u8) return m3u8;

    // Try as JSON
    try {
      const json = JSON.parse(text);
      const jsonUrl = json.url || json.link || json.src || json.source || json.stream ||
                      json.data?.url || json.data?.link || json.data?.src;
      if (jsonUrl && typeof jsonUrl === 'string' && M3U8_PATTERNS.some(p => p.test(jsonUrl))) {
        return jsonUrl;
      }
    } catch {
      // Check if raw text is a URL
      const trimmed = text.trim();
      if (trimmed.startsWith('http') && M3U8_PATTERNS.some(p => p.test(trimmed))) {
        return trimmed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Helper: try known decrypt endpoints for a domain ────────────────────────
// When the JS is too minified to parse, try common endpoints directly
async function tryKnownDecryptEndpoints(
  pageUrl: string,
  streamId: string
): Promise<string | null> {
  try {
    const base = new URL(pageUrl);
    const origin = base.origin;

    // Common decrypt endpoint paths used by streams.center and similar providers
    const decryptPaths = [
      '/embed/decrypt.php',
      '/embed/player/decrypt.php',
      '/decrypt.php',
      '/api/decrypt.php',
      '/embed/token.php',
      '/token.php',
    ];

    // Different body formats to try — providers use different parameter names and formats
    const bodyFormats = [
      // URL-encoded form with different param names
      { body: `stream=${encodeURIComponent(streamId)}`, ct: 'application/x-www-form-urlencoded' },
      { body: `id=${encodeURIComponent(streamId)}`, ct: 'application/x-www-form-urlencoded' },
      { body: `code=${encodeURIComponent(streamId)}`, ct: 'application/x-www-form-urlencoded' },
      { body: `channel=${encodeURIComponent(streamId)}`, ct: 'application/x-www-form-urlencoded' },
      { body: `data=${encodeURIComponent(streamId)}`, ct: 'application/x-www-form-urlencoded' },
      // JSON body with different field names
      { body: JSON.stringify({ stream: streamId }), ct: 'application/json' },
      { body: JSON.stringify({ id: streamId }), ct: 'application/json' },
      { body: JSON.stringify({ code: streamId }), ct: 'application/json' },
      { body: JSON.stringify({ channel: streamId }), ct: 'application/json' },
      // Raw stream ID as body
      { body: streamId, ct: 'text/plain' },
    ];

    for (const path of decryptPaths) {
      const decryptUrl = `${origin}${path}`;
      console.log(`[Resolve Stream] Trying known decrypt endpoint: ${decryptUrl}`);

      for (const fmt of bodyFormats) {
        const result = await tryDecryptPost(decryptUrl, fmt.body, fmt.ct, pageUrl);
        if (result) {
          console.log(`[Resolve Stream] Decrypt succeeded with body format: ${fmt.body.substring(0, 60)}`);
          return result;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Helper: search for decrypt-related code in minified JS ──────────────────
// Scans large JS blobs for any reference to decrypt/token endpoints
function findDecryptInMinifiedJS(jsContent: string, baseUrl: string): DecryptCall | null {
  // Look for any string containing 'decrypt' (minified JS may use variable names or concatenation)
  const decryptStringRegex = /"([^"]*decrypt[^"]*)"|'([^']*decrypt[^']*)'/gi;
  let match;
  while ((match = decryptStringRegex.exec(jsContent)) !== null) {
    const foundStr = match[1] || match[2];
    if (foundStr && (foundStr.endsWith('.php') || foundStr.includes('.php?') || foundStr.startsWith('/') || foundStr.startsWith('http'))) {
      const fetchUrl = resolveUrl(foundStr, baseUrl);
      const streamId = extractStreamId(jsContent) || extractStreamIdFromUrl(baseUrl);
      const body = streamId ? `stream=${encodeURIComponent(streamId)}` : '';
      console.log(`[Resolve Stream] Found decrypt string in minified JS: ${foundStr} -> ${fetchUrl}`);
      return { url: fetchUrl, body, contentType: 'application/x-www-form-urlencoded' };
    }
  }

  // Also look for URL patterns near the word 'decrypt'
  const nearDecryptRegex = /decrypt[^\n]{0,200}?(https?:\/\/[^\s"'<>]+|\/[\w\/]+\.php[^\s"'<>]*)/gi;
  while ((match = nearDecryptRegex.exec(jsContent)) !== null) {
    const foundUrl = match[1];
    if (foundUrl) {
      const fetchUrl = resolveUrl(foundUrl, baseUrl);
      const streamId = extractStreamId(jsContent) || extractStreamIdFromUrl(baseUrl);
      const body = streamId ? `stream=${encodeURIComponent(streamId)}` : '';
      console.log(`[Resolve Stream] Found URL near 'decrypt' in minified JS: ${foundUrl} -> ${fetchUrl}`);
      return { url: fetchUrl, body, contentType: 'application/x-www-form-urlencoded' };
    }
  }

  return null;
}

// ─── Helper: fetch HTML with proper headers ──────────────────────────────────
async function fetchHtml(url: string, referer?: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      ...COMMON_HEADERS,
      Referer: referer || url,
    };

    console.log(`[Resolve Stream] Fetching: ${url}`);
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[Resolve Stream] HTTP ${response.status} for ${url}`);
      return null;
    }

    const text = await response.text();
    console.log(`[Resolve Stream] Got ${text.length} bytes from ${url}`);
    return text;
  } catch (err) {
    console.warn(`[Resolve Stream] Fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Helper: POST to a decrypt endpoint ──────────────────────────────────────
async function postDecrypt(decryptUrl: string, body: string, contentType: string, referer: string): Promise<string | null> {
  try {
    console.log(`[Resolve Stream] POST to decrypt: ${decryptUrl} (body: ${body.substring(0, 100)})`);

    const response = await fetch(decryptUrl, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': contentType,
        Referer: referer,
        Origin: new URL(referer).origin,
      },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
    });

    if (!response.ok) {
      console.warn(`[Resolve Stream] Decrypt POST returned HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log(`[Resolve Stream] Decrypt response (${text.length} bytes): ${text.substring(0, 200)}`);
    return text;
  } catch (err) {
    console.warn(`[Resolve Stream] Decrypt POST failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Core: resolve the embed chain ───────────────────────────────────────────
interface ResolveResult {
  resolvedUrl: string;
  originalUrl: string;
  type: 'hls' | 'iframe';
  resolved: boolean;
}

async function resolveEmbedChain(embedUrl: string): Promise<ResolveResult> {
  const result: ResolveResult = {
    resolvedUrl: embedUrl,
    originalUrl: embedUrl,
    type: 'iframe',
    resolved: false,
  };

  // Check if the URL is already an m3u8 URL
  if (M3U8_PATTERNS.some(p => p.test(embedUrl))) {
    console.log(`[Resolve Stream] URL is already m3u8: ${embedUrl}`);
    return { resolvedUrl: embedUrl, originalUrl: embedUrl, type: 'hls', resolved: true };
  }

  // Step 1: Fetch the initial embed page
  const html = await fetchHtml(embedUrl);
  if (!html) {
    console.warn(`[Resolve Stream] Could not fetch embed page: ${embedUrl}`);
    return result;
  }

  // Step 2: Check for direct m3u8 URL in the initial page
  const directM3u8 = findM3u8InText(html) || findM3u8InJS(html);
  if (directM3u8) {
    console.log(`[Resolve Stream] Found direct m3u8 in embed page: ${directM3u8}`);
    return { resolvedUrl: directM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
  }

  // Step 3: Look for iframe src URLs and follow them
  const iframeSrcs = extractIframeSrcs(html, embedUrl);
  console.log(`[Resolve Stream] Found ${iframeSrcs.length} iframe(s): ${iframeSrcs.map(s => s.substring(0, 80)).join(', ')}`);

  // Track visited URLs to prevent loops
  const visited = new Set<string>([embedUrl]);

  // BFS through iframe chain up to MAX_CHAIN_DEPTH
  const queue: Array<{ url: string; depth: number; parentHtml: string }> = iframeSrcs
    .filter(src => !visited.has(src))
    .map(src => {
      visited.add(src);
      return { url: src, depth: 1, parentHtml: html };
    });

  while (queue.length > 0) {
    const { url: currentUrl, depth, parentHtml } = queue.shift()!;

    if (depth > MAX_CHAIN_DEPTH) {
      console.warn(`[Resolve Stream] Max chain depth reached at: ${currentUrl}`);
      continue;
    }

    // Fetch the iframe page
    const iframeHtml = await fetchHtml(currentUrl, embedUrl);
    if (!iframeHtml) continue;

    // Check for direct m3u8 in the iframe page
    const iframeM3u8 = findM3u8InText(iframeHtml) || findM3u8InJS(iframeHtml);
    if (iframeM3u8) {
      console.log(`[Resolve Stream] Found m3u8 in iframe page (depth ${depth}): ${iframeM3u8}`);
      return { resolvedUrl: iframeM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
    }

    // Look for decrypt.php call pattern in the JS
    let decryptCall = findDecryptCall(iframeHtml, currentUrl);

    // If not found with standard patterns, try scanning minified JS
    if (!decryptCall) {
      decryptCall = findDecryptInMinifiedJS(iframeHtml, currentUrl);
    }

    if (decryptCall) {
      console.log(`[Resolve Stream] Found decrypt call at depth ${depth}: ${decryptCall.url}`);

      const decryptResponse = await postDecrypt(
        decryptCall.url,
        decryptCall.body,
        decryptCall.contentType,
        currentUrl
      );

      if (decryptResponse) {
        const decryptM3u8 = findM3u8InText(decryptResponse) || findM3u8InJS(decryptResponse);
        if (decryptM3u8) {
          console.log(`[Resolve Stream] Got m3u8 from decrypt: ${decryptM3u8}`);
          return { resolvedUrl: decryptM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
        }

        // Try parsing as JSON
        try {
          const json = JSON.parse(decryptResponse);
          const jsonUrl = json.url || json.link || json.src || json.source || json.stream ||
                          json.data?.url || json.data?.link || json.data?.src;
          if (jsonUrl && typeof jsonUrl === 'string') {
            if (M3U8_PATTERNS.some(p => p.test(jsonUrl))) {
              console.log(`[Resolve Stream] Got m3u8 from decrypt JSON: ${jsonUrl}`);
              return { resolvedUrl: jsonUrl, originalUrl: embedUrl, type: 'hls', resolved: true };
            }
            // If it's another URL, follow it
            if (jsonUrl.startsWith('http')) {
              console.log(`[Resolve Stream] Decrypt returned another URL: ${jsonUrl}`);
              if (!visited.has(jsonUrl)) {
                visited.add(jsonUrl);
                queue.push({ url: jsonUrl, depth: depth + 1, parentHtml: iframeHtml });
              }
            }
          }
        } catch {
          // Not JSON, check if the raw text is a URL
          const trimmed = decryptResponse.trim();
          if (trimmed.startsWith('http') && M3U8_PATTERNS.some(p => p.test(trimmed))) {
            console.log(`[Resolve Stream] Decrypt returned raw m3u8: ${trimmed}`);
            return { resolvedUrl: trimmed, originalUrl: embedUrl, type: 'hls', resolved: true };
          }
        }
      }
    }

    // ── Strategy: If on a known decrypt-chain domain, try known endpoints directly ──
    // The JS may be too minified to parse, so we try brute-force common paths
    const isDecryptChainDomain = DECRYPT_CHAIN_DOMAINS.some(d => currentUrl.includes(d));
    if (isDecryptChainDomain) {
      const streamId = extractStreamId(iframeHtml) || extractStreamIdFromUrl(currentUrl);
      if (streamId) {
        console.log(`[Resolve Stream] On decrypt-chain domain, trying known endpoints with stream ID: ${streamId}`);
        const knownM3u8 = await tryKnownDecryptEndpoints(currentUrl, streamId);
        if (knownM3u8) {
          console.log(`[Resolve Stream] Got m3u8 from known endpoint: ${knownM3u8}`);
          return { resolvedUrl: knownM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
        }
      }
    }

    // Look for more iframes within this iframe page
    const nestedIframes = extractIframeSrcs(iframeHtml, currentUrl);
    for (const nestedSrc of nestedIframes) {
      if (!visited.has(nestedSrc)) {
        visited.add(nestedSrc);
        queue.push({ url: nestedSrc, depth: depth + 1, parentHtml: iframeHtml });
      }
    }
  }

  // Step 4: Handle special cases — tvtvhd.com / tarjetaroja chain
  // These sites embed the m3u8 URL directly in their page source
  if (embedUrl.includes('tvtvhd.com') || embedUrl.includes('tarjetaroja') || embedUrl.includes('rojadirecta')) {
    console.log(`[Resolve Stream] Trying tarjetaroja-style extraction for: ${embedUrl}`);
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];
      const scriptM3u8 = findM3u8InJS(scriptContent) || findM3u8InText(scriptContent);
      if (scriptM3u8) {
        console.log(`[Resolve Stream] Found m3u8 in script tag: ${scriptM3u8}`);
        return { resolvedUrl: scriptM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
      }
    }

    // Also try looking for Clappr or other player configurations
    const playerConfigRegex = /(?:new\s+Clappr\.Player|Hls\.js|videojs|jwplayer)\s*\(([\s\S]*?)\)\s*;/gi;
    let playerMatch;
    while ((playerMatch = playerConfigRegex.exec(html)) !== null) {
      const configStr = playerMatch[1];
      const configM3u8 = findM3u8InText(configStr) || findM3u8InJS(configStr);
      if (configM3u8) {
        console.log(`[Resolve Stream] Found m3u8 in player config: ${configM3u8}`);
        return { resolvedUrl: configM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
      }
    }
  }

  // Step 5: Last resort — scan ALL script tags for m3u8 patterns
  const allScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = allScriptRegex.exec(html)) !== null) {
    const scriptContent = scriptMatch[1];
    const jsM3u8 = findM3u8InJS(scriptContent) || findM3u8InText(scriptContent);
    if (jsM3u8) {
      console.log(`[Resolve Stream] Found m3u8 in script tag (last resort): ${jsM3u8}`);
      return { resolvedUrl: jsM3u8, originalUrl: embedUrl, type: 'hls', resolved: true };
    }
  }

  // Step 6: If we found iframe URLs but no m3u8, return the deepest iframe we found
  if (iframeSrcs.length > 0) {
    // Return the first iframe URL that looks like a player page
    const playerIframe = iframeSrcs.find(
      src => src.includes('hls.php') || src.includes('player') || src.includes('embed') || src.includes('stream')
    );
    if (playerIframe) {
      console.log(`[Resolve Stream] Returning iframe URL (fallback): ${playerIframe}`);
      return { resolvedUrl: playerIframe, originalUrl: embedUrl, type: 'iframe', resolved: false };
    }
  }

  console.warn(`[Resolve Stream] Could not resolve m3u8 for: ${embedUrl}`);
  return result;
}

// ─── POST handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url } = body as { url?: string };

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter in request body' },
        { status: 400 }
      );
    }

    // Decode the URL (handles base64)
    url = decodeInputUrl(url);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid URL format — must start with http:// or https://' },
        { status: 400 }
      );
    }

    console.log(`[Resolve Stream] POST request — resolving: ${url}`);

    const result = await resolveEmbedChain(url);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Resolve Stream] POST error:', err);
    return NextResponse.json(
      {
        error: 'Failed to resolve stream',
        resolvedUrl: '',
        originalUrl: '',
        type: 'iframe' as const,
        resolved: false,
      },
      { status: 500 }
    );
  }
}

// ─── GET handler (convenience: ?url=BASE64_ENCODED_URL) ─────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');

    if (!rawUrl) {
      return NextResponse.json(
        { error: 'Missing url query parameter' },
        { status: 400 }
      );
    }

    const url = decodeInputUrl(rawUrl);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid URL format — must start with http:// or https://' },
        { status: 400 }
      );
    }

    console.log(`[Resolve Stream] GET request — resolving: ${url}`);

    const result = await resolveEmbedChain(url);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Resolve Stream] GET error:', err);
    return NextResponse.json(
      {
        error: 'Failed to resolve stream',
        resolvedUrl: '',
        originalUrl: '',
        type: 'iframe' as const,
        resolved: false,
      },
      { status: 500 }
    );
  }
}

// ─── OPTIONS handler (CORS preflight) ───────────────────────────────────────
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
