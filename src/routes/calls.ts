/**
 * Calls Routes
 * Handles call logs and lead management
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { csvStorage } from '../config/csvStorage';
import { createError } from '../middleware/errorHandler';
import { initiateOutboundCall } from '../services/ringg';

export const callsRouter = Router();
callsRouter.use(authenticate);

// Get call logs (from leads)
callsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { tenant_id, property_id, status } = req.query;
    
    const filters: any = {};
    if (tenant_id) filters.tenant_id = tenant_id as string;
    if (property_id) filters.property_id = property_id as string;
    if (status) filters.status = status as string;

    const leads = await csvStorage.getLeads(filters);
    
    // Convert leads to call format
    const calls = leads.map(lead => ({
      id: lead.lead_id,
      conversation_id: lead.lead_id,
      tenant_id: lead.tenant_id,
      property_id: lead.property_id,
      channel: lead.channel || 'call',
      transcript: lead.transcript,
      recording_url: lead.call_recording_url,
      status: lead.status,
      match_score: lead.match_score,
      created_at: lead.created_at,
      updated_at: lead.updated_at
    }));
    
    res.json({ 
      status: 'success', 
      calls,
      total: calls.length 
    });
  } catch (error) {
    next(error);
  }
});

// Get call by ID
callsRouter.get('/:callId', async (req: AuthRequest, res, next) => {
  try {
    const { callId } = req.params;
    const lead = await csvStorage.getLeadById(callId);
    
    if (!lead) {
      throw createError('Call not found', 404);
    }
    
    // Enrich with tenant and property information
    const tenant = lead.tenant_id 
      ? await csvStorage.getTenantById(lead.tenant_id)
      : null;
    const property = lead.property_id
      ? await csvStorage.getPropertyById(lead.property_id)
      : null;
    
    res.json({ 
      status: 'success', 
      call: {
        id: lead.lead_id,
        conversation_id: lead.lead_id,
        tenant_id: lead.tenant_id,
        property_id: lead.property_id,
        channel: lead.channel || 'call',
        transcript: lead.transcript,
        recording_url: lead.call_recording_url,
        status: lead.status,
        match_score: lead.match_score,
        nlp_extracted: lead.nlp_extracted,
        tenant,
        property,
        created_at: lead.created_at,
        updated_at: lead.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Initiate outbound call
callsRouter.post('/outbound', async (req: AuthRequest, res, next) => {
  try {
    const { name, mobile_number, agent_id, from_number, custom_args_values, call_config } = req.body;

    console.log('Outbound call request received:', {
      name,
      mobile_number,
      agent_id,
      from_number,
      custom_args_values,
      has_call_config: !!call_config
    });

    if (!name || !mobile_number) {
      throw createError('Name and mobile_number are required', 400);
    }

    // Format mobile number with country code if not present
    let formattedNumber = mobile_number.trim();
    if (!formattedNumber.startsWith('+')) {
      // Remove any spaces, dashes, or parentheses
      formattedNumber = formattedNumber.replace(/[\s\-\(\)]/g, '');
      
      // Assume Indian number if no country code
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '+91' + formattedNumber.substring(1);
      } else if (formattedNumber.length === 10) {
        formattedNumber = '+91' + formattedNumber;
      } else if (formattedNumber.length > 10) {
        // Might already have country code without +
        formattedNumber = '+' + formattedNumber;
      } else {
        throw createError('Invalid mobile number format', 400);
      }
    }

    // Validate formatted number
    if (!/^\+[1-9]\d{1,14}$/.test(formattedNumber)) {
      throw createError('Invalid mobile number format. Must be in E.164 format (e.g., +919876543210)', 400);
    }

    // Build call parameters
    // from_number is optional - if not provided, Ringg AI will use their default
    const callParams: any = {
      name: name.trim(),
      mobile_number: formattedNumber,
      agent_id,
      custom_args_values,
      call_config
    };
    
    // Only include from_number if explicitly provided
    // If not provided, omit it and let Ringg AI use their default
    if (from_number && from_number.trim() !== '') {
      callParams.from_number = from_number.trim();
    }

    const callResponse = await initiateOutboundCall(callParams);

    res.json({
      status: 'success',
      message: 'Call initiated successfully',
      call: callResponse.data
    });
  } catch (error: any) {
    console.error('Error initiating outbound call:', error);
    next(error);
  }
});
