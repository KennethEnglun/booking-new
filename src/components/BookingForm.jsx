import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useBooking } from "../hooks/useBooking.js";
import { AiAssistant } from "./AiAssistant.jsx";
import { DateInputList } from "./DateInputList.jsx";

const BookingFormComponent = ({ onBookingSuccess, config }) => {
  const [venues, setVenues] = useState([]);
  const [venue, setVenue] = useState("");
  const [dates, setDates] = useState([dayjs().format("YYYY-MM-DD")]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");
  const [purposeType, setPurposeType] = useState("");
  const [customPurpose, setCustomPurpose] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const personInChargePlaceholder = "請輸入負責人姓名";
  const purposePlaceholder = "請填寫其他用途";
  
  const purposeOptions = [
    "會議",
    "課後活動", 
    "家長教育",
    "4RS",
    "課後托管",
    "加強輔導",
    "IEP",
    "其他"
  ];
  const {
    isSubmitting: isSubmittingFromHook,
    error: errorFromHook,
    success: successFromHook,
    availability,
    debouncedCheckConflicts,
    submitBooking,
    setError: setSubmitError
  } = useBooking({ onBookingSuccess, config });

  useEffect(() => {
    // 載入場地列表
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setVenues(data.venues || []);
        setVenue(data.venues?.[0] || "");
      })
      .catch(err => console.error('Failed to load venues:', err));
  }, []);

  useEffect(() => {
    if (venue && dates.length > 0 && dates.every(date => date)) {
      // 檢查所有日期的衝突
      debouncedCheckConflicts(venue, dates, startTime, endTime);
    }
  }, [venue, dates, startTime, endTime, debouncedCheckConflicts]);

  useEffect(() => {
    if (successFromHook) {
      setPurpose("");
      setPurposeType("");
      setCustomPurpose("");
    }
  }, [successFromHook]);

  // 處理用途選擇
  const handlePurposeTypeChange = (type) => {
    setPurposeType(type);
    if (type !== "其他") {
      setPurpose(type);
      setCustomPurpose("");
    } else {
      setPurpose("");
    }
  };

  const handleCustomPurposeChange = (value) => {
    setCustomPurpose(value);
    setPurpose(value);
  };

  const handleSuggestionClick = (newStartTime, newEndTime) => {
    setStartTime(newStartTime);
    setEndTime(newEndTime);
  };

  const handleAddDate = () => {
    setDates((prev) => [...prev, dayjs(prev[prev.length - 1]).add(1, "day").format("YYYY-MM-DD")]);
  };

  const handleDateChange = (index, value) => {
    const newDates = [...dates];
    newDates[index] = value;
    setDates(newDates);
  };

  const handleRemoveDate = (index) => {
    if (dates.length > 1) {
      setDates((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!personInCharge.trim()) {
      setSubmitError("請填寫負責人姓名。");
      return;
    }

    if (dates.some((date) => !date)) {
      setSubmitError("所有日期欄位都必須填寫。");
      return;
    }

    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length !== dates.length) {
      setSubmitError("請移除重複的預約日期。");
      return;
    }

    const bookingData = {
      venue,
      dates: uniqueDates,
      startTime,
      endTime,
      purpose: purpose.trim() || "未提供",
      personInCharge
    };

    await submitBooking(bookingData);
  };

  return (
    <div>
      <div className="bg-white dark:bg-gray-950 dark:border dark:border-gray-800 shadow-xl rounded-2xl">
        <div className="p-6 md:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">預約場地</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 sm:mb-8">請填寫預約資訊，標示 * 為必填欄位。</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="applicant" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">預約人 *</label>
                <input type="text" id="applicant" name="applicant" value={personInCharge} onChange={(e) => setPersonInCharge(e.target.value)} required 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"/>
              </div>

              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">場地 *</label>
                <select id="venue" name="venue" value={venue} onChange={(e) => setVenue(e.target.value)} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                  {venues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">預約日期 *</label>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                <DateInputList
                  dates={dates}
                  onDateChange={handleDateChange}
                  onAddDate={handleAddDate}
                  onRemoveDate={handleRemoveDate}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始時間 *</label>
                <input type="time" id="startTime" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} required 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"/>
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">結束時間 *</label>
                <input type="time" id="endTime" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"/>
              </div>
            </div>
            
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用途 *</label>
              <div className="flex flex-wrap items-center gap-2">
                  {purposeOptions.map(p => (
                      <button type="button" key={p} onClick={() => handlePurposeTypeChange(p)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                              purposeType === p
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                          }`}>
                          {p}
                      </button>
                  ))}
              </div>
              {purposeType === "其他" && (
                <input
                  type="text"
                  value={customPurpose}
                  onChange={(e) => handleCustomPurposeChange(e.target.value)}
                  placeholder={purposePlaceholder}
                  className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              )}
            </div>

            <div className="pt-4 text-center">
              <button type="submit" disabled={isSubmittingFromHook}
                className="w-full md:w-auto px-12 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-transform transform active:scale-95">
                {isSubmittingFromHook ? '檢查中...' : '檢查並預約'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {(errorFromHook || error) && <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-200">{errorFromHook || error}</div>}
      
      {successFromHook && <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg dark:bg-green-900/50 dark:border-green-500/50 dark:text-green-200">{successFromHook}</div>}

      <AiAssistant
        status={availability.status}
        conflictingBookings={availability.conflictingBookings}
        isLoading={availability.isLoading}
        suggestions={availability.suggestions}
        isSuggesting={availability.isSuggesting}
        onSuggestionClick={handleSuggestionClick}
      />

    </div>
  );
};

export { BookingFormComponent };
