const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['personal', 'professional', 'government'],
      required: true,
      trim: true
    },
    subCategory: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String }, // Stores MIME type (e.g., 'application/pdf', 'image/png')
    fileSize: { type: Number, required: true, default: 0 },
    tags: [{ type: String }],
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    summary: { type: String, default: '' },
    summaryStatus: {
      type: String,
      enum: ['none', 'pending', 'completed', 'failed'],
      default: 'none'
    },
    summaryError: { type: String },
    retryCount: { type: Number, default: 0 },
    summaryUpdatedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;

