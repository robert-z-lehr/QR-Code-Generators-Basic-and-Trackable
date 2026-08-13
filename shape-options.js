const circleQrInstances = {};
let trackableCircleObserver = null;

function renderCircularQr(boxId, data) {
  const qrBox = document.getElementById(boxId);
  if (!qrBox || !data) return;

  qrBox.innerHTML = "";

  const frame = document.createElement("div");
  frame.className = "circle-frame";
  qrBox.appendChild(frame);

  const circleQr = new QRCodeStyling({
    width: 256,
    height: 256,
    type: "canvas",
    shape: "circle",
    data,
    margin: 0,
    qrOptions: {
      errorCorrectionLevel: "L"
    },
    dotsOptions: {
      color: "#000000",
      type: "square"
    },
    cornersSquareOptions: {
      color: "#000000",
      type: "square"
    },
    cornersDotOptions: {
      color: "#000000",
      type: "square"
    },
    backgroundOptions: {
      color: "transparent"
    }
  });

  circleQrInstances[boxId] = circleQr;
  circleQr.append(frame);
}

async function downloadCircularQr(boxId, filename) {
  const circleQr = circleQrInstances[boxId];
  if (!circleQr) return false;

  const size = 256;
  const padding = 14;
  const blob = await circleQr.getRawData("png");
  if (!blob) return true;

  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(img, padding, padding, size, size);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    link.click();

    URL.revokeObjectURL(objectUrl);
  };

  img.src = objectUrl;
  return true;
}

function findTrackingUrl(metaBox) {
  const rows = Array.from(metaBox.children);
  const row = rows.find(el => el.textContent.trim().startsWith("Tracking URL:"));
  if (!row) return "";
  return row.textContent.replace(/^Tracking URL:\s*/, "").trim();
}

window.addEventListener("DOMContentLoaded", () => {
  const basicGenerateBtn = document.getElementById("generateBasicBtn");
  const trackableGenerateBtn = document.getElementById("generateTrackableBtn");
  const basicDownloadBtn = document.getElementById("downloadBasicBtn");
  const trackableDownloadBtn = document.getElementById("downloadTrackableBtn");

  basicGenerateBtn.addEventListener("click", () => {
    const shape = document.getElementById("basicShape").value;

    if (shape !== "circle") {
      circleQrInstances.basicQrBox = null;
      return;
    }

    const text = document.getElementById("basicText").value.trim();
    if (!text) return;

    renderCircularQr("basicQrBox", text);
  });

  trackableGenerateBtn.addEventListener("click", () => {
    const shape = document.getElementById("trackableShape").value;

    if (trackableCircleObserver) {
      trackableCircleObserver.disconnect();
      trackableCircleObserver = null;
    }

    if (shape !== "circle") {
      circleQrInstances.trackableQrBox = null;
      return;
    }

    const destinationUrl = document.getElementById("trackableUrl").value.trim();
    if (!destinationUrl) return;

    const metaBox = document.getElementById("trackableMeta");

    trackableCircleObserver = new MutationObserver(() => {
      const trackingUrl = findTrackingUrl(metaBox);

      if (trackingUrl) {
        trackableCircleObserver.disconnect();
        trackableCircleObserver = null;
        renderCircularQr("trackableQrBox", trackingUrl);
        return;
      }

      if (metaBox.textContent.trim()) {
        trackableCircleObserver.disconnect();
        trackableCircleObserver = null;
      }
    });

    trackableCircleObserver.observe(metaBox, { childList: true, subtree: true, characterData: true });
  });

  basicDownloadBtn.addEventListener("click", async event => {
    if (!circleQrInstances.basicQrBox) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await downloadCircularQr("basicQrBox", "basic-qr.png");
  }, true);

  trackableDownloadBtn.addEventListener("click", async event => {
    if (!circleQrInstances.trackableQrBox) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await downloadCircularQr("trackableQrBox", "trackable-qr.png");
  }, true);
});
