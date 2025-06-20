import React, { useState } from 'react';
import axios from 'axios';
import { config } from '../src/config';

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

            const response = await axios.post(`${config.API_ENDPOINT}/ProfilePicture/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Upload response:', response.data);

            if (response.data) {
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
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]" onClick={onClose}>
                <div 
                    className="bg-white rounded-lg p-5 w-[90%] max-w-[500px] shadow-lg"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="text-2xl font-semibold text-gray-800">Upload Profile Picture</h2>
                        <button 
                            className="bg-transparent border-none text-2xl cursor-pointer text-gray-600 hover:text-gray-800 transition-colors"
                            onClick={onClose}
                        >
                            ×
                        </button>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div className="w-[200px] h-[200px] mx-auto rounded-full overflow-hidden border-2 border-gray-200">
                            {selectedFile && (
                                <img 
                                    src={URL.createObjectURL(selectedFile)} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>

                        <div className="flex flex-col gap-3 items-center">
                            <label 
                                className="bg-gray-100 px-5 py-2.5 rounded cursor-pointer hover:bg-gray-200 transition-colors"
                            >
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                                Choose File
                            </label>

                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || loading}
                                className={`w-[150px] py-2.5 px-5 rounded text-white transition-colors
                                ${!selectedFile || loading
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}
                        >
                            {loading ? 'Uploading...' : 'Upload'}
                        </button>

                        {error && (
                                <p className="text-red-600 text-center text-sm">
                                {error}
                                </p>
                            )}
                            </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProfilePictureUpload; 