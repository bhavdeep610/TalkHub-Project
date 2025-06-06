import React, { useState, useEffect } from 'react';
import { uploadProfilePicture, getProfilePicture, deleteProfilePicture } from '../services/profileService';
import defaultAvatar from '../assets/default-avatar.png';
import './ProfilePicture.css';

const ProfilePicture = ({ userId, editable = false, size = 'medium' }) => {
    const [imageUrl, setImageUrl] = useState(defaultAvatar);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadProfilePicture();
    }, [userId]);

    const loadProfilePicture = async () => {
        try {
            const data = await getProfilePicture(userId);
            if (data && data.fileUrl) {
                setImageUrl(`http://localhost:5000${data.fileUrl}`);
            }
        } catch (err) {
            console.error('Error loading profile picture:', err);
            setImageUrl(defaultAvatar);
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            setError('Please select a valid image file (JPEG, PNG, or GIF)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size should be less than 5MB');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await uploadProfilePicture(file);
            await loadProfilePicture();
        } catch (err) {
            setError(err.response?.data || 'Error uploading profile picture');
            console.error('Error uploading profile picture:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to remove your profile picture?')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await deleteProfilePicture();
            setImageUrl(defaultAvatar);
        } catch (err) {
            setError('Error deleting profile picture');
            console.error('Error deleting profile picture:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`profile-picture-container ${size}`}>
            <div className="profile-picture-wrapper">
                <img
                    src={imageUrl}
                    alt="Profile"
                    className={`profile-picture ${loading ? 'loading' : ''}`}
                />
                {loading && <div className="loading-spinner" />}
            </div>
            
            {editable && (
                <div className="profile-picture-actions">
                    <label className="upload-button">
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        Change Picture
                    </label>
                    {imageUrl !== defaultAvatar && (
                        <button onClick={handleDelete} className="delete-button">
                            Remove
                        </button>
                    )}
                </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default ProfilePicture; 