// GET /api/ai-check/config — public IDs for the page (Turnstile, Meta Pixel, Google tags).
// They live in Vercel environment variables, so changing an ID needs no code change.

import { json } from '../_lib/http.js';
import { env, CONSENT_VERSION } from '../_lib/config.js';

// Countries where tracking needs the visitor's consent first: EU, the other EEA states, the UK and Switzerland.
const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH'
]);

/**
 * Does the cookie banner apply? PUBLIC_CONSENT_BANNER: "eu" (default: those countries, and anywhere the
 * country is unknown), "all" (everyone) or "off" (nobody).
 */
export function consentRequired(country, mode = env('PUBLIC_CONSENT_BANNER', 'eu')) {
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  const c = String(country || '').trim().toUpperCase();
  return !c || CONSENT_COUNTRIES.has(c);
}

export function GET(request) {
  return json({
    turnstile_site_key: env('PUBLIC_TURNSTILE_SITE_KEY', null),
    // Google Tag Manager container. When set, GTM runs the tags and the page only sends it events.
    gtm_id: env('PUBLIC_GTM_ID', 'GTM-N9FM3HSM'),
    meta_pixel_id: env('PUBLIC_META_PIXEL_ID', '1532183152066126'),
    google_ads_id: env('PUBLIC_GOOGLE_ADS_ID', null),
    google_ads_labels: {
      check_started: env('PUBLIC_GADS_LABEL_CHECK_STARTED', null),
      check_completed: env('PUBLIC_GADS_LABEL_CHECK_COMPLETED', null),
      audit_requested: env('PUBLIC_GADS_LABEL_AUDIT_REQUESTED', null)
    },
    ga4_id: env('PUBLIC_GA4_ID', null),
    // Scheduling page shown on the thank-you page (Calendly, Cal.com, HubSpot Meetings...), https only.
    // Default: SearchWin's Google Calendar appointment page; PUBLIC_BOOKING_URL overrides it.
    booking_url: env('PUBLIC_BOOKING_URL', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2j4n3mXIM0DGGBGsMuN2NjLLT8QZjBvrHi65i8tWuj0gGiKqUdVEPdok2laSXqHSepE5rsDlv7?gv=true'),
    consent_version: CONSENT_VERSION,
    // Vercel tells the function the visitor's country; the answer differs per visitor, so it is not shared-cached.
    consent_required: consentRequired(request?.headers?.get('x-vercel-ip-country'))
  }, 200, { 'cache-control': 'private, max-age=300' });
}
