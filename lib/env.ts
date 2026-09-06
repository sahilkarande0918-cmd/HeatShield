/**
 * Environment validation.
 *
 * Called once at server start from instrumentation.ts. A missing DATABASE_URL
 * must fail the boot loudly rather than surface as a confusing 500 halfway
 * through a demo, and a missing GEMINI_API_KEY must be announced rather than
 * silently degrading advisories to templates without anyone noticing.
 */

type Check = {
  name: string;
  required: boolean;
  where: string;
  /** Cheap sanity check on the shape of the value, not on whether it works. */
  looksWrong?: (v: string) => string | null;
};

const CHECKS: Check[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    where: 'https://console.neon.tech → your project → Connection Details (pooled)',
    looksWrong: (v) =>
      v.startsWith('postgres://') || v.startsWith('postgresql://')
        ? null
        : 'should start with postgresql://',
  },
  {
    name: 'GEMINI_API_KEY',
    required: false,
    where: 'https://aistudio.google.com/apikey (free tier)',
  },
];

export function validateEnv() {
  const missing: string[] = [];
  const notes: string[] = [];

  for (const c of CHECKS) {
    const v = process.env[c.name];
    if (!v) {
      if (c.required) missing.push(`  ${c.name} — required. Get it from ${c.where}`);
      else notes.push(`  ${c.name} is not set — ward advisories will fall back to templated text.`);
      continue;
    }
    const problem = c.looksWrong?.(v);
    if (problem) notes.push(`  ${c.name} ${problem}`);
  }

  if (missing.length > 0) {
    throw new Error(
      `HeatShield cannot start. Missing environment variables:\n${missing.join('\n')}\n\n` +
        'Locally: copy .env.example to .env.local and fill it in.\n' +
        'On Vercel: Project → Settings → Environment Variables.',
    );
  }

  for (const n of notes) console.warn(`[env]${n}`);
}
