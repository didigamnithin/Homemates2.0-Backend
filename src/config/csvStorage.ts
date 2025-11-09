import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

const DATA_DIR = path.join(process.cwd(), 'database');
const PROPERTIES_CSV = path.join(DATA_DIR, 'flats.csv');
const TENANTS_CSV = path.join(DATA_DIR, 'tenants.csv');
const LEADS_CSV = path.join(DATA_DIR, 'leads.csv');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize CSV files with headers if they don't exist
const initCSV = (filePath: string, headers: string[]) => {
  if (!fs.existsSync(filePath)) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers.map(h => ({ id: h, title: h }))
    });
    // Write empty file with headers
    csvWriter.writeRecords([]);
  }
};

// Initialize CSV files
initCSV(PROPERTIES_CSV, [
  'property_id', 'property_code', 'title', 'address', 'city', 'locality', 
  'rent', 'available_from', 'bedrooms', 'bathrooms', 'area_sqft', 
  'amenities', 'furnishing', 'status', 'owner_id', 'owner_name', 
  'owner_phone', 'description', 'photos', 'created_at', 'updated_at'
]);

initCSV(TENANTS_CSV, [
  'tenant_id', 'name', 'phone', 'whatsapp_number', 'email', 
  'city', 'localities', 'budget_min', 'budget_max', 
  'move_in_date', 'bedrooms', 'amenities', 'preferences', 
  'source', 'consent_timestamp', 'consent_scope', 'created_at', 'updated_at'
]);

initCSV(LEADS_CSV, [
  'lead_id', 'tenant_id', 'property_id', 'property_code', 
  'channel', 'call_recording_url', 'transcript', 'nlp_extracted', 
  'match_score', 'owner_notified', 'status', 'created_at', 'updated_at'
]);

// Helper function to read CSV file
async function readCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    if (!fs.existsSync(filePath)) {
      resolve([]);
      return;
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Helper function to write CSV file
async function writeCSV<T extends Record<string, any>>(filePath: string, data: T[], headers: string[]): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h, title: h }))
  });
  await csvWriter.writeRecords(data);
}

// Helper function to append to CSV
async function appendCSV<T extends Record<string, any>>(filePath: string, data: T, headers: string[]): Promise<void> {
  const existing = await readCSV<T>(filePath);
  existing.push(data);
  await writeCSV(filePath, existing, headers);
}

// Helper function to map flats.csv format to property structure
function mapFlatsToProperty(data: any): any {
  // Handle both formats: new format (property_code, title, etc.) and old format (Name, Mobile, etc.)
  if (data.property_code || data.property_id) {
    // Already in new format
    return data;
  }
  
  // Map from old format (Name, Mobile, Locality, Budget, BHKtype, Amenities, SFT)
  return {
    property_id: data.property_id || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    property_code: data.property_code || data['Code'] || `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: data.title || data['Name'] || '',
    address: data.address || '',
    city: data.city || 'Hyderabad',
    locality: data.locality || data['Locality'] || '',
    rent: data.rent || data['Budget'] || data['Price'] || '',
    available_from: data.available_from || new Date().toISOString().split('T')[0],
    bedrooms: data.bedrooms || data['BHKtype']?.replace(' BHK', '')?.replace('BHK', '') || '',
    bathrooms: data.bathrooms || '',
    area_sqft: data.area_sqft || data['SFT'] || '',
    amenities: data.amenities || data['Amenities'] || '',
    furnishing: data.furnishing || '',
    status: data.status || 'available',
    owner_id: data.owner_id || '',
    owner_name: data.owner_name || '',
    owner_phone: data.owner_phone || data['Mobile'] || '',
    description: data.description || '',
    photos: data.photos || '',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString()
  };
}

// Helper function to map tenants.csv format to tenant structure
function mapTenantsToTenant(data: any): any {
  // Handle both formats: new format (tenant_id, name, etc.) and old format (Name, Mobile, etc.)
  if (data.tenant_id) {
    // Already in new format
    return data;
  }
  
  // Map from old format (Name, Mobile, Locality, Budget, BHKtype, Must Need amenities, Others)
  return {
    tenant_id: data.tenant_id || `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: data.name || data['Name'] || '',
    phone: data.phone || data['Mobile'] || '',
    whatsapp_number: data.whatsapp_number || data.phone || data['Mobile'] || '',
    email: data.email || '',
    city: data.city || 'Hyderabad',
    localities: data.localities || data['Locality'] || '',
    budget_min: data.budget_min || data['Budget']?.split('-')[0]?.trim() || '',
    budget_max: data.budget_max || data['Budget']?.split('-')[1]?.trim() || data['Budget'] || '',
    move_in_date: data.move_in_date || '',
    bedrooms: data.bedrooms || data['BHKtype']?.replace(' BHK', '')?.replace('BHK', '') || '',
    amenities: data.amenities || data['Must Need amenities'] || '',
    preferences: data.preferences || data['Others'] || '',
    source: data.source || 'call',
    consent_timestamp: data.consent_timestamp || new Date().toISOString(),
    consent_scope: data.consent_scope || 'contact',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString()
  };
}

export const csvStorage = {
  // Properties
  async getProperties(filters?: { owner_id?: string; city?: string; status?: string }): Promise<any[]> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    // Map to standard format
    const mappedProperties = properties.map(mapFlatsToProperty);
    let filtered = mappedProperties;
    
    if (filters?.owner_id) {
      filtered = filtered.filter(p => p.owner_id === filters.owner_id);
    }
    if (filters?.city) {
      filtered = filtered.filter(p => p.city?.toLowerCase() === filters.city?.toLowerCase());
    }
    if (filters?.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    
    return filtered;
  },

  async getPropertyById(propertyId: string): Promise<any | null> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    const mappedProperties = properties.map(mapFlatsToProperty);
    return mappedProperties.find(p => p.property_id === propertyId) || null;
  },

  async getPropertyByCode(propertyCode: string): Promise<any | null> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    const mappedProperties = properties.map(mapFlatsToProperty);
    return mappedProperties.find(p => p.property_code?.toLowerCase() === propertyCode?.toLowerCase()) || null;
  },

  async createProperty(propertyData: any): Promise<any> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    // Map existing properties to standard format
    const mappedProperties = properties.map(mapFlatsToProperty);
    const propertyId = propertyData.property_id || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newProperty = {
      property_id: propertyId,
      property_code: propertyData.property_code || '',
      title: propertyData.title || '',
      address: propertyData.address || '',
      city: propertyData.city || '',
      locality: propertyData.locality || '',
      rent: propertyData.rent || '',
      available_from: propertyData.available_from || '',
      bedrooms: propertyData.bedrooms || '',
      bathrooms: propertyData.bathrooms || '',
      area_sqft: propertyData.area_sqft || '',
      amenities: typeof propertyData.amenities === 'string' ? propertyData.amenities : (Array.isArray(propertyData.amenities) ? propertyData.amenities.join(', ') : ''),
      furnishing: propertyData.furnishing || '',
      status: propertyData.status || 'available',
      owner_id: propertyData.owner_id || '',
      owner_name: propertyData.owner_name || '',
      owner_phone: propertyData.owner_phone || '',
      description: propertyData.description || '',
      photos: typeof propertyData.photos === 'string' ? propertyData.photos : (Array.isArray(propertyData.photos) ? propertyData.photos.join(', ') : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mappedProperties.push(newProperty);
    await writeCSV(PROPERTIES_CSV, mappedProperties, [
      'property_id', 'property_code', 'title', 'address', 'city', 'locality', 
      'rent', 'available_from', 'bedrooms', 'bathrooms', 'area_sqft', 
      'amenities', 'furnishing', 'status', 'owner_id', 'owner_name', 
      'owner_phone', 'description', 'photos', 'created_at', 'updated_at'
    ]);
    
    return newProperty;
  },

  async updateProperty(propertyId: string, updates: any): Promise<any | null> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    // Map existing properties to standard format
    const mappedProperties = properties.map(mapFlatsToProperty);
    const index = mappedProperties.findIndex(p => p.property_id === propertyId);
    if (index === -1) return null;
    
    mappedProperties[index] = {
      ...mappedProperties[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await writeCSV(PROPERTIES_CSV, mappedProperties, [
      'property_id', 'property_code', 'title', 'address', 'city', 'locality', 
      'rent', 'available_from', 'bedrooms', 'bathrooms', 'area_sqft', 
      'amenities', 'furnishing', 'status', 'owner_id', 'owner_name', 
      'owner_phone', 'description', 'photos', 'created_at', 'updated_at'
    ]);
    
    return properties[index];
  },

  async deleteProperty(propertyId: string): Promise<boolean> {
    const properties = await readCSV<any>(PROPERTIES_CSV);
    // Map existing properties to standard format
    const mappedProperties = properties.map(mapFlatsToProperty);
    const filtered = mappedProperties.filter(p => p.property_id !== propertyId);
    await writeCSV(PROPERTIES_CSV, filtered, [
      'property_id', 'property_code', 'title', 'address', 'city', 'locality', 
      'rent', 'available_from', 'bedrooms', 'bathrooms', 'area_sqft', 
      'amenities', 'furnishing', 'status', 'owner_id', 'owner_name', 
      'owner_phone', 'description', 'photos', 'created_at', 'updated_at'
    ]);
    return true;
  },

  // Tenants
  async getTenants(filters?: { phone?: string; city?: string }): Promise<any[]> {
    const tenants = await readCSV<any>(TENANTS_CSV);
    // Map to standard format
    const mappedTenants = tenants.map(mapTenantsToTenant);
    let filtered = mappedTenants;
    
    if (filters?.phone) {
      filtered = filtered.filter(t => {
        const tPhone = (t.phone || '').replace(/[\s\+\-\(\)]/g, '');
        const tWhatsapp = (t.whatsapp_number || '').replace(/[\s\+\-\(\)]/g, '');
        const filterPhone = filters.phone!.replace(/[\s\+\-\(\)]/g, '');
        return tPhone === filterPhone || tWhatsapp === filterPhone;
      });
    }
    if (filters?.city) {
      filtered = filtered.filter(t => t.city?.toLowerCase() === filters.city?.toLowerCase());
    }
    
    return filtered;
  },

  async getTenantById(tenantId: string): Promise<any | null> {
    const tenants = await readCSV<any>(TENANTS_CSV);
    const mappedTenants = tenants.map(mapTenantsToTenant);
    return mappedTenants.find(t => t.tenant_id === tenantId) || null;
  },

  async getTenantByPhone(phone: string): Promise<any | null> {
    const tenants = await readCSV<any>(TENANTS_CSV);
    const mappedTenants = tenants.map(mapTenantsToTenant);
    let normalizedPhone = phone.replace(/[\s\+\-\(\)]/g, '');
    // Remove leading 0 if present (e.g., 07095288950 -> 7095288950)
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    return mappedTenants.find(t => {
      let tPhone = (t.phone || '').replace(/[\s\+\-\(\)]/g, '');
      let tWhatsapp = (t.whatsapp_number || '').replace(/[\s\+\-\(\)]/g, '');
      // Remove leading 0 if present
      if (tPhone.startsWith('0')) {
        tPhone = tPhone.substring(1);
      }
      if (tWhatsapp.startsWith('0')) {
        tWhatsapp = tWhatsapp.substring(1);
      }
      return tPhone === normalizedPhone || tWhatsapp === normalizedPhone || tPhone === phone || tWhatsapp === phone;
    }) || null;
  },

  async createTenant(tenantData: any): Promise<any> {
    const tenants = await readCSV<any>(TENANTS_CSV);
    // Map existing tenants to standard format
    const mappedTenants = tenants.map(mapTenantsToTenant);
    const tenantId = tenantData.tenant_id || `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newTenant = {
      tenant_id: tenantId,
      name: tenantData.name || '',
      phone: tenantData.phone || '',
      whatsapp_number: tenantData.whatsapp_number || tenantData.phone || '',
      email: tenantData.email || '',
      city: tenantData.city || '',
      localities: typeof tenantData.localities === 'string' ? tenantData.localities : (Array.isArray(tenantData.localities) ? tenantData.localities.join(', ') : ''),
      budget_min: tenantData.budget_min || '',
      budget_max: tenantData.budget_max || '',
      move_in_date: tenantData.move_in_date || '',
      bedrooms: tenantData.bedrooms || '',
      amenities: typeof tenantData.amenities === 'string' ? tenantData.amenities : (Array.isArray(tenantData.amenities) ? tenantData.amenities.join(', ') : ''),
      preferences: typeof tenantData.preferences === 'string' ? tenantData.preferences : JSON.stringify(tenantData.preferences || {}),
      source: tenantData.source || 'call',
      consent_timestamp: tenantData.consent_timestamp || new Date().toISOString(),
      consent_scope: typeof tenantData.consent_scope === 'string' ? tenantData.consent_scope : (Array.isArray(tenantData.consent_scope) ? tenantData.consent_scope.join(', ') : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mappedTenants.push(newTenant);
    await writeCSV(TENANTS_CSV, mappedTenants, [
      'tenant_id', 'name', 'phone', 'whatsapp_number', 'email', 
      'city', 'localities', 'budget_min', 'budget_max', 
      'move_in_date', 'bedrooms', 'amenities', 'preferences', 
      'source', 'consent_timestamp', 'consent_scope', 'created_at', 'updated_at'
    ]);
    
    return newTenant;
  },

  async updateTenant(tenantId: string, updates: any): Promise<any | null> {
    const tenants = await readCSV<any>(TENANTS_CSV);
    // Map existing tenants to standard format
    const mappedTenants = tenants.map(mapTenantsToTenant);
    const index = mappedTenants.findIndex(t => t.tenant_id === tenantId);
    if (index === -1) return null;
    
    mappedTenants[index] = {
      ...mappedTenants[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await writeCSV(TENANTS_CSV, mappedTenants, [
      'tenant_id', 'name', 'phone', 'whatsapp_number', 'email', 
      'city', 'localities', 'budget_min', 'budget_max', 
      'move_in_date', 'bedrooms', 'amenities', 'preferences', 
      'source', 'consent_timestamp', 'consent_scope', 'created_at', 'updated_at'
    ]);
    
    return tenants[index];
  },

  // Leads
  async getLeads(filters?: { owner_id?: string; tenant_id?: string; property_id?: string; status?: string }): Promise<any[]> {
    const leads = await readCSV<any>(LEADS_CSV);
    let filtered = leads;
    
    if (filters?.tenant_id) {
      filtered = filtered.filter(l => l.tenant_id === filters.tenant_id);
    }
    if (filters?.property_id) {
      filtered = filtered.filter(l => l.property_id === filters.property_id);
    }
    if (filters?.status) {
      filtered = filtered.filter(l => l.status === filters.status);
    }
    
    // If owner_id filter, need to join with properties
    if (filters?.owner_id) {
      const properties = await this.getProperties({ owner_id: filters.owner_id });
      const propertyIds = properties.map(p => p.property_id);
      filtered = filtered.filter(l => propertyIds.includes(l.property_id));
    }
    
    return filtered.sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  },

  async getLeadById(leadId: string): Promise<any | null> {
    const leads = await readCSV<any>(LEADS_CSV);
    return leads.find(l => l.lead_id === leadId) || null;
  },

  async createLead(leadData: any): Promise<any> {
    const leads = await readCSV<any>(LEADS_CSV);
    const leadId = leadData.lead_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newLead = {
      lead_id: leadId,
      tenant_id: leadData.tenant_id || '',
      property_id: leadData.property_id || '',
      property_code: leadData.property_code || '',
      channel: leadData.channel || 'call',
      call_recording_url: leadData.call_recording_url || '',
      transcript: leadData.transcript || '',
      nlp_extracted: typeof leadData.nlp_extracted === 'string' ? leadData.nlp_extracted : JSON.stringify(leadData.nlp_extracted || {}),
      match_score: leadData.match_score || '',
      owner_notified: leadData.owner_notified || 'false',
      status: leadData.status || 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    leads.push(newLead);
    await writeCSV(LEADS_CSV, leads, [
      'lead_id', 'tenant_id', 'property_id', 'property_code', 
      'channel', 'call_recording_url', 'transcript', 'nlp_extracted', 
      'match_score', 'owner_notified', 'status', 'created_at', 'updated_at'
    ]);
    
    return newLead;
  },

  async updateLead(leadId: string, updates: any): Promise<any | null> {
    const leads = await readCSV<any>(LEADS_CSV);
    const index = leads.findIndex(l => l.lead_id === leadId);
    if (index === -1) return null;
    
    leads[index] = {
      ...leads[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await writeCSV(LEADS_CSV, leads, [
      'lead_id', 'tenant_id', 'property_id', 'property_code', 
      'channel', 'call_recording_url', 'transcript', 'nlp_extracted', 
      'match_score', 'owner_notified', 'status', 'created_at', 'updated_at'
    ]);
    
    return leads[index];
  }
};

