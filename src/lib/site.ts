/** Canonical origin. The apex jinshiyu.xyz 307s to www, so www is the one search engines should index. */
export const SITE_URL = "https://www.jinshiyu.xyz";

/**
 * Cloudflare Turnstile site key. Public by design (it ships in the page); the
 * matching secret lives in Supabase → Auth → Attack Protection, which rejects
 * sign-in / sign-up / password-reset calls that arrive without a token.
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAFVo4X_yPcGfGjhv";
