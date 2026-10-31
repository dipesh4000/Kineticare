/**
 * Kineticare Backend Configuration
 */
import './environment.js';

export const config = {
  port: process.env.PORT || 3001,
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',
  appName: 'Kineticare Tele-Rehabilitation Engine',
  version: '2.1.0',
};
