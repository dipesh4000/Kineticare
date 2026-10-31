import express from 'express';
import { apiApp } from '../backend/routes/api.js';

const app = express();
app.use('/api', apiApp);

export default app;
