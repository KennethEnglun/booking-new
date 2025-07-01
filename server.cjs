const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const path = require('path');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');

// 載入 dayjs 插件
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const app = express();
const PORT = process.env.PORT || 3001;

// 中間件
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser('your-secret-key')); // Use a secret key for signed cookies
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

// Mock user database
const users = {
  admin: { id: 'admin-01', name: 'Admin', isAdmin: true, password: 'adminpassword' }
};

// AI 建議功能
async function getAiSuggestions(venue, date, startTime, endTime, existingBookings) {
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
  const { userId } = req.signedCookies;
  if (userId && users[userId]) {
    const { id, name, isAdmin } = users[userId];
    res.json({ id, name, isAdmin });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
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
  const { venue, dates, startTime, endTime, purpose, personInCharge, eventName, classType, pax, remarks } = req.body;
  const { userId } = req.signedCookies;
  const currentUser = userId ? users[userId] : null;

  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, message: '請提供有效的預約日期陣列。' });
  }

  const results = {
    success: [],
    failed: []
  };

  const processBookingForDate = (date) => new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(new Error(`Transaction begin failed: ${err.message}`));
      });

      const checkQuery = `SELECT * FROM bookings WHERE venue = ? AND booking_date = ? AND NOT (? <= start_time OR ? >= end_time)`;
      db.get(checkQuery, [venue, date, endTime, startTime], (err, row) => {
        if (err) {
          return db.run('ROLLBACK', () => reject(new Error(`Conflict check failed: ${err.message}`)));
        }

        if (row) {
          return db.run('ROLLBACK', () => resolve({ date, success: false, message: '時間衝突' }));
        }

        const insertQuery = `INSERT INTO bookings (user_id, person_in_charge, venue, purpose, event_name, class_type, pax, remarks, booking_date, start_time, end_time, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [currentUser?.id || 'user-1', personInCharge, venue, purpose, eventName, classType, pax, remarks, date, startTime, endTime, currentUser?.name || personInCharge];
        
        db.run(insertQuery, params, function(err) {
          if (err) {
            return db.run('ROLLBACK', () => reject(new Error(`Insert failed: ${err.message}`)));
          }
          const lastID = this.lastID;
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              return reject(new Error(`Commit failed: ${commitErr.message}`));
            }
            resolve({ date, success: true, bookingId: lastID });
          });
        });
      });
    });
  });

  try {
    for (const date of dates) {
      const result = await processBookingForDate(date);
      if (result.success) {
        results.success.push(result);
      } else {
        results.failed.push(result);
      }
    }

    if (results.failed.length > 0 && results.success.length === 0) {
      return res.status(409).json({ success: false, message: '所有預約均因衝突而失敗。', details: results.failed });
    } else if (results.failed.length > 0) {
      return res.status(207).json({ success: true, message: '部分預約因衝突而失敗。', details: results });
    } else {
      return res.json({ success: true, message: '所有預約已成功創建！', details: results.success });
    }
  } catch (error) {
    console.error('預約處理失敗:', error);
    return res.status(500).json({ success: false, message: `系統發生錯誤，預約失敗: ${error.message}` });
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

app.post('/api/bookings/import', async (req, res) => {
  const { bookings, mode } = req.body;
  const { userId } = req.signedCookies;
  
  if (!userId || !users[userId] || !users[userId].isAdmin) {
    return res.status(403).json({ message: '權限不足，只有管理員才能匯入資料。' });
  }

  if (!bookings || !Array.isArray(bookings)) {
    return res.status(400).json({ message: '無效的預約資料。' });
  }

  if (mode === 'overwrite') {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return res.status(500).json({ message: `開始事務失敗: ${err.message}` });
        
        db.run('DELETE FROM bookings', (err) => {
          if (err) {
            return db.run('ROLLBACK', () => res.status(500).json({ message: `刪除舊預約失敗: ${err.message}` }));
          }
          
          db.run("DELETE FROM sqlite_sequence WHERE name='bookings'", (err) => {
            if (err) {
              return db.run('ROLLBACK', () => res.status(500).json({ message: `重設 ID 失敗: ${err.message}` }));
            }
            
            const stmt = db.prepare(`INSERT INTO bookings (user_id, person_in_charge, venue, purpose, event_name, class_type, pax, remarks, booking_date, start_time, end_time, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            
            for (const b of bookings) {
              const username = b.username || b.person_in_charge;
              stmt.run('user-import', b.person_in_charge, b.venue, b.purpose, b.event_name, b.class_type, b.pax, b.remarks, b.booking_date, b.start_time, b.end_time, username);
            }
            
            stmt.finalize((err) => {
              if (err) {
                return db.run('ROLLBACK', () => res.status(500).json({ message: `匯入預約時發生錯誤: ${err.message}` }));
              }
              
              db.run('COMMIT', (err) => {
                if (err) {
                  return res.status(500).json({ message: `提交事務失敗: ${err.message}` });
                }
                res.status(201).json({ message: `成功覆蓋並匯入 ${bookings.length} 筆預約。` });
              });
            });
          });
        });
      });
    });
  } else { // 'add' mode
    const results = { success: [], failed: [] };
    
    // We can reuse the function from the single booking endpoint, but we need to adapt it.
    // For simplicity here, we create a similar sequential promise chain.
    const processSingleBooking = (booking) => new Promise((resolve) => {
       const { venue, booking_date, start_time, end_time, person_in_charge, purpose, event_name, class_type, pax, remarks, username } = booking;
       const checkQuery = `SELECT * FROM bookings WHERE venue = ? AND booking_date = ? AND NOT (? <= start_time OR ? >= end_time)`;
       
       db.get(checkQuery, [venue, booking_date, end_time, start_time], (err, row) => {
         if (err || row) {
           resolve({ ...booking, success: false, message: err ? err.message : '時間衝突' });
         } else {
           const insertQuery = `INSERT INTO bookings (user_id, person_in_charge, venue, purpose, event_name, class_type, pax, remarks, booking_date, start_time, end_time, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
           const effectiveUsername = username || person_in_charge;
           const params = ['user-import', person_in_charge, venue, purpose, event_name, class_type, pax, remarks, booking_date, start_time, end_time, effectiveUsername];
           
           db.run(insertQuery, params, function(err) {
             if (err) {
               resolve({ ...booking, success: false, message: err.message });
             } else {
               resolve({ ...booking, success: true, bookingId: this.lastID });
             }
           });
         }
       });
    });

    (async () => {
      for (const booking of bookings) {
        const result = await processSingleBooking(booking);
        if (result.success) {
          results.success.push(result);
        } else {
          results.failed.push(result);
        }
      }
      
      res.status(207).json({ 
        message: `匯入完成。成功 ${results.success.length} 筆，失敗 ${results.failed.length} 筆。`,
        details: results 
      });
    })();
  }
});

// 檢查特定時段是否可預約
app.post('/api/check-availability', (req, res) => {
  const { venue, dates, startTime, endTime } = req.body;
  // ... existing code ...
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username].password === password) {
    res.cookie('userId', username, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
    const { id, name, isAdmin } = users[username];
    res.json({ id, name, isAdmin });
  } else {
    res.status(401).json({ message: '帳號或密碼錯誤' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ message: '登出成功' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 