// ================================================================
// api.js — Góc Nhỏ Của Nhún
// Dùng Google Sheets gviz JSON API (không cần Apps Script)
// Sheet phải được share "Anyone with link can view"
// ================================================================

const SHEET_ID = '1kZrMreYg5bqZBy9-_8CXu7DjH5u72cOpgtPPxvvaoIA';

let allProducts = [];
let activeCat = 'all';

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
            category: get(row, 'Danh mục') || 'Khác'
        }))
        .filter(p => p.name && p.name.trim()); // bỏ hàng trống
}

// ---- Render product grid ----
function renderGrid(products) {
    const grid = document.getElementById('productGrid');
    const noResults = document.getElementById('noResults');

    if (!products.length) {
        grid.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }
    noResults.classList.add('hidden');

    grid.innerHTML = products.map(p => {
        const imgHtml = p.images && p.images.length
            ? `<img class="card-img" src="${p.images[0]}" alt="${p.name}" loading="lazy"
                    onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'><img src=\\'assets/images/clover.svg\\' style=\\'width:44px;height:44px;opacity:0.45\\' alt=\\'\\'/></div>'">`
            : `<div class="card-img-placeholder"><img src="assets/images/clover.svg" style="width:44px;height:44px;opacity:0.45" alt=""></div>`;
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

    // Re-apply current language to newly rendered content
    if (window.applyCurrentLang) window.applyCurrentLang();
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

// ---- Build filter pills ----
function buildFilterPills(products) {
    const pills = document.getElementById('filterPills');
    const cats = [...new Set(products.map(p => p.category || 'Khác'))];
    pills.innerHTML = `<button class="pill-btn active" data-cat="all" onclick="setCatFilter('all',this)" data-vi="Tất cả" data-en="All">Tất cả</button>`
        + cats.map(c =>
            `<button class="pill-btn" data-cat="${c}" onclick="setCatFilter('${c}',this)" data-translatable>${c}</button>`
        ).join('');
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

function applyFilters() { renderGrid(getFiltered()); }

function setCatFilter(cat, btn) {
    activeCat = cat;
    document.querySelectorAll('#filterPills .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
}

function toggleCat(header) { header.parentElement.classList.toggle('open'); }

function filterByCatAndProduct(cat, no) {
    activeCat = cat;
    document.querySelectorAll('#filterPills .pill-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === cat));
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
        buildFilterPills(allProducts);
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