import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fileStorage } from '../config/storage';
import { elevenLabsService } from '../services/elevenlabs';
import { createError } from '../middleware/errorHandler';

export const agentsRouter = Router();
agentsRouter.use(authenticate);

// Get all agents (sync with ElevenLabs)
agentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;

    // Fetch from ElevenLabs
    const elevenLabsAgents = await elevenLabsService.getAgents();

    // Get local agent records
    const localAgents = fileStorage.getAgents(builderId);

    // Merge ElevenLabs data with local customizations
    const agents = elevenLabsAgents.map((elevenAgent) => {
      // Ensure agent_id is preserved - handle different field names from ElevenLabs API
      const agentId = elevenAgent.agent_id || (elevenAgent as any).id || (elevenAgent as any).agentId;
      
      const localAgent = localAgents.find(
        (a: any) => a.eleven_agent_id === agentId
      );
      
      const mergedAgent = {
        ...elevenAgent,
        // Ensure agent_id is always present
        agent_id: agentId,
        ...(localAgent && {
          custom_name: localAgent.name,
          tone: localAgent.tone,
          personality: localAgent.personality
        })
      };
      
      console.log('Merged agent:', {
        agent_id: mergedAgent.agent_id,
        name: mergedAgent.name,
        has_custom_name: !!mergedAgent.custom_name
      });
      
      return mergedAgent;
    });

    console.log(`Returning ${agents.length} agents to frontend`);
    res.json({ status: 'success', agents });
  } catch (error) {
    next(error);
  }
});

// Get single agent
agentsRouter.get('/:agentId', async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.params;
    const builderId = req.user!.builderId;

    const agent = await elevenLabsService.getAgent(agentId);

    // Get local customization
    const localAgents = fileStorage.getAgents(builderId);
    const localAgent = localAgents.find(
        (a: any) => a.eleven_agent_id === agentId
      );

    res.json({
      status: 'success',
      agent: {
        ...agent,
        ...(localAgent && {
          custom_name: localAgent.name,
          tone: localAgent.tone,
          personality: localAgent.personality
        })
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create agent (customize existing ElevenLabs agent)
agentsRouter.post('/create', async (req: AuthRequest, res, next) => {
  try {
    const { eleven_agent_id, name, tone, personality, agent_type } = req.body;
    const builderId = req.user!.builderId;

    if (!eleven_agent_id || !name) {
      throw createError('eleven_agent_id and name are required', 400);
    }

    // Validate agent_type
    if (agent_type && !['inbound', 'outbound'].includes(agent_type)) {
      throw createError('agent_type must be either "inbound" or "outbound"', 400);
    }

    // Verify agent exists in ElevenLabs
    await elevenLabsService.getAgent(eleven_agent_id);

    // Store customization in local storage
    const agent = fileStorage.createAgent({
      builder_id: builderId,
      eleven_agent_id,
      name,
      tone: tone || 'friendly',
      personality: personality || null,
      agent_type: agent_type || 'outbound' // Default to outbound
    });

    res.status(201).json({ status: 'success', agent });
  } catch (error) {
    next(error);
  }
});

// Update agent customization
agentsRouter.patch('/:agentId', async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.params;
    const { name, tone, personality, agent_type } = req.body;
    const builderId = req.user!.builderId;

    // Validate agent_type if provided
    if (agent_type && !['inbound', 'outbound'].includes(agent_type)) {
      throw createError('agent_type must be either "inbound" or "outbound"', 400);
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (tone) updates.tone = tone;
    if (personality !== undefined) updates.personality = personality;
    if (agent_type) updates.agent_type = agent_type;

    const agent = fileStorage.updateAgent(agentId, builderId, updates);
    if (!agent) {
      throw createError('Agent not found', 404);
    }

    res.json({ status: 'success', agent });
  } catch (error) {
    next(error);
  }
});

// Delete agent (remove from local storage, optionally delete from ElevenLabs)
agentsRouter.delete('/:agentId', async (req: AuthRequest, res, next) => {
  try {
    const { agentId } = req.params;
    const { deleteFromElevenLabs } = req.query;
    const builderId = req.user!.builderId;

    // Delete from local storage
    fileStorage.deleteAgent(agentId, builderId);

    // Optionally delete from ElevenLabs
    if (deleteFromElevenLabs === 'true') {
      await elevenLabsService.deleteAgent(agentId);
    }

    res.json({ status: 'success', message: 'Agent deleted' });
  } catch (error) {
    next(error);
  }
});
