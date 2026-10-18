/**
 * Kineticare Backend Configuration
 */
export const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  appName: 'Kineticare Tele-Rehabilitation Engine',
  version: '2.1.0',
};
