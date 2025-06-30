import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import weekday from "dayjs/plugin/weekday";
import { BookingFormComponent } from "./components/BookingForm.jsx";
import { ScheduleComponent } from "./components/Schedule.jsx";

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekday);

function AdminLoginModal({ onLogin, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLoginClick = () => {
    if (password === "512524") {
      onLogin();
    } else {
      setError("密碼錯誤，請重試。");
      setPassword("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLoginClick();
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">管理員登入</h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="請輸入密碼"
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="flex justify-end space-x-2 mt-4">
          <button onClick={onCancel} className="px-4 py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">取消</button>
          <button onClick={handleLoginClick} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">登入</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("booking");
  const [config, setConfig] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  
  const appTitle = "LPMS場地預約系統";
  const appSubtitle = "九龍婦女福利會李炳紀念學校 Kowloon Women's Welfare Club Li Ping Memorial School";

  useEffect(() => {
    // 載入配置
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setShowAdminLogin(false);
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
  };

  const handleBookingSuccess = () => {
    setActiveTab("schedule");
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  if (!config) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100 dark:bg-gray-900">
        <div className="text-lg font-semibold text-gray-600 dark:text-gray-300">載入中...</div>
      </div>
    );
  }

  const NavButton = ({ tabName, currentTab, onClick, children }) => {
    const isActive = tabName === currentTab;
    return (
      <button
        onClick={() => onClick(tabName)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
          isActive
            ? "bg-blue-600 text-white shadow-md"
            : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
        }`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black font-sans text-gray-800 dark:text-gray-200">
      {showAdminLogin && <AdminLoginModal onLogin={handleAdminLoginSuccess} onCancel={() => setShowAdminLogin(false)} />}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{appTitle}</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{appSubtitle}</p>
                </div>
                 <div className="flex items-center space-x-4">
                    <button onClick={toggleTheme} className="w-10 h-10 flex justify-center items-center rounded-full text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                      {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    {isAdmin ? (
                       <button onClick={handleAdminLogout} className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">登出管理員</button>
                    ) : (
                      <button onClick={() => setShowAdminLogin(true)} className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors">管理員登入</button>
                    )}
                </div>
            </div>
            <nav className="mt-3 flex items-center space-x-2">
                <NavButton tabName="booking" currentTab={activeTab} onClick={setActiveTab}>預約場地</NavButton>
                <NavButton tabName="schedule" currentTab={activeTab} onClick={setActiveTab}>預約總覽</NavButton>
            </nav>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <div key={activeTab} className="animate-fadeInUp">
          {activeTab === 'booking' && <BookingFormComponent onBookingSuccess={handleBookingSuccess} config={config} />}
          {activeTab === 'schedule' && <ScheduleComponent isAdmin={isAdmin} config={config} />}
        </div>
      </main>
    </div>
  );
}

export default App; 