import API from './api';

export const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await API.post('/ProfilePicture/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data;
};

export const getProfilePicture = async (userId) => {
    const response = await API.get(`/ProfilePicture/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
    return response.data;
};

export const deleteProfilePicture = async () => {
    await API.delete('/ProfilePicture', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });
}; 