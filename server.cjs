const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const path = require('path');

// 載入 dayjs 插件
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const app = express();
const PORT = process.env.PORT || 3001;

// 中間件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'dist')));

// 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-c47eb9db749e4d0da072557681f52e83";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "512524";
const AVAILABLE_VENUES = ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304', 'STEM Room', '音樂室', '活動室', '英語室', '圖書館', '煮角', 'G01電競室', '輔導室', 'G02', 'G03', '禮堂', '操場', '壁球室', '攀石牆'];

// 初始化資料庫
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    person_in_charge TEXT NOT NULL,
    venue TEXT NOT NULL,
    purpose TEXT,
    event_name TEXT,
    class_type TEXT,
    pax TEXT,
    remarks TEXT,
    booking_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    username TEXT DEFAULT '測試用戶',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 插入測試資料
  const testBookings = [
    {
      user_id: 'user-1',
      person_in_charge: '張三',
      venue: '101',
      purpose: '團隊會議',
      booking_date: '2025-07-01',
      start_time: '09:00',
      end_time: '10:30',
      username: '張三'
    },
    {
      user_id: 'user-2',
      person_in_charge: '李四',
      venue: '102',
      purpose: '客戶簡報',
      booking_date: '2025-07-01',
      start_time: '14:00',
      end_time: '15:30',
      username: '李四'
    }
  ];

  const stmt = db.prepare(`INSERT INTO bookings (user_id, person_in_charge, venue, purpose, booking_date, start_time, end_time, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  testBookings.forEach(booking => {
    stmt.run(booking.user_id, booking.person_in_charge, booking.venue, booking.purpose, booking.booking_date, booking.start_time, booking.end_time, booking.username);
  });
  stmt.finalize();
});

// AI 建議功能
async function getAiSuggestions(venue, date, startTime, endTime, existingBookings) {
  // 動態載入 node-fetch
  const fetch = (await import('node-fetch')).default;

  // 計算預約時長
  const startMoment = dayjs(`${date} ${startTime}`);
  const endMoment = dayjs(`${date} ${endTime}`);
  const durationMinutes = endMoment.diff(startMoment, 'minute');

  const prompt = `你是一個場地預約系統的助理。
用戶想要預約"${venue}"在${date}從${startTime}到${endTime}，但是這個時段已被預約。
現有預約：
${existingBookings.map(b => `- ${b.start_time}到${b.end_time} (用途: ${b.purpose})`).join('\n')}

請為用戶建議3個在同一天的其他可用時段。
- 營業時間：08:00-22:00
- 建議時段不能與現有預約重疊
- 建議時段的時長應該是${durationMinutes}分鐘（${startTime}到${endTime}）

請以JSON格式回應，只返回陣列，不要其他文字：
[{"startTime": "時間", "endTime": "時間"}, ...]`;

  try {
    console.log('Calling DeepSeek API for AI suggestions...');
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { "role": "system", "content": "你是一個聰明的預約系統助理。請只返回JSON陣列格式的時間建議。" },
          { "role": "user", "content": prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      // 如果 API 失敗，返回一些基本的建議
      return generateFallbackSuggestions(startTime, endTime, durationMinutes, existingBookings);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('DeepSeek API response:', content);
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      console.log('Parsed suggestions:', suggestions);
      return suggestions;
    }
    
    // 如果無法解析，返回備用建議
    return generateFallbackSuggestions(startTime, endTime, durationMinutes, existingBookings);

  } catch (error) {
    console.error("Failed to get AI suggestions:", error);
    // 如果 AI 失敗，返回一些基本的建議
    return generateFallbackSuggestions(startTime, endTime, durationMinutes, existingBookings);
  }
}

// 生成備用建議（當 AI API 失敗時）
function generateFallbackSuggestions(startTime, endTime, durationMinutes, existingBookings) {
  const suggestions = [];
  const startHour = 8; // 08:00
  const endHour = 22; // 22:00
  
  // 生成一些基本時段
  const timeSlots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotStart = dayjs().hour(hour).minute(minute).format('HH:mm');
      const slotEnd = dayjs().hour(hour).minute(minute).add(durationMinutes, 'minute').format('HH:mm');
      timeSlots.push({ startTime: slotStart, endTime: slotEnd });
    }
  }
  
  // 過濾與現有預約衝突的時段
  const availableSlots = timeSlots.filter(slot => {
    const slotStart = dayjs(`2025-01-01 ${slot.startTime}`);
    const slotEnd = dayjs(`2025-01-01 ${slot.endTime}`);
    
    return !existingBookings.some(booking => {
      const bookingStart = dayjs(`2025-01-01 ${booking.start_time}`);
      const bookingEnd = dayjs(`2025-01-01 ${booking.end_time}`);
      return slotStart.isBefore(bookingEnd) && bookingStart.isBefore(slotEnd);
    });
  });
  
  // 返回前3個建議
  return availableSlots.slice(0, 3);
}

// API 路由

// 獲取用戶資訊
app.get('/api/user', (req, res) => {
  res.json({ id: 'user-1', username: '測試用戶' });
});

// 檢查衝突
app.post('/api/check-conflicts', (req, res) => {
  const { venue, dates, date, startTime, endTime } = req.body;
  
  // 支援舊版本 API（單個日期）和新版本（多日期）
  const dateArray = dates || (date ? [date] : []);
  
  if (!dateArray.length || !startTime || !endTime) {
    return res.json({ status: 'idle', conflicts: [] });
  }

  // 檢查時間是否有效
  if (dayjs(`${dateArray[0]} ${endTime}`).isSameOrBefore(dayjs(`${dateArray[0]} ${startTime}`))) {
    return res.json({ status: 'idle', conflicts: [] });
  }

  // 查詢所有指定日期的預約
  const placeholders = dateArray.map(() => '?').join(',');
  const query = `SELECT * FROM bookings WHERE venue = ? AND booking_date IN (${placeholders})`;
  
  db.all(query, [venue, ...dateArray], async (err, bookings) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    const allConflicts = [];
    
    // 檢查每個日期的衝突
    dateArray.forEach(checkDate => {
      const newBookingStart = dayjs(`${checkDate} ${startTime}`);
      const newBookingEnd = dayjs(`${checkDate} ${endTime}`);

      const dateConflicts = bookings.filter(booking => {
        if (booking.booking_date !== checkDate) return false;
        const existingStart = dayjs(`${booking.booking_date} ${booking.start_time}`);
        const existingEnd = dayjs(`${booking.booking_date} ${booking.end_time}`);
        return newBookingStart.isBefore(existingEnd) && existingStart.isBefore(newBookingEnd);
      });
      
      allConflicts.push(...dateConflicts);
    });

    if (allConflicts.length > 0) {
      // 獲取 AI 建議（使用第一個日期）
      const suggestions = await getAiSuggestions(venue, dateArray[0], startTime, endTime, allConflicts);
      res.json({ 
        status: 'conflict', 
        conflicts: allConflicts, 
        suggestions 
      });
    } else {
      res.json({ status: 'available', conflicts: [] });
    }
  });
});

// 創建預約
app.post('/api/bookings', async (req, res) => {
  const { venue, dates, startTime, endTime, purpose, personInCharge, eventName, classType, pax, remarks, currentUser } = req.body;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, message: '請提供有效的預約日期陣列。' });
  }

  const results = {
    success: [],
    failed: []
  };

  const processBooking = (date) => new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const checkQuery = `SELECT * FROM bookings WHERE venue = ? AND booking_date = ? AND NOT (? <= start_time OR ? >= end_time)`;
      db.all(checkQuery, [venue, date, endTime, startTime], (err, rows) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(new Error(err.message));
        }

        if (rows.length > 0) {
          db.run('ROLLBACK');
          return resolve({ date, success: false, message: '時間衝突' });
        }
        
        const insertQuery = `INSERT INTO bookings (user_id, person_in_charge, venue, purpose, event_name, class_type, pax, remarks, booking_date, start_time, end_time, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          currentUser?.id || 'user-1',
          personInCharge,
          venue,
          purpose,
          eventName,
          classType,
          pax,
          remarks,
          date,
          startTime,
          endTime,
          currentUser?.username || '測試用戶'
        ];

        db.run(insertQuery, params, function(err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(new Error(err.message));
          }
          db.run('COMMIT');
          resolve({ date, success: true, bookingId: this.lastID });
        });
      });
    });
  });

  try {
    const allPromises = dates.map(date => processBooking(date));
    const allResults = await Promise.all(allPromises);

    allResults.forEach(result => {
      if (result.success) {
        results.success.push(result);
      } else {
        results.failed.push(result);
      }
    });

    if (results.failed.length > 0) {
      if (results.success.length > 0) {
        // 部分成功
        const failedDates = results.failed.map(f => f.date).join(', ');
        return res.status(207).json({ 
            success: false, 
            message: `部分預約成功，但日期 ${failedDates} 因衝突或其他原因失敗。`, 
            details: results 
        });
      } else {
        // 全部失敗
        return res.status(409).json({ success: false, message: '所有預約均因時間衝突而失敗。', details: results });
      }
    } else {
      // 全部成功
      res.status(201).json({ success: true, message: '所有預約均已成功建立！', details: results });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: `伺服器內部錯誤: ${error.message}` });
  }
});

// 獲取所有預約
app.get('/api/bookings', (req, res) => {
  const { startDate, endDate } = req.query;

  let query = "SELECT * FROM bookings";
  const params = [];

  if (startDate && endDate) {
    query += " WHERE booking_date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  } else if (startDate) {
    query += " WHERE booking_date >= ?";
    params.push(startDate);
  } else if (endDate) {
    query += " WHERE booking_date <= ?";
    params.push(endDate);
  }

  query += " ORDER BY booking_date ASC, start_time ASC";

  db.all(query, params, (err, bookings) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(bookings);
  });
});

// 刪除預約
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM bookings WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ success: true });
  });
});

// 獲取配置
app.get('/api/config', (req, res) => {
  res.json({
    venues: AVAILABLE_VENUES,
    adminPassword: ADMIN_PASSWORD
  });
});

// 服務靜態檔案
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 