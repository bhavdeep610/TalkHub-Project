import  { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../src/services/api';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password.trim()) {
      const message = 'Please enter both username and password';
      toast.error(message, {
        duration: 3000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
      });
      setError(message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await API.post('/auth/login', {
        username: username.trim(),
        password: password.trim()
      });

      if (response.data && response.data.token) {
        const token = response.data.token;
        localStorage.setItem('token', token);
        localStorage.setItem('username', username.trim());
        localStorage.setItem('userId', response.data.userId.toString());
        
        API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        toast.success('Login successful! Redirecting...', {
          duration: 1000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '12px',
            borderRadius: '8px',
          },
        });

        setError('');
        
        navigate('/chat');
      } else {
        throw new Error('Invalid response from server: No token received');
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage;
      
      if (error.response) {
        switch (error.response.status) {
          case 400:
          case 401:
            errorMessage = 'Incorrect username or password';
            break;
          case 404:
            errorMessage = 'User not found';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later';
            break;
          default:
            errorMessage = 'Login failed. Please check your credentials';
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection';
      } else {
        errorMessage = 'Login failed. Please try again';
      }

      setPassword('');
      setError(errorMessage);
      
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '12px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 flex items-center justify-center px-4 overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md border border-purple-100"
      >
        <h2 className="text-3xl font-extrabold text-center text-purple-700 mb-6">Welcome Back</h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              placeholder="Username"
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              placeholder="Password"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-0.5 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={togglePasswordVisibility}
              disabled={isLoading}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18M10.58 10.58a3 3 0 104.24 4.24M9.88 9.88l-.36-.36m5.66 5.66l-.36-.36M21 21L3 3" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5s8.573 3.007 9.963 7.178a1.012 1.012 0 010 .639C20.577 16.49 16.64 19.5 12 19.5s-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isLoading ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-purple-600 hover:text-purple-500"
              >
                Forgot your password?
              </Link>
            </div>
            <div className="text-sm">
              <Link
                to="/register"
                className="font-medium text-purple-600 hover:text-purple-500"
              >
                Don't have an account? Sign up
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-purple-600 font-medium hover:underline"
            disabled={isLoading}
          >
            ⬅ Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
