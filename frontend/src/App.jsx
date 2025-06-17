import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@pages/Login';
import Register from '@pages/Register';
import Home from '@pages/Home'; // You need to create this file
import ChatPage from '@pages/ChatPage'; 
import Profile from '@pages/Profile';
import ForgotPassword from '@pages/ForgotPassword';
import PrivateRoute from '@components/PrivateRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route 
          path="/chat" 
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
