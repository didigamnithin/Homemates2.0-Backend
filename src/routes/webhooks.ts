/**
 * Webhooks Routes
 * Handles webhook events from DesiVocal agents
 */

import { Router, Request, Response } from 'express';
import { csvStorage } from '../config/csvStorage';

export const webhooksRouter = Router();

// DesiVocal webhook endpoint for call events
webhooksRouter.post('/desivocal', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    
    console.log('Received DesiVocal webhook event:', JSON.stringify(event, null, 2));
    
    // Handle different event types
    const eventType = event.type || event.event_type || 'unknown';
    const callId = event.call_id || event.callId || event.conversation_id || event.conversationId;
    const phoneNumber = event.phone_number || event.phoneNumber || event.from;
    const transcript = event.transcript || event.transcription;
    const direction = event.direction || 'inbound';
    
    switch (eventType) {
      case 'call_started':
      case 'call_initiated':
        console.log(`Call started: Call ID ${callId}, Direction: ${direction}`);
        break;
        
      case 'call_answered':
        console.log(`Call answered: Call ID ${callId}`);
        if (callId) {
          const lead = await csvStorage.getLeadById(callId);
          if (lead) {
            await csvStorage.updateLead(callId, {
              status: 'answered',
              updated_at: new Date().toISOString()
            });
          }
        }
        break;
        
      case 'call_ended':
      case 'call_completed':
        console.log(`Call ended: Call ID ${callId}`);
        if (callId && transcript) {
          const lead = await csvStorage.getLeadById(callId);
          if (lead) {
            await csvStorage.updateLead(callId, {
              status: 'completed',
              transcript,
              call_recording_url: event.recording_url || event.recordingUrl || '',
              updated_at: new Date().toISOString()
            });
          } else {
            const tenant = await csvStorage.getTenantByPhone(phoneNumber);
            if (tenant) {
              await csvStorage.createLead({
                tenant_id: tenant.tenant_id,
                channel: 'call',
                transcript,
                call_recording_url: event.recording_url || event.recordingUrl || '',
                status: 'completed',
                owner_notified: 'false'
              });
            }
          }
        }
        break;
        
      case 'call_failed':
      case 'call_no_answer':
        console.log(`Call failed/no answer: Call ID ${callId}`);
        if (callId) {
          const lead = await csvStorage.getLeadById(callId);
          if (lead) {
            await csvStorage.updateLead(callId, {
              status: 'no_answer',
              updated_at: new Date().toISOString()
            });
          }
        }
        break;
        
      case 'transcript_update':
        if (callId && transcript) {
          const lead = await csvStorage.getLeadById(callId);
          if (lead) {
            await csvStorage.updateLead(callId, {
              transcript,
              updated_at: new Date().toISOString()
            });
          }
        }
        break;
        
      default:
        console.log(`Unknown event type: ${eventType}`);
    }
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Webhook received',
      event_type: eventType 
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(200).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Health check for webhook endpoint
webhooksRouter.get('/desivocal', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'DesiVocal webhook endpoint is ready',
    timestamp: new Date().toISOString()
  });
});
