import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiApp } from './routes/api.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Mount API routes
app.use('/api', apiApp);

// Serve frontend static build in production
const distPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) {
      res.status(200).send('Kineticare Backend Server running. Start Vite dev server for client.');
    }
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Kineticare Fullstack Server listening on http://${config.host}:${config.port}`);
});

export { app };
