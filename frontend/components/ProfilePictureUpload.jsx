import React, { useState } from 'react';
import axios from 'axios';

const ProfilePictureUpload = ({ isOpen, onClose, onUploadSuccess }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
                setError('Please select a valid image file (JPEG, PNG, or GIF)');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('File size should be less than 5MB');
                return;
            }

            setSelectedFile(file);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select a file first');
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            console.log('Uploading file:', selectedFile.name);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await axios.post('https://talkhub-backend-02fc.onrender.com/api/ProfilePicture/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Upload response:', response.data);

            if (response.data) {
                // Handle both string and object responses
                const imageData = typeof response.data === 'string' 
                    ? { imageUrl: response.data }
                    : { imageUrl: response.data.imageUrl || response.data };

                console.log('Processed image data:', imageData);
                onUploadSuccess(imageData);
                onClose();
            }
        } catch (err) {
            console.error('Upload error:', err);
            if (err.response) {
                console.error('Error response:', err.response.data);
            }
            setError(err.response?.data || 'Error uploading profile picture');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[9999]">
                <div 
                    className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-xl font-semibold text-gray-800">Update Profile Picture</h2>
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex flex-col items-center">
                            <button 
                                type="button"
                                onClick={() => document.querySelector('input[type="file"]').click()}
                                className="w-full py-2 px-4 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                            >
                                Choose file
                            </button>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="mt-2 text-sm text-gray-500">
                                {selectedFile ? selectedFile.name : 'No file chosen'}
                            </div>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || loading}
                            className={`w-full py-3 rounded-lg text-white font-medium
                                ${!selectedFile || loading
                                    ? 'bg-purple-400'
                                    : 'bg-purple-600 hover:bg-purple-700'
                                } transition-colors`}
                        >
                            {loading ? 'Uploading...' : 'Upload'}
                        </button>

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProfilePictureUpload; 