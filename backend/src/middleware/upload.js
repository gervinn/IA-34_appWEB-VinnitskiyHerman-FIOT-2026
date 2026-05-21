const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadsDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
  } else {
    const error = new Error("Дозволені лише файли JPG, PNG або PDF.");
    error.statusCode = 400;
    cb(error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = upload;