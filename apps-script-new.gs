// ================================================================
// GOOGLE APPS SCRIPT — Dán vào Apps Script Editor và Deploy lại
// ================================================================
// CẤU TRÚC SHEET1 (từ hàng 2 trở đi):
// A: STT | B: Tên sản phẩm | C: Link Shopee | D: Link TikTok
// E: Hình ảnh sản phẩm | F: Nội dung review | G: Link video TikTok
// H: Danh mục | I: Các sản phẩm liên quan
//
// SHEET "Request from User":
// A: Ngày và giờ | B: Tên sản phẩm | C: Nickname | D: Nội dung yêu cầu | E: Status
// ================================================================

const SPREADSHEET_ID = '1kZrMreYg5bqZBy9-_8CXu7DjH5u72cOpgtPPxvvaoIA';

// ---- Hàm chính: xử lý GET requests ----
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';

  // Form submission (feedback + review request)
  if (action === 'submit') {
    return handleFormSubmit(e.parameter);
  }

  // Default: trả về OK (data đọc qua gviz API, không cần endpoint này)
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Use gviz API for product data' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Ghi form submission vào sheet "Request from User" ----
function handleFormSubmit(params) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Request from User');

    if (!sheet) throw new Error('Sheet "Request from User" not found');

    sheet.appendRow([
      new Date(),                          // A: Ngày và giờ
      params.product  || '(Chung)',        // B: Tên sản phẩm
      params.nickname || '(Ẩn danh)',      // C: Nickname
      params.request  || '',               // D: Nội dung yêu cầu
      ''                                   // E: Status - Nhún điền sau
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ---- Trigger hàng ngày: ghi log và kiểm tra dữ liệu ----
// Để cài trigger: Chạy hàm setupDailyTrigger() 1 lần duy nhất
function dailyCheck() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = sheet.getDataRange().getValues();
  const HEADER_ROW = 1;
  let count = 0;

  for (let i = HEADER_ROW + 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().trim() !== '') count++;
  }

  console.log(`[${new Date().toLocaleString('vi-VN')}] Tổng sản phẩm hiện có: ${count}`);
  // Có thể thêm: gửi email báo cáo, clear cache, v.v.
}

function setupDailyTrigger() {
  // Xóa trigger cũ nếu có (tránh bị duplicate)
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Tạo trigger chạy mỗi ngày lúc 7h sáng
  ScriptApp.newTrigger('dailyCheck')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  console.log('✅ Trigger đã được cài đặt: dailyCheck chạy mỗi ngày lúc 7h sáng');
}

// ---- Parse helpers ----

function driveToThumb(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w600' : url;
}

function parseImages(raw) {
  if (!raw) return [];
  return raw.split('\n')
    .map(function(line) {
      const m = line.match(/https?:\/\/[^\s]+/);
      return m ? driveToThumb(m[0]) : null;
    })
    .filter(Boolean);
}

function parseReviews(raw) {
  if (!raw) return [];
  const result = [];
  let current = null;
  raw.split('\n').forEach(function(line) {
    line = line.trim();
    const m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:\s*(.*)/);
    if (m) {
      if (current) result.push(current);
      current = { date: m[1], content: m[2] };
    } else if (current && line) {
      current.content += ' ' + line;
    }
  });
  if (current) result.push(current);
  return result;
}

function parseVideoLinks(raw) {
  if (!raw) return [];
  const result = [];
  let current = null;
  raw.split('\n').forEach(function(line) {
    line = line.trim();
    const dm = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(https?:\/\/.*)?/);
    if (dm) {
      if (current && current.url) result.push(current);
      current = { date: dm[1], url: dm[2] ? dm[2].trim() : '' };
    } else if (line.match(/^https?:\/\//) && current) {
      current.url = line;
    }
  });
  if (current && current.url) result.push(current);
  return result;
}
