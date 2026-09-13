/* ============================================================
   Jaguar News — content loader
   Reads /data/<page>.json and fills in every element marked
   with data-field="key" (text) or data-list="key" (repeating
   cards, rendered with the matching template below).
   If the fetch fails (e.g. opened as a local file:// page),
   the HTML's own placeholder text stays put — nothing breaks.
   ============================================================ */
(function () {
  const page = document.body.dataset.page;
  if (!page) return;

  // turns a pasted YouTube URL (any common format) or a bare video ID into an embed URL
  function youtubeEmbedUrl(input) {
    if (!input) return null;
    const m = String(input).match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
    );
    const id = m ? m[1] : (/^[\w-]{11}$/.test(input) ? input : null);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  function videoEmbedHtml(url, label) {
    const embed = youtubeEmbedUrl(url);
    if (embed) {
      return `<div class="ph r-16-9" style="border:2px solid var(--ink,#1b1b1b);padding:0;overflow:hidden">
        <iframe style="width:100%;height:100%;border:0" src="${embed}"
          title="${esc(label || 'Video')}" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`;
    }
    return `<div class="ph r-16-9" data-label="VIDEO THUMBNAIL"></div>`;
  }

  const templates = {
    "story-card": (s) => `
      <div class="ph r-3-2" data-label="IMAGE 600×400"></div>
      <div class="card-body">
        <p class="card-meta">${esc(s.category)}</p>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.excerpt)}</p>
        <a href="articles.html" class="read-more">Read more →</a>
      </div>`,
    "team-card": (m) => `
      <div class="ph r-1-1" data-label="PHOTO"></div>
      <p class="role">${esc(m.role)}</p>
      <h3>${esc(m.name)}</h3>`,
    "issue-row": (i) => `
      <span><strong>Issue No. ${esc(i.number)}</strong> — ${esc(i.title)}</span>
      <span class="issue-date">${esc(i.date)}</span>`,
    "episode-row": (e) => `
      <div class="ep-num">${esc(e.number)}</div>
      <div>
        <h3>${esc(e.title)}</h3>
        <p style="margin:0;color:#555;font-size:.9rem">${esc(e.description)} · ${esc(e.length)}</p>
        <div class="player-bar">
          <div class="play-btn"><svg viewBox="0 0 24 24" fill="none" stroke="#1b1b1b" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M10 8.5 16 12l-6 3.5z" fill="#1b1b1b"/></svg></div>
          <div class="track"></div>
          <span style="font-size:.8rem;color:#666">00:00 / ${esc(e.length)}</span>
        </div>
      </div>
      <a href="#" class="btn outline">Listen</a>`,
    "article-card": (a) => `
      <div class="ph r-3-2" data-label="IMAGE 600×400"></div>
      <div class="card-body">
        <p class="card-meta">${esc(a.category)}</p>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.excerpt)}</p>
        <p class="byline" style="margin-bottom:0">Staff Writer<span class="dot">·</span>Sept 2026</p>
      </div>`,
    "video-card": (v) => `
      ${videoEmbedHtml(v.youtube_url, v.title)}
      <div class="card-body">
        <h3>${esc(v.title)}</h3>
        <p class="byline" style="margin-bottom:0">${esc(v.length)}<span class="dot">·</span>Sept 2026</p>
      </div>`,
    "gallery-figure": (p) => `
      ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.caption || "")}" style="width:100%;display:block;border-bottom:1.5px solid #1b1b1b">`
                 : `<div class="ph r-4-3" data-label="PHOTO 800×600"></div>`}
      <figcaption>${esc(p.caption)}</figcaption>`,
  };

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  fetch(`data/${page}.json`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      // simple text fields
      document.querySelectorAll("[data-field]").forEach((el) => {
        const key = el.dataset.field;
        if (data[key] != null) el.textContent = data[key];
      });
      // single embeddable field (e.g. the featured YouTube video)
      document.querySelectorAll("[data-embed]").forEach((el) => {
        const key = el.dataset.embed;
        const embed = youtubeEmbedUrl(data[key]);
        if (embed) {
          el.outerHTML = `<div class="ph r-16-9" style="border:2px solid var(--ink,#1b1b1b);padding:0;overflow:hidden;margin-bottom:40px">
            <iframe style="width:100%;height:100%;border:0" src="${embed}" title="Featured video" allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>`;
        }
      });
      // repeating lists
      document.querySelectorAll("[data-list]").forEach((el) => {
        const key = el.dataset.list;
        const tpl = el.dataset.template;
        const items = data[key];
        if (!Array.isArray(items) || !templates[tpl]) return;
        el.innerHTML = "";
        items.forEach((item) => {
          const card = document.createElement(el.dataset.itemTag || "div");
          card.className = el.dataset.itemClass || "";
          card.innerHTML = templates[tpl](item);
          el.appendChild(card);
        });
      });
    })
    .catch(() => {
      /* offline or local file — keep the static placeholder content already in the HTML */
    });
})();
