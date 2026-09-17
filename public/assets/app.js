(() => {
  const startEl = document.getElementById("start");
  const endEl = document.getElementById("end");
  const durBox = document.getElementById("duration-chips");
  const preview = document.getElementById("preview");
  const searchBtn = document.getElementById("search-btn");
  const toolbar = document.getElementById("toolbar");
  const bar = document.getElementById("progress-bar");
  const status = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const heatmap = document.getElementById("heatmap");
  const dealLinks = document.getElementById("deal-links");
  const extraDests = document.getElementById("extra-dests");
  const sortEl = document.getElementById("sort");
  const groupEl = document.getElementById("group");

  let rows = [];
  let selectedDays = new Set();

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
  function won(n) {
    if (n == null) return "요금 없음";
    return new Intl.NumberFormat("ko-KR").format(n) + "원";
  }
  function origins() {
    return [...document.querySelectorAll('input[name="origin"]:checked')].map((x) => x.value);
  }
  function regions() {
    return [...document.querySelectorAll("[data-region].on")].map((x) => x.dataset.region);
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
      const on = keep ? keep.has(d) : (windowDays >= 7 ? d < windowDays : true);
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

  async function previewCount() {
    if (!startEl.value || !endEl.value) return;
    const body = queryBody();
    if (!body.origins.length || !body.minDays) {
      preview.textContent = "출발 공항과 체류 일수를 선택하세요.";
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

  function queryBody() {
    const days = [...selectedDays].sort((a, b) => a - b);
    const extra = extraDests.value
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{3}$/.test(s));
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
      dests: extra,
    };
  }

  document.querySelectorAll("[data-region]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      if (!document.querySelector("[data-region].on")) btn.classList.add("on");
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
      previewCount();
    });
  });
  startEl.addEventListener("change", renderDurations);
  endEl.addEventListener("change", renderDurations);
  extraDests.addEventListener("change", previewCount);

  function filterRows(list) {
    const maxPrice = Number(document.getElementById("max-price").value || 0);
    const days = selectedDays;
    return list.filter((r) => {
      if (!days.has(r.days)) return false;
      if (maxPrice && r.price && r.price > maxPrice) return false;
      return true;
    });
  }

  function sortRows(list) {
    const mode = sortEl.value;
    const copy = list.slice();
    const dur = (r) => (r.offer?.durationOutMin || 0) + (r.offer?.durationInMin || 0);
    const stops = (r) => (r.offer?.stopsOut || 0) + (r.offer?.stopsIn || 0);
    copy.sort((a, b) => {
      if (mode === "price") return (a.price || 9e15) - (b.price || 9e15);
      if (mode === "days-asc") return a.days - b.days || (a.price || 9e15) - (b.price || 9e15);
      if (mode === "days-desc") return b.days - a.days || (a.price || 9e15) - (b.price || 9e15);
      if (mode === "out-asc") return a.outbound.localeCompare(b.outbound) || (a.price || 9e15) - (b.price || 9e15);
      if (mode === "out-desc") return b.outbound.localeCompare(a.outbound);
      if (mode === "dest") return a.destName.localeCompare(b.destName, "ko") || (a.price || 9e15) - (b.price || 9e15);
      if (mode === "duration") return dur(a) - dur(b);
      if (mode === "direct") return stops(a) - stops(b) || (a.price || 9e15) - (b.price || 9e15);
      return 0;
    });
    return copy;
  }

  function groupKey(r) {
    const g = groupEl.value;
    if (g === "dest") return `${r.destName} (${r.dest})`;
    if (g === "days") return r.label;
    if (g === "origin") return r.origin;
    return "";
  }

  function renderHeat() {
    const priced = rows.filter((r) => r.price);
    if (!priced.length) {
      heatmap.classList.add("hidden");
      return;
    }
    const byOut = {};
    for (const r of priced) {
      if (!byOut[r.outbound] || r.price < byOut[r.outbound]) byOut[r.outbound] = r.price;
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
          const t = max === min ? 0.3 : (p - min) / (max - min);
          const bg = `rgba(31,111,91,${0.95 - t * 0.7})`;
          return `<i style="background:${bg}"><b>${d.slice(5)}</b>${won(p)}</i>`;
        })
        .join("") +
      "</div>";
  }

  function card(r) {
    const o = r.offer || {};
    const stops = (o.stopsOut || 0) + (o.stopsIn || 0);
    const stopLabel = stops === 0 ? "직항" : `경유 ${stops}`;
    const links = r.links || {};
    return `<article class="card">
      <div class="price">${won(r.price)}<small>${r.origin} 왕복 · ${stopLabel}</small></div>
      <div>
        <div class="route">${r.origin} → ${r.destName} (${r.dest}) → ${r.origin}</div>
        <div class="meta">${r.outbound} (${r.outboundDow}) → ${r.inbound} (${r.inboundDow}) · ${r.label}
          ${o.outFlight ? ` · 가는편 ${o.outFlight} ${o.outDepTime}` : ""}
          ${o.inFlight ? ` · 오는편 ${o.inFlight} ${o.inDepTime}` : ""}
          ${o.outAirline ? ` · ${o.outAirline}` : ""}
        </div>
        <div class="links">
          <a href="${links.naver}" target="_blank" rel="noopener">네이버 항공</a>
          <a href="${links.skyscanner}" target="_blank" rel="noopener">스카이스캐너</a>
          <a href="${links.google}" target="_blank" rel="noopener">구글 플라이트</a>
          <a href="${links.kayak}" target="_blank" rel="noopener">카약</a>
          <a href="${links.hanatour}" target="_blank" rel="noopener">하나투어</a>
          <a href="${links.modetour}" target="_blank" rel="noopener">모두투어</a>
          <a href="${links.interpark}" target="_blank" rel="noopener">인터파크</a>
          <a href="${links.ybtour}" target="_blank" rel="noopener">노랑풍선</a>
        </div>
      </div>
    </article>`;
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
      .map(([k, rs]) => `<h3 class="group-title">${k} · ${rs.length}건</h3>` + rs.map(card).join(""))
      .join("");
  }

  sortEl.addEventListener("change", renderResults);
  groupEl.addEventListener("change", renderResults);
  document.getElementById("max-price").addEventListener("change", renderResults);

  async function search() {
    const body = queryBody();
    if (!body.origins.length) return;
    searchBtn.disabled = true;
    toolbar.classList.remove("hidden");
    rows = [];
    resultsEl.innerHTML = "";
    status.textContent = "검색 시작";
    bar.style.width = "2%";
    try {
      const res = await fetch("/api/search-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        status.textContent = data.error || "검색 실패";
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const block of parts) {
          const ev = (block.match(/^event: (\w+)/m) || [])[1];
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (ev === "row") {
            rows.push(data.row);
            bar.style.width = Math.round((data.done / data.total) * 100) + "%";
            status.textContent = `${data.done}/${data.total} · 요금 ${rows.filter((r) => r.price).length}건`;
            if (data.done % 3 === 0 || data.done === data.total) {
              renderHeat();
              renderResults();
            }
          }
          if (ev === "done") {
            status.textContent = `완료 ${data.total}건`;
            bar.style.width = "100%";
            renderHeat();
            renderResults();
          }
        }
      }
    } catch (e) {
      status.textContent = "연결 오류: " + e.message;
    } finally {
      searchBtn.disabled = false;
    }
  }

  searchBtn.addEventListener("click", search);

  async function loadMeta() {
    const res = await fetch("/api/meta");
    const data = await res.json();
    const origin = origins()[0] || "PUS";
    const deals = data.deals[origin] || data.deals.PUS;
    dealLinks.innerHTML = deals
      .map((d) => `<a href="${d.url}" target="_blank" rel="noopener">${d.name}</a>`)
      .join("");
  }

  setDefaultDates();
  renderDurations();
  loadMeta();
})();
