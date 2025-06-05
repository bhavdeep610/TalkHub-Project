import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [profilePicture, setProfilePicture] = useState(null);
    const [username, setUsername] = useState('');
    
    useEffect(() => {
        loadProfilePicture();
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const loadProfilePicture = async () => {
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            
            if (!userId || !token) {
                console.log('Missing userId or token');
                return;
            }

            console.log('Fetching profile picture for user:', userId);
            const response = await axios.get(`https://talkhub-backend-02fc.onrender.com/api/ProfilePicture/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Profile picture response:', response.data);
            
            if (response.data) {
                // Handle both string and object responses
                const rawUrl = typeof response.data === 'string' 
                    ? response.data
                    : (response.data.imageUrl || response.data);
                
                // If it's already a full URL (starts with http or https), use it as is
                const imageUrl = rawUrl.startsWith('http') 
                    ? rawUrl 
                    : `http://xxx/${rawUrl}`;
                
                console.log('Setting profile picture URL:', imageUrl);
                setProfilePicture(imageUrl);
            }
        } catch (error) {
            console.error('Error loading profile picture:', error);
            if (error.response) {
                console.error('Error response:', error.response.data);
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        navigate('/login');
    };

    // If no username is found, redirect to login
    if (!username) {
        return null;
    }

    return (
        <header className="w-full px-5 py-2 bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center space-x-8">
                    <h1 className="text-2xl font-semibold text-purple-700 cursor-pointer">
                TalkHub
                    </h1>
                </div>
                
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-600 flex items-center justify-center bg-gray-100">
                            {profilePicture ? (
                                <img 
                                    src={profilePicture} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        console.error('Error loading image:', e);
                                        e.target.onerror = null;
                                        setProfilePicture(null);
                                    }}
                                />
                            ) : (
                                <span className="text-sm font-medium text-gray-600">
                                    {username[0]?.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                            {username}
                        </span>
                        <Link
                            to="/profile"
                            className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md transition-colors duration-200 hover:bg-purple-100"
                        >
                            Profile
                        </Link>
                        <button 
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md transition-colors duration-200 hover:bg-purple-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header; 