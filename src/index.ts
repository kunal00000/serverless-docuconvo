import serverless from 'serverless-http';
import express from 'express';

import cors from 'cors';
import queryRouter from './routes/query.routes.js';
import queueRouter from './routes/queue.routes.js';

import { queryAuth } from './middlewares/auth.middleware.js';
const app = express();

app.use(express.json());
app.options('*', cors());
app.use(cors({ allowedHeaders: 'Content-Type, Authorization' }));

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.use('/api', queueRouter);
app.use('/api', queryAuth, queryRouter);

app.use((req, res, next) => {
  return res.status(404).json({
    error: 'Not Found',
  });
});

module.exports.handler = serverless(app);
