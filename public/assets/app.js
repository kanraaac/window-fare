(() => {
  const startEl = document.getElementById("start");
  const endEl = document.getElementById("end");
  const durBox = document.getElementById("duration-chips");
  const preview = document.getElementById("preview");
  const searchBtn = document.getElementById("search-btn");
  const retryBtn = document.getElementById("retry-btn");
  const toolbar = document.getElementById("toolbar");
  const bar = document.getElementById("progress-bar");
  const status = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const heatmap = document.getElementById("heatmap");
  const dealLinks = document.getElementById("deal-links");
  const sortEl = document.getElementById("sort");
  const groupEl = document.getElementById("group");
  const otherWrap = document.getElementById("other-air-wrap");
  const airPicks = [document.getElementById("air1"), document.getElementById("air2"), document.getElementById("air3")];
  const KR_SKIP = new Set(["ICN", "GMP", "PUS", "CJU", "TAE", "CJJ", "KWJ", "RSU", "USN", "WJU", "MWX", "HIN", "KPO", "YNY", "KUV"]);

  let rows = [];
  let selectedDays = new Set();
  let searching = false;
  let searchGen = 0;
  let startedQuery = "";
  let abortCtl = null;

  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(isoDate, n) {
    const d = new Date(isoDate + "T00:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function diffDays(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }
  function sanePrice(n) {
    return typeof n === "number" && Number.isFinite(n) && n >= 1000 && n <= 50000000 ? Math.round(n) : null;
  }
  function won(n) {
    const p = sanePrice(n);
    if (p == null) return "요금 없음";
    return new Intl.NumberFormat("ko-KR").format(p) + "원";
  }
  function origins() {
    return [...document.querySelectorAll('input[name="origin"]:checked')].map((x) => x.value);
  }
  function regions() {
    return [...document.querySelectorAll("[data-region].on")].map((x) => x.dataset.region).filter((r) => r !== "other");
  }
  function otherOn() {
    return !!document.getElementById("other-chip")?.classList.contains("on");
  }
  function pickedAirports() {
    return airPicks.map((el) => (el && el.value) || "").filter((v) => /^[A-Z]{3}$/.test(v));
  }
  function syncOtherWrap() {
    if (!otherWrap) return;
    otherWrap.classList.toggle("hidden", !otherOn());
  }

  function setDefaultDates() {
    const t = new Date();
    t.setDate(t.getDate() + 21);
    startEl.value = iso(t);
    endEl.value = addDays(iso(t), 6);
  }

  function renderDurations() {
    if (!startEl.value || !endEl.value || endEl.value < startEl.value) {
      durBox.innerHTML = "";
      return;
    }
    const windowDays = diffDays(startEl.value, endEl.value) + 1;
    const keep = selectedDays.size ? new Set([...selectedDays].filter((d) => d >= 2 && d <= windowDays)) : null;
    selectedDays = new Set();
    durBox.innerHTML = "";
    for (let d = 2; d <= windowDays; d++) {
      const on = keep ? keep.has(d) : windowDays >= 7 ? d < windowDays : true;
      if (on) selectedDays.add(d);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (on ? " on" : "");
      b.textContent = `${d - 1}박 ${d}일`;
      b.addEventListener("click", () => {
        if (selectedDays.has(d) && selectedDays.size === 1) return;
        if (selectedDays.has(d)) selectedDays.delete(d);
        else selectedDays.add(d);
        b.classList.toggle("on");
        previewCount();
      });
      durBox.appendChild(b);
    }
    previewCount();
  }

  function queryBody() {
    const days = [...selectedDays].sort((a, b) => a - b);
    const dests = pickedAirports().filter((c, i, arr) => arr.indexOf(c) === i);
    return {
      origins: origins(),
      start: startEl.value,
      end: endEl.value,
      minDays: days[0] || 2,
      maxDays: days[days.length - 1] || 2,
      durationDays: days,
      adults: Number(document.getElementById("adults").value || 1),
      nonstop: document.getElementById("nonstop").checked,
      regions: regions(),
      dests,
    };
  }

  function queryKey() {
    return JSON.stringify(queryBody());
  }
  function syncRetryBtn() {
    if (!retryBtn) return;
    retryBtn.disabled = !(searching && queryKey() !== startedQuery);
  }
  async function previewCount() {
    syncRetryBtn();
    if (!startEl.value || !endEl.value) return;
    const body = queryBody();
    if (!body.origins.length || !body.minDays) {
      preview.textContent = "출발 공항과 체류 일수를 선택하세요.";
      return;
    }
    if (otherOn() && !body.regions.length && !body.dests.length) {
      preview.textContent = "그외 공항을 1개 이상 선택하세요.";
      return;
    }
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        preview.textContent = data.error || "미리보기 실패";
        return;
      }
      preview.textContent = `왕복 일정 ${data.tripCount}개 × 목적지 조합 ${data.jobCount}건을 검색합니다.`;
    } catch {
      preview.textContent = "미리보기 서버에 연결하지 못했습니다.";
    }
  }

  document.querySelectorAll("[data-region]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      if (!document.querySelector("[data-region].on")) btn.classList.add("on");
      syncOtherWrap();
      previewCount();
    });
  });
  document.querySelectorAll('input[name="origin"]').forEach((el) => {
    el.addEventListener("change", () => {
      el.parentElement.classList.toggle("on", el.checked);
      if (!origins().length) {
        el.checked = true;
        el.parentElement.classList.add("on");
      }
      renderAirportOptions();
      previewCount();
    });
  });
  startEl.addEventListener("change", renderDurations);
  endEl.addEventListener("change", renderDurations);
  airPicks.forEach((el) => el && el.addEventListener("change", previewCount));

  let allAirports = [];
  let nonstopMap = { PUS: [], GMP: [], ICN: [] };

  function nonstopCodes() {
    const set = new Set();
    origins().forEach((o) => (nonstopMap[o] || []).forEach((c) => set.add(c)));
    return set;
  }

  function renderAirportOptions() {
    const keep = airPicks.map((el) => (el && el.value) || "");
    const nonstop = !!(document.getElementById("nonstop") && document.getElementById("nonstop").checked);
    const allowed = nonstop ? nonstopCodes() : null;
    let list = allAirports.filter((a) => !allowed || allowed.has(a.code));
    const opts = ['<option value="">그외</option>'].concat(
      list.map((a) => '<option value="' + a.code + '">' + a.name + " (" + a.code + ")</option>")
    ).join("");
    airPicks.forEach((el, i) => {
      if (!el) return;
      el.innerHTML = opts;
      el.value = keep[i] && (!allowed || allowed.has(keep[i])) ? keep[i] : "";
    });
  }

  async function fillAirportSelects() {
    let list = [];
    try {
      const res = await fetch("/assets/airports.json");
      list = await res.json();
    } catch {
      list = [];
    }
    try {
      const rr = await fetch("/assets/nonstop-routes.json");
      const data = await rr.json();
      if (data && typeof data === "object") nonstopMap = data;
    } catch {
      /* keep defaults */
    }
    const seen = new Set();
    allAirports = (Array.isArray(list) ? list : []).filter((a) => {
      if (!a || !a.code || !a.name || KR_SKIP.has(a.code) || seen.has(a.code)) return false;
      seen.add(a.code);
      return true;
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));
    renderAirportOptions();
  }

  function filterRows(list) {
    const maxPrice = Number(document.getElementById("max-price").value || 0);
    return list.filter((r) => {
      if (!selectedDays.has(r.days)) return false;
      const p = sanePrice(r.price);
      if (maxPrice && p && p > maxPrice) return false;
      return true;
    });
  }

  function sortRows(list) {
    const mode = sortEl.value;
    const copy = list.slice();
    const dur = (r) => (r.offer?.durationOutMin || 0) + (r.offer?.durationInMin || 0);
    const stops = (r) => (r.offer?.stopsOut || 0) + (r.offer?.stopsIn || 0);
    const priceOf = (r) => sanePrice(r.price) || 9e15;
    copy.sort((a, b) => {
      if (mode === "price") return priceOf(a) - priceOf(b);
      if (mode === "days-asc") return a.days - b.days || priceOf(a) - priceOf(b);
      if (mode === "days-desc") return b.days - a.days || priceOf(a) - priceOf(b);
      if (mode === "out-asc") return a.outbound.localeCompare(b.outbound) || priceOf(a) - priceOf(b);
      if (mode === "out-desc") return b.outbound.localeCompare(a.outbound);
      if (mode === "dest") return a.destName.localeCompare(b.destName, "ko") || priceOf(a) - priceOf(b);
      if (mode === "duration") return dur(a) - dur(b);
      if (mode === "direct") return stops(a) - stops(b) || priceOf(a) - priceOf(b);
      return 0;
    });
    return copy;
  }

  function groupKey(r) {
    const g = groupEl.value;
    if (g === "dest") return r.destName + " (" + r.dest + ")";
    if (g === "days") return r.label;
    if (g === "origin") return r.origin;
    return "";
  }

  function renderHeat() {
    const priced = rows.filter((r) => sanePrice(r.price));
    if (!priced.length) {
      heatmap.classList.add("hidden");
      return;
    }
    const byOut = {};
    for (const r of priced) {
      const p = sanePrice(r.price);
      if (!byOut[r.outbound] || p < byOut[r.outbound]) byOut[r.outbound] = p;
    }
    const vals = Object.values(byOut);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    heatmap.classList.remove("hidden");
    heatmap.innerHTML =
      "<h2>출발일별 최저가</h2><div class='heat'>" +
      Object.keys(byOut)
        .sort()
        .map((d) => {
          const p = byOut[d];
          const t = max === min ? 0 : (p - min) / (max - min);
          const bgR = Math.round(20 + t * (255 - 20));
          const bgG = Math.round(90 + t * (246 - 90));
          const bgB = Math.round(74 + t * (232 - 74));
          const lum = (0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB) / 255;
          const fg = lum > 0.55 ? "#10231c" : "#fff6e8";
          return "<i style=\"background:rgb(" + bgR + "," + bgG + "," + bgB + ");color:" + fg + "\"><b>" + d.slice(5) + "</b>" + won(p) + "</i>";
        })
        .join("") +
      "</div>";
  }

  function fmtDur(min) {
    min = Number(min) || 0;
    if (!min) return "-";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h && m) return h + "시간 " + m + "분";
    if (h) return h + "시간";
    return m + "분";
  }
  function stopText(n) {
    n = Number(n) || 0;
    return n === 0 ? "직항" : "경유 " + n + "회";
  }
  function card(r) {
    const o = r.offer || {};
    const priced = sanePrice(r.price);
    const links = r.links || {};
    const outCls = (o.stopsOut || 0) === 0 ? "direct" : "via";
    const inCls = (o.stopsIn || 0) === 0 ? "direct" : "via";
    const outLine = priced
      ? "<div class=\"leg\"><span class=\"leg-k\">가는편</span><span class=\"badge " + outCls + "\">" + stopText(o.stopsOut) + "</span><span>" + (o.outAirline || "") + " " + (o.outFlight || "") + " <b class=\"dep\">" + (o.outDepTime || "") + "</b> <span class=\"dur-inline\">(" + fmtDur(o.durationOutMin) + ")</span></span></div>"
      : "";
    const inLine = priced
      ? "<div class=\"leg\"><span class=\"leg-k\">오는편</span><span class=\"badge " + inCls + "\">" + stopText(o.stopsIn) + "</span><span>" + (o.inAirline || "") + " " + (o.inFlight || "") + " <b class=\"dep\">" + (o.inDepTime || "") + "</b> <span class=\"dur-inline\">(" + fmtDur(o.durationInMin) + ")</span></span></div>"
      : "<div class=\"leg\"><span class=\"leg-k\">요금</span><span class=\"badge via\">네이버에서 확인</span><span></span></div>";
    return "<article class=\"card\"><div class=\"price\">" + won(priced) + "<small>" + r.origin + " 왕복 · " + r.label + "</small></div><div class=\"card-body\"><div class=\"route\">" + r.origin + " → " + r.destName + " (" + r.dest + ") → " + r.origin + "</div><div class=\"when-line\"><b class=\"when\">" + r.outbound + " (" + r.outboundDow + ")</b> → <b class=\"when\">" + r.inbound + " (" + r.inboundDow + ")</b></div><div class=\"legs\">" + outLine + inLine + "</div><div class=\"links\"><a href=\"" + (links.naver || "#") + "\" target=\"_blank\" rel=\"noopener\">네이버 항공</a><a href=\"" + (links.skyscanner || "#") + "\" target=\"_blank\" rel=\"noopener\">스카이스캐너</a><a href=\"" + (links.google || "#") + "\" target=\"_blank\" rel=\"noopener\">구글 플라이트</a><a href=\"" + (links.kayak || "#") + "\" target=\"_blank\" rel=\"noopener\">카약</a><a href=\"" + (links.hanatour || "#") + "\" target=\"_blank\" rel=\"noopener\">하나투어</a><a href=\"" + (links.modetour || "#") + "\" target=\"_blank\" rel=\"noopener\">모두투어</a><a href=\"" + (links.interpark || "#") + "\" target=\"_blank\" rel=\"noopener\">인터파크</a><a href=\"" + (links.ybtour || "#") + "\" target=\"_blank\" rel=\"noopener\">노랑풍선</a></div></div></article>";
  }

  function renderResults() {
    const list = sortRows(filterRows(rows));
    if (!list.length) {
      resultsEl.innerHTML = "<p class='hint'>표시할 결과가 없습니다. 필터를 느슨하게 해보세요.</p>";
      return;
    }
    if (groupEl.value === "none") {
      resultsEl.innerHTML = list.map(card).join("");
      return;
    }
    const groups = new Map();
    for (const r of list) {
      const k = groupKey(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    resultsEl.innerHTML = [...groups.entries()]
      .map(([k, rs]) => "<h3 class=\"group-title\">" + k + " · " + rs.length + "건</h3>" + rs.map(card).join(""))
      .join("");
  }

  sortEl.addEventListener("change", renderResults);
  groupEl.addEventListener("change", renderResults);
  document.getElementById("max-price").addEventListener("change", renderResults);

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: abortCtl ? abortCtl.signal : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
    return data;
  }

  async function fetchBatch(jobs, adults, nonstop) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await postJson("/api/search-batch", { jobs, adults, nonstop });
        return data.rows || [];
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr || new Error("batch failed");
  }

  async function search() {
    const body = queryBody();
    if (!body.origins.length) return;
    if (otherOn() && !body.regions.length && !body.dests.length) {
      preview.textContent = "그외 공항을 1개 이상 선택하세요.";
      return;
    }
    if (abortCtl) abortCtl.abort();
    abortCtl = new AbortController();
    const myGen = ++searchGen;
    searching = true;
    startedQuery = JSON.stringify(queryBody());
    if (retryBtn) retryBtn.disabled = true;
    searchBtn.disabled = true;
    toolbar.classList.remove("hidden");
    rows = [];
    resultsEl.innerHTML = "";
    status.textContent = "검색 준비";
    bar.style.width = "2%";
    try {
      const previewData = await postJson("/api/preview", body);
      const jobs = [];
      (previewData.dests || []).forEach((block) => {
        (block.dests || []).forEach((dest) => {
          (previewData.trips || []).forEach((trip) => {
            jobs.push({
              origin: block.origin,
              dest: dest.code,
              destName: dest.name,
              outbound: trip.outbound,
              inbound: trip.inbound,
              days: trip.days,
              nights: trip.nights,
              label: trip.label,
            });
          });
        });
      });
      if (!jobs.length) {
        status.textContent = "조회할 조합이 없습니다.";
        return;
      }
      const total = jobs.length;
      const size = 3;
      let failed = 0;
      for (let i = 0; i < jobs.length; i += size) {
        if (myGen !== searchGen) return;
        const chunk = jobs.slice(i, i + size);
        try {
          const batchRows = await fetchBatch(chunk, body.adults, body.nonstop);
          batchRows.forEach((row) => {
            const idx = rows.findIndex((r) => r.origin === row.origin && r.dest === row.dest && r.outbound === row.outbound && r.inbound === row.inbound);
            if (idx >= 0) rows[idx] = row;
            else rows.push(row);
          });
        } catch (e) {
          if (e && e.name === "AbortError") return;
          if (myGen !== searchGen) return;
          failed += chunk.length;
          chunk.forEach((j) => {
            rows.push({
              origin: j.origin,
              dest: j.dest,
              destName: j.destName || j.dest,
              outbound: j.outbound,
              inbound: j.inbound,
              days: j.days,
              nights: j.nights,
              label: j.label,
              price: null,
              offer: null,
              links: {},
            });
          });
        }
        const done = Math.min(i + size, total);
        bar.style.width = Math.round((done / total) * 100) + "%";
        status.textContent = done + "/" + total + " · 요금 " + rows.filter((r) => sanePrice(r.price)).length + "건" + (failed ? " · 실패 " + failed : "");
        renderHeat();
        renderResults();
      }
      status.textContent = "완료 " + total + "건 · 요금 " + rows.filter((r) => sanePrice(r.price)).length + "건" + (failed ? " · 일부 실패 " + failed : "");
      bar.style.width = "100%";
      renderHeat();
      renderResults();
    } catch (e) {
      if (myGen !== searchGen || (e && e.name === "AbortError")) return;
      if (rows.length) {
        status.textContent = "일부만 조회됨 · " + e.message;
        renderHeat();
        renderResults();
      } else {
        status.textContent = "연결 오류: " + e.message;
      }
    } finally {
      if (myGen === searchGen) {
        searching = false;
        searchBtn.disabled = false;
        if (retryBtn) retryBtn.disabled = true;
      }
    }
  }

  searchBtn.addEventListener("click", search);
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      if (retryBtn.disabled) return;
      search();
    });
  }
  document.getElementById("adults").addEventListener("change", previewCount);
  document.getElementById("nonstop").addEventListener("change", () => { renderAirportOptions(); previewCount(); });

  async function loadMeta() {
    const res = await fetch("/api/meta");
    const data = await res.json();
    const origin = origins()[0] || "PUS";
    const deals = data.deals[origin] || data.deals.PUS;
    dealLinks.innerHTML = deals.map((d) => "<a href=\"" + d.url + "\" target=\"_blank\" rel=\"noopener\">" + d.name + "</a>").join("");
  }

  document.querySelectorAll("[data-region]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.region === "other");
  });
  setDefaultDates();
  renderDurations();
  loadMeta();
  fillAirportSelects();
  syncOtherWrap();
  previewCount();
})();
