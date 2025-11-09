import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fileStorage } from '../config/storage';
import { createError } from '../middleware/errorHandler';
import { encrypt } from '../config/encryption';
import { google } from 'googleapis';

export const toolsRouter = Router();
toolsRouter.use(authenticate);

// Get connected tools
toolsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;

    const integrations = fileStorage.getIntegrations(builderId);

    // Don't expose tokens in response
    const safeIntegrations = integrations.map((integration: any) => ({
      id: integration.id,
      tool_type: integration.tool_type,
      status: integration.status,
      last_sync: integration.last_sync,
      created_at: integration.created_at
    }));

    res.json({ status: 'success', integrations: safeIntegrations || [] });
  } catch (error) {
    next(error);
  }
});

// Connect Gmail
toolsRouter.post('/gmail/connect', async (req: AuthRequest, res, next) => {
  try {
    const { code } = req.body;
    const builderId = req.user!.builderId;

    if (!code) {
      throw createError('Authorization code is required', 400);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/tools/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const { access_token, refresh_token } = tokens;

    if (!access_token) {
      throw createError('Failed to obtain access token', 500);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Store integration
    const integration = fileStorage.upsertIntegration({
      builder_id: builderId,
      tool_type: 'gmail',
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      status: 'connected',
      last_sync: new Date().toISOString()
    });

    res.json({ status: 'success', integration: { id: integration.id, tool_type: 'gmail', status: 'connected' } });
  } catch (error) {
    next(error);
  }
});

// Connect Google Calendar
toolsRouter.post('/calendar/connect', async (req: AuthRequest, res, next) => {
  try {
    const { code } = req.body;
    const builderId = req.user!.builderId;

    if (!code) {
      throw createError('Authorization code is required', 400);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/tools/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const { access_token, refresh_token } = tokens;

    if (!access_token) {
      throw createError('Failed to obtain access token', 500);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Store integration
    const integration = fileStorage.upsertIntegration({
      builder_id: builderId,
      tool_type: 'calendar',
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      status: 'connected',
      last_sync: new Date().toISOString()
    });

    res.json({ status: 'success', integration: { id: integration.id, tool_type: 'calendar', status: 'connected' } });
  } catch (error) {
    next(error);
  }
});

// Disconnect tool
toolsRouter.delete('/:toolType', async (req: AuthRequest, res, next) => {
  try {
    const { toolType } = req.params;
    const builderId = req.user!.builderId;

    fileStorage.deleteIntegration(builderId, toolType);

    res.json({ status: 'success', message: 'Tool disconnected' });
  } catch (error) {
    next(error);
  }
});

// Get OAuth URL for Google
toolsRouter.get('/oauth/google', (req: AuthRequest, res, next) => {
  try {
    const { tool_type } = req.query;

    if (!tool_type || (tool_type !== 'gmail' && tool_type !== 'calendar')) {
      throw createError('tool_type must be "gmail" or "calendar"', 400);
    }

    const scopes = tool_type === 'gmail'
      ? ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
      : ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'];

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/tools/callback`
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    res.json({ status: 'success', auth_url: authUrl });
  } catch (error) {
    next(error);
  }
});
