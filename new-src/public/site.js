// site.js — all non-3D interactivity

(function () {

  // ========= BEFORE STACK (mail rows) — animated, with hot/cold variants =========
  const beforeStack = document.getElementById("before-stack");
  const unreadCountEl = document.getElementById("ba-unread-count");
  const unreadBadge = document.getElementById("ba-badge-unread");
  if (beforeStack) {
    const threads = [
      ["AIRBNB",  "Wifi password?",                 "Unit 4",  "now",   false],
      ["VRBO",    "Early check-in possible?",       "Unit 12", "2m",    false],
      ["BOOKING", "Refund please — noise complaint","Unit 7",  "4m",    true],
      ["AIRBNB",  "Where's the parking?",           "Unit 1",  "7m",    false],
      ["AIRBNB",  "Door code not working",          "Unit 4",  "12m",   true],
      ["VRBO",    "Can we bring a dog?",            "Unit 9",  "18m",   false],
      ["BOOKING", "Is the pool heated?",            "Unit 3",  "24m",   false],
      ["AIRBNB",  "Cancellation request",           "Unit 11", "31m",   true],
      ["AIRBNB",  "AC is broken — emergency",       "Unit 6",  "42m",   true],
      ["VRBO",    "Checkout time?",                 "Unit 2",  "58m",   false],
    ];

    let i = 0;
    let count = 38;
    unreadCountEl.textContent = count;

    function addRow() {
      if (i >= threads.length) {
        // reset cycle after delay
        setTimeout(() => {
          beforeStack.innerHTML = "";
          i = 0;
          count = 38;
          unreadCountEl.textContent = count;
          addRow();
        }, 2800);
        return;
      }
      const t = threads[i];
      const row = document.createElement("div");
      row.className = "mail-row" + (t[4] ? " hot" : "");
      row.innerHTML = `
        <div class="unread-dot"></div>
        <div>
          <div class="mail-from"><span class="plat-tag">${t[0]}</span>${t[2]} · Guest message</div>
          <div class="mail-subject">${t[1]}</div>
        </div>
        <div class="mail-meta">
          <span class="m-time">${t[3]}</span>
        </div>
      `;
      // prepend so newest is on top
      beforeStack.insertBefore(row, beforeStack.firstChild);

      count += Math.floor(Math.random() * 2) + 1;
      unreadCountEl.textContent = count;
      unreadBadge.classList.remove("pulse");
      void unreadBadge.offsetWidth;
      unreadBadge.classList.add("pulse");

      i++;
      // only keep ~8 visible
      const rows = beforeStack.querySelectorAll(".mail-row");
      if (rows.length > 8) {
        const last = rows[rows.length - 1];
        last.style.transition = "opacity .4s, transform .4s";
        last.style.opacity = "0";
        last.style.transform = "translateY(20px)";
        setTimeout(() => last.remove(), 400);
      }

      setTimeout(addRow, 900 + Math.random() * 600);
    }
    // seed initial
    setTimeout(addRow, 300);
  }

  // ========= CALENDAR RING TILES =========
  const ring = document.getElementById("cal-ring");
  if (ring) {
    const platforms = ["AIRBNB", "VRBO", "BOOKING", "AIRBNB", "VRBO", "BOOKING"];
    const radius = 38; // % of container
    platforms.forEach((plat, i) => {
      const angle = (i / platforms.length) * Math.PI * 2;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      const tile = document.createElement("div");
      tile.className = "cal-tile";
      tile.style.left = x + "%";
      tile.style.top = y + "%";
      tile.style.transform = `translate(-50%, -50%) translateZ(0) rotateZ(${-i * 60}deg)`;
      const booked = i === 0;
      let grid = "";
      for (let d = 0; d < 14; d++) {
        let cls = "";
        if (booked && (d === 5 || d === 6 || d === 7)) cls = "booked";
        else if (!booked && (d === 5 || d === 6 || d === 7)) cls = "blocked";
        grid += `<span class="${cls}"></span>`;
      }
      tile.innerHTML = `
        <div class="cal-tile-head">${plat} · U${i + 1}</div>
        <div class="cal-mini-grid">${grid}</div>
      `;
      ring.appendChild(tile);
    });

    // scroll-driven tilt (freezes at 50% in view)
    const stage = ring.parentElement;
    window.addEventListener("scroll", () => {
      const rect = stage.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = 1 - Math.max(0, Math.min(1, (rect.top + rect.height * 0.3) / vh));
      const tilt = 55 - progress * 20; // tilt down as you scroll
      const rotZ = progress * 180;
      if (progress < 0.5) {
        ring.style.animation = "ringRotate 40s linear infinite";
      } else {
        ring.style.animation = "none";
        ring.style.transform = `rotateX(${tilt}deg) rotateZ(${rotZ}deg)`;
      }
    }, { passive: true });
  }

  // ========= KB GRADUATION — horizontal bar rows =========
  const kbRows = document.getElementById("kb-rows");
  if (kbRows) {
    // [question, monthly count, auto%]
    const rows = [
      ["Wifi password",          842, 0.98],
      ["Checkout time",          611, 0.95],
      ["Thanks / kind words",    548, 0.92],
      ["Door code",              403, 0.84],
      ["Check-in time",          367, 0.71],
      ["Parking directions",     218, 0.55],
      ["Late check-out",         142, 0.32],
      ["Refund / complaint",      87, 0.00],
    ];
    rows.forEach(([name, count, autoPct]) => {
      const pct = Math.round(autoPct * 100);
      const row = document.createElement("div");
      row.className = "kb-row";
      const full = pct >= 80 ? " full" : "";
      row.innerHTML = `
        <div class="kb-name">${name}<span class="kb-count">${count.toLocaleString()} this month</span></div>
        <div class="kb-bar">
          <div class="kb-draft-seg" data-w="100"></div>
          <div class="kb-auto-seg" data-w="${pct}" data-left="0"></div>
        </div>
        <div class="kb-pct${full}">${pct}% auto</div>
      `;
      kbRows.appendChild(row);
    });

    function growKB() {
      kbRows.querySelectorAll(".kb-row").forEach((r, i) => {
        setTimeout(() => {
          const draft = r.querySelector(".kb-draft-seg");
          const auto = r.querySelector(".kb-auto-seg");
          draft.style.width = "100%";
          auto.style.width = auto.dataset.w + "%";
        }, i * 110);
      });
    }
    let fired = false;
    const obs = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting && !fired) { fired = true; growKB(); } });
    }, { threshold: 0.2 });
    obs.observe(kbRows);
    setTimeout(() => { if (!fired) { fired = true; growKB(); } }, 1800);
  }

  // ========= SKY SCENE (day-night cycle + rolling message feed) =========
  const skyFeed = document.getElementById("sky-phone-feed");
  const skyClock = document.getElementById("sky-clock");
  const skyClockLabel = document.getElementById("sky-clock-label");
  const skyPhoneTime = document.getElementById("sky-phone-time");
  const skyStatusCount = document.getElementById("sky-status-count");

  if (skyFeed) {
    // 24 hours of messages, mapped onto the 48s cycle (1 cycle = 24h)
    const events = [
      { h: 0.5,  kind: "auto",  unit: "Unit 9",  q: "What time is check-out?", meta: "Airbnb · auto-sent · 1.9s" },
      { h: 2.7,  kind: "draft", unit: "Unit 4",  q: "Heating not coming on — any trick?", meta: "Awaiting your approval" },
      { h: 5.1,  kind: "auto",  unit: "Unit 12", q: "Wifi password please?", meta: "VRBO · auto-sent · 2.1s" },
      { h: 7.8,  kind: "auto",  unit: "Unit 2",  q: "What's the door code?", meta: "Airbnb · auto-sent · 1.4s" },
      { h: 10.2, kind: "auto",  unit: "Unit 7",  q: "Parking directions?", meta: "Booking · auto-sent · 2.3s" },
      { h: 12.6, kind: "draft", unit: "Unit 11", q: "Can we check in 2 hours early?", meta: "Awaiting your approval" },
      { h: 14.4, kind: "auto",  unit: "Unit 3",  q: "Is the pool heated?", meta: "VRBO · auto-sent · 1.8s" },
      { h: 17.3, kind: "auto",  unit: "Unit 5",  q: "Late check-out possible?", meta: "Airbnb · auto-sent · 1.5s" },
      { h: 19.8, kind: "auto",  unit: "Unit 8",  q: "Nearest grocery store?", meta: "Booking · auto-sent · 2.2s" },
      { h: 22.1, kind: "auto",  unit: "Unit 1",  q: "Thank you for the great stay!", meta: "Airbnb · auto-sent · 1.7s" },
      { h: 23.6, kind: "draft", unit: "Unit 6",  q: "AC isn't working — kids can't sleep", meta: "Awaiting your approval · URGENT" },
    ];

    const CYCLE_MS = 48000; // matches CSS skyCycle duration
    const startRealTime = performance.now();
    let lastEventIdx = -1;
    let handled = 0;

    function fmtHour(h) {
      const hh = Math.floor(h) % 24;
      const mm = Math.floor((h - Math.floor(h)) * 60);
      const ampm = hh < 12 ? "AM" : "PM";
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return { display: `${h12}:${String(mm).padStart(2,"0")}`, ampm, hh };
    }
    function labelFor(hh) {
      if (hh < 5)  return "NIGHT";
      if (hh < 7)  return "DAWN";
      if (hh < 11) return "MORNING";
      if (hh < 14) return "MIDDAY";
      if (hh < 18) return "AFTERNOON";
      if (hh < 20) return "SUNSET";
      if (hh < 22) return "DUSK";
      return "NIGHT";
    }

    function addMsg(ev) {
      const { display, ampm } = fmtHour(ev.h);
      const el = document.createElement("div");
      el.className = "sky-msg " + ev.kind;
      el.innerHTML = `
        <div class="sky-msg-head">
          <span>${ev.unit} · ${display} ${ampm}</span>
          <span class="sky-msg-tag">${ev.kind === "auto" ? "AUTO" : "DRAFT"}</span>
        </div>
        <div class="sky-msg-body">"${ev.q}"</div>
        <div class="sky-msg-meta">${ev.meta}</div>
      `;
      skyFeed.appendChild(el);
      if (ev.kind === "auto") {
        handled++;
        if (skyStatusCount) skyStatusCount.textContent = handled;
      }
      // cap to 3 visible
      if (skyFeed.children.length > 3 && skyFeed.firstElementChild) {
        const first = skyFeed.firstElementChild;
        first.style.transition = "opacity .4s, transform .4s";
        first.style.opacity = "0";
        first.style.transform = "translateY(-8px) scale(0.96)";
        setTimeout(() => first.remove(), 400);
      }
    }

    function tick() {
      const now = performance.now();
      const elapsed = (now - startRealTime) % CYCLE_MS;
      const hourOfDay = (elapsed / CYCLE_MS) * 24;

      // update clock every tick
      const f = fmtHour(hourOfDay);
      if (skyClock) skyClock.textContent = f.display + " " + f.ampm;
      if (skyPhoneTime) skyPhoneTime.textContent = f.display;
      if (skyClockLabel) skyClockLabel.textContent = labelFor(f.hh);

      // fire events whose hour matches
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        // has the scene hour just crossed ev.h?
        const prevElapsed = ((now - 33 - startRealTime) % CYCLE_MS) / CYCLE_MS * 24;
        if (prevElapsed < ev.h && hourOfDay >= ev.h && lastEventIdx !== i) {
          lastEventIdx = i;
          addMsg(ev);
        }
      }
      // reset lastEventIdx at start of new cycle
      if (hourOfDay < 0.3 && lastEventIdx !== -1 && lastEventIdx >= events.length - 2) {
        lastEventIdx = -1;
        handled = 0;
        if (skyStatusCount) skyStatusCount.textContent = 0;
        // clear feed softly
        Array.from(skyFeed.children).forEach((c, idx) => {
          setTimeout(() => c.remove(), idx * 100);
        });
      }

      requestAnimationFrame(tick);
    }
    // seed with a few messages so feed isn't empty on first load
    addMsg(events[0]);
    setTimeout(() => addMsg(events[1]), 400);
    requestAnimationFrame(tick);
  }

  // ========= SCALE SLIDER =========
  const scaleInput = document.getElementById("scale-input");
  const scaleNum = document.getElementById("scale-num");
  const sliderFill = document.getElementById("slider-fill");
  const sliderThumb = document.getElementById("slider-thumb");
  const statMsg = document.getElementById("stat-msg");
  const statAuto = document.getElementById("stat-auto");
  const statDraft = document.getElementById("stat-draft");
  const barAuto = document.getElementById("bar-auto");
  const sparkMsg = document.getElementById("spark-msg");
  const sparkDraft = document.getElementById("spark-draft");

  function renderSpark(el, seed, scale) {
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < 14; i++) {
      const h = 20 + Math.abs(Math.sin(seed + i * 0.7)) * 80 * scale;
      const s = document.createElement("span");
      s.style.height = h + "%";
      el.appendChild(s);
    }
  }

  function updateScale(n) {
    const pct = ((n - 1) / 499) * 100;
    if (sliderFill) sliderFill.style.width = pct + "%";
    if (sliderThumb) sliderThumb.style.left = pct + "%";
    if (scaleNum) scaleNum.textContent = n.toLocaleString();

    // smoke-and-mirrors math: scales roughly linearly
    const msgs = Math.round(n * 58 + (Math.sin(n * 0.2) * 40));
    const autoPct = Math.min(94, 62 + Math.round(Math.log10(n + 1) * 14));
    const drafts = Math.max(1, Math.round(msgs * (1 - autoPct / 100) * 0.18));

    if (statMsg) statMsg.textContent = msgs.toLocaleString();
    if (statAuto) statAuto.innerHTML = autoPct + '<span class="unit">%</span>';
    if (statDraft) statDraft.textContent = drafts.toLocaleString();
    if (barAuto) barAuto.style.width = autoPct + "%";

    renderSpark(sparkMsg, n * 0.1, 1);
    renderSpark(sparkDraft, n * 0.3 + 7, 0.7);
  }
  if (scaleInput) {
    scaleInput.addEventListener("input", (e) => updateScale(+e.target.value));
    updateScale(+scaleInput.value);
  }

  // ========= FAQ =========
  const faqData = [
    ["Is this a channel manager?",
     "No. We don't sync prices, manage listings, or replace your PMS. We sit on top of whatever you already use and handle the inbox."],
    ["Does it work without Hostaway or Guesty?",
     "Yes — it's designed for operators who don't want to pay PMS fees. All you need is Gmail, Chrome, and the host accounts you already have."],
    ["What happens if the AI gets a message wrong?",
     "Every sensitive message is drafted, not sent. You stay in the loop on anything that touches money, complaints, or edge cases. Twelve trigger words guarantee that."],
    ["Who sees my guest data?",
     "Only you. Your database, your Gmail, your Chrome session. The agent is a local daemon on your machine — we don't hold, proxy, or log your guest conversations."],
    ["Can I turn it off?",
     "Anytime. It's a local process, not a cloud service. Stop the daemon, revoke the Gmail scope, uninstall the extension. No cancellation flow."],
    ["How fast is the calendar sync?",
     "Every 15 minutes by default, or whatever interval you set down to 2 minutes. First-to-book wins — whichever platform confirms first blocks the others."],
    ["Does it work with my team?",
     "Yes. Multiple Telegram approvers, shared audit log, role-scoped policies. Any approver can send; every send is signed."],
    ["Does it handle Airbnb's masked emails?",
     "Yes. We key off the reservation code, not the email address. The masked email flows through to your database untouched so your records match Airbnb's."],
  ];
  const faqEl = document.getElementById("faq");
  if (faqEl) {
    faqData.forEach((q, i) => {
      const item = document.createElement("div");
      item.className = "faq-item";
      item.dataset.open = "false";
      item.innerHTML = `
        <button class="faq-q" aria-expanded="false">
          <span><span style="color:var(--fg-mute); margin-right:16px; font-family:var(--font-mono); font-size:13px;">${String(i + 1).padStart(2,"0")}</span>${q[0]}</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </button>
        <div class="faq-a"><div class="faq-a-inner">${q[1]}</div></div>
      `;
      const btn = item.querySelector(".faq-q");
      const a = item.querySelector(".faq-a");
      btn.addEventListener("click", () => {
        const open = item.dataset.open === "true";
        item.dataset.open = open ? "false" : "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (open) a.style.maxHeight = "0";
        else a.style.maxHeight = a.scrollHeight + "px";
      });
      faqEl.appendChild(item);
    });
  }

  // ========= TWEAKS =========
  const tweaksPanel = document.getElementById("tweaks");
  const defaults = window.__TWEAKS_DEFAULTS || { accent: "indigo", density: "roomy", grain: "subtle", animNotes: true };
  let tweaksVisible = false;
  let state = Object.assign({}, defaults);

  function applyTweaks() {
    document.documentElement.dataset.accent = state.accent;
    document.documentElement.dataset.density = state.density;
    document.documentElement.dataset.grain = state.grain;
    document.documentElement.dataset.animNotes = String(state.animNotes);
    // grain
    const grainOpacity = state.grain === "off" ? "0" : state.grain === "heavy" ? "0.08" : "0.035";
    document.body.style.setProperty("--grain-opacity", grainOpacity);
    // Apply via inline style on the ::before by setting CSS var and using fallback in stylesheet
    // We'll just re-inject a style tag for ::before opacity:
    let grainStyle = document.getElementById("__grain_style");
    if (!grainStyle) {
      grainStyle = document.createElement("style");
      grainStyle.id = "__grain_style";
      document.head.appendChild(grainStyle);
    }
    grainStyle.textContent = `body::before { opacity: ${grainOpacity} !important; }`;
    // anim notes
    let noteStyle = document.getElementById("__note_style");
    if (!noteStyle) {
      noteStyle = document.createElement("style");
      noteStyle.id = "__note_style";
      document.head.appendChild(noteStyle);
    }
    noteStyle.textContent = state.animNotes ? "" : ".anim-note { display: none; }";
    // density
    let denseStyle = document.getElementById("__dense_style");
    if (!denseStyle) {
      denseStyle = document.createElement("style");
      denseStyle.id = "__dense_style";
      document.head.appendChild(denseStyle);
    }
    denseStyle.textContent = state.density === "compact"
      ? `.section { padding: 92px 0; } .feat { padding: 24px 22px; min-height: 180px; } .price { padding: 30px 26px; min-height: 440px; } .scale-wrap, .kb-wrap { padding: 28px; }`
      : "";

    // update tweak opt active states
    tweaksPanel?.querySelectorAll(".tweak-opts").forEach((group) => {
      const key = group.dataset.key;
      group.querySelectorAll(".tweak-opt").forEach((btn) => {
        const val = btn.dataset.value;
        const active = String(state[key]) === String(val);
        btn.classList.toggle("active", active);
      });
    });

    // notify 3D to re-color
    window.dispatchEvent(new Event("__accent_changed"));

    // persist to host
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: state }, "*");
    } catch (e) {}
  }

  // wire tweak buttons
  tweaksPanel?.querySelectorAll(".tweak-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.parentElement.dataset.key;
      let val = btn.dataset.value;
      if (val === "true") val = true;
      else if (val === "false") val = false;
      state[key] = val;
      applyTweaks();
    });
  });

  document.getElementById("tweaks-close")?.addEventListener("click", () => {
    tweaksPanel.classList.remove("active");
    tweaksVisible = false;
  });

  // host protocol
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "__activate_edit_mode") {
      tweaksVisible = true;
      tweaksPanel?.classList.add("active");
    } else if (d.type === "__deactivate_edit_mode") {
      tweaksVisible = false;
      tweaksPanel?.classList.remove("active");
    }
  });
  // announce only after the listener is live
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}

  applyTweaks();

})();
