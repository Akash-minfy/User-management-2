export const appConfig = {
  name: import.meta.env.VITE_APP_NAME || 'Minfy',
  environment: (import.meta.env.VITE_APP_ENV || 'Development') as 'Development' | 'Staging' | 'Production',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
};

