const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const cloudinary = require('../src/config/cloudinary');
const Document = require('../src/models/Document');

const cleanupPdfs = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find PDFs that might be using the wrong resource type or all older PDFs
        // The user said: "All previously uploaded PDFs... Must be deleted"
        const pdfs = await Document.find({
            $or: [
                { mimeType: 'application/pdf' },
                { fileUrl: { $regex: /\.pdf$/i } } // Fallback check
            ]
        });

        console.log(`Found ${pdfs.length} PDFs to clean up.`);

        for (const doc of pdfs) {
            try {
                // Try to extract public_id
                // URL format: https://res.cloudinary.com/CLOUD_NAME/image/upload/v1234/safelynx/filename.pdf
                // or .../raw/upload/...

                const urlParts = doc.fileUrl.split('/');
                const versionIndex = urlParts.findIndex(p => p.startsWith('v') && !isNaN(parseInt(p.substring(1))));

                if (versionIndex !== -1) {
                    const publicIdParts = urlParts.slice(versionIndex + 1);
                    let publicId = publicIdParts.join('/');
                    // Remove extension if present? 
                    // For 'image' resource type, usually public_id doesn't have extension in logic, but URL does.
                    // For 'raw', I was adding extension.
                    // Let's try both 'image' and 'raw' destroy.

                    // Remove extension for the ID if it's there
                    const publicIdNoExt = publicId.replace(/\.[^/.]+$/, "");

                    // Try destroying as Raw (old config)
                    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
                    // Try destroying as Image (just in case)
                    await cloudinary.uploader.destroy(publicIdNoExt, { resource_type: 'image' });

                    console.log(`Deleted Cloudinary resource for: ${doc.title}`);
                }

                await doc.deleteOne();
                console.log(`Deleted MongoDB Doc: ${doc.title}`);
            } catch (err) {
                console.error(`Failed to clean doc ${doc._id}:`, err.message);
            }
        }

        console.log('Cleanup complete.');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup failed:', err);
        process.exit(1);
    }
};

cleanupPdfs();
