import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API from '@services/api';
import ProfilePictureUpload from '@components/ProfilePictureUpload';

const Profile = () => {
    const navigate = useNavigate();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [error, setError] = useState('');
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

            setEditUsername(userData.fullName);
            setProfileData(userData);

            // Load profile picture
            try {
                const response = await API.get(`/ProfilePicture/${userId}`);
                if (response.data) {
                    const rawUrl = typeof response.data === 'string' 
                        ? response.data
                        : (response.data.imageUrl || response.data);
                    
                    const imageUrl = rawUrl.startsWith('http')
                        ? rawUrl
                        : `${API.defaults.baseURL}/${rawUrl}`;
                    
                    setProfileData(prev => ({
                        ...prev,
                        profilePicture: imageUrl
                    }));
                }
            } catch (error) {
                console.error('Error loading profile picture:', error);
                if (error.response?.status === 401) {
                    navigate('/login');
                }
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    };

    const handleSaveUsername = async () => {
        if (!editUsername.trim() || editUsername.length < 2) {
            setError('Username must be at least 2 characters long');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.put(`https://talkhub-backend-02fc.onrender.com/api/User/update`, {
                fullName: editUsername
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            localStorage.setItem('username', editUsername);
            setProfileData(prev => ({
                ...prev,
                fullName: editUsername
            }));
            setIsEditing(false);
            setError('');
        } catch (error) {
            console.error('Error updating username:', error);
            setError('Failed to update username');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center">
                        <button 
                            onClick={() => navigate('/chat')}
                            className="mr-4 text-gray-600 hover:text-gray-900"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-purple-600">Profile</h1>
                    </div>
                </div>
            </header>

            {/* Profile Content */}
            <main className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Profile Picture Section */}
                    <div className="p-8 flex flex-col items-center">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500">
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
                                    <div className="w-full h-full bg-purple-100 flex items-center justify-center">
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
                        <p className="mt-2 text-sm text-gray-500">Click the camera icon to update your photo</p>
                    </div>

                    {/* Profile Information */}
                    <div className="px-8 py-6 border-t border-gray-200">
                        <div className="space-y-6">
                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    {isEditing ? (
                                        <div className="flex-1 flex space-x-2">
                                            <input
                                                type="text"
                                                value={editUsername}
                                                onChange={(e) => setEditUsername(e.target.value)}
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                                            />
                                            <button
                                                onClick={handleSaveUsername}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setEditUsername(profileData.fullName);
                                                    setError('');
                                                }}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex justify-between items-center">
                                            <span className="block w-full px-3 py-2 sm:text-sm text-gray-900">
                                                {profileData.fullName}
                                            </span>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-purple-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                            </div>

                            {/* Email - Read Only */}
                            <div>
                                <div className="flex items-center">
                                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                    <span className="ml-2 text-xs text-gray-500">(Read-only)</span>
                                </div>
                                <div className="mt-1">
                                    <div className="flex-1 block w-full px-3 py-2 sm:text-sm text-gray-600 bg-gray-50 rounded-md border border-gray-200">
                                        {profileData.email}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Information */}
                            <div className="pt-6 border-t border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Member Since</label>
                                        <div className="mt-1 text-sm text-gray-900">{profileData.memberSince}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Account Status</label>
                                        <div className="mt-1 flex items-center">
                                            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                            <span className="text-sm text-gray-900">{profileData.accountStatus}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Profile Picture Upload Modal */}
            {isUploadModalOpen && (
                <ProfilePictureUpload
                    onClose={() => setIsUploadModalOpen(false)}
                    onUploadSuccess={(data) => {
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
                        setIsUploadModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default Profile; 