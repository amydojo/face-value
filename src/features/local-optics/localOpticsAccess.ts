// The experiment ships only in development builds or builds that opt in explicitly.
export const LOCAL_OPTICS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_LOCAL_OPTICS_EXPERIMENT === 'true';

export const TRIAL_PATHS = ['/trial', '/trial/'];

/**
 * Experimental routes that need nothing from the production journey's provider, and so are
 * rendered without it (see main.tsx). The provider reads saved journeys from localStorage while
 * mounting; where Safari blocks website data that read throws before any screen appears. Always
 * false in builds without the experiment, so production bootstraps exactly as before.
 */
export function isStandaloneExperimentPath(pathname: string): boolean {
  return LOCAL_OPTICS_ENABLED && (TRIAL_PATHS.includes(pathname) || pathname === '/experiments/local-optics');
}
