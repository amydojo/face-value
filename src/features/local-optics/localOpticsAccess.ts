// The experiment ships only in development builds or builds that opt in explicitly.
export const LOCAL_OPTICS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_LOCAL_OPTICS_EXPERIMENT === 'true';
