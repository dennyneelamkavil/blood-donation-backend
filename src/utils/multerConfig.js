import multer from "multer";
import path from "path";
import fs from "fs";

// Helper to turn a Date into a filesystem‑safe string
function timestamp() {
  return new Date()
    .toISOString() // e.g. "2025-06-20T07:45:30.123Z"
    .replace(/[:.]/g, "-") // e.g. "2025-06-20T07-45-30-123Z"
    .replace("T", "_"); // e.g. "2025-06-20_07-45-30-123Z"
}

// Saving profile pics
// Create the directory if it does not exist
const uploadDir = path.join(process.cwd(), "public", "images", "profilepics");
fs.mkdirSync(uploadDir, { recursive: true });

export const profilePicStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const nameWithTs = `${base}_${timestamp()}${ext}`;
    cb(null, nameWithTs);
  },
});

export const profilePicUpload = multer({
  storage: profilePicStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Saving proof images
const proofUploadDir = path.join(process.cwd(), "public", "images", "proofs");
fs.mkdirSync(proofUploadDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, proofUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);

    cb(null, `${base}_${timestamp()}${ext}`);
  },
});

export const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowed.includes(ext)) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});
