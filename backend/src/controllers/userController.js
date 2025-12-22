const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Save new profile image path (Cloudinary URL)
        // Note: We don't manually delete the old image from Cloudinary here to keep it simple,
        // but the DB reference is updated.
        user.profileImage = req.file.path;
        await user.save();

        res.json({
            message: 'Profile image uploaded successfully',
            profileImage: user.profileImage,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload profile image', error: error.message });
    }
};

// Delete profile image
exports.deleteProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Just remove reference from DB.
        // (Optional: Add cloudinary.uploader.destroy logic here later if needed)
        user.profileImage = '';
        await user.save();

        res.json({
            message: 'Profile image deleted successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Failed to delete profile image', error: error.message });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Failed to get user profile', error: error.message });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.name = req.body.name || user.name;
        user.username = req.body.username || user.username;
        user.phoneNumber = req.body.phoneNumber || user.phoneNumber;
        user.about = req.body.about || user.about;

        if (req.body.socialLinks) {
            user.socialLinks = {
                ...user.socialLinks,
                ...req.body.socialLinks
            };
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                username: updatedUser.username,
                phoneNumber: updatedUser.phoneNumber,
                about: updatedUser.about,
                socialLinks: updatedUser.socialLinks,
                profileImage: updatedUser.profileImage,
            },
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
};
