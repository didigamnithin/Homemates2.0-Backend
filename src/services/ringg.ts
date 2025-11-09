/**
 * Ringg AI Service
 * Handles outbound calls using Ringg AI API
 */

import axios from 'axios';

const RINGG_API_BASE_URL = 'https://prod-api.ringg.ai/ca/api/v0';
const RINGG_API_KEY = process.env.RINGG_API_KEY || '5d001a13-f975-4baa-a8b6-e61fce1e8e98';
const RINGG_AGENT_ID = process.env.RINGG_AGENT_ID_OUTBOUND || process.env.RINGG_AGENT_ID || '752c2ef5-086d-475a-87ca-c84708d4c49a';
// RINGG_FROM_NUMBER: Default to provided number, can be overridden via environment variable
const RINGG_FROM_NUMBER = process.env.RINGG_FROM_NUMBER || '+918035736726';

export interface OutboundCallParams {
  name: string;
  mobile_number: string;
  agent_id?: string;
  from_number?: string;
  custom_args_values?: {
    [key: string]: string;
  };
  call_config?: {
    idle_timeout_warning?: number;
    idle_timeout_end?: number;
    max_call_length?: number;
    call_retry_config?: {
      retry_count?: number;
      retry_busy?: number;
      retry_not_picked?: number;
      retry_failed?: number;
    };
    call_time?: {
      call_start_time?: string;
      call_end_time?: string;
      timezone?: string;
    };
  };
}

export interface OutboundCallResponse {
  'Call Status': string;
  data: {
    'Unique Call ID': string;
    'Call Direction': string;
    'Call Status': string;
    'From Number': string;
    'To Number': string;
    'Initiated at': string;
    'Agent ID': string;
    message: string;
  };
}

/**
 * Initiate an outbound call using Ringg AI API
 */
export async function initiateOutboundCall(params: OutboundCallParams): Promise<OutboundCallResponse> {
  const requestBody: any = {
    name: params.name,
    mobile_number: params.mobile_number,
    agent_id: params.agent_id || RINGG_AGENT_ID
  };

  // Always include from_number (required by Ringg AI)
  // Use provided from_number, or fall back to default
  const fromNumber = params.from_number || RINGG_FROM_NUMBER;
  if (fromNumber && fromNumber.trim() !== '') {
    requestBody.from_number = fromNumber.trim();
  } else {
    // If no from_number is available, use the default
    requestBody.from_number = RINGG_FROM_NUMBER;
    }

  // Only include custom_args_values if provided and not empty
  if (params.custom_args_values && Object.keys(params.custom_args_values).length > 0) {
    requestBody.custom_args_values = params.custom_args_values;
    }

  // Only include call_config if provided
  if (params.call_config) {
    requestBody.call_config = params.call_config;
  }

  try {
    console.log('Ringg AI API Request:', {
      url: `${RINGG_API_BASE_URL}/calling/outbound/individual`,
      body: requestBody,
        headers: {
        'X-API-KEY': RINGG_API_KEY.substring(0, 10) + '...', // Log partial key for security
          'Content-Type': 'application/json'
        }
      });
      
    const response = await axios.post<OutboundCallResponse>(
      `${RINGG_API_BASE_URL}/calling/outbound/individual`,
      requestBody,
      {
        headers: {
          'X-API-KEY': RINGG_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
    console.log('Ringg AI API Response:', response.data);
    return response.data;
    } catch (error: any) {
    if (error.response) {
      // API returned an error response
      const errorData = error.response.data;
      const errorMessage = errorData?.error?.message || errorData?.message || error.response.statusText;
      const errorCode = errorData?.error?.code || error.response.status;
      
      // Log full error for debugging
      console.error('Ringg AI API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: errorData,
        requestBody: requestBody
      });
      
      throw new Error(
        `Ringg AI API Error (${errorCode}): ${errorMessage}`
      );
    } else if (error.request) {
      // Request was made but no response received
      console.error('Ringg AI API: No response received', error.request);
      throw new Error('Ringg AI API: No response received');
    } else {
      // Something else happened
      console.error('Ringg AI API Error:', error.message);
      throw new Error(`Ringg AI Error: ${error.message}`);
    }
  }
}

