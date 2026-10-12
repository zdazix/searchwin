// Business facts → {name, service, city, state, ...} with a fast, cheap Claude model.

import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { env } from '../config.js';

// Claude Haiku 5.5 list price per million tokens (prompts up to 100K tokens).
const PRICE_IN = 0.10 / 1e6;
const PRICE_OUT = 0.50 / 1e6;

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: ['string', 'null'], description: 'Business name as customers know it, without legal suffixes like LLC.' },
    service: { type: ['string', 'null'], description: 'Main service in the words a customer would type into ChatGPT, 1-4 lower-case words, e.g. "emergency plumber", "dentist", "personal injury lawyer", "roof repair". Not marketing language.' },
    city: { type: ['string', 'null'], description: 'Main city the business serves, e.g. "Austin".' },
    state: { type: ['string', 'null'], description: 'Two-letter US state code for that city, e.g. "TX". Null if not in the US or unknown.' },
    country: { type: ['string', 'null'], description: 'Two-letter ISO country code of the business, e.g. "US", "CA", "GB". Null if unknown.' },
    is_local_business: { type: 'boolean', description: 'True if it serves customers in a specific local area (home services, clinics, law firms, contractors, salons, restaurants, auto shops, agents). False for SaaS, online-only stores, national brands, media, directories and marketplaces.' },
    confidence: { type: 'number', description: '0 to 1: how sure you are about name, service and city together.' }
  },
  required: ['name', 'service', 'city', 'state', 'country', 'is_local_business', 'confidence'],
  additionalProperties: false
};

const SYSTEM = `You read what a website says about a business and fill in a small form.
Use only what the pages say. Prefer structured data and addresses for the city; if the business serves an area ("serving Greater Austin"), use that main city.
For "service", write what a customer would type when asking ChatGPT who to call: short, plain and lower case ("plumber", "emergency plumber", "family dentist", "personal injury lawyer", "ac repair"). Never use slogans or phrases like "plumbing solutions".
Return null for anything the pages don't show.`;

let client;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 25000, maxRetries: 1 });
  return client;
}

/**
 * @param facts output of factsForModel()
 * @returns {Promise<{ data: object, cost_usd: number, model: string }>}
 */
export async function extractBusiness(facts) {
  const model = env('ANTHROPIC_MODEL', 'claude-haiku-5-5');
  const response = await anthropic().messages.parse({
    model,
    max_tokens: 600,
    thinking: { type: 'disabled' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Website pages as JSON:\n${JSON.stringify(facts)}` }],
    output_config: { format: jsonSchemaOutputFormat(SCHEMA), effort: 'low' }
  });
  const usage = response.usage || {};
  const cost = (usage.input_tokens || 0) * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    const err = new Error(`Claude returned no data (${response.stop_reason})`);
    err.code = 'llm_no_data';
    err.cost_usd = cost;
    throw err;
  }
  return { data: response.parsed_output, cost_usd: cost, model };
}
