const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 18080);
const PUBLIC_DIR = path.join(__dirname, "public");
const NAVER_INTL = "https://flight-api.naver.com/flight/international/searchFlights";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const KR = new Set(["PUS", "GMP", "ICN", "CJU", "TAE", "CJJ", "KWJ", "RSU", "USN", "WJU", "MWX", "HIN", "KPO", "YNY", "KUV"]);

const DESTINATIONS = {
  PUS: [
    { code: "FUK", name: "후쿠오카", region: "japan" },
    { code: "KIX", name: "오사카", region: "japan" },
    { code: "NRT", name: "도쿄 나리타", region: "japan" },
    { code: "HND", name: "도쿄 하네다", region: "japan" },
    { code: "NGO", name: "나고야", region: "japan" },
    { code: "CTS", name: "삿포로", region: "japan" },
    { code: "OKA", name: "오키나와", region: "japan" },
    { code: "TPE", name: "타이베이", region: "greater-china" },
    { code: "HKG", name: "홍콩", region: "greater-china" },
    { code: "MFM", name: "마카오", region: "greater-china" },
    { code: "PVG", name: "상하이", region: "greater-china" },
    { code: "DAD", name: "다낭", region: "sea" },
    { code: "CXR", name: "나트랑", region: "sea" },
    { code: "HAN", name: "하노이", region: "sea" },
    { code: "SGN", name: "호치민", region: "sea" },
    { code: "BKK", name: "방콕", region: "sea" },
    { code: "MNL", name: "마닐라", region: "sea" },
    { code: "CEB", name: "세부", region: "sea" },
    { code: "SIN", name: "싱가포르", region: "sea" },
    { code: "GUM", name: "괌", region: "pacific" },
    { code: "CJU", name: "제주", region: "domestic" },
    { code: "GMP", name: "김포", region: "domestic" },
  ],
  GMP: [
    { code: "KIX", name: "오사카", region: "japan" },
    { code: "HND", name: "도쿄 하네다", region: "japan" },
    { code: "NRT", name: "도쿄 나리타", region: "japan" },
    { code: "FUK", name: "후쿠오카", region: "japan" },
    { code: "CTS", name: "삿포로", region: "japan" },
    { code: "OKA", name: "오키나와", region: "japan" },
    { code: "NGO", name: "나고야", region: "japan" },
    { code: "TPE", name: "타이베이", region: "greater-china" },
    { code: "PVG", name: "상하이", region: "greater-china" },
    { code: "CJU", name: "제주", region: "domestic" },
    { code: "PUS", name: "부산 김해", region: "domestic" },
    { code: "TAE", name: "대구", region: "domestic" },
    { code: "KWJ", name: "광주", region: "domestic" },
  ],
  ICN: [
    { code: "NRT", name: "도쿄 나리타", region: "japan" },
    { code: "HND", name: "도쿄 하네다", region: "japan" },
    { code: "KIX", name: "오사카", region: "japan" },
    { code: "FUK", name: "후쿠오카", region: "japan" },
    { code: "CTS", name: "삿포로", region: "japan" },
    { code: "OKA", name: "오키나와", region: "japan" },
    { code: "TPE", name: "타이베이", region: "greater-china" },
    { code: "HKG", name: "홍콩", region: "greater-china" },
    { code: "BKK", name: "방콕", region: "sea" },
    { code: "DAD", name: "다낭", region: "sea" },
    { code: "SIN", name: "싱가포르", region: "sea" },
    { code: "MNL", name: "마닐라", region: "sea" },
    { code: "GUM", name: "괌", region: "pacific" },
    { code: "CJU", name: "제주", region: "domestic" },
  ],
};

const DEST_INDEX = {};
for (const list of Object.values(DESTINATIONS)) {
  for (const d of list) DEST_INDEX[d.code] = d;
}

const cache = new Map();
const CACHE_MS = 20 * 60 * 1000;

function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(obj));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function ymd(iso) {
  return String(iso).replace(/-/g, "");
}
function isoFromYmd(s) {
  if (!s || s.length !== 8) return s || "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function diffDays(a, b) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}
function weekdayKo(iso) {
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(iso + "T00:00:00").getDay()];
}
function fmtTime(t) {
  const s = String(t || "").replace(":", "");
  if (s.length !== 4) return t || "";
  return s.slice(0, 2) + ":" + s.slice(2);
}

function enumerateTrips(start, end, minDays, maxDays, durationDays) {
  const windowDays = diffDays(start, end) + 1;
  const allowed = Array.isArray(durationDays) && durationDays.length
    ? durationDays.map(Number).filter((d) => d >= 2 && d <= windowDays)
    : null;
  const minD = Math.max(2, minDays || 2);
  const maxD = Math.min(windowDays, maxDays || windowDays);
  const trips = [];
  for (let days = minD; days <= maxD; days++) {
    if (allowed && !allowed.includes(days)) continue;
    const lastStart = addDays(end, -(days - 1));
    for (let out = start; out <= lastStart; out = addDays(out, 1)) {
      const ret = addDays(out, days - 1);
      trips.push({
        outbound: out,
        inbound: ret,
        days,
        nights: days - 1,
        label: `${days - 1}박 ${days}일`,
      });
    }
  }
  return trips;
}

function buildPayload(origin, dest, outbound, inbound, adults, nonstop) {
  return {
    adultCount: adults,
    childCount: 0,
    infantCount: 0,
    device: "pc",
    isNonstop: !!nonstop,
    seatClass: "Y",
    tripType: "RT",
    openReturnDays: 0,
    initialRequest: true,
    itineraries: [
      {
        departureLocationCode: origin,
        departureLocationType: "airport",
        arrivalLocationCode: dest,
        arrivalLocationType: "airport",
        departureDate: ymd(outbound),
      },
      {
        departureLocationCode: dest,
        departureLocationType: "airport",
        arrivalLocationCode: origin,
        arrivalLocationType: "airport",
        departureDate: ymd(inbound),
      },
    ],
    flightFilter: {
      filter: {
        airlines: [],
        departureAirports: [[origin], []],
        arrivalAirports: [[], [origin]],
        departureTime: [],
        fareTypes: [],
        flightDurationSeconds: [],
        hasCardBenefit: false,
        isIndividual: false,
        isLowCarbonEmission: false,
        isSameAirlines: false,
        isSameDepArrAirport: true,
        isTravelClub: false,
        minFare: {},
        viaCount: [],
        selectedItineraries: [],
      },
      limit: 80,
      skip: 0,
      sort: { adultMinFare: 1 },
    },
  };
}

function parseSse(text) {
  const events = [];
  for (const line of String(text).split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      /* skip */
    }
  }
  if (!events.length) return null;
  let best = events[events.length - 1];
  for (const ev of events) {
    const fares = ev.fareMappings?.length || 0;
    const bestFares = best.fareMappings?.length || 0;
    if (fares > bestFares) best = ev;
    if (ev.status?.isCompleted) best = ev;
  }
  return best;
}

function pickBestOffer(data) {
  if (!data) return null;
  const itineraries = new Map((data.itineraries || []).map((it) => [it.itineraryId, it]));
  const airlines = data.status?.airlinesCodeMap || {};
  const airports = data.status?.airportsCodeMap || {};
  let best = null;
  for (const mapping of data.fareMappings || []) {
    const ids = String(mapping.itineraryIds || "").split("-");
    if (ids.length < 2) continue;
    const out = itineraries.get(ids[0]);
    const inn = itineraries.get(ids[1]);
    const fares = (mapping.fares || [])
      .filter((f) => f?.adult?.totalFare > 0)
      .sort((a, b) => a.adult.totalFare - b.adult.totalFare);
    if (!fares.length) continue;
    const fare = fares[0];
    const price = fare.adult.totalFare;
    if (best && price >= best.price) continue;
    const outSegs = out?.segments || [];
    const inSegs = inn?.segments || [];
    const outFirst = outSegs[0];
    const outLast = outSegs[outSegs.length - 1];
    const inFirst = inSegs[0];
    const inLast = inSegs[inSegs.length - 1];
    best = {
      price,
      tax: fare.adult.tax || 0,
      partnerCode: fare.partnerCode || "",
      fareType: fare.fareType || "",
      baggage: fare.baggageFeeType || "",
      confirmed: !!fare.isConfirmed,
      stopsOut: Math.max(0, outSegs.length - 1),
      stopsIn: Math.max(0, inSegs.length - 1),
      durationOutMin: Math.round((out?.duration || 0) / 60),
      durationInMin: Math.round((inn?.duration || 0) / 60),
      outFlight: outFirst
        ? `${outFirst.marketingCarrier.airlineCode}${outFirst.marketingCarrier.flightNumber}`
        : "",
      inFlight: inFirst
        ? `${inFirst.marketingCarrier.airlineCode}${inFirst.marketingCarrier.flightNumber}`
        : "",
      outAirline: outFirst ? airlines[outFirst.marketingCarrier.airlineCode] || outFirst.marketingCarrier.airlineCode : "",
      inAirline: inFirst ? airlines[inFirst.marketingCarrier.airlineCode] || inFirst.marketingCarrier.airlineCode : "",
      outDepTime: fmtTime(outFirst?.departure?.time),
      outArrTime: fmtTime(outLast?.arrival?.time),
      inDepTime: fmtTime(inFirst?.departure?.time),
      inArrTime: fmtTime(inLast?.arrival?.time),
      destAirportName: airports[outLast?.arrival?.airportCode]?.airportName || "",
      destCityName: airports[outLast?.arrival?.airportCode]?.cityName || "",
      arrivedAirport: outLast?.arrival?.airportCode || "",
    };
  }
  return best;
}

async function searchNaver(origin, dest, outbound, inbound, adults, nonstop) {
  const key = [origin, dest, outbound, inbound, adults, nonstop ? 1 : 0].join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch(NAVER_INTL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "User-Agent": UA,
        Referer: "https://flight.naver.com/",
        Origin: "https://flight.naver.com",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      body: JSON.stringify(buildPayload(origin, dest, outbound, inbound, adults, nonstop)),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const v = { ok: false, error: `naver ${res.status}` };
      cache.set(key, { t: Date.now(), v });
      return v;
    }
    const data = parseSse(text);
    const offer = pickBestOffer(data);
    const v = {
      ok: true,
      lowest: data?.status?.lowestFare || null,
      priceRange: data?.status?.priceRange || null,
      offer,
    };
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "timeout" : String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function yymmdd(iso) {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

function buildLinks(origin, dest, outbound, inbound, adults) {
  const outN = ymd(outbound);
  const inN = ymd(inbound);
  const sky = `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${yymmdd(outbound)}/${yymmdd(inbound)}/?adultsv2=${adults}&cabinclass=economy&currency=KRW&locale=ko-KR&market=KR`;
  const bothDom = KR.has(origin) && KR.has(dest);
  const scope = bothDom ? "domestic" : "international";
  const naver = `https://flight.naver.com/flights/${scope}/${origin}-${dest}-${outN}/${dest}-${origin}-${inN}?adult=${adults}&child=0&infant=0&fareType=${bothDom ? "YC" : "Y"}`;
  const google = `https://www.google.com/travel/flights?hl=ko&curr=KRW&gl=KR&q=${encodeURIComponent(`flights from ${origin} to ${dest} on ${outbound} to ${inbound}`)}`;
  const kayak = `https://www.kayak.co.kr/flights/${origin}-${dest}/${outbound}/${inbound}?sort=price_a&adults=${adults}`;
  const hana = `https://www.hanatour.com/`;
  const mode = `https://www.modetour.com/Flight/`;
  const interpark = `https://travel.interpark.com/flight`;
  const yellow = `https://www.ybtour.co.kr/`;
  const verygood = `https://www.verygoodtour.com/`;
  return {
    skyscanner: sky,
    naver,
    google,
    kayak,
    hanatour: hana,
    modetour: mode,
    interpark,
    ybtour: yellow,
    verygoodtour: verygood,
  };
}

function resolveDests(origin, dests, regions) {
  const catalog = DESTINATIONS[origin] || DESTINATIONS.PUS;
  let list = catalog.slice();
  if (regions && regions.length) {
    const set = new Set(regions);
    list = list.filter((d) => set.has(d.region));
  }
  if (dests && dests.length) {
    const have = new Set(list.map((d) => d.code));
    for (const raw of dests) {
      const code = String(raw).toUpperCase();
      if (!/^[A-Z]{3}$/.test(code) || code === origin || have.has(code)) continue;
      list.push(DEST_INDEX[code] || { code, name: code, region: "other" });
      have.add(code);
    }
  }
  return list.filter((d) => d.code !== origin);
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function dealsFor(origin) {
  const o = origin || "PUS";
  return [
    { name: "스카이스캐너 어디든지", url: `https://www.skyscanner.co.kr/transport/flights-from/${o.toLowerCase()}/`, kind: "meta" },
    { name: "네이버 항공 어디든지", url: `https://flight.naver.com/flights/everywhere/monthly/${o}`, kind: "meta" },
    { name: "구글 플라이트 탐색", url: `https://www.google.com/travel/explore?hl=ko&gl=KR&curr=KRW`, kind: "meta" },
    { name: "하나투어 항공/패키지", url: "https://www.hanatour.com/", kind: "ota" },
    { name: "모두투어 항공권", url: "https://www.modetour.com/Flight/", kind: "ota" },
    { name: "노랑풍선", url: "https://www.ybtour.co.kr/", kind: "ota" },
    { name: "인터파크 투어 항공", url: "https://travel.interpark.com/flight", kind: "ota" },
    { name: "참좋은여행", url: "https://www.verygoodtour.com/", kind: "ota" },
    { name: "롯데관광", url: "https://www.lottetour.com/", kind: "ota" },
    { name: "웹투어", url: "https://www.webtour.com/", kind: "ota" },
    { name: "에어부산 공식", url: "https://www.airbusan.com/", kind: "airline" },
    { name: "제주항공 공식", url: "https://www.jejuair.net/", kind: "airline" },
    { name: "진에어 공식", url: "https://www.jinair.com/", kind: "airline" },
    { name: "티웨이 공식", url: "https://www.twayair.com/", kind: "airline" },
  ];
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function normalizeSearch(body) {
  let origins = body.origins || (body.origin ? [body.origin] : ["PUS"]);
  origins = origins.map((x) => String(x).toUpperCase()).filter((x) => ["PUS", "GMP", "ICN"].includes(x));
  if (!origins.length) origins = ["PUS"];
  const start = body.start;
  const end = body.end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    throw new Error("여행 시작/종료 날짜를 확인하세요.");
  }
  if (diffDays(start, end) > 21) throw new Error("한 번에 21일 이내 기간만 탐색합니다.");
  const minDays = Number(body.minDays || 2);
  const maxDays = Number(body.maxDays || diffDays(start, end) + 1);
  const adults = Math.min(9, Math.max(1, Number(body.adults || 1)));
  const nonstop = !!body.nonstop;
  const dests = Array.isArray(body.dests) ? body.dests : body.dest ? [body.dest] : [];
  const regions = Array.isArray(body.regions) ? body.regions : [];
  const durationDays = Array.isArray(body.durationDays) ? body.durationDays.map(Number) : [];
  return { origins, start, end, minDays, maxDays, adults, nonstop, dests, regions, durationDays };
}

function buildJobs(q) {
  const trips = enumerateTrips(q.start, q.end, q.minDays, q.maxDays, q.durationDays);
  const jobs = [];
  for (const origin of q.origins) {
    const dests = resolveDests(origin, q.dests, q.regions);
    for (const dest of dests) {
      for (const trip of trips) {
        jobs.push({ origin, dest, trip, adults: q.adults, nonstop: q.nonstop });
      }
    }
  }
  return { trips, jobs };
}

function toResult(job, searched) {
  const offer = searched.offer;
  const price = offer?.price || searched.lowest?.direct || searched.lowest?.a01 || searched.priceRange?.min || null;
  return {
    origin: job.origin,
    dest: job.dest.code,
    destName: job.dest.name,
    region: job.dest.region,
    outbound: job.trip.outbound,
    inbound: job.trip.inbound,
    outboundDow: weekdayKo(job.trip.outbound),
    inboundDow: weekdayKo(job.trip.inbound),
    days: job.trip.days,
    nights: job.trip.nights,
    label: job.trip.label,
    price,
    ok: searched.ok,
    error: searched.error || null,
    offer: offer || null,
    links: buildLinks(job.origin, job.dest.code, job.trip.outbound, job.trip.inbound, job.adults),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return sendFile(res, path.join(PUBLIC_DIR, "index.html"));
  }
  if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
    return sendFile(res, path.join(PUBLIC_DIR, url.pathname.slice(1)));
  }
  if (req.method === "GET" && url.pathname === "/api/meta") {
    return json(res, 200, { destinations: DESTINATIONS, deals: { PUS: dealsFor("PUS"), GMP: dealsFor("GMP"), ICN: dealsFor("ICN") } });
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/preview") {
    try {
      const q = normalizeSearch(await parseBody(req));
      const { trips, jobs } = buildJobs(q);
      return json(res, 200, {
        tripCount: trips.length,
        jobCount: jobs.length,
        trips,
        dests: q.origins.map((o) => ({ origin: o, dests: resolveDests(o, q.dests, q.regions) })),
      });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/search-stream") {
    let q;
    try {
      q = normalizeSearch(await parseBody(req));
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
    const { jobs } = buildJobs(q);
    if (jobs.length > 220) {
      return json(res, 400, { error: `조합이 ${jobs.length}개입니다. 목적지 또는 기간을 줄여 주세요. (최대 220)` });
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: meta\ndata: ${JSON.stringify({ total: jobs.length })}\n\n`);
    let done = 0;
    await mapPool(jobs, 3, async (job) => {
      const searched = await searchNaver(job.origin, job.dest.code, job.trip.outbound, job.trip.inbound, job.adults, job.nonstop);
      done += 1;
      const row = toResult(job, searched);
      res.write(`event: row\ndata: ${JSON.stringify({ done, total: jobs.length, row })}\n\n`);
    });
    res.write(`event: done\ndata: ${JSON.stringify({ done: jobs.length, total: jobs.length })}\n\n`);
    res.end();
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`window-fare listening on ${PORT}`);
});
