export const environment = {
  wsHost: (window as any).__env?.wsHost ?? 'http://localhost:3000',
  wsTimeout: 5000,
  wsRequestTimeout: 5000,
};
