import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fileStorage } from '../config/storage';
import { createError } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const brandGuideRouter = Router();
brandGuideRouter.use(authenticate);

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/brand-guides/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp3|wav|m4a/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (PNG/JPG) and audio (MP3/WAV/M4A) are allowed.'));
    }
  }
});

// Get brand guide
brandGuideRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;

    const brandGuide = fileStorage.getBrandGuide(builderId);

    res.json({ status: 'success', brand_guide: brandGuide || null });
  } catch (error) {
    next(error);
  }
});

// Create or update brand guide
brandGuideRouter.post('/', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'voice_note', maxCount: 1 }
]), async (req: AuthRequest, res, next) => {
  try {
    const builderId = req.user!.builderId;
    const { tone, description, keywords, script_examples } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const logoFile = files?.logo?.[0];
    const voiceNoteFile = files?.voice_note?.[0];

    // Store files locally
    const uploadsDir = path.join(process.cwd(), 'uploads', 'brand-assets', builderId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let logoUrl = null;
    if (logoFile) {
      const logoExt = path.extname(logoFile.originalname);
      const logoFileName = `logo${logoExt}`;
      const logoPath = path.join(uploadsDir, logoFileName);
      fs.copyFileSync(logoFile.path, logoPath);
      logoUrl = `/uploads/brand-assets/${builderId}/${logoFileName}`;
      fs.unlinkSync(logoFile.path);
    }

    let voiceNoteUrl = null;
    if (voiceNoteFile) {
      const voiceExt = path.extname(voiceNoteFile.originalname);
      const voiceFileName = `voice_note${voiceExt}`;
      const voicePath = path.join(uploadsDir, voiceFileName);
      fs.copyFileSync(voiceNoteFile.path, voicePath);
      voiceNoteUrl = `/uploads/brand-assets/${builderId}/${voiceFileName}`;
      fs.unlinkSync(voiceNoteFile.path);
    }

    // Parse keywords if provided as string
    let keywordsArray = null;
    if (keywords) {
      if (typeof keywords === 'string') {
        keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
      } else {
        keywordsArray = keywords;
      }
    }

    // Upsert brand guide
    const brandGuide = fileStorage.upsertBrandGuide({
      builder_id: builderId,
      tone: tone || 'friendly',
      description: description || null,
      keywords: keywordsArray,
      script_examples: script_examples || null,
      logo_url: logoUrl,
      voice_note_url: voiceNoteUrl
    });

    res.json({ status: 'success', brand_guide: brandGuide });
  } catch (error) {
    next(error);
  }
});
