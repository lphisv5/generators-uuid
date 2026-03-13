const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME";

function secureRandom(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

function checksum(data) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url")
    .slice(0, 6)
    .toUpperCase();
}

function generatePremiumUUIDv8() {
  const bytes = crypto.randomBytes(16);

  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const timeHash = crypto
    .createHash("sha1")
    .update(Date.now().toString())
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

  const partA = secureRandom(5);
  const partB = secureRandom(5);
  const partC = secureRandom(5);

  const base = `${PREFIX}-${timeHash}-${partA}-${partB}-${partC}`;
  const sign = checksum(base);

  return `${base}-${sign}`;
}

router.get("/uuid", (req, res) => {
  try {
    res.status(200).json({
      result: generatePremiumUUIDv8(),
      version: "v8",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error generating UUID:", error);
    res.status(500).json({ 
      error: "Failed to generate UUID",
      message: error.message 
    });
  }
});

router.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString() 
  });
});

const app = express();

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ 
    error: "Not Found",
    message: `Cannot ${req.method} ${req.url}` 
  });
});

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/uuid`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}
