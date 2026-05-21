const multer = require("multer");
const logger = require("../config/logger");

function errorHandler(error, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} - ${error.message}`);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Файл занадто великий. Максимальний розмір — 5 MB.",
      });
    }

    return res.status(400).json({
      success: false,
      status: 400,
      message: error.message,
    });
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: error.message || "Внутрішня помилка сервера",
  });
}

module.exports = errorHandler;