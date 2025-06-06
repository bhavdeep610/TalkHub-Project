import React, { useState, useEffect } from 'react';cd 
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from '../src/components/ThemeToggle';
import { useTheme } from '../src/contexts/ThemeContext';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [profilePicture, setProfilePicture] = useState(null);
    const [username, setUsername] = useState('');
    const { isDarkMode } = useTheme();
    
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

            const response = await axios.get(`https://talkhub-backend-02fc.onrender.com/api/ProfilePicture/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data) {
                let imageUrl = null;
                
                // Handle different response formats
                if (typeof response.data === 'string') {
                    imageUrl = response.data;
                } else if (response.data.imageUrl) {
                    imageUrl = response.data.imageUrl;
                } else if (response.data.fileUrl) {
                    imageUrl = response.data.fileUrl;
                }

                // Only set the profile picture if we have a valid URL
                if (imageUrl) {
                    // Ensure the URL is absolute
                    if (!imageUrl.startsWith('http')) {
                        imageUrl = `https://talkhub-backend-02fc.onrender.com${imageUrl}`;
                    }
                    setProfilePicture(imageUrl);
                }
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
        <header className={`w-full px-5 py-2 sticky top-0 z-50 transition-colors duration-200 ${
            isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-200'
        } border-b`}>
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center space-x-8">
                    <h1 className={`text-2xl font-semibold ${
                        isDarkMode ? 'text-purple-400' : 'text-purple-700'
                    } cursor-pointer`}>
                        TalkHub
                    </h1>
                </div>
                
                <div className="flex items-center space-x-4">
                    <ThemeToggle />
                    <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-full overflow-hidden border-2 ${
                            isDarkMode ? 'border-purple-400' : 'border-purple-600'
                        } flex items-center justify-center ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
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
                                <span className={`text-sm font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                }`}>
                                    {username[0]?.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <span className={`text-sm font-medium ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                            {username}
                        </span>
                        <Link
                            to="/profile"
                            className={`px-4 py-2 text-sm font-medium ${
                                isDarkMode ? 'text-purple-400 bg-purple-700' : 'text-purple-600 bg-purple-50'
                            } rounded-md transition-colors duration-200 hover:bg-purple-100`}
                        >
                            Profile
                        </Link>
                        <button 
                            onClick={handleLogout}
                            className={`px-4 py-2 text-sm font-medium ${
                                isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                            } rounded-md transition-colors duration-200`}
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