// Single source of truth for the running server version. The value is
// pulled directly from `server/deno.json` so a release bump only requires
// editing that one file. Imported with `with { type: 'json' }` so Deno's
// loader treats the module as JSON regardless of the file extension.
import denoConfig from '../deno.json' with { type: 'json' };

export const SERVER_VERSION: string = (denoConfig as { version?: string }).version ?? '0.0.0-dev';
