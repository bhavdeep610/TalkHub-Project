import React, { useState } from 'react';
import axios from 'axios';
import './ProfilePictureUpload.css';

const ProfilePictureUpload = ({ isOpen, onClose, onUploadSuccess }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
                setError('Please select a valid image file (JPEG, PNG, or GIF)');
                return;
            }
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('File size should be less than 5MB');
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
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
            const response = await axios.post('http://localhost:5211/api/ProfilePicture/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (onUploadSuccess) {
                onUploadSuccess(response.data);
            }
            onClose();
        } catch (err) {
            setError(err.response?.data || 'Error uploading profile picture');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="profile-upload-modal-overlay">
            <div className="profile-upload-modal">
                <div className="profile-upload-header">
                    <h2>Update Profile Picture</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="profile-upload-content">
                    {previewUrl && (
                        <div className="image-preview">
                            <img src={previewUrl} alt="Preview" />
                        </div>
                    )}

                    <div className="upload-controls">
                        <label className="file-input-label">
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                onChange={handleFileSelect}
                                className="file-input"
                            />
                            Choose File
                        </label>

                        <button
                            className="upload-button"
                            onClick={handleUpload}
                            disabled={!selectedFile || loading}
                        >
                            {loading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        </div>
    );
};

export default ProfilePictureUpload; 