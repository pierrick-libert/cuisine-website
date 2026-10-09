import { existsSync, readFileSync } from 'node:fs';

// Minimal .env loader (no dependency needed for two or three local-dev variables).
// Prefers .env.local (gitignored, per-developer); falls back to .env.example's defaults.
const envFile = existsSync('.env.local') ? '.env.local' : '.env.example';
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, value = ''] = match;
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
