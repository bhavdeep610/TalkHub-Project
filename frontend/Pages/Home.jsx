
import { Users, Shield, Zap, Globe } from 'lucide-react';
import "../src/index.css";
import { useNavigate } from 'react-router-dom';
import heroImg from '../src/assets/chat-illustration.avif'; 
import { motion } from 'framer-motion';
export default function NexChatHomepage() {
  const navigate = useNavigate();

  const handleLogin = () => {
    animateButton("login");
    setTimeout(() => navigate('/login'), 200);
  };

  const handleRegister = () => {
    animateButton("register");
    setTimeout(() => navigate('/register'), 200);
  };

  const animateButton = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("scale-90", "opacity-80");
    setTimeout(() => {
      el.classList.remove("scale-90", "opacity-80");
    }, 150);
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 text-gray-800">
      
      <nav className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 py-3 shadow-md text-base">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-2"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">💬</span>
            </div>
            <span className="text-xl font-bold text-white">TalkHub</span>
          </motion.div>

          <div className="flex items-center space-x-3">
            <button 
              id="login"
              className="px-4 py-1.5 bg-white text-purple-700 rounded-lg font-medium transition-all transform hover:scale-105 hover:shadow-md"
              onClick={handleLogin}
            >
              Log In
            </button>
            <button 
              id="register"
              className="px-4 py-1.5 bg-yellow-400 text-white rounded-lg font-medium shadow-md transition-all transform hover:scale-105 hover:bg-yellow-500"
              onClick={handleRegister}
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-56px)]">
        <div className="grid lg:grid-cols-2 gap-10 items-center h-full">
          
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-snug">
                Welcome to <span className="text-purple-700">TalkHub</span>
              </h1>
              <p className="text-base md:text-lg text-gray-700">
                Connect with your team in vibrant new ways. Chat, share, and collaborate seamlessly.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: Users, text: "Connect with your team in one place" },
                { icon: Shield, text: "Top-notch security and privacy" },
                { icon: Zap, text: "Fast messaging and sharing" },
                { icon: Globe, text: "Use it anywhere, any device" },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div 
                  key={i}
                  className="flex items-center space-x-3"
                  whileHover={{ scale: 1.05 }}
                >
                  <Icon className="w-5 h-5 text-purple-600" />
                  <span className="text-sm md:text-base font-medium">{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            className="bg-white rounded-2xl shadow-xl p-6 space-y-5 border border-purple-100"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <img 
              src={heroImg} 
              alt="Chat Illustration" 
              className="w-full max-h-48 object-contain mb-4 rounded-lg shadow-sm" 
            />
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-gray-900">Get Started with TalkHub</h2>
              <p className="text-gray-600 text-sm">
                Sign in or create a new account to connect instantly.
              </p>
            </div>
            <div className="space-y-3">
              <button
                id="login"
                onClick={handleLogin}
                className="w-full bg-purple-600 text-white py-2 rounded-xl font-semibold transition-all transform hover:scale-105 hover:bg-purple-700"
              >
                Log In
              </button>
              <button
                id="register"
                onClick={handleRegister}
                className="w-full border border-purple-600 text-purple-600 py-2 rounded-xl font-semibold transition-all transform hover:scale-105 hover:bg-purple-50"
              >
                Sign Up
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
