// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Load .env file - try current working directory first (when running from backend/)
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

// If not found, try relative to this file location
if (result.error || !process.env.ELEVENLABS_API_KEY) {
  const altEnvPath = path.resolve(__dirname, '../.env');
  dotenv.config({ path: altEnvPath });
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { agentsRouter } from './routes/agents';
import { callsRouter } from './routes/calls';
import { toolsRouter } from './routes/tools';
import { databaseRouter } from './routes/database';
import { webhooksRouter } from './routes/webhooks';
import { propertiesRouter } from './routes/properties';
import { tenantsRouter } from './routes/tenants';
import { leadsRouter } from './routes/leads';

const app = express();
// Cloud Run uses PORT environment variable, default to 8080 for Cloud Run, 3001 for local
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/database', databaseRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/leads', leadsRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

