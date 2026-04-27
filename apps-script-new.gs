// ================================================================
// GOOGLE APPS SCRIPT — Dán vào Apps Script Editor và Deploy lại
// ================================================================
// CẤU TRÚC SHEET (từ hàng 2 trở đi):
// A: STT | B: Tên sản phẩm | C: Link Shopee | D: Link TikTok
// E: Hình ảnh sản phẩm | F: Nội dung review | G: Link video TikTok | H: Danh mục
// ================================================================

// ---- Hàm chính: trả dữ liệu JSON cho website ----
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = sheet.getDataRange().getValues();

  // Hàng 0 = trống, Hàng 1 = header, Hàng 2+ = data
  const HEADER_ROW = 1;
  const result = [];

  for (let i = HEADER_ROW + 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1] || row[1].toString().trim() === '') continue;

    result.push({
      no:         parseInt(row[0]) || (i - HEADER_ROW),
      name:       row[1].toString().trim(),
      shopeeLink: row[2] ? row[2].toString().trim() : '',
      tiktokLink: row[3] ? row[3].toString().trim() : '',
      images:     parseImages(row[4] ? row[4].toString() : ''),
      reviews:    parseReviews(row[5] ? row[5].toString() : ''),
      videoLinks: parseVideoLinks(row[6] ? row[6].toString() : ''),
      category:   row[7] ? row[7].toString().trim() : 'Khác'
    });
  }

  const output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
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
