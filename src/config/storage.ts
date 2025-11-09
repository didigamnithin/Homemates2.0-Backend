import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const CALLS_FILE = path.join(DATA_DIR, 'calls.json');
const BRAND_GUIDES_FILE = path.join(DATA_DIR, 'brand_guides.json');
const INTEGRATIONS_FILE = path.join(DATA_DIR, 'integrations.json');
const DATASETS_FILE = path.join(DATA_DIR, 'datasets.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
const initFile = (filePath: string, defaultValue: any[] = []) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
};

initFile(USERS_FILE, []);
initFile(AGENTS_FILE, []);
initFile(CALLS_FILE, []);
initFile(BRAND_GUIDES_FILE, []);
initFile(INTEGRATIONS_FILE, []);
initFile(DATASETS_FILE, []);

// Helper functions for file operations
export const fileStorage = {
  // Users
  getUsers: (): any[] => {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  getUserByEmail: (email: string) => {
    const users = fileStorage.getUsers();
    return users.find(u => u.email === email);
  },

  getUserById: (id: string) => {
    const users = fileStorage.getUsers();
    return users.find(u => u.id === id);
  },

  createUser: async (userData: { email: string; password: string; name: string; company_name?: string; phone?: string; user_type?: string }) => {
    const users = fileStorage.getUsers();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newUser = {
      id,
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      company_name: userData.company_name || null,
      phone: userData.phone || null,
      user_type: userData.user_type || 'tenant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return newUser;
  },

  verifyPassword: async (password: string, hashedPassword: string) => {
    return bcrypt.compare(password, hashedPassword);
  },

  // Agents
  getAgents: (builderId: string) => {
    try {
      const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
      const agents = JSON.parse(data);
      return agents.filter((a: any) => a.builder_id === builderId);
    } catch {
      return [];
    }
  },

  createAgent: (agentData: any) => {
    const agents = fileStorage.getAgents(agentData.builder_id);
    const id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAgent = {
      id,
      ...agentData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const allAgents = fileStorage.getAllAgents();
    allAgents.push(newAgent);
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(allAgents, null, 2));
    return newAgent;
  },

  getAllAgents: () => {
    try {
      const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  updateAgent: (agentId: string, builderId: string, updates: any) => {
    const allAgents = fileStorage.getAllAgents();
    const index = allAgents.findIndex((a: any) => a.eleven_agent_id === agentId && a.builder_id === builderId);
    if (index === -1) return null;
    
    allAgents[index] = {
      ...allAgents[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(allAgents, null, 2));
    return allAgents[index];
  },

  deleteAgent: (agentId: string, builderId: string) => {
    const allAgents = fileStorage.getAllAgents();
    const filtered = allAgents.filter((a: any) => !(a.eleven_agent_id === agentId && a.builder_id === builderId));
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(filtered, null, 2));
    return true;
  },

  // Calls
  getCalls: (builderId: string, agentId?: string) => {
    try {
      const data = fs.readFileSync(CALLS_FILE, 'utf-8');
      let calls = JSON.parse(data);
      calls = calls.filter((c: any) => c.builder_id === builderId);
      if (agentId) {
        calls = calls.filter((c: any) => c.agent_id === agentId);
      }
      return calls.sort((a: any, b: any) => 
        new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime()
      );
    } catch {
      return [];
    }
  },

  getCallById: (callId: string, builderId: string) => {
    const calls = fileStorage.getCalls(builderId);
    return calls.find((c: any) => c.id === callId);
  },

  createCall: (callData: any) => {
    const allCalls = fileStorage.getAllCalls();
    const id = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCall = {
      id,
      ...callData,
      created_at: new Date().toISOString()
    };
    allCalls.push(newCall);
    fs.writeFileSync(CALLS_FILE, JSON.stringify(allCalls, null, 2));
    return newCall;
  },

  getAllCalls: () => {
    try {
      const data = fs.readFileSync(CALLS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  updateCall: (conversationId: string, updates: any) => {
    const allCalls = fileStorage.getAllCalls();
    const index = allCalls.findIndex((c: any) => c.conversation_id === conversationId);
    if (index === -1) return null;
    
    allCalls[index] = {
      ...allCalls[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(CALLS_FILE, JSON.stringify(allCalls, null, 2));
    return allCalls[index];
  },

  // Brand Guides
  getBrandGuide: (builderId: string) => {
    try {
      const data = fs.readFileSync(BRAND_GUIDES_FILE, 'utf-8');
      const guides = JSON.parse(data);
      return guides.find((g: any) => g.builder_id === builderId) || null;
    } catch {
      return null;
    }
  },

  upsertBrandGuide: (guideData: any) => {
    const allGuides = fileStorage.getAllBrandGuides();
    const index = allGuides.findIndex((g: any) => g.builder_id === guideData.builder_id);
    
    if (index === -1) {
      const id = `brand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newGuide = {
        id,
        ...guideData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      allGuides.push(newGuide);
      fs.writeFileSync(BRAND_GUIDES_FILE, JSON.stringify(allGuides, null, 2));
      return newGuide;
    } else {
      allGuides[index] = {
        ...allGuides[index],
        ...guideData,
        updated_at: new Date().toISOString()
      };
      fs.writeFileSync(BRAND_GUIDES_FILE, JSON.stringify(allGuides, null, 2));
      return allGuides[index];
    }
  },

  getAllBrandGuides: () => {
    try {
      const data = fs.readFileSync(BRAND_GUIDES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  // Integrations
  getIntegrations: (builderId: string) => {
    try {
      const data = fs.readFileSync(INTEGRATIONS_FILE, 'utf-8');
      const integrations = JSON.parse(data);
      return integrations.filter((i: any) => i.builder_id === builderId);
    } catch {
      return [];
    }
  },

  getIntegration: (builderId: string, toolType: string) => {
    const integrations = fileStorage.getIntegrations(builderId);
    return integrations.find((i: any) => i.tool_type === toolType);
  },

  upsertIntegration: (integrationData: any) => {
    const allIntegrations = fileStorage.getAllIntegrations();
    const index = allIntegrations.findIndex(
      (i: any) => i.builder_id === integrationData.builder_id && i.tool_type === integrationData.tool_type
    );
    
    if (index === -1) {
      const id = `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newIntegration = {
        id,
        ...integrationData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      allIntegrations.push(newIntegration);
      fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(allIntegrations, null, 2));
      return newIntegration;
    } else {
      allIntegrations[index] = {
        ...allIntegrations[index],
        ...integrationData,
        updated_at: new Date().toISOString()
      };
      fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(allIntegrations, null, 2));
      return allIntegrations[index];
    }
  },

  getAllIntegrations: () => {
    try {
      const data = fs.readFileSync(INTEGRATIONS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  deleteIntegration: (builderId: string, toolType: string) => {
    const allIntegrations = fileStorage.getAllIntegrations();
    const filtered = allIntegrations.filter(
      (i: any) => !(i.builder_id === builderId && i.tool_type === toolType)
    );
    fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(filtered, null, 2));
    return true;
  },

  // Datasets
  getDatasets: (builderId: string) => {
    try {
      const data = fs.readFileSync(DATASETS_FILE, 'utf-8');
      const datasets = JSON.parse(data);
      return datasets.filter((d: any) => d.builder_id === builderId)
        .sort((a: any, b: any) => 
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
    } catch {
      return [];
    }
  },

  getDatasetById: (datasetId: string, builderId: string) => {
    const datasets = fileStorage.getDatasets(builderId);
    return datasets.find((d: any) => d.id === datasetId);
  },

  createDataset: (datasetData: any) => {
    const allDatasets = fileStorage.getAllDatasets();
    const id = `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDataset = {
      id,
      ...datasetData,
      uploaded_at: new Date().toISOString()
    };
    allDatasets.push(newDataset);
    fs.writeFileSync(DATASETS_FILE, JSON.stringify(allDatasets, null, 2));
    return newDataset;
  },

  getAllDatasets: () => {
    try {
      const data = fs.readFileSync(DATASETS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  deleteDataset: (datasetId: string, builderId: string) => {
    const allDatasets = fileStorage.getAllDatasets();
    const filtered = allDatasets.filter(
      (d: any) => !(d.id === datasetId && d.builder_id === builderId)
    );
    fs.writeFileSync(DATASETS_FILE, JSON.stringify(filtered, null, 2));
    return true;
  }
};

