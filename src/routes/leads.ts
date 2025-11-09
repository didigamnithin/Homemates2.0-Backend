/**
 * Leads Routes
 * Handles lead management for owners
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { csvStorage } from '../config/csvStorage';
import { createError } from '../middleware/errorHandler';

export const leadsRouter = Router();
leadsRouter.use(authenticate);

// Get all leads (show tenants.csv as leads)
leadsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { owner_id, tenant_id, property_id, status } = req.query;
    
    // Get all tenants as leads
    const tenants = await csvStorage.getTenants();
    
    // Get owner's properties for matching
    let ownerProperties: any[] = [];
    if (owner_id) {
      ownerProperties = await csvStorage.getProperties({ owner_id: owner_id as string });
    } else {
      // Get all properties for matching
      ownerProperties = await csvStorage.getProperties();
    }
    
    // Convert tenants to leads format (show all leads regardless of matching)
    const leads = tenants.map((tenant) => {
      // Find matching properties based on tenant requirements (for display only)
      const matchingProperties = ownerProperties.filter((prop) => {
        let matches = 0;
        
        // Match locality (nearby matching)
        if (tenant.localities && prop.locality) {
          const tenantLocalities = tenant.localities.toLowerCase().split(',').map((l: string) => l.trim());
          const propLocality = prop.locality.toLowerCase();
          if (tenantLocalities.some((loc: string) => propLocality.includes(loc) || loc.includes(propLocality))) {
            matches++;
          }
        }
        
        // Match budget (within ±20%)
        if (tenant.budget_min && tenant.budget_max && prop.rent) {
          const tenantMin = parseFloat(tenant.budget_min);
          const tenantMax = parseFloat(tenant.budget_max);
          const propRent = parseFloat(prop.rent);
          const budgetRange = (tenantMax - tenantMin) * 0.2; // 20% range
          if (propRent >= tenantMin - budgetRange && propRent <= tenantMax + budgetRange) {
            matches++;
          }
        }
        
        // Match bedrooms
        if (tenant.bedrooms && prop.bedrooms) {
          if (tenant.bedrooms === prop.bedrooms) {
            matches++;
          }
        }
        
        // Match amenities (if any amenity matches)
        if (tenant.amenities && prop.amenities) {
          const tenantAmenities = tenant.amenities.toLowerCase().split(',').map((a: string) => a.trim());
          const propAmenities = prop.amenities.toLowerCase().split(',').map((a: string) => a.trim());
          if (tenantAmenities.some((amenity: string) => propAmenities.includes(amenity))) {
            matches++;
          }
        }
        
        // Return true if at least one match (relaxed matching)
        return matches > 0;
      });
      
      // Calculate match score (percentage of matching criteria)
      const matchScore = matchingProperties.length > 0 
        ? Math.min(0.9, 0.5 + (matchingProperties.length * 0.1))
        : 0.3;
      
      // Get the best matching property (if any)
      const bestMatch = matchingProperties[0] || null;
      
      return {
        lead_id: tenant.tenant_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: tenant.tenant_id,
        property_id: bestMatch?.property_id || '',
        property_code: bestMatch?.property_code || '',
        channel: 'tenant_csv',
        transcript: '',
        call_recording_url: '',
        match_score: matchScore.toString(),
        status: status as string || 'new',
        owner_notified: 'false',
        created_at: tenant.created_at || new Date().toISOString(),
        updated_at: tenant.updated_at || new Date().toISOString(),
        tenant: {
          tenant_id: tenant.tenant_id,
          name: tenant.name,
          phone: tenant.phone,
          whatsapp_number: tenant.whatsapp_number,
          email: tenant.email,
          city: tenant.city,
          localities: tenant.localities,
          budget_min: tenant.budget_min,
          budget_max: tenant.budget_max,
          bedrooms: tenant.bedrooms,
          amenities: tenant.amenities
        },
        property: bestMatch ? {
          property_id: bestMatch.property_id,
          property_code: bestMatch.property_code,
          title: bestMatch.title,
          locality: bestMatch.locality,
          rent: bestMatch.rent,
          bedrooms: bestMatch.bedrooms,
          area_sqft: bestMatch.area_sqft,
          amenities: bestMatch.amenities
        } : null,
        matching_properties_count: matchingProperties.length
      };
    });
    
    // Filter by status if provided
    let filteredLeads = leads;
    if (status) {
      filteredLeads = leads.filter((lead) => lead.status === status);
    }
    
    // Sort by created_at (newest first) - show all leads regardless of matching
    filteredLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    res.json({ 
      status: 'success', 
      leads: filteredLeads,
      count: filteredLeads.length 
    });
  } catch (error) {
    next(error);
  }
});

// Get lead by ID
leadsRouter.get('/:leadId', async (req: AuthRequest, res, next) => {
  try {
    const { leadId } = req.params;
    const lead = await csvStorage.getLeadById(leadId);
    
    if (!lead) {
      throw createError('Lead not found', 404);
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
      lead: {
        ...lead,
        tenant,
        property
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create lead
leadsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const leadData = {
      ...req.body,
      status: req.body.status || 'new',
      owner_notified: req.body.owner_notified || 'false'
    };

    const lead = await csvStorage.createLead(leadData);
    
    res.status(201).json({ 
      status: 'success', 
      lead 
    });
  } catch (error) {
    next(error);
  }
});

// Update lead
leadsRouter.put('/:leadId', async (req: AuthRequest, res, next) => {
  try {
    const { leadId } = req.params;
    const lead = await csvStorage.getLeadById(leadId);
    
    if (!lead) {
      throw createError('Lead not found', 404);
    }

    const updatedLead = await csvStorage.updateLead(leadId, req.body);
    
    res.json({ 
      status: 'success', 
      lead: updatedLead 
    });
  } catch (error) {
    next(error);
  }
});

// Claim lead (for owners)
leadsRouter.post('/:leadId/claim', async (req: AuthRequest, res, next) => {
  try {
    const { leadId } = req.params;
    const { owner_user_id } = req.body;
    
    const lead = await csvStorage.getLeadById(leadId);
    if (!lead) {
      throw createError('Lead not found', 404);
    }

    const updatedLead = await csvStorage.updateLead(leadId, {
      status: 'claimed',
      owner_user_id: owner_user_id || req.user!.id,
      owner_notified: 'true'
    });
    
    res.json({ 
      status: 'success', 
      lead: updatedLead,
      message: 'Lead claimed successfully'
    });
  } catch (error) {
    next(error);
  }
});

