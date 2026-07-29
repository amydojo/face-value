export interface DemoLabEnvironment {
  dev: boolean;
  production: boolean;
  showDemoControls: string | undefined;
}

export function demoLabAccessEnabled(environment: DemoLabEnvironment): boolean {
  return environment.production || (environment.dev && environment.showDemoControls === 'true');
}

// This is a bundle/runtime switch, not the access boundary. In production,
// Vercel serves the app shell at /demo only after validating the signed cookie.
export const DEMO_LAB_ENABLED = demoLabAccessEnabled({
  dev: import.meta.env.DEV,
  production: import.meta.env.PROD,
  showDemoControls: import.meta.env.VITE_SHOW_DEMO_CONTROLS,
});
