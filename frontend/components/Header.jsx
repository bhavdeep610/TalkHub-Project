import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { profilePictureService } from '../src/services/profilePictureService';

const Header = () => {
    const navigate = useNavigate();
    useLocation();
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
            if (!userId) return;

            const imageUrl = await profilePictureService.getProfilePicture(userId);
            setProfilePicture(imageUrl);
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        navigate('/login');
    };

    if (!username) {
        return null;
    }

    return (
        <header className="w-full px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="flex items-center justify-between max-w-[1200px] mx-auto">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold text-gray-900 cursor-pointer hover:text-purple-600 transition-colors">
                        TalkHub
                    </h1>
                    
                    
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 px-2 py-1 rounded-lg">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-600 transform hover:scale-105 transition-transform duration-200">
                                {profilePicture ? (
                                    <img 
                                        src={profilePicture} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            setProfilePicture(null);
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                                        <span className="text-sm font-medium text-purple-600">
                                            {username[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <span className="text-[0.95rem] font-medium text-gray-700">
                                {username}
                            </span>
                        </div>

                        <Link
                            to="/profile"
                            className="px-5 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md 
                                transition-all duration-200 hover:bg-purple-100 uppercase tracking-wide"
                        >
                            Profile
                        </Link>
                        
                        <button 
                            onClick={handleLogout}
                            className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-md 
                                transition-all duration-200 hover:bg-purple-700 uppercase tracking-wide 
                                active:transform active:translate-y-px"
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