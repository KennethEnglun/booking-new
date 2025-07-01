import React, { useState, useEffect } from "react";
import { BookingFormComponent as BookingForm } from "./components/BookingForm";
import { ScheduleComponent as Schedule } from "./components/Schedule";
import { useAuth } from './context/AuthContext';
import LoginModal from './components/LoginModal';

const App = () => {
  const [activeTab, setActiveTab] = useState("booking");
  const { currentUser, logout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans">
      <header className="bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 text-white font-bold text-lg">
                LPMS場地預約系統
                <p className="text-xs font-normal text-gray-400">
                  九龍婦女福利會李炳紀念學校 Kowloon Women's Welfare Club Li
                  Ping Memorial School
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
               <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <button
                    onClick={() => setActiveTab("booking")}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                      activeTab === "booking"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    預約場地
                  </button>
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                      activeTab === "schedule"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    預約總覽
                  </button>
                </div>
              </div>
              {currentUser ? (
                <div className="flex items-center">
                  <span className="text-white text-sm mr-4">歡迎, {currentUser.name}</span>
                  <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition">登出</button>
                </div>
              ) : (
                <button onClick={() => setIsLoginModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium transition">
                  管理員登入
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div key={activeTab} className="animate-fadeIn">
          {activeTab === 'booking' && <BookingForm />}
          {activeTab === 'schedule' && <Schedule />}
        </div>
      </main>
      
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
};

export default App; 