// Exports the running server's match state to a local JSON file.
const parseArgs = (args: string[]) => {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const value = args[i + 1];
    if (!value || value.startsWith('--')) continue;
    parsed[key.slice(2)] = value;
    i += 1;
  }
  return parsed;
};

const args = parseArgs(Deno.args);
const url = args.url ?? Deno.env.get('MATCH_STATE_EXPORT_URL') ??
  `http://localhost:${Deno.env.get('PORT') || 3001}/debug/match-state`;
const outPath = args.out ?? Deno.env.get('MATCH_STATE_EXPORT_OUT') ?? './match-state-export.json';

const response = await fetch(url);
if (!response.ok) {
  const text = await response.text();
  throw new Error(`failed to export match state (${response.status}): ${text}`);
}

const payload = await response.text();
await Deno.writeTextFile(outPath, payload);
console.log(`[export-match-state] wrote match state to ${outPath}`);
