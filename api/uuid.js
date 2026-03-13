// api/uuid.js - สำหรับ Vercel Serverless Functions (GET only)
const crypto = require("crypto");

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME_IN_PRODUCTION";

const CONFIG = {
    CHECKSUM_LENGTH: 6,
    RANDOM_PARTS_LENGTH: 5
};

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
        .slice(0, CONFIG.CHECKSUM_LENGTH)
        .toUpperCase();
}

function generateTimestampHash() {
    const timestamp = Date.now().toString();
    const salt = crypto.randomBytes(2).toString('hex');
    return crypto
        .createHash("sha1")
        .update(timestamp + salt)
        .digest("hex")
        .slice(0, 6)
        .toUpperCase();
}

function generatePremiumUUIDv8() {
    const timeHash = generateTimestampHash();
    const partA = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    const partB = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    const partC = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    
    const base = `${PREFIX}-${timeHash}-${partA}-${partB}-${partC}`;
    const sign = checksum(base);
    
    return `${base}-${sign}`;
}

function verifyUUID(uuid) {
    try {
        const pattern = new RegExp(`^${PREFIX}-[A-Z0-9]{6}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{6}$`);
        
        if (!pattern.test(uuid)) {
            return false;
        }
        
        const parts = uuid.split('-');
        const base = parts.slice(0, 5).join('-');
        const providedChecksum = parts[5];
        const calculatedChecksum = checksum(base);
        
        return providedChecksum === calculatedChecksum;
        
    } catch (error) {
        return false;
    }
}

// Main handler สำหรับ Vercel (GET only)
module.exports = async (req, res) => {
    // ตั้งค่า CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // อนุญาตเฉพาะ GET เท่านั้น
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: "Method not allowed. Use GET only." 
        });
    }
    
    try {
        const { query } = req;
        
        // กรณีตรวจสอบ UUID: /api/uuid?verify=YZ-xxxx
        if (query.verify) {
            const isValid = verifyUUID(query.verify);
            
            return res.status(200).json({
                uuid: query.verify,
                valid: isValid
            });
        }
        
        // กรณีสร้าง UUID ใหม่: /api/uuid
        const newUUID = generatePremiumUUIDv8();
        
        return res.status(200).json({
            uuid: newUUID,
            version: "v8-premium"
        });
        
    } catch (error) {
        return res.status(500).json({ 
            error: "Internal server error" 
        });
    }
};
