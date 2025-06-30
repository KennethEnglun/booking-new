import React, { useState, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { ScheduleGrid } from "./ScheduleGrid.jsx";

dayjs.extend(isSameOrAfter);

const ScheduleComponent = ({ isAdmin, config }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [venues, setVenues] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  
  // States for 'list' view
  const [filterVenue, setFilterVenue] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedBookings, setSelectedBookings] = useState(new Set());

  // State for 'grid' view
  const [gridDate, setGridDate] = useState('');

  const sortedBookings = useMemo(() => 
    bookings.slice().sort((a, b) => dayjs(a.booking_date).diff(dayjs(b.booking_date))),
  [bookings]);

  useEffect(() => {
    if (sortedBookings.length > 0) {
      setGridDate(sortedBookings[0].booking_date);
    }
  }, [sortedBookings]);

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bookings');
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    if (config?.venues) {
        setVenues(config.venues);
    }
  }, [config, loadBookings]);

  // Set initial grid date when bookings are loaded for the first time
  useEffect(() => {
    if (bookings.length > 0 && !gridDate) {
      // Find the earliest date from all bookings
      const earliestDate = bookings.map(b => b.booking_date).sort((a, b) => a.localeCompare(b))[0];
      setGridDate(earliestDate);
    } else if (bookings.length === 0 && !gridDate) {
      // Fallback to today if there are no bookings
      setGridDate(dayjs().format('YYYY-MM-DD'));
    }
  }, [bookings, gridDate]);

  const handleDelete = async (bookingId) => {
    if (window.confirm("確定要取消這個預約嗎？")) {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
        setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          loadBookings(); // Reload bookings
        } else {
          alert("刪除失敗，你可能沒有權限或發生網路錯誤。");
        }
      } catch (error) {
        console.error("Failed to delete booking:", error);
        alert("刪除失敗，發生網路錯誤。");
      }
    }
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) {
      alert("沒有預約記錄可以導出。");
      return;
    }

    const headers = ["ID", "場地", "用途", "負責人", "預約日期", "開始時間", "結束時間", "創建時間"];
    const csvRows = [headers.join(',')];

    // 導出所有預約記錄
    for (const booking of bookings) {
        const values = [
            booking.id,
            `"${(booking.venue || '').replace(/"/g, '""')}"`,
            `"${(booking.purpose || '').replace(/"/g, '""')}"`,
            `"${(booking.person_in_charge || '').replace(/"/g, '""')}"`,
            booking.booking_date,
            booking.start_time,
            booking.end_time,
            booking.created_at,
        ];
        csvRows.push(values.join(','));
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings-export-${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchDelete = async () => {
    if (selectedBookings.size === 0) {
      alert("請選擇要刪除的預約");
      return;
    }

    if (window.confirm(`確定要刪除選中的 ${selectedBookings.size} 個預約嗎？`)) {
      try {
        const deletePromises = Array.from(selectedBookings).map(bookingId =>
          fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
        );
        
        await Promise.all(deletePromises);
        setSelectedBookings(new Set());
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        loadBookings();
      } catch (error) {
        console.error("Failed to delete bookings:", error);
        alert("批量刪除失敗，發生網路錯誤。");
      }
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm("確定要刪除所有預約嗎？此操作無法復原！")) {
      try {
        const deletePromises = bookings.map(booking =>
          fetch(`/api/bookings/${booking.id}`, { method: 'DELETE' })
        );
        
        await Promise.all(deletePromises);
        setSelectedBookings(new Set());
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        loadBookings();
      } catch (error) {
        console.error("Failed to delete all bookings:", error);
        alert("刪除所有預約失敗，發生網路錯誤。");
      }
    }
  };

  const handleSelectBooking = (bookingId) => {
    const newSelected = new Set(selectedBookings);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookings(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBookings.size === bookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(bookings.map(b => b.id)));
    }
  };

  const visibleBookings = useMemo(() => {
    if (isAdmin) return bookings;
    const today = dayjs().startOf('day');
    return bookings.filter(b => dayjs(b.booking_date).isSameOrAfter(today));
  }, [bookings, isAdmin]);

  const filteredBookings = useMemo(() => {
    return visibleBookings.filter((booking) => {
      const venueMatch = filterVenue ? booking.venue === filterVenue : true;
      const dateMatch = filterDate ? booking.booking_date === filterDate : true;
      return venueMatch && dateMatch;
    });
  }, [visibleBookings, filterVenue, filterDate]);

  const groupedBookings = useMemo(() => {
    return filteredBookings.reduce((acc, booking) => {
      const date = booking.booking_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(booking);
      return acc;
    }, {});
  }, [filteredBookings]);

  const uniqueDates = useMemo(() => [...new Set(visibleBookings.map(b => b.booking_date))].sort(), [visibleBookings]);

  const ViewModeButton = ({ mode, children }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
        viewMode === mode
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">讀取中...</div>;
  if (error) return <div className="p-8 text-center text-red-500 dark:text-red-400">錯誤: {error}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse dark:bg-green-600">
           操作成功！
         </div>
      )}
      <div className="bg-white dark:bg-gray-900 dark:border dark:border-gray-700 shadow-xl rounded-2xl p-6 md:p-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-4 sm:mb-0">預約總覽</h2>
          <div className="flex items-center space-x-2">
            <ViewModeButton mode="list">列表視圖</ViewModeButton>
            <ViewModeButton mode="grid">表格視圖</ViewModeButton>
          </div>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <div>
            {/* Admin Controls */}
            {isAdmin && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700/50 rounded-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">管理員操作</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={handleSelectAll} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">全選/取消</button>
                  <button onClick={handleBatchDelete} disabled={selectedBookings.size === 0} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors">刪除選取</button>
                  <button onClick={handleDeleteAll} className="px-3 py-1.5 text-sm bg-red-800 text-white rounded-md hover:bg-red-900 transition-colors">刪除全部</button>
                  <button onClick={handleExportCsv} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">導出 CSV</button>
                </div>
              </div>
            )}
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
               <select onChange={(e) => setFilterVenue(e.target.value)} value={filterVenue} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                  <option value="">所有場地</option>
                  {venues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select onChange={(e) => setFilterDate(e.target.value)} value={filterDate} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white">
                  <option value="">所有日期</option>
                  {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>
            {/* Bookings Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {isAdmin && <th scope="col" className="p-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0} className="h-4 w-4 rounded border-gray-300 dark:bg-gray-700 dark:border-gray-500 text-blue-600 focus:ring-blue-500"/></th>}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">日期</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">時間</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">場地</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">用途</th>
                    {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">預約人</th>}
                    {isAdmin && <th scope="col" className="relative px-6 py-3"><span className="sr-only">刪除</span></th>}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.keys(groupedBookings).sort().map(date => (
                    groupedBookings[date].map(booking => (
                      <tr key={booking.id} className={`${selectedBookings.has(booking.id) ? 'bg-blue-50 dark:bg-blue-800/30' : ''}`}>
                        {isAdmin && <td className="p-4"><input type="checkbox" checked={selectedBookings.has(booking.id)} onChange={() => handleSelectBooking(booking.id)} className="h-4 w-4 rounded border-gray-300 dark:bg-gray-700 dark:border-gray-500 text-blue-600 focus:ring-blue-500"/></td>}
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{booking.booking_date}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{booking.start_time} - {booking.end_time}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{booking.venue}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{booking.purpose}</td>
                        {isAdmin && <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{booking.person_in_charge}</td>}
                        {isAdmin && <td className="px-6 py-4 text-right text-sm font-medium"><button onClick={() => handleDelete(booking.id)} className="text-red-600 hover:text-red-900 dark:text-red-500 dark:hover:text-red-400">刪除</button></td>}
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div>
            <div className="mb-4">
              <label htmlFor="grid-date-picker" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">選擇日期</label>
              <input 
                type="date"
                id="grid-date-picker"
                value={gridDate}
                onChange={(e) => setGridDate(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <ScheduleGrid bookings={bookings.filter(b => b.booking_date === gridDate)} venues={venues} />
          </div>
        )}
      </div>
    </div>
  );
}

export { ScheduleComponent };
