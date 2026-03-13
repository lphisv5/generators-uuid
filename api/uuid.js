const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME_SECRET";

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

function timeHash() {
  return crypto
    .createHash("sha1")
    .update(Date.now().toString())
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

function generatePremiumUUIDv8() {
  const partA = secureRandom(5);
  const partB = secureRandom(5);
  const partC = secureRandom(5);

  const base = `${PREFIX}-${timeHash()}-${partA}-${partB}-${partC}`;
  const sign = checksum(base);

  return `${base}-${sign}`;
}

function verifyUUID(uuid) {
  const parts = uuid.split("-");

  if (parts.length !== 6) return false;

  const sign = parts.pop();
  const base = parts.join("-");

  const expected = checksum(base);

  return sign === expected;
}

router.get("/uuid", (req, res) => {
  res.json({
    uuid: generatePremiumUUIDv8(),
    version: "v8-premium",
  });
});

router.get("/uuid/verify/:id", (req, res) => {
  const valid = verifyUUID(req.params.id);

  res.json({
    uuid: req.params.id,
    valid,
  });
});

const app = express();

app.use(express.json());
app.use("/api", router);

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    error: "Internal Server Error",
  });
});

module.exports = app;
