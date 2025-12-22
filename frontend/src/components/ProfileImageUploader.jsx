import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';

const ProfileImageUploader = () => {
    const { user, updateProfileImage, removeProfileImage } = useAuth();
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const apiUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || '';

    // Fix: Check if image is an absolute URL (Cloudinary) or relative path (Legacy/Local)
    const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${apiUrl}${path}`;
    };

    const currentImage = getImageUrl(user?.profileImage);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            setError('Only JPG, JPEG, and PNG images are allowed');
            return;
        }

        // Validate file size (3 MB)
        if (file.size > 3 * 1024 * 1024) {
            setError('File size must be less than 3 MB');
            return;
        }

        // Clear error and show preview
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);

        // Upload immediately
        handleUpload(file);
    };

    const handleUpload = async (file) => {
        try {
            setUploading(true);
            setError('');
            const response = await userApi.uploadProfileImage(file);
            updateProfileImage(response.profileImage);
            setPreview(null);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.message || 'Failed to upload image');
            setPreview(null);
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        try {
            setUploading(true);
            setError('');
            await userApi.deleteProfileImage();
            removeProfileImage();
            setPreview(null);
        } catch (err) {
            console.error('Delete error:', err);
            setError(err.response?.data?.message || 'Failed to remove image');
        } finally {
            setUploading(false);
        }
    };

    const displayImage = preview || currentImage;

    return (
        <div className="flex flex-col items-center space-y-4">
            {/* Avatar Preview */}
            <div className="relative group">
                <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl ring-2 ring-indigo-50 dark:ring-indigo-900/30">
                    {displayImage ? (
                        <img
                            src={displayImage}
                            alt="Profile"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-4xl">
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>

                {/* Camera Icon Overlay Button */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-1 right-1 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-white dark:border-slate-800"
                    title="Upload new photo"
                >
                    {uploading ? (
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* User Details & Instructions */}
            <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                    @{user?.username || user?.name?.split(' ')[0].toLowerCase() || 'username'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                    Upload a new profile picture (JPG, PNG, max 3MB)
                </p>
                {currentImage && (
                    <button
                        onClick={handleRemove}
                        disabled={uploading}
                        className="text-xs text-rose-500 hover:text-rose-600 mt-2 hover:underline"
                    >
                        Remove photo
                    </button>
                )}
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
                    >
                        <p className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProfileImageUploader;
