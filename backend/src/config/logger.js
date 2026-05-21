const path = require("path");
const fs = require("fs");
const { createLogger, format, transports } = require("winston");

const logsDir = path.join(__dirname, "../../logs");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf((info) => {
      return `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
    })
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDir, "app.log"),
    }),
    new transports.Console(),
  ],
});

module.exports = logger;