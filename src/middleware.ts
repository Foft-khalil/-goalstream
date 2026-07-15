import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers middleware for GoalStream.
 * Adds security headers to all responses and provides basic rate limiting info.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers applied to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Allow embedding in iframes (needed for z.ai preview panel and streaming players)
  // Remove X-Frame-Options and use CSP frame-ancestors instead for fine-grained control
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // Content Security Policy
  // Allows: scripts from self/CDNs, styles from self/unsafe-inline, images from anywhere,
  // media from anywhere (for HLS streams), iframes from allowed streaming domains
  // frame-ancestors: allow same-origin + allow embedding in any parent (for preview panels)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob: https: http:",
    "frame-src 'self' https: http:",
    "connect-src 'self' https: http: blob: data:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self' *",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // HSTS (only in production with HTTPS)
  if (request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (icon-*, manifest, sw.js)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest|sw.js).*)',
  ],
};
