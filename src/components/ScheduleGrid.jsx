import React from 'react';
import dayjs from 'dayjs';
import {
  SCHEDULE_GRID_START_TIME,
  SCHEDULE_GRID_END_TIME,
  SCHEDULE_GRID_SLOT_MINUTES
} from "../config.js";

const generateTimeSlots = () => {
  const slots = [];
  let current = dayjs().hour(parseInt(SCHEDULE_GRID_START_TIME.split(":")[0])).minute(parseInt(SCHEDULE_GRID_START_TIME.split(":")[1])).second(0);
  const end = dayjs().hour(parseInt(SCHEDULE_GRID_END_TIME.split(":")[0])).minute(parseInt(SCHEDULE_GRID_END_TIME.split(":")[1])).second(0);
  while (current.isBefore(end)) {
    slots.push(current.format("HH:mm"));
    current = current.add(SCHEDULE_GRID_SLOT_MINUTES, "minute");
  }
  return slots;
};

const ScheduleGridComponent = ({ bookings, venues }) => {
  const timeSlots = React.useMemo(() => generateTimeSlots(), []);
  
  const bookingMap = React.useMemo(() => {
    const map = new Map();
    bookings.forEach((booking) => {
      const timeKey = dayjs(`${booking.booking_date} ${booking.start_time}`).format('HH:mm');
      const key = `${booking.venue}-${timeKey}`;
      map.set(key, booking);
    });
    return map;
  }, [bookings]);

  const getBookingColor = (purpose) => {
    const hash = purpose.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-indigo-500',
        'bg-pink-500', 'bg-sky-500', 'bg-emerald-500', 'bg-fuchsia-500'
    ];
    const darkColors = [
        'dark:bg-blue-800', 'dark:bg-green-800', 'dark:bg-purple-800', 'dark:bg-indigo-800',
        'dark:bg-pink-800', 'dark:bg-sky-800', 'dark:bg-emerald-800', 'dark:bg-fuchsia-800'
    ];
    const index = Math.abs(hash) % colors.length;
    return `${colors[index]} ${darkColors[index]}`;
  };

  if (!venues || venues.length === 0) {
    return <div className="text-center p-8 text-gray-500 dark:text-gray-400">正在等待場地設定...</div>;
  }
  
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      <table className="min-w-full">
        <thead className="bg-gray-50 dark:bg-black/20 sticky top-0 z-10">
          <tr>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 w-24">時間</th>
            {venues.map(venue => (
              <th key={venue} scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">{venue}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {timeSlots.map((time, timeIndex) => (
            <tr key={time} className="divide-x divide-gray-200 dark:divide-gray-700">
              <td className={`px-3 py-2 text-xs text-center text-gray-500 dark:text-gray-400 align-top h-16 ${timeIndex % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-950/40' : 'dark:bg-gray-900'}`}>
                {time}
              </td>
              {venues.map(venue => {
                const booking = bookingMap.get(`${venue}-${time}`);
                if (!booking) {
                    let isSpanned = false;
                    for (const b of bookings) {
                        if (b.venue === venue) {
                            const startTime = dayjs(`${b.booking_date} ${b.start_time}`);
                            const endTime = dayjs(`${b.booking_date} ${b.end_time}`);
                            const currentTime = dayjs(`${b.booking_date} ${time}`);
                            if (currentTime.isAfter(startTime) && currentTime.isBefore(endTime)) {
                                isSpanned = true;
                                break;
                            }
                        }
                    }
                    return isSpanned ? null : <td key={venue} className={`h-16 ${timeIndex % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-950/40' : 'dark:bg-gray-900'}`}></td>;
                }
                
                const start = dayjs(`${booking.booking_date} ${booking.start_time}`);
                const end = dayjs(`${booking.booking_date} ${booking.end_time}`);
                const durationMinutes = end.diff(start, 'minute');
                const rowSpan = Math.max(1, Math.ceil(durationMinutes / SCHEDULE_GRID_SLOT_MINUTES));

                return (
                  <td key={venue} rowSpan={rowSpan} className="p-1 align-top relative" style={{ height: `${rowSpan * 4}rem`}}>
                     <div className={`p-2 rounded-lg text-white h-full flex flex-col justify-between shadow-md ${getBookingColor(booking.purpose)}`}>
                      <div>
                        <p className="font-bold text-sm text-gray-100">{booking.purpose}</p>
                        <p className="text-xs opacity-90 text-gray-200">{booking.start_time} - {booking.end_time}</p>
                      </div>
                      <p className="text-xs font-medium text-right truncate text-gray-300" title={booking.person_in_charge}>{booking.person_in_charge}</p>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export { ScheduleGridComponent as ScheduleGrid };
