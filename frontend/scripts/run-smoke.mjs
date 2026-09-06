/**
 * Bundles scripts/smoke.ts with esbuild (resolves extensionless TS imports
 * and node_modules) and runs it in Node.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'bwb-smoke-'));

await build({
  entryPoints: ['scripts/smoke.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: join(outdir, 'smoke.cjs'),
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [join(outdir, 'smoke.cjs')], { stdio: 'inherit' });
process.exit(result.status ?? 1);
