import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '@services/api';
import ProfilePictureUpload from '@components/ProfilePictureUpload';

const Profile = () => {
    const navigate = useNavigate();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [profileData, setProfileData] = useState({
        fullName: '',
        email: '',
        profilePicture: null,
        memberSince: '',
        accountStatus: 'Active'
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
            navigate('/login');
            return;
        }

        loadProfileData();
    }, [navigate]);

    const loadProfileData = async () => {
        try {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');
            
            if (!userId || !token) {
                console.log('Missing userId or token');
                navigate('/login');
                return;
            }

            // Load user data from backend
            const userResponse = await axios.get(`https://talkhub-backend-02fc.onrender.com/api/User/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const userData = {
                fullName: userResponse.data.userName || '',
                email: userResponse.data.email || '',
                memberSince: new Date(userResponse.data.created).toISOString().split('T')[0],
                accountStatus: 'Active'
            };

            // Load profile picture
            try {
                const response = await API.get(`/ProfilePicture/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.data) {
                    const rawUrl = typeof response.data === 'string' 
                        ? response.data
                        : (response.data.imageUrl || response.data);
                    
                    const imageUrl = rawUrl.startsWith('http')
                        ? rawUrl
                        : `${API.defaults.baseURL}/${rawUrl}`;
                    
                    userData.profilePicture = imageUrl;
                }
            } catch (error) {
                console.error('Error loading profile picture:', error);
                if (error.response?.status === 401) {
                    navigate('/login');
                    return;
                }
            }

            setProfileData(userData);
        } catch (error) {
            console.error('Error loading profile data:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    };

    const handleUploadSuccess = async (data) => {
        if (data) {
            const rawUrl = typeof data === 'string'
                ? data
                : (data.imageUrl || data);
            
            const imageUrl = rawUrl.startsWith('http')
                ? rawUrl
                : `${API.defaults.baseURL}/${rawUrl}`;
            
            setProfileData(prev => ({
                ...prev,
                profilePicture: imageUrl
            }));
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header - Fixed */}
            <header className="w-full px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={() => navigate('/chat')}
                            className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-semibold text-purple-600">TalkHub</h1>
                    </div>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-200">
                <div className="max-w-2xl mx-auto px-4 py-8">
                    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                        <h2 className="text-2xl font-semibold text-purple-600 mb-2">Profile</h2>
                        <p className="text-gray-600 mb-8">Your profile information</p>

                        {/* Profile Picture Section */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="relative">
                                <div className="w-32 h-32 rounded-full border-4 border-purple-500 overflow-hidden bg-gray-100 shadow-lg">
                                    {profileData.profilePicture ? (
                                        <img 
                                            src={profileData.profilePicture} 
                                            alt="Profile" 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                setProfileData(prev => ({
                                                    ...prev,
                                                    profilePicture: null
                                                }));
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-purple-100">
                                            <span className="text-3xl font-semibold text-purple-600">
                                                {profileData.fullName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setIsUploadModalOpen(true)}
                                    className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors duration-200"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                            <h3 className="mt-4 text-xl font-semibold text-gray-800">{profileData.fullName}</h3>
                            <p className="text-gray-500">{profileData.email}</p>
                        </div>

                        {/* Profile Information */}
                        <div className="space-y-6">
                            {/* Member Since */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500">Member Since</h4>
                                    <p className="text-gray-800">{profileData.memberSince}</p>
                                </div>
                            </div>

                            {/* Account Status */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500">Account Status</h4>
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                        <p className="text-gray-800">{profileData.accountStatus}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Picture Upload Modal */}
            {isUploadModalOpen && (
                <ProfilePictureUpload
                    onClose={() => setIsUploadModalOpen(false)}
                    onUploadSuccess={handleUploadSuccess}
                />
            )}
        </div>
    );
};

export default Profile; 