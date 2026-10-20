// The three questions asked to ChatGPT.
//   US: the spec's templates ("best plumber in Austin, TX").
//   Other countries, English-speaking: the same questions with the city only (the location sets the country).
//   Other languages: the questions Gemini wrote in the site's language while reading the site.

import { DEFAULT_SETTINGS } from '../config.js';
import { renderPrompt } from './normalize.js';

const GOOD_QUESTION = (q) => typeof q === 'string' && q.trim().length >= 10 && q.trim().length <= 250 && !/https?:|www\./i.test(q);

/**
 * @param business { service, city, state, country } (country is an ISO code, default US)
 * @param questions optional: questions in the site's language from the site reader
 */
export function buildPrompts({ service, city, state, country = 'US' }, { questions = null, settings = DEFAULT_SETTINGS } = {}) {
  const n = settings.query_count;
  if (String(country).toUpperCase() === 'US') {
    return settings.prompt_templates.slice(0, n).map((t) => renderPrompt(t, { service, city, state }));
  }
  if (Array.isArray(questions) && questions.length >= n && questions.slice(0, n).every(GOOD_QUESTION)) {
    return questions.slice(0, n).map((q) => q.trim().replace(/\s+/g, ' '));
  }
  return settings.prompt_templates_intl.slice(0, n).map((t) => renderPrompt(t, { service, city, state: null }));
}
