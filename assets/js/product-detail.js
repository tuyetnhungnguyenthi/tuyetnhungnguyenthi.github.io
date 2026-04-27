// ================================================================
// product-detail.js — Trang chi tiết sản phẩm
// ================================================================

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function renderDetail(p) {
    const main = document.getElementById('detailMain');
    document.title = `${p.name} | Góc Nhỏ Của Nhún`;

    // Image gallery
    const imgs = p.images && p.images.length ? p.images : [];
    const mainImgSrc = imgs[0] || '';

    const galleryHtml = `
        <div class="detail-gallery">
            <div class="gallery-main">
                ${mainImgSrc
                    ? `<img id="mainImg" src="${mainImgSrc}" alt="${p.name}">`
                    : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem">🌿</div>`}
            </div>
            ${imgs.length > 1 ? `
            <div class="gallery-thumbs">
                ${imgs.map((src, i) => `
                    <img class="gallery-thumb ${i===0?'active':''}"
                         src="${src}" alt="ảnh ${i+1}"
                         onclick="switchImg('${src}', this)">
                `).join('')}
            </div>` : ''}
        </div>`;

    // Review rows matched with video by date
    const videoMap = {};
    (p.videoLinks || []).forEach(v => { if (v.date) videoMap[v.date] = v.url; });

    const reviews = p.reviews || [];
    const reviewsHtml = reviews.length ? `
        <div>
            <div class="reviews-title">📝 Review sản phẩm</div>
            <div class="review-table">
                ${reviews.map(r => {
                    const vid = videoMap[r.date] || '';
                    const vidHtml = vid
                        ? `<a class="review-video" href="${vid}" target="_blank" rel="noopener">🎬 Xem video</a>`
                        : `<span style="width:90px"></span>`;
                    return `
                    <div class="review-row">
                        <div>
                            ${r.date ? `<div class="review-date">📅 ${r.date}</div>` : ''}
                            <div class="review-content">${r.content}</div>
                        </div>
                        ${vidHtml}
                    </div>`;
                }).join('')}
            </div>
        </div>` : '';

    // Videos without matching review date
    const unmatchedVideos = (p.videoLinks || []).filter(v => !videoMap[v.date] || !reviews.find(r => r.date === v.date));

    main.innerHTML = `
        <a href="goc-nho.html" class="detail-back">← Quay lại danh sách</a>

        <div class="detail-layout">
            ${galleryHtml}

            <div class="detail-info">
                <h1 class="detail-name">${p.name}</h1>

                <div class="detail-links">
                    ${p.shopeeLink ? `
                    <div class="detail-link-row">
                        <span class="detail-link-label">🛍️ Link Shopee:</span>
                        <a class="detail-link-btn" href="${p.shopeeLink}" target="_blank" rel="noopener">Xem trên Shopee ↗</a>
                    </div>` : ''}
                    ${p.tiktokLink ? `
                    <div class="detail-link-row">
                        <span class="detail-link-label">🎵 Link TikTok:</span>
                        <a class="detail-link-btn" href="${p.tiktokLink}" target="_blank" rel="noopener">Xem trên TikTok ↗</a>
                    </div>` : ''}
                </div>

                ${reviewsHtml}

                ${unmatchedVideos.length ? `
                <div>
                    <div class="reviews-title">🎬 Video liên quan</div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        ${unmatchedVideos.map(v => `
                            <div style="display:flex;align-items:center;gap:10px">
                                ${v.date ? `<span class="review-date">📅 ${v.date}</span>` : ''}
                                <a class="review-video" href="${v.url}" target="_blank" rel="noopener">🎬 Xem video</a>
                            </div>`).join('')}
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}

function switchImg(src, thumb) {
    document.getElementById('mainImg').src = src;
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

async function loadDetail() {
    const no = getParam('no');
    const main = document.getElementById('detailMain');

    // Try sessionStorage first (faster, set by list page on card click)
    const cached = sessionStorage.getItem('nhun_product');
    if (cached) {
        try {
            const p = JSON.parse(cached);
            if (String(p.no) === String(no)) {
                renderDetail(p);
                return;
            }
        } catch (_) {}
    }

    // Fallback: re-fetch from gviz API
    const SHEET_ID = '1kZrMreYg5bqZBy9-_8CXu7DjH5u72cOpgtPPxvvaoIA';
    try {
        const res  = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
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
        function pRevs(raw) { if (!raw) return []; const r=[]; let c=null; raw.split('\n').forEach(l => { l=l.trim(); const m=l.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:\s*(.*)/); if(m){if(c)r.push(c);c={date:m[1],content:m[2]};}else if(c&&l)c.content+=' '+l; }); if(c)r.push(c); return r; }
        function pVids(raw) { if (!raw) return []; const r=[]; let c=null; raw.split('\n').forEach(l => { l=l.trim(); const dm=l.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*:?\s*(https?:\/\/.*)?/); if(dm){if(c&&c.url)r.push(c);c={date:dm[1],url:dm[2]?dm[2].trim():''};}else if(l.match(/^https?:\/\//)&&c)c.url=l; }); if(c&&c.url)r.push(c); return r; }

        const all = rows.map((row, idx) => ({
            no: parseInt(get(row,'No.')) || idx+1,
            name: get(row,'Tên sản phẩm'),
            shopeeLink: get(row,'Link shoppee'),
            tiktokLink: get(row,'Link tiktok'),
            images: pImgs(get(row,'Hình ảnh sản phẩm')),
            reviews: pRevs(get(row,'Nội dung review')),
            videoLinks: pVids(get(row,'Link video tiktok liên quan')),
            category: get(row,'Danh mục') || 'Khác'
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
