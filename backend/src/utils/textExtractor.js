const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const mammoth = require('mammoth');

const extractText = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();

        // 1. PDF Handling
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            try {
                const data = await pdfParse(dataBuffer);
                const text = data.text ? data.text.trim() : "";

                if (text.length < 100) {
                    console.log("[TextExtractor] PDF text too short. Likely scanned.");
                    return { text: "", isScanned: true };
                }

                return { text: text, isScanned: false };
            } catch (e) {
                console.error("[TextExtractor] PDF Parse Error:", e);
                return { text: "", error: e.message };
            }
        }

        // 2. DOCX Handling (Mammoth)
        else if (ext === '.docx') {
            const dataBuffer = fs.readFileSync(filePath);
            const result = await mammoth.extractRawText({ buffer: dataBuffer });
            return { text: result.value.trim(), isScanned: false };
        }

        // 2. Image Handling (OCR)
        else if (['.png', '.jpg', '.jpeg', '.bmp', '.webp'].includes(ext)) {
            console.log(`[OCR] Starting Tesseract on ${path.basename(filePath)}...`);
            try {
                const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
                    logger: m => {
                        // Minimal logging
                    }
                });
                const cleanText = text.trim();
                return { text: cleanText, isScanned: false };
            } catch (ocrError) {
                console.error("[OCR] Failed:", ocrError);
                throw new Error("OCR Failed for image");
            }
        }

        // 3. Text/Code Handling (Fallback)
        else if (['.txt', '.md', '.json', '.js', '.html', '.css', '.xml'].includes(ext)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return { text: content, isScanned: false };
        }

        return { text: null, error: "Unsupported file type" };
    } catch (error) {
        console.error("Text extraction failed:", error);
        throw error;
    }
};

module.exports = { extractText };
