// ================================================================
// api.js — Danh sách sản phẩm (goc-nho.html)
// ================================================================

const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbyDh9UY4hO56gpCExj2SEyYRzSzLTluHJkvACg2ITOGbZ5UDecYyvhHZuwaPKVCuhfdEw/exec";

// Lưu tất cả sản phẩm để filter không cần fetch lại
let allProducts = [];
let activeCat = 'all';

// ---- Helpers ----

/** Chuyển Google Drive view link → thumbnail URL */
function driveThumb(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w500` : url;
}

/** Parse chuỗi ảnh từ sheet (mỗi dòng: "1 - https://..." hoặc chỉ URL) */
function parseImages(raw) {
    if (!raw) return [];
    return raw.split('\n')
        .map(line => {
            const m = line.match(/https?:\/\/[^\s]+/);
            return m ? driveThumb(m[0]) : null;
        })
        .filter(Boolean);
}

/** Parse review entries: "DD/MM/YYYY: nội dung\nDD/MM/YYYY: ..." */
function parseReviews(raw) {
    if (!raw) return [];
    const result = [];
    let current = null;
    raw.split('\n').forEach(line => {
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

/** Parse video links: "DD/MM/YYYY:\nhttps://..." */
function parseVideoLinks(raw) {
    if (!raw) return [];
    const result = [];
    let current = null;
    raw.split('\n').forEach(line => {
        line = line.trim();
        const dateM = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(https?:\/\/.*)?/);
        if (dateM) {
            if (current && current.url) result.push(current);
            current = { date: dateM[1], url: dateM[2] ? dateM[2].trim() : '' };
        } else if (line.match(/^https?:\/\//) && current) {
            current.url = line;
        }
    });
    if (current && current.url) result.push(current);
    return result;
}

/** Lấy ngày đầu tiên của review để sort */
function firstReviewDate(product) {
    if (product.reviews && product.reviews.length > 0) {
        const parts = product.reviews[0].date.split('/');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }
    return new Date(0);
}

// ---- Render ----

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
        const imgHtml = p.images && p.images.length > 0
            ? `<img class="card-img" src="${p.images[0]}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>🌿</div>'">`
            : `<div class="card-img-placeholder">🌿</div>`;
        return `
        <div class="product-card" onclick="goDetail(${p.no})">
            ${imgHtml}
            <div class="card-body">
                <div class="card-category">${p.category || 'Chưa phân loại'}</div>
                <div class="card-name">${p.name}</div>
            </div>
        </div>`;
    }).join('');
}

function buildSidebar(products) {
    const tree = document.getElementById('categoryTree');
    const cats = {};
    products.forEach(p => {
        const c = p.category || 'Chưa phân loại';
        if (!cats[c]) cats[c] = [];
        cats[c].push(p);
    });

    tree.innerHTML = Object.entries(cats).map(([cat, items]) => `
        <div class="cat-group open" data-cat="${cat}">
            <div class="cat-header" onclick="toggleCat(this)">
                <span>${cat}</span>
                <span class="cat-arrow">▶</span>
            </div>
            <div class="cat-items">
                ${items.map(p => `
                    <span class="cat-item" onclick="filterByCatAndProduct('${cat}', ${p.no})">${p.name}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function buildFilterPills(products) {
    const pills = document.getElementById('filterPills');
    const cats = [...new Set(products.map(p => p.category || 'Chưa phân loại'))];
    const extra = cats.map(c =>
        `<button class="pill-btn" data-cat="${c}" onclick="setCatFilter('${c}', this)">${c}</button>`
    ).join('');
    // Keep "Tất cả" button, append rest
    pills.innerHTML = `<button class="pill-btn active" data-cat="all" onclick="setCatFilter('all', this)">Tất cả</button>${extra}`;
}

// ---- Filter / Sort / Search ----

function getFiltered() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const sort   = document.getElementById('sortSelect').value;

    let list = allProducts.filter(p => {
        const catMatch = activeCat === 'all' || (p.category || 'Chưa phân loại') === activeCat;
        const searchMatch = !search || p.name.toLowerCase().includes(search);
        return catMatch && searchMatch;
    });

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

function toggleCat(header) {
    header.parentElement.classList.toggle('open');
}

function filterByCatAndProduct(cat, no) {
    activeCat = cat;
    document.querySelectorAll('#filterPills .pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === cat);
    });
    applyFilters();
    goDetail(no);
}

// ---- Navigation to detail ----

function goDetail(no) {
    const product = allProducts.find(p => p.no == no);
    if (product) {
        sessionStorage.setItem('nhun_product', JSON.stringify(product));
        window.location.href = `product-detail.html?no=${no}`;
    }
}

// ---- Fetch ----

async function fetchProducts() {
    const grid = document.getElementById('productGrid');
    try {
        const res  = await fetch(GOOGLE_SHEET_API);
        const raw  = await res.json();

        // Support both old format {name, imageUrl,...} and new format {name, images,...}
        allProducts = raw.map((item, idx) => ({
            no:        item.no   ?? idx + 1,
            name:      item.name ?? '',
            category:  item.category ?? 'Chưa phân loại',
            shopeeLink: item.shopeeLink ?? item.affiliateLink ?? '',
            tiktokLink: item.tiktokLink ?? '',
            images:    item.images   ?? (item.imageUrl ? [item.imageUrl] : []),
            reviews:   item.reviews  ?? (item.description ? [{ date: '', content: item.description }] : []),
            videoLinks: item.videoLinks ?? []
        }));

        grid.innerHTML = '';
        buildFilterPills(allProducts);
        buildSidebar(allProducts);
        applyFilters();

        // Wire up event listeners
        document.getElementById('sortSelect').addEventListener('change', applyFilters);
        document.getElementById('searchInput').addEventListener('input', applyFilters);

    } catch (err) {
        grid.innerHTML = `
            <div class="error-state" style="grid-column:1/-1">
                <div class="icon">🛠️</div>
                <strong>Chưa tải được sản phẩm</strong>
                <p>Kiểm tra lại Apps Script Deployment hoặc kết nối mạng nhé Nhún!</p>
            </div>`;
        console.error('Fetch error:', err);
    }
}

document.addEventListener('DOMContentLoaded', fetchProducts);