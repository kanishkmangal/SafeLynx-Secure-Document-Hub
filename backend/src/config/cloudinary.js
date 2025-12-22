const cloudinary = require("cloudinary").v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName) {
    console.error("❌ CRITICAL: Cloudinary Cloud Name is missing! Checked CLOUDINARY_CLOUD_NAME and CLOUDINARY_NAME.");
} else {
    console.log(`✅ Cloudinary Configured. Cloud Name: ${cloudName}`);
}

if (!apiKey || !apiSecret) {
    console.error("❌ CRITICAL: Cloudinary API Key or Secret is missing!");
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
});

module.exports = cloudinary;
