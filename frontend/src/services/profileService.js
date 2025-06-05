import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/ProfilePicture/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data;
};

export const getProfilePicture = async (userId) => {
    const response = await axios.get(`${API_URL}/ProfilePicture/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data;
};

export const deleteProfilePicture = async () => {
    await axios.delete(`${API_URL}/ProfilePicture`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
}; 