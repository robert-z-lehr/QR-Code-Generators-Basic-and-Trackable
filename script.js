const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxRKHN-tkaLGizpx8mPCJh-Ak5yWzParxqerFIDLhAQ1fVSoQXBrMk-2k0Jcbe2Mp-8Sg/exec";

const EC = QRCode.CorrectLevel;
const EC_MAP = { M: EC.M, Q: EC.Q, H: EC.H };
const MODE_LABELS = { contact: "Generate Contact QR", basic: "Generate Link/Text QR", trackable: "Generate Trackable QR" };
const CUT_MARGIN_MODULES = 1;

let activeMode = "contact";
let latestPayload = "";
let latestModuleCount = null;
let latestCanvas = null;
let latestCircleQr = null;
let latestTrackingMeta = null;

const $ = id => document.getElementById(id);
const els = {
  modeCards: Array.from(document.querySelectorAll(".mode-card")),
  contactFields: $("contactFields"), basicFields: $("basicFields"), trackableFields: $("trackableFields"),
  contactName: $("contactName"), contactOrg: $("contactOrg"), contactTitle: $("contactTitle"), contactPhone: $("contactPhone"), contactEmail: $("contactEmail"), contactUrl: $("contactUrl"), contactNote: $("contactNote"),
  basicText: $("basicText"), trackableLabel: $("trackableLabel"), trackableUrl: $("trackableUrl"), notificationEmail: $("notificationEmail"), trackingMode: $("trackingMode"),
  qrShape: $("qrShape"), ecLevel: $("ecLevel"), imageSize: $("imageSize"), physicalSize: $("physicalSize"), physicalUnit: $("physicalUnit"),
  generateBtn: $("generateBtn"), downloadBtn: $("downloadBtn"), formError: $("formError"), qrError: $("qrError"), qrPreview: $("qrPreview"),
  emptyResult: $("emptyResult"), resultArea: $("resultArea"), diagBytes: $("diagBytes"), diagEc: $("diagEc"), diagVersion: $("diagVersion"), diagMatrix: $("diagMatrix"), diagPhysical: $("diagPhysical"), diagModule: $("diagModule"), scanStatus: $("scanStatus"), trackableMeta: $("trackableMeta"),
  feedbackOpenBtn: $("feedbackOpenBtn"), feedbackDetails: $("feedbackDetails")
};

function setMode(mode) {
  activeMode = mode;
  els.modeCards.forEach(card => {
    const active = card.dataset.mode === mode;
    card.classList.toggle("active", active);
    card.setAttribute("aria-selected", String(active));
  });
  els.contactFields.classList.toggle("hidden", mode !== "contact");
  els.basicFields.classList.toggle("hidden", mode !== "basic");
  els.trackableFields.classList.toggle("hidden", mode !== "trackable");
  els.generateBtn.textContent = MODE_LABELS[mode];
  clearError();
}

function escapeVCard(value) {
  return String(value || "").trim().replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function buildVCard() {
  const fn = els.contactName.value.trim();
  if (!fn) throw new Error("Full name is required for a Contact QR.");
  const { first, last } = splitName(fn);
  const org = els.contactOrg.value.trim(), title = els.contactTitle.value.trim(), tel = els.contactPhone.value.trim(), email = els.contactEmail.value.trim(), url = els.contactUrl.value.trim(), note = els.contactNote.value.trim();
  return [
    "BEGIN:VCARD", "VERSION:3.0", `N:${escapeVCard(last)};${escapeVCard(first)};;;`, `FN:${escapeVCard(fn)}`,
    org ? `ORG:${escapeVCard(org)}` : "", title ? `TITLE:${escapeVCard(title)}` : "", tel ? `TEL;TYPE=CELL:${escapeVCard(tel)}` : "",
    email ? `EMAIL:${escapeVCard(email)}` : "", url ? `URL:${escapeVCard(url)}` : "", note ? `NOTE:${escapeVCard(note)}` : "", "END:VCARD"
  ].filter(Boolean).join("\r\n");
}

function utf8Bytes(text) { return new TextEncoder().encode(text).length; }
function makeProbeQr(text, level) { const holder = document.createElement("div"); return new QRCode(holder, { text, width:256, height:256, correctLevel:level }); }
function versionFromModules(modules) { return Math.round((modules - 17) / 4); }

function dimensions(requestedPx, moduleCount) {
  const totalModules = moduleCount + 8 + CUT_MARGIN_MODULES * 2;
  const unit = Math.max(1, Math.floor(requestedPx / totalModules));
  return {
    unit,
    corePx: moduleCount * unit,
    quietPx: 4 * unit,
    cutMarginPx: CUT_MARGIN_MODULES * unit,
    totalPx: totalModules * unit,
    qrOffsetPx: (CUT_MARGIN_MODULES + 4) * unit
  };
}

function drawSquareCutGuide(ctx, d) {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, Math.round(d.unit * 0.18));
  const inset = d.cutMarginPx / 2;
  ctx.strokeRect(inset, inset, d.totalPx - inset * 2, d.totalPx - inset * 2);
  ctx.restore();
}

function drawCircleCutGuide(ctx, d) {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, Math.round(d.unit * 0.18));
  const radius = d.totalPx / 2 - d.cutMarginPx / 2;
  ctx.beginPath();
  ctx.arc(d.totalPx / 2, d.totalPx / 2, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function clearPreview() {
  els.qrPreview.innerHTML = "";
  latestCanvas = null;
  latestCircleQr = null;
}

function renderSquare(payload, level, requestedPx, moduleCount) {
  clearPreview();
  const d = dimensions(requestedPx, moduleCount);
  const outer = document.createElement("canvas");
  outer.width = d.totalPx; outer.height = d.totalPx;
  const ctx = outer.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, outer.width, outer.height);

  const temp = document.createElement("div");
  new QRCode(temp, { text:payload, width:d.corePx, height:d.corePx, colorDark:"#000000", colorLight:"#ffffff", correctLevel:level });
  const src = temp.querySelector("canvas") || temp.querySelector("img");
  if (!src) throw new Error("QR renderer did not produce an image.");
  if (src.tagName === "CANVAS") {
    ctx.drawImage(src, d.qrOffsetPx, d.qrOffsetPx, d.corePx, d.corePx);
    drawSquareCutGuide(ctx, d);
  } else {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, d.qrOffsetPx, d.qrOffsetPx, d.corePx, d.corePx); drawSquareCutGuide(ctx, d); };
    img.src = src.src;
  }
  els.qrPreview.appendChild(outer);
  latestCanvas = outer;
}

function renderCircle(payload, levelKey, requestedPx, moduleCount) {
  clearPreview();
  const d = dimensions(requestedPx, moduleCount);
  const frame = document.createElement("div");
  frame.className = "circle-frame";
  frame.style.padding = `${d.quietPx}px`;
  frame.style.margin = `${d.cutMarginPx}px`;
  els.qrPreview.appendChild(frame);
  latestCircleQr = new QRCodeStyling({
    width:d.corePx, height:d.corePx, type:"canvas", shape:"circle", data:payload, margin:0,
    qrOptions:{ errorCorrectionLevel:levelKey }, dotsOptions:{ color:"#000000", type:"square" },
    cornersSquareOptions:{ color:"#000000", type:"square" }, cornersDotOptions:{ color:"#000000", type:"square" }, backgroundOptions:{ color:"#ffffff" }
  });
  latestCircleQr.append(frame);
  requestAnimationFrame(() => { frame.style.outline = `${Math.max(1, Math.round(d.unit * .18))}px solid #000`; frame.style.outlineOffset = `${d.cutMarginPx}px`; });
}

function updateDiagnostics(payload, levelKey, moduleCount) {
  const bytes = utf8Bytes(payload), physical = Number(els.physicalSize.value), physicalUnit = els.physicalUnit.value;
  const totalPitches = moduleCount + 8;
  els.diagBytes.textContent = `${bytes} UTF-8 bytes`;
  els.diagEc.textContent = `${levelKey} (${levelKey === "M" ? "~15%" : levelKey === "Q" ? "~25%" : "~30%"})`;
  els.diagVersion.textContent = String(versionFromModules(moduleCount));
  els.diagMatrix.textContent = `${moduleCount} × ${moduleCount} modules`;
  if (physical > 0) {
    const mm = physicalUnit === "in" ? physical * 25.4 : physical;
    const moduleMm = mm / totalPitches;
    els.diagPhysical.textContent = `${physical.toFixed(2)} ${physicalUnit}`;
    els.diagModule.textContent = `${moduleMm.toFixed(3)} mm`;
    if (moduleMm >= .5) { els.scanStatus.className="status good"; els.scanStatus.textContent="Good: module size is generous for many physical reproduction methods. Still test the finished artifact before batch production."; }
    else if (moduleMm >= .4) { els.scanStatus.className="status warn"; els.scanStatus.textContent="Caution: this is relatively dense at the selected physical size. Test carefully on the final material and consider enlarging it or reducing payload."; }
    else { els.scanStatus.className="status risk"; els.scanStatus.textContent="High density: consider increasing physical size, shortening the payload, or lowering error correction before physical production."; }
  } else {
    els.diagPhysical.textContent="Not entered"; els.diagModule.textContent="Not calculated"; els.scanStatus.className="status info";
    els.scanStatus.textContent="Open Advanced settings and enter an intended physical size if you want a physical module-size estimate.";
  }
}

function setError(message) { els.formError.textContent = message || ""; }
function clearError() { setError(""); els.qrError.textContent=""; els.qrError.classList.add("hidden"); }
function showQrError(message) { els.qrError.textContent=message; els.qrError.classList.remove("hidden"); }

function safeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function showResult(payload, trackingMeta = null) {
  const levelKey = els.ecLevel.value, level = EC_MAP[levelKey] || EC.M, requestedPx = parseInt(els.imageSize.value, 10) || 320;
  const probe = makeProbeQr(payload, level), moduleCount = probe._oQRCode.getModuleCount();
  if (els.qrShape.value === "circle") renderCircle(payload, levelKey, requestedPx, moduleCount); else renderSquare(payload, level, requestedPx, moduleCount);
  latestPayload=payload; latestModuleCount=moduleCount; latestTrackingMeta=trackingMeta;
  updateDiagnostics(payload, levelKey, moduleCount);
  els.emptyResult.classList.add("hidden"); els.resultArea.classList.remove("hidden");
  if (trackingMeta) {
    els.trackableMeta.innerHTML = `<strong>Trackable QR created</strong><br>Tracking ID: ${safeHtml(trackingMeta.trackingId)}<br>Tracking URL: ${safeHtml(trackingMeta.trackingUrl)}<br>Notification email: ${safeHtml(trackingMeta.notificationEmail || "none / backend default")}<br>Mode: ${safeHtml(trackingMeta.redirectMode)}<br><br><strong>Important:</strong> scan count is not a count of unique people or devices.`;
    els.trackableMeta.classList.remove("hidden");
  } else { els.trackableMeta.innerHTML=""; els.trackableMeta.classList.add("hidden"); }
}

async function generateTrackablePayload() {
  const destinationUrl = els.trackableUrl.value.trim();
  if (!destinationUrl) throw new Error("Destination URL is required for a Trackable QR.");
  try { const parsed = new URL(destinationUrl); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { throw new Error("Enter a valid http:// or https:// destination URL."); }
  const body = new URLSearchParams({ action:"createTrackable", label:els.trackableLabel.value.trim(), destinationUrl, notificationEmail:els.notificationEmail.value.trim(), redirectMode:els.trackingMode.value });
  const response = await fetch(APPS_SCRIPT_WEB_APP_URL, { method:"POST", body });
  const result = await response.json();
  if (!result.ok || !result.trackingUrl) throw new Error(result.message || JSON.stringify(result));
  return { payload:result.trackingUrl, meta:result };
}

async function generate() {
  clearError(); els.generateBtn.disabled=true;
  const originalText = els.generateBtn.textContent;
  if (activeMode === "trackable") els.generateBtn.textContent="Creating trackable QR…";
  try {
    if (activeMode === "contact") showResult(buildVCard());
    else if (activeMode === "basic") { const text=els.basicText.value.trim(); if (!text) throw new Error("Enter a URL or text for the Link/Text QR."); showResult(text); }
    else { const { payload, meta } = await generateTrackablePayload(); showResult(payload, meta); }
  } catch (error) { showQrError(`Could not generate the QR. ${error && error.message ? error.message : String(error)}`); }
  finally { els.generateBtn.disabled=false; els.generateBtn.textContent=MODE_LABELS[activeMode] || originalText; }
}

function downloadCanvas(canvas, filename) {
  if (!canvas) return;
  const a=document.createElement("a"); a.href=canvas.toDataURL("image/png"); a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}

async function downloadCircle(filename) {
  if (!latestCircleQr || !latestModuleCount) return;
  const requestedPx=parseInt(els.imageSize.value,10)||320, d=dimensions(requestedPx, latestModuleCount), blob=await latestCircleQr.getRawData("png");
  if (!blob) return;
  const objectUrl=URL.createObjectURL(blob), img=new Image();
  img.onload=()=>{
    const canvas=document.createElement("canvas"); canvas.width=d.totalPx; canvas.height=d.totalPx;
    const ctx=canvas.getContext("2d"); ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.arc(canvas.width/2,canvas.height/2,canvas.width/2,0,Math.PI*2); ctx.fill();
    ctx.drawImage(img,d.qrOffsetPx,d.qrOffsetPx,d.corePx,d.corePx); drawCircleCutGuide(ctx,d); downloadCanvas(canvas,filename); URL.revokeObjectURL(objectUrl);
  };
  img.src=objectUrl;
}

function filenameForMode() { return `${activeMode}-qr-${els.qrShape.value}.png`; }
async function downloadCurrent() { if (!latestPayload) { showQrError("Generate a QR before downloading it."); return; } if (els.qrShape.value === "circle") await downloadCircle(filenameForMode()); else downloadCanvas(latestCanvas, filenameForMode()); }
function regenerateDirectIfPossible() { if (!latestPayload || activeMode === "trackable") return; try { if (activeMode === "contact") showResult(buildVCard()); if (activeMode === "basic" && els.basicText.value.trim()) showResult(els.basicText.value.trim()); } catch (_) {} }

els.modeCards.forEach(card => card.addEventListener("click", () => setMode(card.dataset.mode)));
els.generateBtn.addEventListener("click", generate);
els.downloadBtn.addEventListener("click", downloadCurrent);
[els.qrShape, els.ecLevel, els.imageSize, els.physicalSize, els.physicalUnit].forEach(el => el.addEventListener("change", () => {
  if (latestPayload && activeMode === "trackable") { try { showResult(latestPayload, latestTrackingMeta); } catch (_) {} }
  else regenerateDirectIfPossible();
}));
if (els.feedbackOpenBtn && els.feedbackDetails) els.feedbackOpenBtn.addEventListener("click", () => { els.feedbackDetails.open=true; els.feedbackDetails.scrollIntoView({ behavior:"smooth", block:"center" }); });

setMode("contact");
