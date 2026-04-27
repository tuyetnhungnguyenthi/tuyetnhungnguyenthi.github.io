// ================================================================
// product-detail.js — Trang chi tiết sản phẩm
// Features: Image lightbox, Related products, Feedback form
// ================================================================

// ---- Apps Script URL (điền sau khi deploy) ----
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDh9UY4hO56gpCExj2SEyYRzSzLTluHJkvACg2ITOGbZ5UDecYyvhHZuwaPKVCuhfdEw/exec';

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// ================================================================
// PARSE HELPERS
// ================================================================
function pRelated(raw) {
    // Parses Column I "Các sản phẩm liên quan"
    // Format:
    //   25/04/2026:
    //   - bột bắp Tài Ký [9]
    // Returns: { 'dd/mm/yyyy': [{name, no}] }
    if (!raw) return {};
    const result = {};
    let currentDate = null;
    raw.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;

        // Date line: "25/04/2026:" or "25/04/2026: <optional product>"
        const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(.*)?$/);
        if (dateMatch) {
            currentDate = dateMatch[1];
            if (!result[currentDate]) result[currentDate] = [];
            // Inline product on same line as date
            const rest = (dateMatch[2] || '').trim();
            if (rest) {
                const pm = rest.match(/[-*•]\s+(.+?)\s+\[(\d+)\]/);
                if (pm) result[currentDate].push({ name: pm[1].trim(), no: parseInt(pm[2]) });
            }
            return;
        }
        // Product bullet line: "- bột bắp Tài Ký [9]"
        const pm = line.match(/^[-*•]\s+(.+?)\s+\[(\d+)\]/);
        if (pm && currentDate) {
            if (!result[currentDate]) result[currentDate] = [];
            result[currentDate].push({ name: pm[1].trim(), no: parseInt(pm[2]) });
        }
    });
    return result;
}

// ================================================================
// LIGHTBOX
// ================================================================
function injectLightbox() {
    if (document.getElementById('imgLightbox')) return;
    const lb = document.createElement('div');
    lb.id = 'imgLightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Xem ảnh phóng to');
    lb.innerHTML = `
        <button class="lb-close" onclick="closeLightbox()" aria-label="Đóng">✕</button>
        <img id="lbImg" src="" alt="Ảnh phóng to" onclick="event.stopPropagation()">
    `;
    lb.addEventListener('click', closeLightbox);
    document.body.appendChild(lb);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}

function openLightbox(src) {
    const lb = document.getElementById('imgLightbox');
    document.getElementById('lbImg').src = src;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lb = document.getElementById('imgLightbox');
    if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
}

// ================================================================
// TOAST NOTIFICATION
// ================================================================
function showToast(msg, type = 'success') {
    let toast = document.getElementById('nhunToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'nhunToast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast-show toast-${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = ''; }, 3500);
}

// ================================================================
// RENDER DETAIL
// ================================================================
function renderDetail(p) {
    const main = document.getElementById('detailMain');
    document.title = `${p.name} | Góc Nhỏ Của Nhún`;

    injectLightbox();

    // ---- Image gallery ----
    const imgs = p.images && p.images.length ? p.images : [];
    const mainImgSrc = imgs[0] || '';

    const galleryHtml = `
        <div class="detail-gallery">
            <div class="gallery-main">
                ${mainImgSrc
            ? `<img id="mainImg" src="${mainImgSrc}" alt="${p.name}"
                            onclick="openLightbox(this.src)"
                            title="Click để phóng to"
                            style="cursor:zoom-in">`
            : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem">🌿</div>`}
            </div>
            ${imgs.length > 1 ? `
            <div class="gallery-thumbs">
                ${imgs.map((src, i) => `
                    <img class="gallery-thumb ${i === 0 ? 'active' : ''}"
                         src="${src}" alt="ảnh ${i + 1}"
                         onclick="switchImg('${src}', this)">
                `).join('')}
            </div>` : ''}
        </div>`;

    // ---- Related products map ----
    const relatedMap = p.relatedProducts || {};

    // ---- Review rows matched with video + related products ----
    const videoMap = {};
    (p.videoLinks || []).forEach(v => { if (v.date) videoMap[v.date] = v.url; });

    const reviews = p.reviews || [];
    const reviewsHtml = reviews.length ? `
        <div>
            <div class="reviews-title" data-vi="📝 Nhật ký review" data-en="📝 Review diary">📝 Nhật ký review</div>
            <div class="review-table">
                ${reviews.map(r => {
        const vid = videoMap[r.date] || '';
        const vidHtml = vid
            ? `<a class="review-video" href="${vid}" target="_blank" rel="noopener"
                              data-vi="🎬 Xem video" data-en="🎬 Watch video">🎬 Xem video</a>`
            : `<span style="width:90px"></span>`;

        // Related products for this date
        const relList = relatedMap[r.date] || [];
        const relHtml = relList.length ? `
                        <div class="review-related">
                            <span class="related-label" data-vi="🔗 Dùng cùng:" data-en="🔗 Used with:">🔗 Dùng cùng:</span>
                            ${relList.map(rel =>
            `<a class="related-link" href="product-detail.html?no=${rel.no}"
                                    data-translatable>${rel.name}</a>`
        ).join('')}
                        </div>` : '';

        return `
                    <div class="review-row">
                        <div>
                            ${r.date ? `<div class="review-date">📅 ${r.date}</div>` : ''}
                            <div class="review-content" data-translatable>${r.content}</div>
                            ${relHtml}
                        </div>
                        ${vidHtml}
                    </div>`;
    }).join('')}
            </div>
        </div>` : '';

    // ---- Videos without matching review date ----
    const unmatchedVideos = (p.videoLinks || []).filter(v => !reviews.find(r => r.date === v.date));

    // ---- Feedback form ----
    const feedbackHtml = `
        <div class="feedback-section">
            <div class="reviews-title" data-vi="💬 Góc nhỏ của bạn" data-en="💬 Your corner">💬 Góc nhỏ của bạn</div>
            <p class="feedback-desc"
               data-vi="Bạn có muốn mình review thêm điều gì về sản phẩm này không?"
               data-en="Is there anything else you'd like me to review about this product?">
               Bạn có muốn mình review thêm điều gì về sản phẩm này không?
            </p>
            <div class="feedback-form">
                <input type="text" id="fbNickname" class="fb-input"
                       data-ph-vi="Nickname của bạn *" data-ph-en="Your nickname *"
                       placeholder="Nickname của bạn *" maxlength="50">
                <textarea id="fbRequest" class="fb-textarea"
                          data-ph-vi="Yêu cầu của bạn... *" data-ph-en="Your request... *"
                          placeholder="Yêu cầu của bạn... *" rows="3" maxlength="500"></textarea>
                <button class="fb-btn" id="fbSubmitBtn" onclick="submitFeedback('${p.name.replace(/'/g, "\\'")}')"
                        data-vi="Gửi đi 💌" data-en="Send 💌">Gửi đi 💌</button>
            </div>
        </div>`;

    main.innerHTML = `
        <a href="goc-nho.html" class="detail-back"
           data-vi="← Quay lại danh sách" data-en="← Back to list">← Quay lại danh sách</a>

        <div class="detail-layout">
            ${galleryHtml}

            <div class="detail-info">
                <h1 class="detail-name" data-translatable>${p.name}</h1>

                <div class="detail-links">
                    ${p.shopeeLink ? `
                    <div class="detail-link-row">
                        <span class="detail-link-label" data-vi="🛍️ Link Shopee:" data-en="🛍️ Shopee Link:">🛍️ Link Shopee:</span>
                        <a class="detail-link-btn" href="${p.shopeeLink}" target="_blank" rel="noopener"
                           data-vi="Xem trên Shopee ↗" data-en="View on Shopee ↗">Xem trên Shopee ↗</a>
                    </div>` : ''}
                    ${p.tiktokLink ? `
                    <div class="detail-link-row">
                        <span class="detail-link-label" data-vi="🎵 Link TikTok:" data-en="🎵 TikTok Link:">🎵 Link TikTok:</span>
                        <a class="detail-link-btn" href="${p.tiktokLink}" target="_blank" rel="noopener"
                           data-vi="Xem trên TikTok ↗" data-en="View on TikTok ↗">Xem trên TikTok ↗</a>
                    </div>` : ''}
                </div>

                ${reviewsHtml}

                ${unmatchedVideos.length ? `
                <div>
                    <div class="reviews-title" data-vi="🎬 Video liên quan" data-en="🎬 Related Videos">🎬 Video liên quan</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        ${unmatchedVideos.map(v => `
                            <div style="display:flex;align-items:center;gap:10px">
                                ${v.date ? `<span class="review-date">📅 ${v.date}</span>` : ''}
                                <a class="review-video" href="${v.url}" target="_blank" rel="noopener"
                                   data-vi="🎬 Xem video" data-en="🎬 Watch video">🎬 Xem video</a>
                            </div>`).join('')}
                    </div>
                </div>` : ''}

                ${feedbackHtml}
            </div>
        </div>`;

    if (window.applyCurrentLang) window.applyCurrentLang();
}

// ================================================================
// FORM SUBMISSION
// ================================================================
async function submitFeedback(productName) {
    const nicknameEl = document.getElementById('fbNickname');
    const requestEl = document.getElementById('fbRequest');
    const btn = document.getElementById('fbSubmitBtn');

    const nickname = nicknameEl.value.trim();
    const request = requestEl.value.trim();

    if (!nickname) { nicknameEl.focus(); showToast('Vui lòng nhập nickname nhé! 🥺', 'error'); return; }
    if (!request) { requestEl.focus(); showToast('Bạn chưa nhập yêu cầu nè! 🥺', 'error'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Đang gửi...';

    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', 'submit');
        url.searchParams.set('product', productName);
        url.searchParams.set('nickname', nickname);
        url.searchParams.set('request', request);

        await fetch(url.toString(), { mode: 'no-cors' });
        showToast('✅ Gửi thành công! Nhún sẽ cân nhắc nhé 💚');
        nicknameEl.value = '';
        requestEl.value = '';
    } catch (err) {
        showToast('❌ Gửi thất bại. Thử lại sau nhé!', 'error');
    } finally {
        btn.disabled = false;
        const lang = window.getLang ? window.getLang() : 'vi';
        btn.textContent = lang === 'en' ? 'Send 💌' : 'Gửi đi 💌';
    }
}

// Also used from yeu-cau-review.html
async function submitReviewRequest() {
    const productEl = document.getElementById('rrProduct');
    const nicknameEl = document.getElementById('rrNickname');
    const noteEl = document.getElementById('rrNote');
    const btn = document.getElementById('rrSubmitBtn');

    const product = productEl ? productEl.value.trim() : '';
    const nickname = nicknameEl ? nicknameEl.value.trim() : '';
    const note = noteEl ? noteEl.value.trim() : '';

    if (!product) { productEl.focus(); showToast('Bạn chưa nhập sản phẩm muốn review nè! 🥺', 'error'); return; }
    if (!nickname) { nicknameEl.focus(); showToast('Vui lòng nhập nickname nhé! 🥺', 'error'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Đang gửi...';

    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', 'submit');
        url.searchParams.set('product', product);
        url.searchParams.set('nickname', nickname);
        url.searchParams.set('request', note || '(Yêu cầu review sản phẩm)');

        await fetch(url.toString(), { mode: 'no-cors' });
        showToast('✅ Gửi thành công! Nhún sẽ cân nhắc nhé 💚');
        productEl.value = '';
        nicknameEl.value = '';
        if (noteEl) noteEl.value = '';
    } catch (err) {
        showToast('❌ Gửi thất bại. Thử lại sau nhé!', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ Gửi yêu cầu';
    }
}

// ================================================================
// GALLERY
// ================================================================
function switchImg(src, thumb) {
    document.getElementById('mainImg').src = src;
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

// ================================================================
// LOAD PRODUCT
// ================================================================
async function loadDetail() {
    const no = getParam('no');
    const main = document.getElementById('detailMain');

    // Try sessionStorage first (set by list page on card click)
    const cached = sessionStorage.getItem('nhun_product');
    if (cached) {
        try {
            const p = JSON.parse(cached);
            if (String(p.no) === String(no)) {
                // Re-fetch related products if missing (older cache)
                if (!p.relatedProducts) p.relatedProducts = {};
                renderDetail(p);
                return;
            }
        } catch (_) { }
    }

    // Fallback: fetch from gviz API
    const SHEET_ID = '1kZrMreYg5bqZBy9-_8CXu7DjH5u72cOpgtPPxvvaoIA';
    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
        const text = await res.text();
        const match = text.match(/setResponse\(([\s\S]*)\)/);
        if (!match) throw new Error('Cannot parse gviz response');
        const json = JSON.parse(match[1]);

        const cols = json.table.cols;
        const rows = json.table.rows;
        const colIdx = {};
        cols.forEach((col, i) => { if (col.label) colIdx[col.label.trim()] = i; });

        const get = (row, label) => {
            const i = colIdx[label];
            if (i === undefined || !row.c || !row.c[i] || row.c[i].v === null) return '';
            return String(row.c[i].v);
        };

        function dThumb(url) { const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/); return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600` : url; }
        function pImgs(raw) { if (!raw) return []; return raw.split('\n').map(l => { const m = l.match(/https?:\/\/[^\s]+/); return m ? dThumb(m[0]) : null; }).filter(Boolean); }
        function pRevs(raw) { if (!raw) return []; const r = []; let c = null; raw.split('\n').forEach(l => { l = l.trim(); const m = l.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:\s*(.*)/); if (m) { if (c) r.push(c); c = { date: m[1], content: m[2] }; } else if (c && l) c.content += ' ' + l; }); if (c) r.push(c); return r; }
        function pVids(raw) { if (!raw) return []; const r = []; let c = null; raw.split('\n').forEach(l => { l = l.trim(); const dm = l.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(https?:\/\/.*)?/); if (dm) { if (c && c.url) r.push(c); c = { date: dm[1], url: dm[2] ? dm[2].trim() : '' }; } else if (l.match(/^https?:\/\//) && c) c.url = l; }); if (c && c.url) r.push(c); return r; }

        const all = rows.map((row, idx) => ({
            no: parseInt(get(row, 'No.')) || idx + 1,
            name: get(row, 'Tên sản phẩm'),
            shopeeLink: get(row, 'Link shoppee'),
            tiktokLink: get(row, 'Link tiktok'),
            images: pImgs(get(row, 'Hình ảnh sản phẩm')),
            reviews: pRevs(get(row, 'Nội dung review')),
            videoLinks: pVids(get(row, 'Link video tiktok liên quan')),
            category: get(row, 'Danh mục') || 'Khác',
            relatedProducts: pRelated(get(row, 'Các sản phẩm liên quan'))
        })).filter(p => p.name && p.name.trim());

        const product = all.find(p => String(p.no) === String(no));
        if (product) renderDetail(product);
        else main.innerHTML = '<p class="loading">😅 Không tìm thấy sản phẩm.</p>';

    } catch (err) {
        main.innerHTML = `<div class="error-state"><div class="icon">🛠️</div><p>Không tải được dữ liệu. Thử lại sau nhé!</p></div>`;
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', loadDetail);
