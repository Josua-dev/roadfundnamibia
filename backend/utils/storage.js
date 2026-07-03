const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'report-photos';

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // The service_role key bypasses Row Level Security entirely -- this
  // is intentional and safe *only* because this client is used
  // exclusively from trusted backend code that has already run its
  // own auth/ownership checks (via the existing authenticateToken
  // middleware and the routes' own logic) before ever touching
  // storage. It must never be sent to the frontend.
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const generateFilename = (originalName) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = require('path').extname(originalName).toLowerCase();
  return `rf-${uniqueSuffix}${ext}`;
};

/**
 * Uploads a single multer-memory-storage file (has .buffer, .mimetype,
 * .originalname) to Supabase Storage. Returns the generated filename,
 * which is what gets stored in attachments.file_path (as
 * /api/uploads/<filename>, matching the existing convention) --
 * callers don't need to know anything about Supabase itself.
 */
async function uploadFile(file) {
  if (!supabase) {
    throw new Error('Storage is not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const filename = generateFilename(file.originalname);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return filename;
}

/**
 * Downloads a file's raw bytes + content-type back out of storage,
 * for the authenticated/public serving routes to stream to the client.
 */
async function downloadFile(filename) {
  if (!supabase) {
    throw new Error('Storage is not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(filename);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: data.type };
}

module.exports = { uploadFile, downloadFile };
