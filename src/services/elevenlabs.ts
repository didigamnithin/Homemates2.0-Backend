import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Lazy-load API key and create client to ensure dotenv has loaded
const getClient = (): ElevenLabsClient => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is required. Please check your backend/.env file.');
  }
  
  // Use US endpoint by default (can be overridden via env variable)
  const baseUrl = process.env.ELEVENLABS_API_BASE_URL || 'https://api.us.elevenlabs.io';
  
  return new ElevenLabsClient({
    apiKey: apiKey,
    environment: 'https://api.elevenlabs.io'
  });
};

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
  description?: string;
  voice_id?: string;
  language?: string;
  [key: string]: any;
}

export interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  customer_name?: string;
  phone?: string;
  duration?: number;
  audio_url?: string;
  timestamp?: string;
  metadata?: any;
}

export interface ElevenLabsPhoneNumber {
  phone_number: string;
  label: string;
  supports_inbound: boolean;
  supports_outbound: boolean;
  phone_number_id: string;
  assigned_agent?: {
    agent_id: string;
    agent_name: string;
  } | null;
  provider: 'twilio' | 'sip_trunk';
}

export const elevenLabsService = {
  // Get all agents
  async getAgents(): Promise<ElevenLabsAgent[]> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.agents.list();
      
      console.log('ElevenLabs agents response:', JSON.stringify(response, null, 2));
      
      // Handle different response structures
      let agents: any[] = [];
      if (Array.isArray(response)) {
        agents = response;
      } else if (response && typeof response === 'object') {
        if (Array.isArray((response as any).agents)) {
          agents = (response as any).agents;
        } else if (Array.isArray((response as any).data)) {
          agents = (response as any).data;
        } else {
          agents = [response];
        }
      }
      
      // Normalize agent_id field - ensure all agents have agent_id
      agents = agents.map((agent: any) => {
        // Try to find agent_id in various possible field names from ElevenLabs API
        const agentId = agent.agent_id || agent.id || agent.agentId;
        if (!agentId) {
          console.warn('Agent missing agent_id field:', agent);
          // If still no agent_id, try to extract from the object itself
          const fallbackId = Object.keys(agent).find(key => 
            key.toLowerCase().includes('agent') && key.toLowerCase().includes('id')
          );
          if (fallbackId) {
            console.log(`Found agent ID in field: ${fallbackId} = ${agent[fallbackId]}`);
            return {
              ...agent,
              agent_id: agent[fallbackId]
            };
          }
        }
        return {
          ...agent,
          agent_id: agentId // Ensure agent_id is always present
        };
      });
      
      console.log(`Normalized ${agents.length} agents with agent_id field`);
      return agents;
    } catch (error: any) {
      console.error('Error fetching agents from ElevenLabs:', error);
      throw new Error(`Failed to fetch agents: ${error.message}`);
    }
  },

  // Get single agent
  async getAgent(agentId: string): Promise<ElevenLabsAgent> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.agents.get(agentId);
      
      console.log(`Agent ${agentId} configuration:`, JSON.stringify(response, null, 2));
      
      // Normalize agent_id field
      const normalized = {
        ...response,
        agent_id: (response as any).agent_id || (response as any).id || (response as any).agentId || agentId
      };
      
      return normalized as any;
    } catch (error: any) {
      console.error(`Error fetching agent ${agentId}:`, error);
      throw new Error(`Failed to fetch agent: ${error.message}`);
    }
  },

  // Create agent
  async createAgent(agentData: Partial<ElevenLabsAgent>): Promise<ElevenLabsAgent> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.agents.create(agentData as any);
      return response as any;
    } catch (error: any) {
      throw new Error(`Failed to create agent: ${error.message}`);
    }
  },

  // Delete agent
  async deleteAgent(agentId: string): Promise<void> {
    try {
      const client = getClient();
      await client.conversationalAi.agents.delete(agentId);
    } catch (error: any) {
      throw new Error(`Failed to delete agent: ${error.message}`);
    }
  },

  // Get conversations list from ElevenLabs
  async getConversations(params?: {
    agent_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.conversations.list(params as any);
      
      console.log('ElevenLabs conversations response:', JSON.stringify(response, null, 2));
      
      // Handle different response structures
      let conversations: any[] = [];
      if (Array.isArray(response)) {
        conversations = response;
      } else if (response && typeof response === 'object') {
        if (Array.isArray((response as any).conversations)) {
          conversations = (response as any).conversations;
        } else if (Array.isArray((response as any).data)) {
          conversations = (response as any).data;
        } else if ((response as any).items && Array.isArray((response as any).items)) {
          conversations = (response as any).items;
        } else {
          conversations = [response];
        }
      }
      
      // Normalize conversation_id field
      conversations = conversations.map((conv: any) => {
        const conversationId = conv.conversation_id || conv.id || conv.conversationId;
        return {
          ...conv,
          conversation_id: conversationId
        };
      });
      
      console.log(`Returning ${conversations.length} conversations`);
      return conversations;
    } catch (error: any) {
      console.error('Error fetching conversations from ElevenLabs:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
  },

  // Get single conversation details
  async getConversation(conversationId: string): Promise<any> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.conversations.get(conversationId);
      
      console.log(`Conversation ${conversationId} details:`, JSON.stringify(response, null, 2));
      
      // Normalize conversation_id field
      const normalized = {
        ...response,
        conversation_id: (response as any).conversation_id || (response as any).id || (response as any).conversationId || conversationId
      };
      
      return normalized;
    } catch (error: any) {
      console.error(`Error fetching conversation ${conversationId}:`, error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }
  },

  // Get conversations (old method - keeping for backward compatibility)
  async getConversationsOld(params?: {
    agent_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ElevenLabsConversation[]> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.conversations.list(params as any);
      return (response as any).conversations || response || [];
    } catch (error: any) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
  },

  // Get phone numbers
  async getPhoneNumbers(): Promise<ElevenLabsPhoneNumber[]> {
    try {
      const client = getClient();
      const response = await client.conversationalAi.phoneNumbers.list();
      
      console.log('ElevenLabs phone numbers response:', JSON.stringify(response, null, 2));
      
      // Handle different response structures
      let phoneNumbers: any[] = [];
      if (Array.isArray(response)) {
        phoneNumbers = response;
      } else if (response && typeof response === 'object') {
        // Check for nested phone_numbers array
        if (Array.isArray((response as any).phone_numbers)) {
          phoneNumbers = (response as any).phone_numbers;
        }
        // Check for data array
        else if (Array.isArray((response as any).data)) {
          phoneNumbers = (response as any).data;
        }
        // If response is an object with phone number properties, wrap it in an array
        else if ((response as any).phone_number_id || (response as any).phone_number || (response as any).id) {
          phoneNumbers = [response as any];
        }
      }
      
      // Normalize phone_number_id field - ensure all phone numbers have phone_number_id
      phoneNumbers = phoneNumbers.map((pn: any) => {
        // Try to find phone_number_id in various possible field names from ElevenLabs API
        // SDK returns camelCase (phoneNumberId), REST API returns snake_case (phone_number_id)
        const phoneNumberId = pn.phoneNumberId || pn.phone_number_id || pn.id;
        const phoneNumber = pn.phoneNumber || pn.phone_number || pn.phone;
        const label = pn.label || pn.name || '';
        
        // Normalize assigned_agent structure
        // ElevenLabs SDK returns camelCase (assignedAgent) but we need snake_case (assigned_agent)
        let assignedAgent = null;
        
        // Check for assignedAgent (camelCase - from SDK)
        if (pn.assignedAgent) {
          assignedAgent = {
            agent_id: pn.assignedAgent.agentId || pn.assignedAgent.agent_id || pn.assignedAgent.id,
            agent_name: pn.assignedAgent.agentName || pn.assignedAgent.agent_name || pn.assignedAgent.name || ''
          };
          console.log('Found assignedAgent (camelCase):', assignedAgent);
        }
        // Check for assigned_agent (snake_case - from REST API)
        else if (pn.assigned_agent) {
          assignedAgent = {
            agent_id: pn.assigned_agent.agent_id || pn.assigned_agent.id || pn.assigned_agent.agentId,
            agent_name: pn.assigned_agent.agent_name || pn.assigned_agent.name || pn.assigned_agent.agentName
          };
          console.log('Found assigned_agent (snake_case):', assignedAgent);
        }
        // Check for agent_id directly on phone number object
        else if (pn.agent_id || pn.agentId) {
          assignedAgent = {
            agent_id: pn.agent_id || pn.agentId,
            agent_name: pn.agent_name || pn.agentName || ''
          };
        }
        // Check for nested agent object
        else if (pn.agent) {
          assignedAgent = {
            agent_id: pn.agent.agent_id || pn.agent.id || pn.agent.agentId,
            agent_name: pn.agent.agent_name || pn.agent.name || pn.agent.agentName || ''
          };
        }
        
        // Log if we couldn't find assigned agent but phone number might have one
        if (!assignedAgent) {
          console.log('Phone number has no assigned agent. Available fields:', Object.keys(pn));
        }
        
        const normalized = {
          ...pn,
          phone_number_id: phoneNumberId, // Ensure phone_number_id is always present
          phone_number: phoneNumber,
          label: label,
          supports_inbound: pn.supports_inbound !== false,
          supports_outbound: pn.supports_outbound !== false,
          assigned_agent: assignedAgent
        };
        
        console.log('Normalized phone number:', {
          phone_number_id: normalized.phone_number_id,
          phone_number: normalized.phone_number,
          label: normalized.label,
          has_assigned_agent: !!normalized.assigned_agent,
          assigned_agent: normalized.assigned_agent
        });
        
        return normalized;
      });
      
      console.log(`Normalized ${phoneNumbers.length} phone numbers with phone_number_id field`);
      return phoneNumbers;
    } catch (error: any) {
      // Log detailed error information
      const errorData = error.body || error.data || error.response?.data;
      const status = error.status || error.statusCode || error.response?.status;
      
      console.error('ElevenLabs phone numbers API Error:', {
        status: status,
        statusText: error.statusText,
        data: errorData,
        message: error.message,
        error: error
      });
      
      // Extract detailed error message
      let errorMessage = error.message || 'Unknown error';
      if (errorData) {
        if (errorData.detail && Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            if (err.message) return err.message;
            return JSON.stringify(err);
          }).join(', ');
        } else if (errorData.detail && typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      
      throw new Error(`Failed to fetch phone numbers: ${errorMessage}`);
    }
  },

  // Initiate outbound call via Twilio using SDK
  // Uses the correct Twilio outbound call API with proper parameter names
  // API expects: agent_id, agent_phone_number_id, to_number
  async initiateCall(data: {
    agent_id: string;
    agent_phone_number_id: string;
    to_number: string;
    conversation_initiation_client_data?: any;
  }): Promise<{ 
    success: boolean;
    message: string;
    conversation_id: string | null;
    callSid?: string | null;
  }> {
    try {
      const client = getClient();
      
      // Ensure all required fields are present and not empty
      if (!data.agent_id || !data.agent_phone_number_id || !data.to_number) {
        throw new Error('Missing required fields: agent_id, agent_phone_number_id, and to_number are required');
      }

      // Prepare the request payload
      const requestPayload: any = {
        agentId: data.agent_id,
        agentPhoneNumberId: data.agent_phone_number_id,
        toNumber: data.to_number
      };
      
      // Only include conversationInitiationClientData if it's provided
      if (data.conversation_initiation_client_data) {
        requestPayload.conversationInitiationClientData = data.conversation_initiation_client_data;
      }
      
      console.log('Calling ElevenLabs Twilio Outbound Call API:');
      console.log('Request payload:', JSON.stringify(requestPayload, null, 2));
      
      // Use SDK to initiate outbound call
      // The agent will use its own configuration (prompt, first_message, voice, etc.) from ElevenLabs
      const response = await client.conversationalAi.twilio.outboundCall(requestPayload);
      
      console.log('ElevenLabs API Response:', JSON.stringify(response, null, 2));
      
      // Normalize response - SDK returns camelCase, we need to support both
      const normalizedResponse = {
        ...response,
        // Support both camelCase (from SDK) and snake_case (from REST API)
        conversation_id: (response as any).conversationId || (response as any).conversation_id || null,
        conversationId: (response as any).conversationId || (response as any).conversation_id || null,
        callSid: (response as any).callSid || (response as any).call_sid || null,
        call_sid: (response as any).callSid || (response as any).call_sid || null,
        success: (response as any).success !== false,
        message: (response as any).message || 'Call initiated'
      };
      
      console.log('Normalized call response:', normalizedResponse);
      return normalizedResponse as any;
    } catch (error: any) {
      // Log detailed error information
      // SDK errors might have different structure than axios errors
      const errorData = error.body || error.data || error.response?.data;
      const status = error.status || error.statusCode || error.response?.status;
      
      console.error('ElevenLabs API Error:', {
        status: status,
        statusText: error.statusText,
        data: errorData,
        message: error.message,
        error: error
      });
      
      // Log the full error data for debugging
      if (errorData) {
        console.error('Full error data:', JSON.stringify(errorData, null, 2));
      }
      
      // Extract detailed error message properly
      let errorMessage = error.message || 'Unknown error';
      
      if (errorData) {
        // Handle detail array (common in 422 validation errors)
        if (errorData.detail && Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            if (err.message) return err.message;
            if (err.loc && err.msg) {
              return `${err.loc.join('.')}: ${err.msg}`;
            }
            return JSON.stringify(err);
          }).join(', ');
        } else if (errorData.detail && typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (Array.isArray(errorData)) {
          // Handle validation errors array
          errorMessage = errorData.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.message) return err.message;
            if (err.msg) return err.msg;
            return JSON.stringify(err);
          }).join(', ');
        } else {
          // Last resort: stringify the whole object
          try {
            errorMessage = JSON.stringify(errorData);
          } catch {
            errorMessage = String(errorData);
          }
        }
      }
      
      throw new Error(`Failed to initiate call: ${errorMessage}`);
    }
  }
};

