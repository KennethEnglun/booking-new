import React, { useState, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { ScheduleGrid } from "./ScheduleGrid.jsx";
import Papa from 'papaparse';

dayjs.extend(isSameOrAfter);

const ScheduleComponent = ({ isAdmin, config }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [venues, setVenues] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [importMode, setImportMode] = useState('add'); // 'add' or 'overwrite'
  
  // States for 'list' view
  const [filterVenue, setFilterVenue] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("");
  const [filterEventName, setFilterEventName] = useState("");
  const [filterPersonInCharge, setFilterPersonInCharge] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'time', direction: 'ascending' });
  const [selectedBookings, setSelectedBookings] = useState(new Set());

  // State for 'grid' view
  const [gridDate, setGridDate] = useState(dayjs().format('YYYY-MM-DD'));
  


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

  const handleImportCsv = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const response = await fetch('/api/bookings/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bookings: results.data,
                mode: importMode,
              }),
            });
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: '導入失敗，請檢查日誌' }));
              throw new Error(errorData.message || '導入失敗');
            }
            loadBookings(); // Refresh bookings list
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          } catch (error) {
            console.error('導入CSV時出錯:', error);
            setError(`導入失敗: ${error.message}`);
          }
        },
        error: (error) => {
          console.error('解析CSV時出錯:', error);
          setError('解析CSV失敗，請檢查文件格式。');
        },
      });
    }
  };

  const handleExportCsv = () => {
    if (bookings.length === 0) {
      alert("沒有預約記錄可以導出。");
      return;
    }

    const headers = ["ID", "場地", "用途", "活動名稱", "班別", "人數", "備注", "負責人", "預約日期", "開始時間", "結束時間", "創建時間"];
    const csvRows = [headers.join(',')];

    // 導出所有預約記錄
    for (const booking of bookings) {
        const values = [
            booking.id,
            `"${(booking.venue || '').replace(/"/g, '""')}"`,
            `"${(booking.purpose || '').replace(/"/g, '""')}"`,
            `"${(booking.event_name || '').replace(/"/g, '""')}"`,
            `"${(booking.class_type || '').replace(/"/g, '""')}"`,
            `"${(booking.pax || '').replace(/"/g, '""')}"`,
            `"${(booking.remarks || '').replace(/"/g, '""')}"`,
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

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
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
      const purposeMatch = filterPurpose ? booking.purpose === filterPurpose : true;
      const eventNameMatch = filterEventName ? booking.event_name === filterEventName : true;
      const personInChargeMatch = filterPersonInCharge ? booking.person_in_charge === filterPersonInCharge : true;
      return venueMatch && dateMatch && purposeMatch && eventNameMatch && personInChargeMatch;
    });
  }, [visibleBookings, filterVenue, filterDate, filterPurpose, filterEventName, filterPersonInCharge]);

  const groupedBookings = useMemo(() => {
    const grouped = filteredBookings.reduce((acc, booking) => {
      const date = booking.booking_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(booking);
      return acc;
    }, {});

    // Sort bookings within each group
    for (const date in grouped) {
        grouped[date].sort((a, b) => {
            if (sortConfig.key === 'time') {
                const timeA = a.start_time;
                const timeB = b.start_time;
                if (sortConfig.direction === 'ascending') {
                    return timeA.localeCompare(timeB);
                } else {
                    return timeB.localeCompare(timeA);
                }
            }
            return 0;
        });
    }

    return grouped;
  }, [filteredBookings, sortConfig]);

  const uniqueDates = useMemo(() => [...new Set(visibleBookings.map(b => b.booking_date))].sort(), [visibleBookings]);
  const uniquePurposes = useMemo(() => [...new Set(visibleBookings.map(b => b.purpose).filter(Boolean))].sort(), [visibleBookings]);
  const uniqueEventNames = useMemo(() => [...new Set(visibleBookings.map(b => b.event_name).filter(Boolean))].sort(), [visibleBookings]);
  const uniquePersonsInCharge = useMemo(() => [...new Set(visibleBookings.map(b => b.person_in_charge).filter(Boolean))].sort(), [visibleBookings]);

  const ViewModeButton = ({ mode, children }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
        viewMode === mode
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );



  if (loading) return <div className="p-8 text-center text-gray-500">讀取中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">錯誤: {error}</div>;

  return (
    <div className="animate-fadeInUp">
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
           操作成功！
         </div>
      )}
      <div className="bg-white shadow-xl rounded-2xl p-6 md:p-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">預約總覽</h2>
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
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-3">管理員操作</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={handleSelectAll} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">全選/取消</button>
                  <button onClick={handleBatchDelete} disabled={selectedBookings.size === 0} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400">刪除選取</button>
                  <button onClick={handleDeleteAll} className="px-3 py-1.5 text-sm bg-red-800 text-white rounded-md hover:bg-red-900 transition-colors">刪除全部</button>
                  <button onClick={handleExportCsv} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">導出 CSV</button>
                  <label htmlFor="csv-importer" className="cursor-pointer px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors">
                    導入 CSV
                  </label>
                  <input type="file" id="csv-importer" accept=".csv" onChange={handleImportCsv} className="hidden" />
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-600">導入模式:</span>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="importMode" value="add" checked={importMode === 'add'} onChange={() => setImportMode('add')} className="form-radio h-4 w-4 text-blue-600" />
                    <span className="text-sm">增加</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="form-radio h-4 w-4 text-red-600" />
                    <span className="text-sm">覆蓋</span>
                  </label>
                </div>
              </div>
            )}
            
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <select onChange={(e) => setFilterVenue(e.target.value)} value={filterVenue}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">所有場地</option>
                {venues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select onChange={(e) => setFilterDate(e.target.value)} value={filterDate}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">所有日期</option>
                {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select onChange={(e) => setFilterPurpose(e.target.value)} value={filterPurpose}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">所有用途</option>
                {uniquePurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select onChange={(e) => setFilterEventName(e.target.value)} value={filterEventName}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">所有活動名稱</option>
                {uniqueEventNames.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select onChange={(e) => setFilterPersonInCharge(e.target.value)} value={filterPersonInCharge}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">所有預約人</option>
                {uniquePersonsInCharge.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            {/* Bookings List */}
            <div className="overflow-x-auto">
              <div className="min-w-full align-middle">
                 <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {isAdmin && <th scope="col" className="relative px-6 py-3 w-12"><input type="checkbox" onChange={handleSelectAll} checked={selectedBookings.size === bookings.length && bookings.length > 0} className="rounded" /></th>}
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            <button onClick={() => requestSort('time')} className="flex items-center gap-1 hover:text-blue-600">
                              時間
                              {sortConfig.key === 'time' && (
                                <span className="text-xs">
                                  {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                                </span>
                              )}
                            </button>
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">場地</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">用途</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">活動名稱</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">班別</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">人數</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">備注</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">預約人</th>
                          {isAdmin && <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">刪除</span></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {Object.keys(groupedBookings).length > 0 ? (
                          Object.entries(groupedBookings).map(([date, bookingsOnDate]) => (
                            <React.Fragment key={date}>
                              <tr className="bg-gray-100">
                                <td colSpan={isAdmin ? 10 : 8} className="px-4 py-2 text-sm font-semibold text-gray-900">
                                  {dayjs(date).format("YYYY年MM月DD日 (dddd)")}
                                </td>
                              </tr>
                              {bookingsOnDate.map((booking) => (
                                <tr key={booking.id} className={selectedBookings.has(booking.id) ? 'bg-blue-50' : ''}>
                                  {isAdmin && (
                                    <td className="relative px-6 py-4 w-12">
                                      <input
                                        type="checkbox"
                                        className="rounded"
                                        checked={selectedBookings.has(booking.id)}
                                        onChange={() => handleSelectBooking(booking.id)}
                                      />
                                    </td>
                                  )}
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.start_time} - {booking.end_time}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.venue}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.purpose}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.event_name}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.class_type}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.pax}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.remarks}</td>
                                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{booking.person_in_charge}</td>
                                  {isAdmin && (
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                      <button onClick={() => handleDelete(booking.id)} className="text-red-600 hover:text-red-900">
                                        刪除
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 8} className="text-center py-12">
                               <h3 className="text-lg font-medium text-gray-900">沒有符合的預約記錄</h3>
                               <p className="mt-1 text-sm text-gray-500">請嘗試調整篩選條件或新增預約。</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
              <label htmlFor="grid-date-select" className="text-sm font-medium text-gray-700">選擇日期</label>
              <input 
                type="date"
                id="grid-date-select"
                value={gridDate}
                onChange={e => setGridDate(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <ScheduleGrid 
              key={gridDate} 
              bookings={bookings.filter(b => b.booking_date === gridDate)}
              venues={venues} 
            />
          </div>
        )}
      </div>

    </div>
  );
}

export { ScheduleComponent };
