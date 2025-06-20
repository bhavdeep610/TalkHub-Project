import  { useState } from 'react';
import API from '../src/services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const navigate = useNavigate();

  const validateUsername = (username) => {
    if (!username.trim()) {
      return 'Username is required';
    }
    if (username.length < 3 || username.length > 20) {
      return 'Username must be between 3 and 20 characters';
    }
    if (!/^[a-z][a-z0-9._]*$/.test(username)) {
      return 'Username must start with a lowercase letter and can only contain lowercase letters, numbers, dots, and underscores';
    }
    if (/[._]{2,}/.test(username)) {
      return 'Username cannot contain consecutive dots or underscores';
    }
    if (/[._]$/.test(username)) {
      return 'Username cannot end with a dot or underscore';
    }
    return '';
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value.toLowerCase();
    setUsername(newUsername);
    const error = validateUsername(newUsername);
    setUsernameError(error);
  };

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasNumber && hasSpecialChar,
      errors: {
        minLength,
        hasUpperCase,
        hasNumber,
        hasSpecialChar
      }
    };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const usernameValidationError = validateUsername(username);
    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      return;
    }

    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      let errorMessage = 'Password must contain:';
      if (!errors.minLength) errorMessage += '\n- Minimum 8 characters';
      if (!errors.hasUpperCase) errorMessage += '\n- At least 1 uppercase letter';
      if (!errors.hasNumber) errorMessage += '\n- At least 1 number';
      if (!errors.hasSpecialChar) errorMessage += '\n- At least 1 special character';
      
      setError(errorMessage);
      return;
    }

    try {
      const response = await API.post('/auth/register', {
        username,
        email,
        password
      });

      if (response.data) {
        toast.success('Registration successful! Redirecting to login...', {
          duration: 1000,
          position: 'top-center',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '16px',
            borderRadius: '10px',
            fontWeight: '500',
          },
        });

        setTimeout(() => {
          navigate('/login');
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed.';
      setError(errorMessage);
      
      toast.error('Registration failed. Please try again.', {
        duration: 3000,
        position: 'top-center',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '10px',
          fontWeight: '500',
        },
      });
      
      console.error('Full error:', error);
      console.error('Response data:', error.response?.data);
      console.error('Status:', error.response?.status);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const passwordValidation = validatePassword(password);
  const getValidationColor = (isValid) => isValid ? 'text-green-600' : 'text-red-600';

  return (
    <div className="h-screen w-full bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 flex items-center justify-center px-4 overflow-hidden">
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '10px',
            padding: '16px',
          },
        }}
      />
      <motion.div
        className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md border border-purple-100"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-extrabold text-center text-purple-700 mb-6">Create Your Account</h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl whitespace-pre-line"
          >
            <span className="block sm:inline">{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <input
              className={`w-full px-4 py-2 border ${usernameError ? 'border-red-300' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700`}
              placeholder="Username"
              value={username}
              onChange={handleUsernameChange}
              required
            />
            {usernameError && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 text-sm text-red-600"
              >
                {usernameError}
              </motion.p>
            )}
          </div>
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setShowPasswordHint(true)}
              onBlur={() => setShowPasswordHint(false)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            {showPasswordHint && (
              <div className="absolute top-full left-0 w-full mt-2 bg-purple-50 border border-purple-200 text-sm rounded-xl px-4 py-3 shadow-md z-10">
                <p className="font-semibold mb-1">Password requirements:</p>
                <ul className="list-none space-y-1">
                  <li className={getValidationColor(passwordValidation.errors.minLength)}>
                    ✓ Minimum 8 Characters
                  </li>
                  <li className={getValidationColor(passwordValidation.errors.hasUpperCase)}>
                    ✓ At least 1 uppercase letter (A-Z)
                  </li>
                  <li className={getValidationColor(passwordValidation.errors.hasNumber)}>
                    ✓ At least 1 number (0-9)
                  </li>
                  <li className={getValidationColor(passwordValidation.errors.hasSpecialChar)}>
                    ✓ At least 1 special character (e.g., ! @ # $)
                  </li>
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="mt-6 w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold transition-all duration-300 ease-in-out transform hover:scale-105 hover:bg-purple-700 hover:shadow-lg relative z-10"
          >
            Register
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-purple-600 font-semibold hover:underline"
          >
            Login
          </button>
        </p>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-purple-600 font-medium hover:underline"
          >
            ⬅ Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default Register;
