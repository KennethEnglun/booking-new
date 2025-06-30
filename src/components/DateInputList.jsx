import React from "react";
import dayjs from "dayjs";

const maxBookingDays = 20;

const DateInputListComponent = ({ dates, onDateChange, onAddDate, onRemoveDate }) => {
  const handleAdd = () => {
    if (dates.length < maxBookingDays) {
      onAddDate();
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">預約日期</label>
      {dates.map((date, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            min={dayjs().format("YYYY-MM-DD")}
            onChange={(e) => onDateChange(index, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            required
          />
          {dates.length > 1 && (
            <button
              type="button"
              onClick={() => onRemoveDate(index)}
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors transform active:scale-95 dark:bg-red-700 dark:hover:bg-red-800"
            >
              移除
            </button>
          )}
        </div>
      ))}
      {dates.length < maxBookingDays && (
        <button
          type="button"
          onClick={handleAdd}
          className="w-full mt-3 px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors transform active:scale-95 dark:bg-green-700 dark:hover:bg-green-800"
        >
          + 新增預約日期
        </button>
      )}
    </div>
  );
};

export { DateInputListComponent as DateInputList };
