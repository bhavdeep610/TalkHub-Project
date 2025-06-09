image.pngimport React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProfilePictureUpload from './ProfilePictureUpload';
import './Header.css';

const Header = () => {
    const navigate = useNavigate();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [profilePicture, setProfilePicture] = useState(null);
    
    useEffect(() => {
        loadProfilePicture();
    }, []);

    const loadProfilePicture = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;

            const response = await axios.get(`http://localhost:5000/api/ProfilePicture/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.data && response.data.imageUrl) {
                setProfilePicture(response.data.imageUrl);
            }
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        navigate('/login');
    };

    const handleProfileClick = () => {
        setIsUploadModalOpen(true);
    };

    const handleUploadSuccess = (data) => {
        if (data && data.imageUrl) {
            setProfilePicture(data.imageUrl);
        }
    };

    return (
        <header className="header">
            <div className="logo">TalkHub</div>
            <div className="user-controls">
                <div className="profile-section" onClick={handleProfileClick}>
                    {profilePicture ? (
                        <img src={profilePicture} alt="Profile" className="profile-picture" />
                    ) : (
                        <div className="profile-initial">
                            {localStorage.getItem('username')?.[0]?.toUpperCase() || 'R'}
                        </div>
                    )}
                </div>
                <span className="username">{localStorage.getItem('username') || 'raj'}</span>
                <button className="logout-button" onClick={handleLogout}>
                    Logout
                </button>
            </div>

            <ProfilePictureUpload
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />
        </header>
    );
};

export default Header; 