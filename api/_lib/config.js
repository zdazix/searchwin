// Defaults for the free AI check. Everything in DEFAULT_SETTINGS can be
// overridden from the admin (table app_settings, key "ai_check") without a deploy.

export const DEFAULT_SETTINGS = {
  // {service}, {city}, {state} are filled from the parsed site; state is a 2-letter code.
  prompt_templates: [
    'best {service} in {city}, {state}',
    'who should I call for {service} near {city} {state}? I need someone reliable',
    'top rated {service} in {city} {state} with good reviews'
  ],
  // How many of the templates to run (fallback plan in the spec: 3 → 2).
  query_count: 3,
  // Directories and marketplaces never count as a business in the answer.
  directory_domains: [
    'yelp.com', 'angi.com', 'angieslist.com', 'homeadvisor.com', 'thumbtack.com', 'bbb.org',
    'google.com', 'maps.google.com', 'nextdoor.com', 'facebook.com', 'yellowpages.com', 'expertise.com',
    'bestpickreports.com', 'consumeraffairs.com', 'birdeye.com', 'trustanalytica.org', 'houzz.com',
    'porch.com', 'mapquest.com', 'apple.com', 'avvo.com', 'justia.com', 'findlaw.com', 'healthgrades.com',
    'zocdoc.com', 'vitals.com', 'tripadvisor.com', 'bestinhood.com', 'threebestrated.com', 'reddit.com',
    'linkedin.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com', 'wikipedia.org', 'bing.com'
  ],
  directory_names: [
    'yelp', 'angi', 'angies list', 'homeadvisor', 'home advisor', 'thumbtack', 'bbb', 'better business bureau',
    'google', 'google maps', 'google business profile', 'nextdoor', 'facebook', 'yellow pages', 'expertise',
    'best pick reports', 'consumeraffairs', 'consumer affairs', 'birdeye', 'trustanalytica', 'houzz', 'porch',
    'avvo', 'justia', 'findlaw', 'healthgrades', 'zocdoc', 'tripadvisor', 'reddit', 'linkedin', 'instagram'
  ],
  // Words that say what a business does or what it is, not who it is. They never
  // count as the "rarest word" of a name, so "Austin Plumbing" can't match "Austin Plumbing Pros".
  generic_name_words: [
    'a', 'an', 'and', 'of', 'the', 'in', 'at', 'by', 'for', 'on', 'to', 'n', 'amp',
    'llc', 'inc', 'co', 'corp', 'company', 'companies', 'ltd', 'pllc', 'pc', 'pa', 'llp', 'group', 'enterprise',
    'service', 'services', 'solution', 'solutions', 'pro', 'pros', 'professional', 'professionals', 'expert', 'experts',
    'specialist', 'specialists', 'team', 'partner', 'partners', 'associate', 'associates', 'center', 'centre',
    'local', 'family', 'quality', 'best', 'top', 'premier', 'elite', 'affordable', 'reliable', 'trusted', 'precision',
    'express', 'emergency', '24', '7', '247', 'hour', 'same', 'day', 'fast', 'rapid', 'quick',
    'home', 'homes', 'house', 'residential', 'commercial', 'repair', 'repairs', 'install', 'installation', 'maintenance',
    'plumbing', 'plumber', 'plumbers', 'drain', 'drains', 'sewer', 'rooter', 'water', 'heater', 'heaters',
    'roofing', 'roofer', 'roofers', 'roof', 'roofs', 'gutter', 'gutters', 'siding', 'exteriors', 'exterior', 'restoration',
    'hvac', 'heating', 'air', 'conditioning', 'cooling', 'ac', 'climate', 'comfort', 'mechanical',
    'electric', 'electrical', 'electrician', 'electricians', 'lighting', 'solar', 'energy', 'power',
    'dental', 'dentist', 'dentists', 'dentistry', 'orthodontics', 'orthodontist', 'smile', 'smiles', 'oral', 'surgery',
    'medical', 'clinic', 'clinics', 'health', 'care', 'wellness', 'spa', 'med', 'medspa', 'aesthetics', 'studio',
    'law', 'lawyer', 'lawyers', 'legal', 'attorney', 'attorneys', 'firm', 'office', 'offices', 'injury', 'personal',
    'pest', 'control', 'exterminating', 'exterminator', 'exterminators', 'termite', 'termites', 'wildlife',
    'cleaning', 'cleaners', 'cleaner', 'maid', 'maids', 'janitorial', 'carpet', 'window', 'windows', 'pressure', 'washing',
    'septic', 'pumping', 'garage', 'door', 'doors', 'gate', 'gates', 'lock', 'locksmith', 'locksmiths',
    'auto', 'automotive', 'car', 'cars', 'tire', 'tires', 'body', 'collision', 'shop', 'motors', 'transmission',
    'veterinary', 'vet', 'vets', 'animal', 'pet', 'pets', 'hospital', 'hospitals',
    'landscaping', 'landscape', 'lawn', 'tree', 'trees', 'garden', 'pool', 'pools', 'fence', 'fencing', 'concrete',
    'construction', 'contractor', 'contractors', 'contracting', 'builders', 'builder', 'remodeling', 'renovation',
    'painting', 'painters', 'painter', 'flooring', 'floors', 'kitchen', 'bath', 'cabinets', 'moving', 'movers',
    'storage', 'insurance', 'agency', 'realty', 'real', 'estate', 'accounting', 'tax', 'cpa', 'consulting'
  ]
};

export const VERDICTS = {
  not_recommended: { label: 'Not recommended', offer: 'Find out why ChatGPT skips you' },
  sometimes: { label: 'Sometimes recommended', offer: 'Find out how to show up every time' },
  not_first: { label: 'Recommended, not first', offer: 'Find out how to become the first name' },
  top_pick: { label: 'Top pick', offer: 'Keep it: see where competitors are catching up' }
};

export const LIMITS = {
  dataforseoTimeoutMs: 130000,
  // A query still "running" after this is treated as dead (worker hit its limit).
  staleQueryMs: 330000,
  // A check stuck in "parsing" longer than this is failed by the watchdog.
  staleParseMs: 150000,
  checkCacheDays: 7,
  siteCacheDays: 30,
  rawResponseDays: 90,
  auditDueHours: 48
};

export function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function numberEnv(name, fallback) {
  const v = Number(env(name, ''));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Merge admin overrides over the defaults, ignoring anything malformed. */
export function mergeSettings(overrides) {
  const out = { ...DEFAULT_SETTINGS };
  if (!overrides || typeof overrides !== 'object') return out;
  const arrays = ['prompt_templates', 'directory_domains', 'directory_names', 'generic_name_words'];
  for (const k of arrays) {
    if (Array.isArray(overrides[k]) && overrides[k].every((s) => typeof s === 'string') && overrides[k].length) {
      out[k] = overrides[k].map((s) => s.trim()).filter(Boolean);
    }
  }
  const qc = Number(overrides.query_count);
  if (Number.isInteger(qc) && qc >= 1 && qc <= 3) out.query_count = qc;
  out.query_count = Math.min(out.query_count, out.prompt_templates.length);
  return out;
}

/** Validation for the admin settings editor. Returns a list of problems (empty when fine). */
export function validateSettings(obj) {
  const problems = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['Ожидается JSON-объект'];
  if ('prompt_templates' in obj) {
    if (!Array.isArray(obj.prompt_templates) || !obj.prompt_templates.length) problems.push('prompt_templates: нужен непустой массив строк');
    else for (const t of obj.prompt_templates) {
      if (typeof t !== 'string' || !t.includes('{service}') || !t.includes('{city}')) problems.push(`шаблон «${t}» должен содержать {service} и {city}`);
    }
  }
  if ('query_count' in obj && !(Number.isInteger(obj.query_count) && obj.query_count >= 1 && obj.query_count <= 3)) {
    problems.push('query_count: целое от 1 до 3');
  }
  for (const k of ['directory_domains', 'directory_names', 'generic_name_words']) {
    if (k in obj && !(Array.isArray(obj[k]) && obj[k].every((s) => typeof s === 'string'))) problems.push(`${k}: нужен массив строк`);
  }
  return problems;
}
