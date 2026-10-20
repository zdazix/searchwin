// GET /api/ai-check/config — public IDs for the page (Turnstile, Meta Pixel, Google tags).
// They live in Vercel environment variables, so changing an ID needs no code change.

import { json } from '../_lib/http.js';
import { env, CONSENT_VERSION } from '../_lib/config.js';

export function GET() {
  return json({
    turnstile_site_key: env('PUBLIC_TURNSTILE_SITE_KEY', null),
    meta_pixel_id: env('PUBLIC_META_PIXEL_ID', null),
    google_ads_id: env('PUBLIC_GOOGLE_ADS_ID', null),
    google_ads_labels: {
      check_completed: env('PUBLIC_GADS_LABEL_CHECK_COMPLETED', null),
      audit_requested: env('PUBLIC_GADS_LABEL_AUDIT_REQUESTED', null)
    },
    ga4_id: env('PUBLIC_GA4_ID', null),
    // Scheduling page shown on the thank-you page (Calendly, Cal.com, HubSpot Meetings...), https only.
    // Default: SearchWin's Google Calendar appointment page; PUBLIC_BOOKING_URL overrides it.
    booking_url: env('PUBLIC_BOOKING_URL', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0nMNtPX0HDsTx3pVTMc8l9mppMHpmESzTgeJPALHeeQmlYbsm35-h1eiGLW6PqEohX5YjgMYP-?gv=true'),
    consent_version: CONSENT_VERSION
  }, 200, { 'cache-control': 'public, max-age=300' });
}
