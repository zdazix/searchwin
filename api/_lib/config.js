// Settings of the free AI check: questions, directories and words that never identify a business.

export const DEFAULT_SETTINGS = {
  // {service}, {city}, {state} are filled from the parsed site; state is a 2-letter code.
  prompt_templates: [
    'best {service} in {city}, {state}',
    'who should I call for {service} near {city} {state}? I need someone reliable',
    'top rated {service} in {city} {state} with good reviews'
  ],
  // Outside the US there are no state codes: {state} is the region as written on the site, or the country name.
  prompt_templates_intl: [
    'best {service} in {city}, {state}',
    'who should I call for {service} near {city}, {state}? I need someone reliable',
    'top rated {service} in {city}, {state} with good reviews'
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
    'linkedin.com', 'instagram.com', 'youtube.com', 'x.com', 'twitter.com', 'wikipedia.org', 'bing.com',
    // Review sites and directories outside the US
    'trustpilot.com', 'yell.com', 'checkatrade.com', 'trustatrader.com', 'ratedpeople.com', 'mybuilder.com', 'which.co.uk', 'trustedtraders.which.co.uk',
    'yellowpages.ca', 'homestars.com', 'yellowpages.com.au', 'hipages.com.au', 'oneflare.com.au', 'truelocal.com.au', 'starworks.com.au', 'productreview.com.au',
    'gelbeseiten.de', '11880.com', 'werkenntdenbesten.de', 'jameda.de', 'profimap.de', 'trustlocal.de', 'sanitaerfinden.com', 'dasoertliche.de', 'myhammer.de', 'check24.de',
    'pagesjaunes.fr', 'doctolib.fr', 'travaux.com', 'habitatpresto.com', 'paginasamarillas.es', 'doctoralia.es', 'habitissimo.es', 'paginegialle.it', 'misterwhat.it',
    'goudengids.nl', 'zoofy.nl', 'olx.pl', 'pkt.pl', 'oferteo.pl', 'paginasamarelas.pt', 'olx.com.br', 'guiamais.com.br', 'mercadolibre.com'
  ],
  directory_names: [
    'yelp', 'angi', 'angies list', 'homeadvisor', 'home advisor', 'thumbtack', 'bbb', 'better business bureau',
    'google', 'google maps', 'google business profile', 'nextdoor', 'facebook', 'yellow pages', 'expertise',
    'best pick reports', 'consumeraffairs', 'consumer affairs', 'birdeye', 'trustanalytica', 'houzz', 'porch',
    'avvo', 'justia', 'findlaw', 'healthgrades', 'zocdoc', 'tripadvisor', 'reddit', 'linkedin', 'instagram',
    'trustpilot', 'yell', 'checkatrade', 'trustatrader', 'which trusted traders', 'rated people', 'mybuilder', 'homestars', 'hipages', 'oneflare',
    'gelbeseiten', 'wer kennt den besten', 'jameda', 'profimap', 'pages jaunes', 'pagesjaunes', 'doctolib', 'paginas amarillas', 'pagine gialle'
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

export { VERDICTS } from '../../assets/js/ai-check-core.js';

export const LIMITS = {
  // Each /api/ai-check/* function may run this long (vercel.json maxDuration).
  functionMs: 150000,
  // One DataForSEO call never waits longer than this; a retry only starts if a full answer still fits.
  dataforseoTimeoutMs: 130000,
  dataforseoTypicalMs: 60000,
  // How long the page may use one parse result to ask ChatGPT.
  ticketMs: 5 * 60000,
  auditDueHours: 48
};

export function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

// Shown next to the email field; stored with every lead.
export const CONSENT_VERSION = '2026-10-14';

export const MESSAGES = {
  invalid_url: 'Enter your website, e.g. yourbusiness.com',
  captcha: "We couldn't confirm you're human. Refresh the page and try again.",
  city_state: 'Enter a US city and state, e.g. Austin, TX',
  city: 'Enter a city, e.g. Manchester',
  country: 'Choose the country of your business',
  service: 'Tell us what you do, e.g. plumber or family dentist',
  expired: 'This check has expired. Run it again, it takes about a minute.',
  answer_failed: "This answer didn't load — it'll be in your full audit.",
  server: 'Something went wrong on our side. Try again in a minute.',
  email_format: 'Enter a valid email, e.g. name@yourbusiness.com',
  email_disposable: "Please use a permanent email address. Temporary inboxes can't receive the audit.",
  email_no_mx: "This email domain can't receive mail. Check it for typos."
};
