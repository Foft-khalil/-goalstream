/**
 * Security utilities for GoalStream
 * - Domain allowlist for proxy endpoints (SSRF protection)
 * - Private IP detection (prevent internal network access)
 * - Rate limiting (in-memory, per-IP)
 */

// ─── SSRF Protection: Domain Allowlist ────────────────────────────────────────

// Only these domains are allowed for server-side proxying
const ALLOWED_PROXY_DOMAINS = [
  'streams.center',
  'streamcenter.pro',
  '000007.mov',
  'kora-api.space',
  'kora-api.com',
  'tvtvhd.com',
  'pltvhd.com',
  'fubohd.com',
  'cdnjalive.live',
  'viralapps.live',
];

// ─── SSRF Protection: Private IP Blocklist ────────────────────────────────────

const PRIVATE_IP_RANGES = [
  // IPv4 loopback
  /^127\./,
  // IPv4 private ranges (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  // IPv4 broadcast
  /^0\./,
  /^255\.255\.255\./,
  // IPv6 loopback
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  // IPv6 private
  /^fc/,
  /^fd/,
  /^fe80:/,
];

/**
 * Validates that a URL is safe to fetch server-side.
 * Returns an error message if unsafe, or null if safe.
 */
export function validateProxyUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch(_e) {
    return 'Invalid URL format';
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http/https protocols are allowed';
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check domain allowlist
  const isDomainAllowed = ALLOWED_PROXY_DOMAINS.some(domain => {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  });

  if (!isDomainAllowed) {
    return `Domain "${hostname}" is not allowed for proxying`;
  }

  // Check for private IP ranges (even for allowed domains, in case of DNS rebinding)
  const isPrivateIP = PRIVATE_IP_RANGES.some(range => range.test(hostname));
  if (isPrivateIP) {
    return 'Private/internal IP addresses are not allowed';
  }

  // Block common metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Cloud metadata endpoints are not allowed';
  }

  // Block localhost variants
  if (hostname === 'localhost' || hostname === 'local' || hostname === '127.0.0.1') {
    return 'Localhost addresses are not allowed';
  }

  return null; // URL is safe
}

// ─── Rate Limiting (in-memory, per-IP) ────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Simple in-memory rate limiter.
 * @param ip - Client IP address
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limit exceeded, false if OK
 */
export function isRateLimited(ip: string, maxRequests: number = 60, windowMs: number = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true; // Rate limited
  }

  return false;
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}
