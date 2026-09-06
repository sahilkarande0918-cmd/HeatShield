/**
 * Runs once when the server starts, in dev and in production. Env problems
 * surface here, at boot, instead of as a 500 mid-demo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();
  }
}
