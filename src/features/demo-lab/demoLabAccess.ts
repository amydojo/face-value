export interface DemoLabEnvironment {
  dev: boolean;
  showDemoControls: string | undefined;
}

export function demoLabAccessEnabled(environment: DemoLabEnvironment): boolean {
  return environment.dev && environment.showDemoControls === 'true';
}

export const DEMO_LAB_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_CONTROLS === 'true';
