// ================================================================
// GOOGLE APPS SCRIPT — Dán vào Apps Script Editor và Deploy lại
// Thay thế toàn bộ nội dung hiện tại bằng code này
// ================================================================

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data  = sheet.getDataRange().getValues();

  // Row 0 = empty, Row 1 = header, Row 2+ = data
  const HEADER_ROW = 1;
  const result = [];

  for (let i = HEADER_ROW + 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1] || row[1].toString().trim() === '') continue; // skip blank rows

    result.push({
      no:         parseInt(row[0]) || (i - HEADER_ROW),
      name:       row[1].toString().trim(),
      shopeeLink: row[2] ? row[2].toString().trim() : '',
      tiktokLink: row[3] ? row[3].toString().trim() : '',
      images:     parseImages(row[4] ? row[4].toString() : ''),
      reviews:    parseReviews(row[5] ? row[5].toString() : ''),
      videoLinks: parseVideoLinks(row[6] ? row[6].toString() : ''),
      category:   row[7] ? row[7].toString().trim() : 'Khác'  // Cột H: Danh mục
    });
  }

  const output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/** Chuyển Google Drive link sang thumbnail URL */
function driveToThumb(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w600' : url;
}

/** Parse cột Hình ảnh: mỗi dòng "1 - https://..." hoặc chỉ URL */
function parseImages(raw) {
  if (!raw) return [];
  return raw.split('\n')
    .map(function(line) {
      const m = line.match(/https?:\/\/[^\s]+/);
      return m ? driveToThumb(m[0]) : null;
    })
    .filter(Boolean);
}

/** Parse cột Review: "DD/MM/YYYY: nội dung\nDD/MM/YYYY: ..." */
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

/** Parse cột Video links: "DD/MM/YYYY:\nhttps://..." */
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
