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

  // the data for the page currently being rendered (lets list templates read
  // page-wide settings, like the gallery's editable button text)
  let currentData = null;
  const seeMoreLabel = () => (currentData && currentData.see_more_label) || "See more photos";

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

  // renders a video: a YouTube link wins if present, otherwise an uploaded
  // video file (plays with the browser's own player), otherwise the placeholder
  function videoEmbedHtml(url, label, fileUrl) {
    const embed = youtubeEmbedUrl(url);
    if (embed) {
      return `<div class="video-embed">
        <iframe src="${embed}"
          title="${esc(label || 'Video')}" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`;
    }
    if (fileUrl) {
      return `<div class="video-embed">
        <video controls preload="metadata" playsinline src="${esc(fileUrl)}" title="${esc(label || 'Video')}"></video>
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
      ${e.youtube_url
        ? `<button type="button" class="btn outline" data-youtube-popup="${esc(e.youtube_url)}">Listen</button>`
        : `<button type="button" class="btn outline" disabled style="opacity:.5;cursor:not-allowed">Listen</button>`}`,
    "article-card": (a) => `
      ${a.photo ? `<img src="${esc(a.photo)}" alt="${esc(a.title || "")}" style="width:100%;aspect-ratio:3/2;object-fit:cover;display:block;border-bottom:1.5px solid #1b1b1b">`
                 : `<div class="ph r-3-2" data-label="IMAGE 600×400"></div>`}
      <div class="card-body">
        <p class="card-meta">${esc(a.category)}</p>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.excerpt)}</p>
        <p class="byline" style="margin-bottom:0">${bylineHtml(a.author, a.date)}</p>
      </div>`,
    "video-card": (v) => `
      ${videoEmbedHtml(v.youtube_url, v.title, v.video_file)}
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
      <div class="gtc-more">
        <p>${esc(t.description)}</p>
        <span class="btn gtc-btn">${esc(seeMoreLabel())} →</span>
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

  // "Author · Date" byline; falls back to "Staff Writer" if no author is set,
  // and simply leaves the date off if there isn't one
  function bylineHtml(author, date) {
    return [author || "Staff Writer", date]
      .filter(Boolean)
      .map(esc)
      .join('<span class="dot">·</span>');
  }

  // wires up category filter buttons on any page that has a ".filters" bar
  // immediately followed by the data-list it should filter (Articles' grid,
  // Podcast's episode list, or any future page built the same way) — a no-op
  // if a page has no .filters bar at all
  function wireFilterButtons() {
    const filterBar = document.querySelector(".filters");
    if (!filterBar) return;
    let list = filterBar.nextElementSibling;
    while (list && !list.hasAttribute("data-list")) list = list.nextElementSibling;
    if (!list) return;
    const buttons = filterBar.querySelectorAll("button[data-filter]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("is-on"));
        btn.classList.add("is-on");
        const filter = btn.dataset.filter;
        Array.from(list.children).forEach((card) => {
          const show = filter === "all" || card.dataset.category === filter;
          card.style.display = show ? "" : "none";
        });
      });
    });
  }
  wireFilterButtons();

  // ---- YouTube pop-up (used by the Podcast page's "Listen" button) ----
  function ensureVideoModal() {
    let modal = document.getElementById("video-modal-overlay");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "video-modal-overlay";
    modal.className = "video-modal-overlay";
    modal.innerHTML = `
      <div class="video-modal">
        <button type="button" class="video-modal-close" aria-label="Close">&times;</button>
        <div class="video-modal-body"></div>
      </div>`;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeVideoModal();
    });
    modal.querySelector(".video-modal-close").addEventListener("click", closeVideoModal);
    document.body.appendChild(modal);
    return modal;
  }
  function openVideoModal(url) {
    const embed = youtubeEmbedUrl(url);
    if (!embed) return;
    const modal = ensureVideoModal();
    modal.querySelector(".video-modal-body").innerHTML = `
      <div class="video-embed">
        <iframe src="${embed}" title="Episode video" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeVideoModal() {
    const modal = document.getElementById("video-modal-overlay");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.querySelector(".video-modal-body").innerHTML = ""; // stop playback
    document.body.style.overflow = "";
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-youtube-popup]");
    if (!btn) return;
    e.preventDefault();
    if (btn.dataset.youtubePopup) openVideoModal(btn.dataset.youtubePopup);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeVideoModal();
  });

  // ---- remembering the last-seen content ----
  // We save the last JSON we fetched in the browser, so on every visit after the
  // first the page can paint real content instantly instead of waiting on the
  // network (that wait is what used to show the placeholders for a split second).
  function readCache(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeCache(key, text) {
    try { localStorage.setItem(key, text); } catch (e) { /* blocked or full — fine */ }
  }
  // "no-cache" = always ask the server if it changed, but get a fast 304 if not
  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject()));
  }

  // ---- site-wide settings (currently just the contact email) ----
  function applySite(site) {
    document.querySelectorAll("[data-mailto]").forEach((el) => {
      const key = el.dataset.mailto;
      const email = site[key];
      if (email) {
        el.href = `mailto:${email}`;
        el.textContent = email;
      }
    });
  }

  // ---- page content ----
  // gallery-topic / article pages only want ONE entry out of the big file;
  // returns null if that entry doesn't exist
  function resolveData(raw) {
    if (isGalleryTopic) {
      const topics = Array.isArray(raw.topics) ? raw.topics : [];
      return topics.find((t) => t.id === requestedTopicId) || null;
    }
    if (isArticle) {
      const articles = Array.isArray(raw.articles) ? raw.articles : [];
      return articles.find((a) => a.id === requestedArticleId) || null;
    }
    return raw;
  }

  function render(data) {
    currentData = data;
    // simple text fields
    document.querySelectorAll("[data-field]").forEach((el) => {
      const key = el.dataset.field;
      if (data[key] != null) el.textContent = data[key];
    });
    // single embeddable field (e.g. the featured YouTube video)
    document.querySelectorAll("[data-embed]").forEach((el) => {
      const key = el.dataset.embed;
      const embed = youtubeEmbedUrl(data[key]);
      const fileUrl = el.dataset.embedFile ? data[el.dataset.embedFile] : null;
      if (embed) {
        el.outerHTML = `<div class="video-embed featured-video-player">
          <iframe src="${embed}" title="Featured video" allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>`;
      } else if (fileUrl) {
        el.outerHTML = `<div class="video-embed featured-video-player">
          <video controls preload="metadata" playsinline src="${esc(fileUrl)}" title="Featured video"></video>
        </div>`;
      }
    });
    // "Author · Date" line (e.g. on the single-article page)
    document.querySelectorAll("[data-byline]").forEach((el) => {
      el.innerHTML = bylineHtml(data.author, data.date);
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
  }

  const siteKey = "jn:data/site.json";
  const pageKey = "jn:" + dataUrl;
  const hasMailto = !!document.querySelector("[data-mailto]");

  // 1) paint straight from the saved copies, if we have them
  let siteFromCache = false;
  const cachedSite = readCache(siteKey);
  if (cachedSite) {
    try { applySite(JSON.parse(cachedSite)); siteFromCache = true; } catch (e) { /* ignore */ }
  }
  let pageFromCache = null; // the exact text we painted from (null = didn't)
  const cachedPage = readCache(pageKey);
  if (cachedPage) {
    try {
      const d = resolveData(JSON.parse(cachedPage));
      if (d) { render(d); pageFromCache = cachedPage; }
    } catch (e) { /* ignore */ }
  }
  // already showing real content? then there's nothing left to wait for
  if (pageFromCache !== null && (siteFromCache || !hasMailto)) {
    document.body.classList.add("cms-ready");
  }

  // 2) in the background, fetch the real thing
  const sitePromise = fetchJson("data/site.json")
    .then((site) => {
      writeCache(siteKey, JSON.stringify(site));
      applySite(site);
    })
    .catch(() => { /* keep whatever email is already on the page */ });

  const pagePromise = fetchJson(dataUrl)
    .then((raw) => {
      const text = JSON.stringify(raw);
      writeCache(pageKey, text);
      if (pageFromCache !== null) {
        // we already painted from the saved copy; if the content has changed
        // since, reload once to show the new version (the next load is instant)
        if (text !== pageFromCache) window.location.reload();
        return;
      }
      const d = resolveData(raw);
      if (d) render(d);
    })
    .catch(() => {
      /* offline, local file, or an unknown ?id= — keep the static placeholder
         content already in the HTML */
    });

  // both chains above always resolve (they catch their own errors), so this
  // runs whether loading worked or not — styles.css keeps the data-driven bits
  // invisible until then, so placeholders never flash on screen
  Promise.all([sitePromise, pagePromise]).then(() => {
    document.body.classList.add("cms-ready");
  });
})();
