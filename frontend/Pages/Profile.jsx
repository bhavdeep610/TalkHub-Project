import  { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../src/services/api';
import ProfilePictureUpload from '../components/ProfilePictureUpload';

const Profile = () => {
    const navigate = useNavigate();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState({
        fullName: false
    });
    const [editData, setEditData] = useState({
        fullName: ''
    });
    const [errors, setErrors] = useState({
        fullName: ''
    });
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

            const userResponse = await API.get('/User/profile');

            const userData = {
                fullName: userResponse.data.userName || '',
                email: userResponse.data.email || '',
                memberSince: new Date(userResponse.data.created).toISOString().split('T')[0],
                accountStatus: 'Active'
            };

            setEditData({
                fullName: userResponse.data.userName || ''
            });

            try {
                const response = await API.get(`/ProfilePicture/${userId}`);
                
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

    const validateField = (name, value) => {
        let error = '';
        switch (name) {
            case 'fullName':
                if (!value.trim()) {
                    error = 'Full name is required';
                } else if (value.length < 2) {
                    error = 'Full name must be at least 2 characters';
                }
                break;
            default:
                break;
        }
        return error;
    };

    const handleEdit = (field) => {
        setIsEditing(prev => ({ ...prev, [field]: true }));
        setEditData(prev => ({ ...prev, [field]: profileData[field] }));
    };

    const handleCancel = (field) => {
        setIsEditing(prev => ({ ...prev, [field]: false }));
        setEditData(prev => ({ ...prev, [field]: profileData[field] }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const handleChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
        const error = validateField(field, value);
        setErrors(prev => ({ ...prev, [field]: error }));
    };

    const handleSave = async (field) => {
        const error = validateField(field, editData[field]);
        if (error) {
            setErrors(prev => ({ ...prev, [field]: error }));
            return;
        }

        try {
            await API.put('/User/update', {
                [field]: editData[field]
            });

            if (field === 'fullName') {
                localStorage.setItem('username', editData[field]);
            }

            setProfileData(prev => ({
                ...prev,
                [field]: editData[field]
            }));

            setIsEditing(prev => ({ ...prev, [field]: false }));
            setErrors(prev => ({ ...prev, [field]: '' }));

        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            setErrors(prev => ({ 
                ...prev, 
                [field]: error.response?.data?.message || `Failed to update ${field}` 
            }));
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
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

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-200">
                <div className="max-w-2xl mx-auto px-4 py-8">
                    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                        <h2 className="text-2xl font-semibold text-purple-600 mb-2">Profile</h2>
                        <p className="text-gray-600 mb-8">Your profile information</p>

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
                                        <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
                                            {profileData.fullName[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setIsUploadModalOpen(true)}
                                    className="absolute bottom-0 right-0 bg-purple-600 p-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors duration-200 transform hover:scale-105"
                                >
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="mt-4 text-sm text-gray-500">Click the camera icon to update your photo</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">Username</label>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="text"
                                        value={isEditing.fullName ? editData.fullName : profileData.fullName}
                                        onChange={(e) => handleChange('fullName', e.target.value)}
                                        readOnly={!isEditing.fullName}
                                        className={`flex-1 px-4 py-2 ${isEditing.fullName ? 'bg-white' : 'bg-gray-50'} border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors duration-200`}
                                    />
                                    <div className="flex space-x-2">
                                        {isEditing.fullName ? (
                                            <>
                                                <button
                                                    onClick={() => handleSave('fullName')}
                                                    disabled={!!errors.fullName}
                                                    className="text-green-600 hover:text-green-700 disabled:text-gray-400 px-3 py-2"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => handleCancel('fullName')}
                                                    className="text-red-600 hover:text-red-700 px-3 py-2"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleEdit('fullName')}
                                                className="text-purple-600 hover:text-purple-700 px-3 py-2"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {errors.fullName && (
                                    <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center">
                                    <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
                                </div>
                                <div className="flex items-center">
                                    <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                                        {profileData.email}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-medium text-purple-600 mb-4">Account Information</h3>
                                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Member Since</span>
                                        <span className="text-gray-800">{profileData.memberSince}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Account Status</span>
                                        <span className="text-green-600">{profileData.accountStatus}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ProfilePictureUpload
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />
        </div>
    );
};

export default Profile; 