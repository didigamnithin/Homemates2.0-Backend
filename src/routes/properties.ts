/**
 * Properties Routes
 * Handles property CRUD operations using CSV storage
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { csvStorage } from '../config/csvStorage';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

export const propertiesRouter = Router();

// Public endpoint to get available properties (for landing page)
propertiesRouter.get('/public', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const filters: any = { status: 'available' };
    
    let properties = await csvStorage.getProperties(filters);
    
    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      properties = properties.slice(0, limitNum);
    }
    
    res.json({ 
      status: 'success', 
      properties,
      count: properties.length 
    });
  } catch (error) {
    next(error);
  }
});

// Protected routes require authentication
propertiesRouter.use(authenticate);

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/properties/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'text/csv' || file.mimetype === 'application/csv';

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  }
});

// Get all properties
propertiesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { city, status, owner_id, limit } = req.query;
    
    const filters: any = {};
    if (city) filters.city = city as string;
    if (status) filters.status = status as string;
    if (owner_id) filters.owner_id = owner_id as string;

    let properties = await csvStorage.getProperties(filters);
    
    // Limit to 5 properties for owners
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      properties = properties.slice(0, limitNum);
    } else if (owner_id) {
      // Default limit of 5 for owners
      properties = properties.slice(0, 5);
    }
    
    res.json({ 
      status: 'success', 
      properties,
      count: properties.length 
    });
  } catch (error) {
    next(error);
  }
});

// Get matching properties based on tenant requirements
propertiesRouter.get('/match', async (req: AuthRequest, res, next) => {
  try {
    const { city, locality, bedrooms, budget_min, budget_max, amenities } = req.query;
    
    const allProperties = await csvStorage.getProperties({ status: 'available' });
    
    // Relaxed matching - show properties even if only 1 criteria matches
    let matchedProperties = allProperties.filter((property: any) => {
      let matchScore = 0;
      let totalCriteria = 0;
      
      // City match (optional)
      if (city) {
        totalCriteria++;
        if (property.city?.toLowerCase() === (city as string).toLowerCase()) {
          matchScore++;
        }
      }
      
      // Locality match (optional)
      if (locality) {
        totalCriteria++;
        const propertyLocality = property.locality?.toLowerCase() || '';
        const tenantLocalities = (locality as string).toLowerCase().split(',').map((l: string) => l.trim());
        if (tenantLocalities.some((loc: string) => propertyLocality.includes(loc))) {
          matchScore++;
        }
      }
      
      // BHK match (optional)
      if (bedrooms) {
        totalCriteria++;
        if (property.bedrooms === bedrooms) {
          matchScore++;
        }
      }
      
      // Budget match (relaxed - within 20% range)
      if (budget_min || budget_max) {
        totalCriteria++;
        const propertyRent = parseFloat(property.rent) || 0;
        const minBudget = budget_min ? parseFloat(budget_min as string) * 0.8 : 0; // 20% below
        const maxBudget = budget_max ? parseFloat(budget_max as string) * 1.2 : Infinity; // 20% above
        
        if (propertyRent >= minBudget && propertyRent <= maxBudget) {
          matchScore++;
        }
      }
      
      // Amenities match (partial - at least one)
      if (amenities) {
        totalCriteria++;
        const propertyAmenities = (property.amenities || '').toLowerCase();
        const tenantAmenities = (amenities as string).toLowerCase().split(',').map((a: string) => a.trim());
        const hasMatchingAmenity = tenantAmenities.some((amenity: string) => 
          propertyAmenities.includes(amenity)
        );
        if (hasMatchingAmenity) {
          matchScore++;
        }
      }
      
      // Show property if at least 1 criteria matches OR if no criteria specified
      return totalCriteria === 0 || matchScore >= 1;
    });
    
    // Sort by relevance (you can add scoring logic here)
    matchedProperties.sort((a: any, b: any) => {
      const rentA = parseFloat(a.rent) || 0;
      const rentB = parseFloat(b.rent) || 0;
      return rentA - rentB; // Sort by rent ascending
    });
    
    res.json({ 
      status: 'success', 
      properties: matchedProperties,
      count: matchedProperties.length 
    });
  } catch (error) {
    next(error);
  }
});

// Get property by ID
propertiesRouter.get('/:propertyId', async (req: AuthRequest, res, next) => {
  try {
    const { propertyId } = req.params;
    const property = await csvStorage.getPropertyById(propertyId);
    
    if (!property) {
      throw createError('Property not found', 404);
    }
    
    res.json({ status: 'success', property });
  } catch (error) {
    next(error);
  }
});

// Get property by code
propertiesRouter.get('/code/:propertyCode', async (req: AuthRequest, res, next) => {
  try {
    const { propertyCode } = req.params;
    const property = await csvStorage.getPropertyByCode(propertyCode);
    
    if (!property) {
      throw createError('Property not found', 404);
    }
    
    res.json({ status: 'success', property });
  } catch (error) {
    next(error);
  }
});

// Create property
propertiesRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const propertyData = {
      ...req.body,
      owner_id: req.body.owner_id || userId,
      owner_name: req.body.owner_name || req.user!.email,
      status: req.body.status || 'available'
    };

    const property = await csvStorage.createProperty(propertyData);
    
    res.status(201).json({ 
      status: 'success', 
      property 
    });
  } catch (error) {
    next(error);
  }
});

// Update property
propertiesRouter.put('/:propertyId', async (req: AuthRequest, res, next) => {
  try {
    const { propertyId } = req.params;
    const property = await csvStorage.getPropertyById(propertyId);
    
    if (!property) {
      throw createError('Property not found', 404);
    }

    const updatedProperty = await csvStorage.updateProperty(propertyId, req.body);
    
    res.json({ 
      status: 'success', 
      property: updatedProperty 
    });
  } catch (error) {
    next(error);
  }
});

// Delete property
propertiesRouter.delete('/:propertyId', async (req: AuthRequest, res, next) => {
  try {
    const { propertyId } = req.params;
    const property = await csvStorage.getPropertyById(propertyId);
    
    if (!property) {
      throw createError('Property not found', 404);
    }

    await csvStorage.deleteProperty(propertyId);
    
    res.json({ 
      status: 'success', 
      message: 'Property deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

// Upload properties CSV (appends to master flats.csv)
// Also supports reading from database/flats.csv
propertiesRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const file = req.file;
    const { use_database_file } = req.body; // Option to use database/flats.csv

    let properties: any[] = [];

    if (use_database_file === 'true') {
      // Read from backend/database/flats.csv
      const databaseFlatsPath = path.join(process.cwd(), 'database', 'flats.csv');
      
      if (!fs.existsSync(databaseFlatsPath)) {
        throw createError('database/flats.csv file not found', 404);
      }

      await new Promise((resolve, reject) => {
        fs.createReadStream(databaseFlatsPath)
          .pipe(csv())
          .on('data', (data) => {
            // Map database CSV columns to property structure
            const property = {
              property_code: data.property_code || data['Code'] || `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: data.title || data['Name'] || '',
              address: data.address || '',
              city: data.city || 'Hyderabad',
              locality: data.locality || data['Locality'] || '',
              rent: data.rent || data['Budget'] || data['Price'] || '',
              available_from: data.available_from || new Date().toISOString().split('T')[0],
              bedrooms: data.bedrooms || data['BHKtype']?.replace(' BHK', '') || '',
              bathrooms: data.bathrooms || '',
              area_sqft: data.area_sqft || data['SFT'] || '',
              amenities: data.amenities || data['Amenities'] || '',
              furnishing: data.furnishing || '',
              status: 'available',
              owner_id: userId,
              owner_name: req.user!.email,
              owner_phone: data.owner_phone || data['Mobile'] || '7095288950',
              description: data.description || '',
              photos: data.photos || ''
            };
            properties.push(property);
          })
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (file) {
      // Read from uploaded file
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (data) => {
            // Map CSV columns to property structure
            const property = {
              property_code: data.property_code || data['Property Code'] || data['Code'] || '',
              title: data.title || data['Title'] || data['Name'] || '',
              address: data.address || data['Address'] || '',
              city: data.city || data['City'] || 'Hyderabad',
              locality: data.locality || data['Locality'] || data['Area'] || '',
              rent: data.rent || data['Rent'] || data['Budget'] || data['Price'] || '',
              available_from: data.available_from || data['Available From'] || data['Availability'] || new Date().toISOString().split('T')[0],
              bedrooms: data.bedrooms || data['Bedrooms'] || data['BHKtype']?.replace(' BHK', '') || data['BHK'] || '',
              bathrooms: data.bathrooms || data['Bathrooms'] || '',
              area_sqft: data.area_sqft || data['Area (sqft)'] || data['SFT'] || data['Area'] || '',
              amenities: data.amenities || data['Amenities'] || '',
              furnishing: data.furnishing || data['Furnishing'] || '',
              status: data.status || data['Status'] || 'available',
              owner_id: userId,
              owner_name: req.user!.email,
              owner_phone: data.owner_phone || data['Mobile'] || data['Phone'] || '',
              description: data.description || data['Description'] || '',
              photos: data.photos || data['Photos'] || ''
            };
            properties.push(property);
          })
          .on('end', resolve)
          .on('error', reject);
      });
    } else {
      throw createError('CSV file is required or use_database_file must be true', 400);
    }

    if (properties.length === 0) {
      throw createError('CSV file is empty or could not be parsed', 400);
    }

    // Create properties in bulk (this will append to the master CSV)
    const createdProperties = [];
    for (const propertyData of properties) {
      try {
        const property = await csvStorage.createProperty(propertyData);
        createdProperties.push(property);
      } catch (error: any) {
        console.error('Error creating property:', error);
        // Continue with other properties
      }
    }

    // Clean up temp file if uploaded
    if (file) {
      fs.unlinkSync(file.path);
    }

    res.status(201).json({
      status: 'success',
      message: `Successfully uploaded ${createdProperties.length} properties`,
      properties: createdProperties,
      total: createdProperties.length,
      failed: properties.length - createdProperties.length
    });
  } catch (error) {
    next(error);
  }
});

// Import from backend/database/flats.csv
propertiesRouter.post('/import-database', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const databaseFlatsPath = path.join(process.cwd(), 'database', 'flats.csv');
    
    if (!fs.existsSync(databaseFlatsPath)) {
      throw createError('database/flats.csv file not found', 404);
    }

    const properties: any[] = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(databaseFlatsPath)
        .pipe(csv())
        .on('data', (data) => {
          // Map database CSV columns to property structure
          const property = {
            property_code: data.property_code || data['Code'] || `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: data.title || data['Name'] || '',
            address: data.address || '',
            city: data.city || 'Hyderabad',
            locality: data.locality || data['Locality'] || '',
            rent: data.rent || data['Budget'] || data['Price'] || '',
            available_from: data.available_from || new Date().toISOString().split('T')[0],
            bedrooms: data.bedrooms || data['BHKtype']?.replace(' BHK', '') || '',
            bathrooms: data.bathrooms || '',
            area_sqft: data.area_sqft || data['SFT'] || '',
            amenities: data.amenities || data['Amenities'] || '',
            furnishing: data.furnishing || '',
            status: 'available',
            owner_id: userId,
              owner_name: req.user!.email,
            owner_phone: data.owner_phone || data['Mobile'] || '7095288950',
            description: data.description || '',
            photos: data.photos || ''
          };
          properties.push(property);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (properties.length === 0) {
      throw createError('database/flats.csv file is empty or could not be parsed', 400);
    }

    // Create properties in bulk
    const createdProperties = [];
    for (const propertyData of properties) {
      try {
        const property = await csvStorage.createProperty(propertyData);
        createdProperties.push(property);
      } catch (error: any) {
        console.error('Error creating property:', error);
      }
    }

    res.status(201).json({
      status: 'success',
      message: `Successfully imported ${createdProperties.length} properties from database/flats.csv`,
      properties: createdProperties,
      total: createdProperties.length,
      failed: properties.length - createdProperties.length
    });
  } catch (error) {
    next(error);
  }
});
