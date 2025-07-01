import { useState, useCallback } from 'react';
import dayjs from 'dayjs';

// Debounce function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

export const useBooking = ({ onBookingSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [availability, setAvailability] = useState({ 
        status: 'idle', 
        conflictingBookings: [], 
        isLoading: false, 
        suggestions: [], 
        isSuggesting: false 
    });

    const conflictCheckDebounceMs = 500;
    const successRedirectDelay = 2500;
    
    const checkConflicts = useCallback(async (venue, dates, startTime, endTime) => {
        // 如果是單個日期，轉換為陣列
        const dateArray = Array.isArray(dates) ? dates : [dates];
        
        if (!dateArray.length || !startTime || !endTime || dateArray.some(date => !date)) {
            setAvailability({ status: 'idle', conflictingBookings: [], isLoading: false, suggestions: [], isSuggesting: false });
            return;
        }

        // 檢查時間是否有效
        if (dayjs(`${dateArray[0]} ${endTime}`).isSameOrBefore(dayjs(`${dateArray[0]} ${startTime}`))) {
            setAvailability({ status: 'idle', conflictingBookings: [], isLoading: false, suggestions: [], isSuggesting: false });
            return;
        }

        setAvailability(prev => ({ ...prev, isLoading: true, isSuggesting: false, suggestions: [] }));

        try {
            const response = await fetch('/api/check-conflicts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ venue, dates: dateArray, startTime, endTime }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if (data.status === 'conflict') {
                setAvailability({ 
                    status: 'conflict', 
                    conflictingBookings: data.conflicts, 
                    isLoading: false, 
                    suggestions: [], 
                    isSuggesting: true 
                });
                
                // 等待 AI 建議
                setTimeout(() => {
                    setAvailability({ 
                        status: 'conflict', 
                        conflictingBookings: data.conflicts, 
                        isLoading: false, 
                        suggestions: data.suggestions || [], 
                        isSuggesting: false 
                    });
                }, 1500); // 模擬 AI 處理時間
            } else {
                setAvailability({ 
                    status: 'available', 
                    conflictingBookings: [], 
                    isLoading: false, 
                    suggestions: [], 
                    isSuggesting: false 
                });
            }
        } catch (err) {
            console.error("Conflict check failed:", err);
            setAvailability({ 
                status: 'error', 
                conflictingBookings: [], 
                isLoading: false, 
                suggestions: [], 
                isSuggesting: false 
            });
        }
    }, []);

    const debouncedCheckConflicts = useCallback(debounce(checkConflicts, conflictCheckDebounceMs), [checkConflicts]);

    const submitBooking = useCallback(async (bookingData) => {
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const userResponse = await fetch('/api/user');
            const currentUser = await userResponse.json();

            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...bookingData,
                    currentUser
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '無法解析錯誤回應' }));
                throw new Error(errorData.message || '預約請求失敗');
            }

            const data = await response.json();

            if (data.success) {
                setSuccess(data.message);
                if (onBookingSuccess) {
                    setTimeout(() => {
                        onBookingSuccess();
                        setSuccess('');
                    }, 2000);
                }
            } else {
                 const failedDates = data.details.filter(d => !d.success).map(d => `${d.date} (${d.message})`).join(', ');
                 setError(`部分預約失敗: ${failedDates}`);
            }

        } catch (err) {
            console.error('Booking submission failed:', err);
            setError(`系統發生錯誤，預約失敗: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    }, [onBookingSuccess]);
    
    return {
        isSubmitting,
        error,
        success,
        availability,
        debouncedCheckConflicts,
        submitBooking,
        setError,
    };
};