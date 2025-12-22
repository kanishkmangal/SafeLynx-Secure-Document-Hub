const express = require('express');
const { uploadProfileImage, deleteProfileImage, getUserProfile, updateUserProfile } = require('../controllers/userController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Profile image routes
router.post('/upload-profile', auth, upload.single('profileImage'), uploadProfileImage);
router.delete('/profile-image', auth, deleteProfileImage);
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, updateUserProfile);

module.exports = router;
