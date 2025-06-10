import React from 'react';
import './ProfilePicture.css';

const ProfilePicture = ({ imageUrl, size = '40px', onClick }) => {
  return (
    <div
      className="profile-picture"
      style={{
        width: size,
        height: size,
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Profile"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
        />
      ) : (
        <div
          className="default-avatar"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ccc',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `calc(${size} * 0.4)`
          }}
        >
          👤
        </div>
      )}
    </div>
  );
};

export default ProfilePicture; 