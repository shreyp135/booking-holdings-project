// Builds the Express app. The catalog and the store are passed in, which keeps tests simple.
import express from 'express';
import cors from 'cors';
import { buildRouter } from './routes/api.js';
import { imagesDir } from './engine/credits.js';

export function createApp({ catalog, store }) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/images', express.static(imagesDir, { maxAge: '7d' })); // hotel and attraction photos
  app.use('/api', buildRouter(catalog, store));
  return app;
}
