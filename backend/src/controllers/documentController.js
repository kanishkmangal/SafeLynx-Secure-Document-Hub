const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const Document = require('../models/Document');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const { extractText } = require('../utils/textExtractor');
const { generateDocumentSummary } = require('../utils/aiService');

// Helper to update status and increment retry if needed
const updateDocStatus = async (docId, status, errorMsg, shouldIncrementRetry = false) => {
  const update = {
    summaryStatus: status,
    summaryError: errorMsg,
    summaryUpdatedAt: new Date()
  };

  if (shouldIncrementRetry) {
    update.$inc = { retryCount: 1 };
  } else {
    // Reset retry if successful or non-retriable failure
    if (status === 'completed') update.retryCount = 0;
  }

  await Document.findByIdAndUpdate(docId, update);
};

const triggerAiSummary = async (docId) => {
  console.log(`[AI] Processing ${docId}`);

  try {
    const doc = await Document.findById(docId);
    if (!doc) return;

    // 0. Check Retry Limit
    if (doc.summaryStatus === 'failed' && doc.retryCount >= 1) {
      console.log(`[AI] Skipping ${docId} - Max retries reached.`);
      return;
    }

    if (!doc.fileUrl) {
      await updateDocStatus(docId, 'failed', "No file URL found");
      return;
    }

    // 1. Download File to Temp
    const parsedUrl = new URL(doc.fileUrl);
    const ext = path.extname(parsedUrl.pathname) || path.extname(doc.title) || '.tmp';
    const tempPath = path.join(os.tmpdir(), `safelynx_${docId}_${Date.now()}${ext}`);

    console.log(`[AI] Downloading to ${tempPath}...`);

    // Check if fileUrl is local (backwards compatibility) or remote
    if (!doc.fileUrl.startsWith('http')) {
      // Assume local file if no http
      const localPath = path.join(__dirname, '../../', doc.fileUrl.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        await updateDocStatus(docId, 'failed', "Local file not found");
        return;
      }
      // Copy to temp to be consistent
      fs.copyFileSync(localPath, tempPath);
    } else {
      const response = await axios({
        url: doc.fileUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }

    // 2. Extract Text
    const extractionResult = await extractText(tempPath);

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Check specific extraction signals
    if (extractionResult.error) {
      await updateDocStatus(docId, 'failed', `Extraction failed: ${extractionResult.error}`, true);
      return;
    }

    if (extractionResult.isScanned) {
      await updateDocStatus(docId, 'failed', "Scanned PDF detected. OCR is limited for full PDFs in this environment.", false);
      return;
    }

    const text = extractionResult.text;

    // 3. Validate Text Length
    if (!text || text.length < 50) {
      await updateDocStatus(docId, 'failed', "Insufficient text content found to summarize.", false);
      return;
    }

    // 4. Generate Summary
    // Ensure we mark as pending if it wasn't already (e.g. if this is a retry)
    await Document.findByIdAndUpdate(docId, { summaryStatus: 'pending' });

    const summary = await generateDocumentSummary(text);

    // 5. Save Success
    await updateDocStatus(docId, 'completed', null, false);
    await Document.findByIdAndUpdate(docId, { summary: summary }); // Save summary content

    console.log(`[AI] Success for ${docId}`);

  } catch (error) {
    console.error(`[AI] Error for ${docId}:`, error.message);
    await updateDocStatus(docId, 'failed', error.message, true); // Increment retry on generic errors
  }
};

const uploadDocument = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) return res.status(400).json({ message: 'No file uploaded' });

    // Storage check (Simplified for brevity, assumes handled)
    const { title, category, subCategory, tags = '' } = req.body;
    if (!category) return res.status(400).json({ message: 'Category is required' });

    const tagList = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : tags;
    const createdDocs = [];

    for (const file of files) {
      let finalTitle = title;
      if (files.length > 1 && title) finalTitle = `${title} - ${file.originalname}`;
      else if (!finalTitle) finalTitle = file.originalname.replace(/\.[^/.]+$/, '');

      // Use file.path for Cloudinary URL, fall back to constructing one if local (unlikely with this config)
      let fileUrl = file.path;
      if (!fileUrl && file.filename) {
        // Fallback for local storage if somehow used
        const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        fileUrl = `${backendUrl}/uploads/${file.filename}`;
      }

      const doc = await Document.create({
        title: finalTitle,
        category,
        subCategory,
        uploadedBy: req.user._id,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        tags: tagList,
        summaryStatus: 'pending'
      });

      // Trigger Async
      // We no longer pass filename, just the ID. The function handles downloading.
      triggerAiSummary(doc._id);
      createdDocs.push(doc);
    }

    req.user.lastUploadAt = new Date();
    await req.user.save();

    return res.status(201).json({
      message: 'Upload successful',
      count: createdDocs.length,
      documents: createdDocs,
      document: createdDocs[0]
    });
  } catch (err) {
    return res.status(500).json({ message: 'Upload failed', error: err.message });
  }
};

const regenerateSummary = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Check ownership
    const isOwner = doc.uploadedBy.toString() === req.user._id.toString();
    const isShared = doc.sharedWith.some(u => u.toString() === req.user._id.toString());
    if (!isOwner && !isShared) return res.status(403).json({ message: 'Access denied' });

    // Set to pending
    doc.summaryStatus = 'pending';
    doc.summary = '';
    await doc.save();

    // Trigger
    triggerAiSummary(doc._id);

    return res.json({ message: 'Summary regeneration started', document: doc });
  } catch (err) {
    return res.status(500).json({ message: "Failed to start regeneration", error: err.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    const { category, search } = req.query;

    // Base ownership query: Owned OR Shared
    const ownershipQuery = {
      $or: [
        { uploadedBy: req.user._id },
        { sharedWith: req.user._id }
      ]
    };

    // Use $and to combine ownership, category, and search
    const query = { $and: [ownershipQuery] };

    if (category) {
      query.$and.push({ category });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$and.push({
        $or: [
          { subCategory: searchRegex },
          { title: searchRegex },
          { fileUrl: searchRegex },
          { category: searchRegex }
        ]
      });
    }

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name email');

    // Add isShared flag
    const docsWithFlag = documents.map((doc) => {
      const docObj = doc.toObject();
      docObj.isShared = doc.uploadedBy._id.toString() !== req.user._id.toString();
      return docObj;
    });

    return res.json({ documents: docsWithFlag });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch documents', error: err.message });
  }
};

const getSharedDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ sharedWith: req.user._id }).sort({ createdAt: -1 });
    return res.json({ documents });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch shared documents', error: err.message });
  }
};

const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const isOwner = doc.uploadedBy.toString() === req.user._id.toString();
    const isShared = doc.sharedWith.some((u) => u.toString() === req.user._id.toString());
    if (!isOwner && !isShared) return res.status(403).json({ message: 'Access denied' });

    // Trigger AI summary if missing OR if it failed previously (retry logic)
    // Check if it's stuck in pending (older than 5 minutes)
    const STUCK_TIMEOUT = 5 * 60 * 1000;
    const isStuck = doc.summaryStatus === 'pending' && (new Date() - new Date(doc.updatedAt) > STUCK_TIMEOUT);

    if (doc.summaryStatus === 'none' || doc.summaryStatus === 'failed' || isStuck) {
      console.log(`[AI-DEBUG] Retriggering summary for ${doc._id}. Status: ${doc.summaryStatus}, IsStuck: ${isStuck}`);
      doc.summaryStatus = 'pending';
      // Clear previous error message ensuring UI shows loading state
      doc.summary = '';
      await doc.save();
      triggerAiSummary(doc._id);
    }

    return res.json({ document: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch document', error: err.message });
  }
};

const renameDocument = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Valid title is required' });
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 100) {
      return res.status(400).json({ message: 'Title must be less than 100 characters' });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owners can rename documents' });
    }

    doc.title = trimmedTitle;
    await doc.save();
    return res.json({ document: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to rename document', error: err.message });
  }
};

const updateDocument = async (req, res) => {
  try {
    const { title, category, tags } = req.body;
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owners can update documents' });
    }
    if (title) doc.title = title;
    if (category) doc.category = category;
    if (tags) doc.tags = typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags;
    await doc.save();
    return res.json({ document: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to update document', error: err.message });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owners can delete documents' });
    }
    await doc.deleteOne();
    return res.json({ message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to delete document', error: err.message });
  }
};

const shareDocument = async (req, res) => {
  try {
    const { email } = req.body;
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owners can share documents' });
    }
    const targetUser = await User.findOne({ email });
    if (!targetUser) return res.status(404).json({ message: 'Recipient not found' });
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }
    if (!doc.sharedWith.includes(targetUser._id)) {
      doc.sharedWith.push(targetUser._id);
      await doc.save();

      // Create notification
      await createNotification({
        recipient: targetUser._id,
        sender: req.user._id,
        type: 'share',
        message: `${req.user.name || 'Someone'} shared a document "${doc.title}" with you`,
        documentId: doc._id
      });
    }
    req.user.lastShareAt = new Date();
    await req.user.save();
    return res.json({ message: 'Document shared', document: doc });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to share document', error: err.message });
  }
};

const activitySummary = async (req, res) => {
  try {
    const ownedCount = await Document.countDocuments({ uploadedBy: req.user._id });
    const sharedCount = await Document.countDocuments({ sharedWith: req.user._id });
    return res.json({
      lastLogin: req.user.lastLogin,
      lastUploadAt: req.user.lastUploadAt,
      lastShareAt: req.user.lastShareAt,
      totals: {
        owned: ownedCount,
        sharedWithMe: sharedCount,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch activity', error: err.message });
  }
};

const getCategoryCounts = async (req, res) => {
  try {
    const { search } = req.query;

    // Base ownership query: Owned OR Shared
    const ownershipQuery = {
      $or: [
        { uploadedBy: req.user._id },
        { sharedWith: req.user._id }
      ]
    };

    const matchQuery = { $and: [ownershipQuery] };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      matchQuery.$and.push({
        $or: [
          { subCategory: searchRegex },
          { title: searchRegex },
          { fileUrl: searchRegex },
          { category: searchRegex }
        ]
      });
    }

    const counts = await Document.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const result = {
      personal: 0,
      professional: 0,
      government: 0,
    };

    counts.forEach((item) => {
      if (item._id && result[item._id] !== undefined) {
        result[item._id] = item.count;
      }
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch category counts', error: err.message });
  }
};

const getUniqueDocumentTypes = async (req, res) => {
  try {
    const types = await Document.distinct('subCategory', {
      uploadedBy: req.user._id,
      subCategory: { $nin: [null, ''] }
    });
    return res.json({ types });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to fetch document types', error: err.message });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getSharedDocuments,
  getDocumentById,
  updateDocument,
  renameDocument,
  deleteDocument,
  shareDocument,
  activitySummary,
  getCategoryCounts,
  getUniqueDocumentTypes,
  regenerateSummary,
};
