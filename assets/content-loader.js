/* ============================================================
   Jaguar News — content loader
   Reads /data/<page>.json and fills in every element marked
   with data-field="key" (text) or data-list="key" (repeating
   cards, rendered with the matching template below).
   If the fetch fails (e.g. opened as a local file:// page),
   the HTML's own placeholder text stays put — nothing breaks.

   Special case: the "gallery-topic" page doesn't have its own
   data/gallery-topic.json — it reads data/gallery.json, finds
   the topic whose "id" matches ?id= in the URL, and treats that
   one topic object as the page's data (so data-field="title",
   data-field="description" and data-list="photos" all just work).
   ============================================================ */
(function () {
  const page = document.body.dataset.page;
  if (!page) return;

  const isGalleryTopic = page === "gallery-topic";
  const isArticle = page === "article";
  const requestedTopicId = isGalleryTopic
    ? new URLSearchParams(window.location.search).get("id")
    : null;
  const requestedArticleId = isArticle
    ? new URLSearchParams(window.location.search).get("id")
    : null;
  const dataUrl = isGalleryTopic
    ? "data/gallery.json"
    : isArticle
    ? "data/articles.json"
    : `data/${page}.json`;

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
      return `<div class="video-embed">
        <iframe src="${embed}"
          title="${esc(label || 'Video')}" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`;
    }
    return `<div class="ph r-16-9" data-label="VIDEO THUMBNAIL"></div>`;
  }

  const templates = {
    "story-card": (s) => `
      ${s.photo ? `<img src="${esc(s.photo)}" alt="${esc(s.title || "")}" style="width:100%;aspect-ratio:3/2;object-fit:cover;display:block;border-bottom:1.5px solid #1b1b1b">`
                 : `<div class="ph r-3-2" data-label="IMAGE 600×400"></div>`}
      <div class="card-body">
        <p class="card-meta">${esc(s.category)}</p>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.excerpt)}</p>
        <span class="read-more">Read more →</span>
      </div>`,
    "team-card": (m) => `
      <div class="ph r-1-1" data-label="PHOTO"></div>
      <p class="role">${esc(m.role)}</p>
      <h3>${esc(m.name)}</h3>`,
    "leadership-row": (p) => `
      <div class="leadership-photo">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name || "")}">`
                   : `<div class="ph r-1-1" data-label="PHOTO"></div>`}
      </div>
      <div class="leadership-body">
        <p class="role">${esc(p.role)}</p>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description)}</p>
      </div>`,
    "department-row": (d) => `
      <h3>${esc(d.title)}</h3>
      <p class="department-desc">${esc(d.description)}</p>
      <div class="department-leader">
        <div class="department-leader-photo">
          ${d.leader_photo ? `<img src="${esc(d.leader_photo)}" alt="${esc(d.leader_name || "")}">`
                            : `<div class="ph r-1-1" data-label="PHOTO"></div>`}
        </div>
        <div class="department-leader-body">
          <p class="role">${esc(d.leader_title)}</p>
          <h4>${esc(d.leader_name)}</h4>
          <p>${esc(d.leader_bio)}</p>
        </div>
      </div>`,
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
      ${a.photo ? `<img src="${esc(a.photo)}" alt="${esc(a.title || "")}" style="width:100%;aspect-ratio:3/2;object-fit:cover;display:block;border-bottom:1.5px solid #1b1b1b">`
                 : `<div class="ph r-3-2" data-label="IMAGE 600×400"></div>`}
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
    "gallery-topic-card": (t) => `
      <div class="gtc-cover">
        ${t.cover ? `<img src="${esc(t.cover)}" alt="${esc(t.title || "")}">`
                   : `<div class="ph r-4-3" data-label="PHOTO 800×600"></div>`}
      </div>
      <div class="gtc-title"><h3>${esc(t.title)}</h3></div>
      <div class="gtc-preview">
        ${t.cover ? `<img src="${esc(t.cover)}" alt="${esc(t.title || "")}">`
                   : `<div class="ph r-4-3" data-label="PHOTO 800×600"></div>`}
        <p>${esc(t.description)}</p>
        <span class="gtc-cta">Ver todas las fotos →</span>
      </div>`,
  };

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  // turns plain text with blank-line-separated paragraphs into <p> tags
  function paragraphsHtml(text) {
    if (!text) return "";
    return String(text)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join("");
  }

  // wires up the category filter buttons on the Articles page (a no-op on
  // any other page, since it bails out if it can't find both elements)
  function wireArticleFilters() {
    const grid = document.querySelector('[data-list="articles"]');
    const filterBar = document.querySelector(".filters");
    if (!grid || !filterBar) return;
    const buttons = filterBar.querySelectorAll("button[data-filter]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("is-on"));
        btn.classList.add("is-on");
        const filter = btn.dataset.filter;
        Array.from(grid.children).forEach((card) => {
          const show = filter === "all" || card.dataset.category === filter;
          card.style.display = show ? "" : "none";
        });
      });
    });
  }
  wireArticleFilters();

  fetch(dataUrl, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((raw) => {
      let data = raw;

      // gallery-topic: narrow the full gallery.json down to just the requested topic
      if (isGalleryTopic) {
        const topics = Array.isArray(raw.topics) ? raw.topics : [];
        const topic = topics.find((t) => t.id === requestedTopicId);
        if (!topic) return Promise.reject();
        data = topic;
      }

      // article: narrow the full articles.json down to just the requested article
      if (isArticle) {
        const articles = Array.isArray(raw.articles) ? raw.articles : [];
        const article = articles.find((a) => a.id === requestedArticleId);
        if (!article) return Promise.reject();
        data = article;
      }

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
          el.outerHTML = `<div class="video-embed featured-video-player">
            <iframe src="${embed}" title="Featured video" allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
          </div>`;
        }
      });
      // long-form text field rendered as one <p> per line (e.g. an article body)
      document.querySelectorAll("[data-richtext]").forEach((el) => {
        const key = el.dataset.richtext;
        if (data[key] != null) el.innerHTML = paragraphsHtml(data[key]);
      });
      // single image field that replaces the placeholder box when a real photo exists
      document.querySelectorAll("[data-image]").forEach((el) => {
        const key = el.dataset.image;
        const url = data[key];
        if (url) {
          const img = document.createElement("img");
          img.src = url;
          img.alt = data.title || "";
          img.className = "article-photo";
          el.replaceWith(img);
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
          if (item.category) card.dataset.category = item.category;
          // optional: build a link href from the item's own fields, e.g.
          // data-item-href="gallery-topic.html?id={id}" -> replaces {id} with item.id
          if (el.dataset.itemHref) {
            const href = el.dataset.itemHref.replace(/\{(\w+)\}/g, (_, k) =>
              encodeURIComponent(item[k] ?? "")
            );
            card.setAttribute("href", href);
          }
          card.innerHTML = templates[tpl](item);
          el.appendChild(card);
        });
      });
    })
    .catch(() => {
      /* offline, local file, or (for gallery-topic) an unknown ?id= —
         keep the static placeholder content already in the HTML */
    });
})();
