/**
 * Tenants Routes
 * Handles tenant CRUD operations using CSV storage
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { csvStorage } from '../config/csvStorage';
import { createError } from '../middleware/errorHandler';

export const tenantsRouter = Router();
tenantsRouter.use(authenticate);

// Get all tenants
tenantsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { phone, city } = req.query;
    
    const filters: any = {};
    if (phone) filters.phone = phone as string;
    if (city) filters.city = city as string;

    const tenants = await csvStorage.getTenants(filters);
    
    res.json({ 
      status: 'success', 
      tenants,
      count: tenants.length 
    });
  } catch (error) {
    next(error);
  }
});

// Get tenant by ID
tenantsRouter.get('/:tenantId', async (req: AuthRequest, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await csvStorage.getTenantById(tenantId);
    
    if (!tenant) {
      throw createError('Tenant not found', 404);
    }
    
    res.json({ status: 'success', tenant });
  } catch (error) {
    next(error);
  }
});

// Get tenant by phone
tenantsRouter.get('/phone/:phone', async (req: AuthRequest, res, next) => {
  try {
    const { phone } = req.params;
    const tenant = await csvStorage.getTenantByPhone(phone);
    
    if (!tenant) {
      throw createError('Tenant not found', 404);
    }
    
    res.json({ status: 'success', tenant });
  } catch (error) {
    next(error);
  }
});

// Create tenant
tenantsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const tenantData = {
      ...req.body,
      source: req.body.source || 'app',
      consent_timestamp: req.body.consent_timestamp || new Date().toISOString(),
      consent_scope: req.body.consent_scope || 'contact'
    };

    const tenant = await csvStorage.createTenant(tenantData);
    
    // Also append to backend/database/tenants.csv
    try {
      const fs = require('fs');
      const path = require('path');
      const databaseTenantsPath = path.join(process.cwd(), 'database', 'tenants.csv');
      
      // Ensure database directory exists
      const databaseDir = path.join(process.cwd(), 'database');
      if (!fs.existsSync(databaseDir)) {
        fs.mkdirSync(databaseDir, { recursive: true });
      }
      
      // Format: Name, Mobile, Locality, Budget, BHKtype, Must Need amenities, Others
      const newLine = [
        tenant.name || '',
        tenant.phone || '',
        tenant.localities || '',
        tenant.budget_max || tenant.budget_min || '',
        tenant.bedrooms ? `${tenant.bedrooms} BHK` : '',
        tenant.amenities || '',
        tenant.preferences ? (JSON.parse(tenant.preferences).others || '') : ''
      ].map(field => {
        const fieldStr = String(field || '');
        // Escape quotes and wrap in quotes
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }).join(',');
      
      if (fs.existsSync(databaseTenantsPath)) {
        // Append to existing file
        fs.appendFileSync(databaseTenantsPath, '\n' + newLine);
      } else {
        // Create new file with header
        const header = 'Name,Mobile,Locality,Budget,BHKtype,Must Need amenities,Others\n';
        fs.writeFileSync(databaseTenantsPath, header + newLine);
      }
    } catch (error) {
      console.error('Error writing to database/tenants.csv:', error);
      // Continue even if this fails
    }
    
    res.status(201).json({ 
      status: 'success', 
      tenant 
    });
  } catch (error) {
    next(error);
  }
});

// Update tenant
tenantsRouter.put('/:tenantId', async (req: AuthRequest, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await csvStorage.getTenantById(tenantId);
    
    if (!tenant) {
      throw createError('Tenant not found', 404);
    }

    const updatedTenant = await csvStorage.updateTenant(tenantId, req.body);
    
    res.json({ 
      status: 'success', 
      tenant: updatedTenant 
    });
  } catch (error) {
    next(error);
  }
});

