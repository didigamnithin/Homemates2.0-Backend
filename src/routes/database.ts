import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fileStorage } from '../config/storage';
import { createError } from '../middleware/errorHandler';
import { perplexityService } from '../services/perplexity';
import multer from 'multer';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

export const databaseRouter = Router();
databaseRouter.use(authenticate);

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/datasets/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'text/csv' || 
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.mimetype === 'application/vnd.ms-excel';

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Get all datasets
databaseRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;

    const datasets = fileStorage.getDatasets(builderId);

    res.json({ status: 'success', datasets: datasets || [] });
  } catch (error) {
    next(error);
  }
});

// Upload dataset
databaseRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;
    const { data_type, agent_id } = req.body;
    const file = req.file;

    if (!file) {
      throw createError('File is required', 400);
    }

    let rows: any[] = [];
    const fileExt = path.extname(file.originalname).toLowerCase();

    // Parse file based on type
    if (fileExt === '.csv') {
      rows = await parseCSV(file.path);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      rows = await parseExcel(file.path);
    } else {
      throw createError('Unsupported file format', 400);
    }

    if (rows.length === 0) {
      throw createError('File is empty or could not be parsed', 400);
    }

    // Store file in uploads directory
    const datasetsDir = path.join(process.cwd(), 'uploads', 'datasets', builderId);
    if (!fs.existsSync(datasetsDir)) {
      fs.mkdirSync(datasetsDir, { recursive: true });
    }

    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = path.join(datasetsDir, fileName);
    fs.copyFileSync(file.path, filePath);
    const fileUrl = `/uploads/datasets/${builderId}/${fileName}`;

    // Store dataset metadata
    const dataset = fileStorage.createDataset({
      builder_id: builderId,
      file_url: fileUrl,
      file_name: file.originalname,
      data_type: data_type || 'leads',
      row_count: rows.length,
      agent_id: agent_id || null
    });

    // Clean up temp file
    fs.unlinkSync(file.path);

    // Analyze data health
    const dataHealth = analyzeDataHealth(rows);

    res.status(201).json({
      status: 'success',
      dataset,
      data_health: dataHealth,
      preview: rows.slice(0, 5) // Return first 5 rows as preview
    });
  } catch (error) {
    next(error);
  }
});

// Get dataset details
databaseRouter.get('/:datasetId', async (req: AuthRequest, res, next) => {
  try {
    const { datasetId } = req.params;
    const builderId = req.user!.builderId;

    const dataset = fileStorage.getDatasetById(datasetId, builderId);
    if (!dataset) {
      throw createError('Dataset not found', 404);
    }

    // Read and parse the file to get sample rows
    const filePath = path.join(process.cwd(), dataset.file_url.replace(/^\//, ''));
    let sampleRows: any[] = [];
    
    if (fs.existsSync(filePath)) {
      const fileExt = path.extname(dataset.file_name).toLowerCase();
      if (fileExt === '.csv') {
        sampleRows = await parseCSV(filePath);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        sampleRows = await parseExcel(filePath);
      }
      sampleRows = sampleRows.slice(0, 10);
    }

    res.json({
      status: 'success',
      dataset,
      sample_rows: sampleRows
    });
  } catch (error) {
    next(error);
  }
});

// Delete dataset
databaseRouter.delete('/:datasetId', async (req: AuthRequest, res, next) => {
  try {
    const { datasetId } = req.params;
    const builderId = req.user!.builderId;

    const dataset = fileStorage.getDatasetById(datasetId, builderId);
    if (!dataset) {
      throw createError('Dataset not found', 404);
    }

    // Delete file
    const filePath = path.join(process.cwd(), dataset.file_url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete dataset record
    fileStorage.deleteDataset(datasetId, builderId);

    res.json({ status: 'success', message: 'Dataset deleted' });
  } catch (error) {
    next(error);
  }
});

// Ingest listings from Perplexity
databaseRouter.post('/ingest', async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;
    const { city } = req.body;

    console.log('Starting Perplexity ingestion for city:', city || 'Hyderabad');

    // Search for listings using Perplexity
    const searchResults = await perplexityService.searchListings(city || 'Hyderabad');

    console.log(`Found ${searchResults.results.length} search results`);
    console.log(`Extracted ${searchResults.listings.length} structured listings`);

    // Convert listings to CSV format and save
    if (searchResults.listings.length > 0) {
      const csvData = convertListingsToCSV(searchResults.listings);
      const fileName = `perplexity_listings_${Date.now()}.csv`;
      const datasetsDir = path.join(process.cwd(), 'uploads', 'datasets', builderId);
      
      if (!fs.existsSync(datasetsDir)) {
        fs.mkdirSync(datasetsDir, { recursive: true });
      }

      const filePath = path.join(datasetsDir, fileName);
      fs.writeFileSync(filePath, csvData);
      const fileUrl = `/uploads/datasets/${builderId}/${fileName}`;

      // Store dataset metadata
      const dataset = fileStorage.createDataset({
        builder_id: builderId,
        file_url: fileUrl,
        file_name: fileName,
        data_type: 'leads',
        row_count: searchResults.listings.length,
        agent_id: null
      });

      res.status(201).json({
        status: 'success',
        message: `Successfully ingested ${searchResults.listings.length} listings`,
        dataset,
        results: searchResults.results,
        listings: searchResults.listings,
        total_results: searchResults.results.length,
        total_listings: searchResults.listings.length
      });
    } else {
      res.json({
        status: 'success',
        message: 'Search completed but no structured listings were extracted',
        results: searchResults.results,
        listings: [],
        total_results: searchResults.results.length,
        total_listings: 0
      });
    }
  } catch (error) {
    next(error);
  }
});

// Helper function to convert listings to CSV
function convertListingsToCSV(listings: any[]): string {
  if (listings.length === 0) {
    return '';
  }

  // Get all unique keys from all listings
  const allKeys = new Set<string>();
  listings.forEach(listing => {
    Object.keys(listing).forEach(key => allKeys.add(key));
  });

  const headers = Array.from(allKeys);
  
  // Create CSV header
  const csvRows = [headers.map(h => `"${h}"`).join(',')];

  // Create CSV rows
  listings.forEach(listing => {
    const row = headers.map(header => {
      const value = listing[header];
      if (value === null || value === undefined) {
        return '""';
      }
      if (Array.isArray(value)) {
        return `"${value.join(', ')}"`;
      }
      // Escape quotes and wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

// Helper functions
async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function parseExcel(filePath: string): Promise<any[]> {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(worksheet);
}

function analyzeDataHealth(rows: any[]): {
  total_rows: number;
  has_name: boolean;
  has_phone: boolean;
  has_email: boolean;
  completeness_score: number;
} {
  if (rows.length === 0) {
    return {
      total_rows: 0,
      has_name: false,
      has_phone: false,
      has_email: false,
      completeness_score: 0
    };
  }

  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map(k => k.toLowerCase());

  const hasName = keys.some(k => 
    k.includes('name') || k.includes('customer') || k.includes('client')
  );
  const hasPhone = keys.some(k => 
    k.includes('phone') || k.includes('mobile') || k.includes('contact')
  );
  const hasEmail = keys.some(k => 
    k.includes('email') || k.includes('mail')
  );

  const completenessScore = (
    (hasName ? 1 : 0) +
    (hasPhone ? 1 : 0) +
    (hasEmail ? 1 : 0)
  ) / 3 * 100;

  return {
    total_rows: rows.length,
    has_name: hasName,
    has_phone: hasPhone,
    has_email: hasEmail,
    completeness_score: Math.round(completenessScore)
  };
}
