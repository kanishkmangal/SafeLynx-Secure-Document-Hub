const express = require('express');
const {
  uploadDocument,
  getDocuments,
  getSharedDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  shareDocument,
  activitySummary,
  getCategoryCounts,
  getUniqueDocumentTypes,
  renameDocument,
  regenerateSummary,
} = require('../controllers/documentController');
const { getStorageUsage } = require('../controllers/storageController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(auth);

router.get('/activity', activitySummary);
router.get('/shared', getSharedDocuments);
// Category counts
router.get('/category-count', getCategoryCounts);
router.get('/storage-usage', getStorageUsage);
router.get('/types', getUniqueDocumentTypes);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.post('/upload', upload.array('files'), uploadDocument);
router.put('/:id', updateDocument);
router.patch('/:id/rename', renameDocument);
router.post('/:id/regenerate', regenerateSummary);
router.post('/:id/summary', regenerateSummary); // Alias for regenerateSummary
router.delete('/:id', deleteDocument);
router.post('/:id/share', shareDocument);

module.exports = router;

