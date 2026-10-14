// The site reader the parse route uses. Tests and scripts/dev-server.mjs swap it for a reader
// of saved pages, because there is no DNS or Claude key there; on Vercel it is always parseSite.
import { parseSite } from './site-parse.js';

export const deps = { parseSite };
