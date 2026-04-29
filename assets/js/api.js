// ================================================================
// api.js — Góc Nhỏ Của Nhún
// Dùng Google Sheets gviz JSON API (không cần Apps Script)
// Sheet phải được share "Anyone with link can view"
// ================================================================

const SHEET_ID = '1kZrMreYg5bqZBy9-_8CXu7DjH5u72cOpgtPPxvvaoIA';

let allProducts = [];
let activeCat = 'all';

// ---- Pagination state ----
const PAGE_SIZE = 10;
let currentPage = 1;

// ---- Helpers: parse Google Drive URLs ----
function driveThumb(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600` : url;
}

// ---- Helpers: parse multi-line cell content ----
function parseImages(raw) {
    if (!raw) return [];
    return raw.split('\n')
        .map(line => { const m = line.match(/https?:\/\/[^\s]+/); return m ? driveThumb(m[0]) : null; })
        .filter(Boolean);
}

function parseReviews(raw) {
    if (!raw) return [];
    const result = []; let current = null;
    raw.split('\n').forEach(line => {
        line = line.trim();
        const m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:\s*(.*)/);
        if (m) { if (current) result.push(current); current = { date: m[1], content: m[2] }; }
        else if (current && line) current.content += ' ' + line;
    });
    if (current) result.push(current);
    return result;
}

function parseVideoLinks(raw) {
    if (!raw) return [];
    const result = []; let current = null;
    raw.split('\n').forEach(line => {
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

function parseRelated(raw) {
    // Parses Column I "C\u00e1c s\u1ea3n ph\u1ea9m li\u00ean quan"
    // Format (per date block):
    //   dd/mm/yyyy:
    //   - Ten san pham [no]
    // Returns { 'dd/mm/yyyy': [{name, no}] }
    if (!raw) return {};
    const result = {};
    let currentDate = null;
    raw.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;
        const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(.*)?$/);
        if (dateMatch) {
            currentDate = dateMatch[1];
            if (!result[currentDate]) result[currentDate] = [];
            const rest = (dateMatch[2] || '').trim();
            if (rest) {
                const pm = rest.match(/[-*\u2022]\s+(.+?)\s+\[(\d+)\]/);
                if (pm) result[currentDate].push({ name: pm[1].trim(), no: parseInt(pm[2]) });
            }
            return;
        }
        const pm = line.match(/^[-*\u2022]\s+(.+?)\s+\[(\d+)\]/);
        if (pm && currentDate) {
            if (!result[currentDate]) result[currentDate] = [];
            result[currentDate].push({ name: pm[1].trim(), no: parseInt(pm[2]) });
        }
    });
    return result;
}

// ---- Fetch from Google Sheets gviz JSON API ----
async function fetchFromSheet() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    // Strip gviz wrapper: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    const match = text.match(/setResponse\(([\s\S]*)\)/);
    if (!match) throw new Error('Cannot parse gviz response');
    const json = JSON.parse(match[1]);

    const cols = json.table.cols;   // [{label, type}, ...]
    const rows = json.table.rows;   // [{c: [{v: value}, ...]}, ...]

    // Build column label → index map
    const colIdx = {};
    cols.forEach((col, i) => { if (col.label) colIdx[col.label.trim()] = i; });

    const get = (row, label) => {
        const i = colIdx[label];
        if (i === undefined || !row.c || !row.c[i] || row.c[i].v === null) return '';
        return String(row.c[i].v);
    };

    return rows
        .map((row, idx) => ({
            no: parseInt(get(row, 'No.')) || idx + 1,
            name: get(row, 'Tên sản phẩm'),
            shopeeLink: get(row, 'Link shoppee'),
            tiktokLink: get(row, 'Link tiktok'),
            images: parseImages(get(row, 'Hình ảnh sản phẩm')),
            reviews: parseReviews(get(row, 'Nội dung review')),
            videoLinks: parseVideoLinks(get(row, 'Link video tiktok liên quan')),
            category: get(row, 'Danh mục') || 'Khác',
            relatedProducts: parseRelated(get(row, 'Các sản phẩm liên quan'))
        }))
        .filter(p => p.name && p.name.trim()); // bỏ hàng trống
}

// ---- Render product grid (with pagination) ----
function renderGrid(products) {
    const grid = document.getElementById('productGrid');
    const noResults = document.getElementById('noResults');

    if (!products.length) {
        grid.innerHTML = '';
        noResults.classList.remove('hidden');
        renderPagination(0, 0);
        return;
    }
    noResults.classList.add('hidden');

    const totalPages = Math.ceil(products.length / PAGE_SIZE);
    // Clamp currentPage in case filter reduced total
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = products.slice(start, start + PAGE_SIZE);

    grid.innerHTML = pageItems.map(p => {
        const imgHtml = p.images && p.images.length
            ? `<img class="card-img" src="${p.images[0]}" alt="${p.name}" loading="lazy"
                    onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>🌿</div>'">`
            : `<div class="card-img-placeholder">🌿</div>`;
        return `
        <div class="product-card" onclick="goDetail(${p.no})" tabindex="0"
             onkeypress="if(event.key==='Enter')goDetail(${p.no})">
            ${imgHtml}
            <div class="card-body">
                <div class="card-category" data-translatable>${p.category}</div>
                <div class="card-name" data-translatable>${p.name}</div>
            </div>
        </div>`;
    }).join('');

    renderPagination(products.length, totalPages);

    // Re-apply current language to newly rendered content
    if (window.applyCurrentLang) window.applyCurrentLang();
}

// ---- Render pagination controls ----
function renderPagination(totalItems, totalPages) {
    const container = document.getElementById('paginationBar');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const lang = window.getLang ? window.getLang() : 'vi';
    const prevLabel = lang === 'en' ? '‹ Prev' : '‹ Trước';
    const nextLabel = lang === 'en' ? 'Next ›' : 'Tiếp ›';

    // Build page number buttons (show max 5 around current)
    let pageButtons = '';
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);

    if (left > 1) {
        pageButtons += `<button class="pg-btn" onclick="goPage(1)">1</button>`;
        if (left > 2) pageButtons += `<span class="pg-ellipsis">…</span>`;
    }
    for (let i = left; i <= right; i++) {
        pageButtons += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    }
    if (right < totalPages) {
        if (right < totalPages - 1) pageButtons += `<span class="pg-ellipsis">…</span>`;
        pageButtons += `<button class="pg-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalItems);
    const infoText = lang === 'en'
        ? `${start}–${end} of ${totalItems}`
        : `${start}–${end} / ${totalItems} sản phẩm`;

    container.innerHTML = `
        <div class="pg-info">${infoText}</div>
        <div class="pg-controls">
            <button class="pg-btn pg-nav" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>${prevLabel}</button>
            ${pageButtons}
            <button class="pg-btn pg-nav" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>${nextLabel}</button>
        </div>
    `;
}

// ---- Go to a specific page ----
function goPage(page) {
    const filtered = getFiltered();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderGrid(filtered);
    // Scroll grid into view smoothly
    const grid = document.getElementById('productGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Build sidebar category tree ----
function buildSidebar(products) {
    const tree = document.getElementById('categoryTree');
    const cats = {};
    products.forEach(p => {
        const c = p.category || 'Khác';
        if (!cats[c]) cats[c] = [];
        cats[c].push(p);
    });

    tree.innerHTML = Object.entries(cats).map(([cat, items]) => `
        <div class="cat-group open" data-cat="${cat}">
            <div class="cat-header" onclick="toggleCat(this)">
                <span data-translatable>${cat}</span>
                <span class="cat-arrow">▶</span>
            </div>
            <div class="cat-items">
                ${items.map(p =>
        `<span class="cat-item" onclick="filterByCatAndProduct('${cat}',${p.no})" data-translatable>${p.name}</span>`
    ).join('')}
            </div>
        </div>`).join('');
}

// ---- Build category select dropdown ----
function buildCatSelect(products) {
    const select = document.getElementById('catSelect');
    if (!select) return;
    const cats = [...new Set(products.map(p => p.category || 'Khác'))];
    // Keep 'Tất cả' option, append each category
    const lang = window.getLang ? window.getLang() : 'vi';
    select.innerHTML = `<option value="all">${lang === 'en' ? '📁 All categories' : '📁 Tất cả danh mục'}</option>`
        + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    select.value = activeCat;
}

// ---- Filter / Sort / Search ----
function firstReviewDate(p) {
    if (p.reviews && p.reviews.length) {
        const [d, m, y] = p.reviews[0].date.split('/');
        if (y) return new Date(`${y}-${m}-${d}`);
    }
    return new Date(0);
}

function getFiltered() {
    const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const sort = document.getElementById('sortSelect').value;
    let list = allProducts.filter(p =>
        (activeCat === 'all' || p.category === activeCat) &&
        (!search || p.name.toLowerCase().includes(search))
    );
    if (sort === 'newest') list.sort((a, b) => firstReviewDate(b) - firstReviewDate(a));
    else if (sort === 'oldest') list.sort((a, b) => firstReviewDate(a) - firstReviewDate(b));
    else if (sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return list;
}

function applyFilters() {
    currentPage = 1; // Reset to page 1 on any filter/sort/search change
    renderGrid(getFiltered());
}

function setCatFilter(cat) {
    activeCat = cat;
    const select = document.getElementById('catSelect');
    if (select) select.value = cat;
    applyFilters();
}

function toggleCat(header) { header.parentElement.classList.toggle('open'); }

function filterByCatAndProduct(cat, no) {
    activeCat = cat;
    const select = document.getElementById('catSelect');
    if (select) select.value = cat;
    applyFilters();
    goDetail(no);
}

// ---- Navigate to detail page ----
function goDetail(no) {
    const product = allProducts.find(p => p.no == no);
    if (product) {
        sessionStorage.setItem('nhun_product', JSON.stringify(product));
        window.location.href = `product-detail.html?no=${no}`;
    }
}

// ---- Main: fetch & render ----
async function fetchProducts() {
    const grid = document.getElementById('productGrid');
    try {
        allProducts = await fetchFromSheet();

        if (!allProducts.length) {
            grid.innerHTML = `<div class="error-state" style="grid-column:1/-1">
                <div class="icon">📭</div>
                <strong>Chưa có sản phẩm nào</strong>
                <p>Thêm dữ liệu vào Google Sheet là hiện thôi!</p>
            </div>`;
            return;
        }

        grid.innerHTML = '';
        buildCatSelect(allProducts);
        buildSidebar(allProducts);
        applyFilters();

        document.getElementById('sortSelect').addEventListener('change', applyFilters);
        document.getElementById('searchInput').addEventListener('input', applyFilters);

    } catch (err) {
        grid.innerHTML = `
            <div class="error-state" style="grid-column:1/-1">
                <div class="icon">🛠️</div>
                <strong>Chưa tải được sản phẩm</strong>
                <p>Đảm bảo Google Sheet được share <em>"Anyone with link can view"</em> nhé Nhún!</p>
                <small style="color:var(--text-light);margin-top:6px;display:block">${err.message}</small>
            </div>`;
        console.error('Fetch error:', err);
    }
}

document.addEventListener('DOMContentLoaded', fetchProducts);