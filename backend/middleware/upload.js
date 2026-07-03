const multer = require('multer');
const path = require('path');

// Files are kept in memory (as a Buffer) rather than written to local
// disk. Render's free-tier disk is ephemeral -- wiped on every
// redeploy -- so anything written there was never actually durable.
// Each controller that receives an upload forwards the buffer
// straight to Supabase Storage (see utils/storage.js) instead.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 5,
  },
});

module.exports = upload;
