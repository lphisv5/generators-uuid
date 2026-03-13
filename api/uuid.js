// api/uuid.js - สำหรับ Vercel Serverless Functions
const crypto = require("crypto");

const PREFIX = "YZ";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET = process.env.UUID_SECRET || "CHANGE_ME_IN_PRODUCTION";

// ใน production ควรใช้ Redis หรือ Database จริง
// แต่สำหรับตัวอย่างนี้ใช้ Map ใน memory (Vercel จะรีเซ็ตเมื่อไร้ connection)
const keyStore = new Map(); // key: uuid, value: { discordId, discordName, createdAt, lastVerifiedAt, version }
const userKeys = new Map(); // key: discordId, value: array of uuids

const CONFIG = {
    CHECKSUM_LENGTH: 6,
    RANDOM_PARTS_LENGTH: 5,
    KEY_EXPIRY_HOURS: 4, // อายุคีย์ 4 ชม.
    VERIFICATION_EXTEND_HOURS: 5, // ต่ออายุอีก 5 ชม. เมื่อถูกตรวจสอบ
    MAX_KEYS_PER_USER: 3 // แต่ละ user มีคีย์ได้สูงสุด 3 อัน
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

function generateUUIDv8() {
    const timeHash = generateTimestampHash();
    const partA = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    const partB = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    const partC = secureRandom(CONFIG.RANDOM_PARTS_LENGTH);
    
    const base = `${PREFIX}-${timeHash}-${partA}-${partB}-${partC}`;
    const sign = checksum(base);
    
    return `${base}-${sign}`;
}

// ฟังก์ชันลบคีย์ที่หมดอายุ
function cleanupExpiredKeys() {
    const now = Date.now();
    for (const [uuid, data] of keyStore.entries()) {
        const expiryTime = data.lastVerifiedAt 
            ? data.lastVerifiedAt + (CONFIG.VERIFICATION_EXTEND_HOURS * 60 * 60 * 1000)
            : data.createdAt + (CONFIG.KEY_EXPIRY_HOURS * 60 * 60 * 1000);
        
        if (now > expiryTime) {
            keyStore.delete(uuid);
            // ลบจาก userKeys ด้วย
            if (data.discordId && userKeys.has(data.discordId)) {
                const userKeyList = userKeys.get(data.discordId);
                const index = userKeyList.indexOf(uuid);
                if (index > -1) userKeyList.splice(index, 1);
                if (userKeyList.length === 0) userKeys.delete(data.discordId);
            }
        }
    }
}

// ตรวจสอบว่าคีย์ยังใช้งานได้หรือไม่
function isKeyValid(uuid) {
    if (!keyStore.has(uuid)) return false;
    
    const data = keyStore.get(uuid);
    const now = Date.now();
    const expiryTime = data.lastVerifiedAt 
        ? data.lastVerifiedAt + (CONFIG.VERIFICATION_EXTEND_HOURS * 60 * 60 * 1000)
        : data.createdAt + (CONFIG.KEY_EXPIRY_HOURS * 60 * 60 * 1000);
    
    return now <= expiryTime;
}

// อัพเดทเวลาตรวจสอบล่าสุด
function updateVerificationTime(uuid) {
    if (keyStore.has(uuid)) {
        const data = keyStore.get(uuid);
        data.lastVerifiedAt = Date.now();
        keyStore.set(uuid, data);
    }
}

// Main handler สำหรับ Vercel
module.exports = async (req, res) => {
    // ตั้งค่า CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed. Use GET only." });
    }

    try {
        // Cleanup expired keys ทุกครั้งที่มี request
        cleanupExpiredKeys();
        
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);
        const parts = pathname.split('/').filter(p => p);
        
        // Route: / (root) - สร้างคีย์ปกติ
        if (parts.length === 0 || parts[0] === 'api' || parts[0] === 'uuid') {
            const newUUID = generateUUIDv8();
            
            // บันทึกคีย์ปกติ (ไม่มี discord info)
            keyStore.set(newUUID, {
                discordId: null,
                discordName: null,
                createdAt: Date.now(),
                lastVerifiedAt: null,
                version: 'normal'
            });
            
            return res.status(200).json({
                uuid: newUUID,
                version: 'normal'
            });
        }
        
        // Route: /:id/:name - สร้างคีย์ premium สำหรับ Discord
        if (parts.length === 2 && parts[0] !== 'verify') {
            const discordId = parts[0];
            const discordName = decodeURIComponent(parts[1]);
            
            // ตรวจสอบจำนวนคีย์ที่ user มี
            const userExistingKeys = userKeys.get(discordId) || [];
            if (userExistingKeys.length >= CONFIG.MAX_KEYS_PER_USER) {
                return res.status(400).json({
                    error: "Maximum keys limit reached",
                    message: `You can only have ${CONFIG.MAX_KEYS_PER_USER} active keys at a time`
                });
            }
            
            const newUUID = generateUUIDv8();
            
            // บันทึกคีย์ premium
            keyStore.set(newUUID, {
                discordId,
                discordName,
                createdAt: Date.now(),
                lastVerifiedAt: null,
                version: 'premium'
            });
            
            // บันทึกใน userKeys
            if (!userKeys.has(discordId)) {
                userKeys.set(discordId, []);
            }
            userKeys.get(discordId).push(newUUID);
            
            return res.status(200).json({
                uuid: newUUID,
                version: 'premium'
            });
        }
        
        // Route: /verify/:id - ตรวจสอบคีย์ของ user
        if (parts.length === 2 && parts[0] === 'verify') {
            const discordId = parts[1];
            
            // หาคีย์ที่ใช้งานได้ของ user นี้
            const userKeyList = userKeys.get(discordId) || [];
            const validKeys = userKeyList.filter(uuid => isKeyValid(uuid));
            
            if (validKeys.length === 0) {
                return res.status(404).json({
                    error: "No valid keys found",
                    message: "This user has no valid keys or all keys have expired"
                });
            }
            
            // ใช้คีย์ล่าสุด (สมมติว่าสร้างทีหลังคือคีย์ปัจจุบัน)
            const latestUUID = validKeys[validKeys.length - 1];
            const keyData = keyStore.get(latestUUID);
            
            // อัพเดทเวลาตรวจสอบ
            updateVerificationTime(latestUUID);
            
            return res.status(200).json({
                uuid: latestUUID,
                valid: true,
                name: keyData.discordName,
                id: keyData.discordId,
                expiresAt: new Date(keyData.lastVerifiedAt + (CONFIG.VERIFICATION_EXTEND_HOURS * 60 * 60 * 1000)).toISOString()
            });
        }
        
        // Route: /verify?uuid=xxxx - ตรวจสอบคีย์เฉพาะ (สำหรับเว็บ)
        if (parts.length === 1 && parts[0] === 'verify' && req.query.uuid) {
            const uuid = req.query.uuid;
            
            // ตรวจสอบรูปแบบ UUID ก่อน
            const pattern = new RegExp(`^${PREFIX}-[A-Z0-9]{6}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{6}$`);
            if (!pattern.test(uuid)) {
                return res.status(400).json({
                    uuid,
                    valid: false,
                    error: "Invalid UUID format"
                });
            }
            
            // ตรวจสอบ checksum
            const parts = uuid.split('-');
            const base = parts.slice(0, 5).join('-');
            const providedChecksum = parts[5];
            const calculatedChecksum = checksum(base);
            
            const isValidFormat = providedChecksum === calculatedChecksum;
            const isInStore = keyStore.has(uuid);
            const isNotExpired = isKeyValid(uuid);
            
            if (isValidFormat && isInStore && isNotExpired) {
                const keyData = keyStore.get(uuid);
                updateVerificationTime(uuid);
                
                return res.status(200).json({
                    uuid,
                    valid: true,
                    ...(keyData.discordId && {
                        name: keyData.discordName,
                        id: keyData.discordId
                    }),
                    version: keyData.version,
                    expiresAt: new Date((keyData.lastVerifiedAt || keyData.createdAt) + 
                        (CONFIG.VERIFICATION_EXTEND_HOURS * 60 * 60 * 1000)).toISOString()
                });
            } else {
                return res.status(200).json({
                    uuid,
                    valid: false,
                    reason: !isValidFormat ? "Invalid checksum" : 
                            !isInStore ? "Key not found in system" : 
                            "Key has expired"
                });
            }
        }
        
        // Route: /keys/:id - ดูคีย์ทั้งหมดของ user (สำหรับ debug)
        if (parts.length === 2 && parts[0] === 'keys') {
            const discordId = parts[1];
            const userKeyList = userKeys.get(discordId) || [];
            const validKeys = userKeyList.filter(uuid => isKeyValid(uuid));
            
            return res.status(200).json({
                discordId,
                totalKeys: userKeyList.length,
                validKeys: validKeys.length,
                keys: validKeys.map(uuid => {
                    const data = keyStore.get(uuid);
                    return {
                        uuid,
                        createdAt: new Date(data.createdAt).toISOString(),
                        expiresAt: new Date((data.lastVerifiedAt || data.createdAt) + 
                            (CONFIG.VERIFICATION_EXTEND_HOURS * 60 * 60 * 1000)).toISOString(),
                        lastVerified: data.lastVerifiedAt ? new Date(data.lastVerifiedAt).toISOString() : null
                    };
                })
            });
        }
        
        // Route not found
        return res.status(404).json({ error: "Endpoint not found" });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
