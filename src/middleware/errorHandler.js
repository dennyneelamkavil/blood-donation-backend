import multer from "multer";

export default function errorHandler(err, req, res, next) {
  // Catch Multer file size errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File too large. Max: 2MB" });
    }
    return res.status(400).json({ message: err.message });
  }

  console.error(err);
  return res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
}
