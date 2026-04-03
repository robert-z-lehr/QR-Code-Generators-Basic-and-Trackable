const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxRKHN-tkaLGizpx8mPCJh-Ak5yWzParxqerFIDLhAQ1fVSoQXBrMk-2k0Jcbe2Mp-8Sg/exec";

function clearQr(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = "";
}

function generateBasicQR() {
  const text = document.getElementById("basicText").value.trim();
  const qrBox = document.getElementById("basicQrBox");

  clearQr("basicQrBox");

  if (!text) {
    alert("Enter a URL or text for the basic QR code.");
    return;
  }

  new QRCode(qrBox, {
    text,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.L
  });
}

async function generateTrackableQR() {
  const label = document.getElementById("trackableLabel").value.trim();
  const destinationUrl = document.getElementById("trackableUrl").value.trim();
  const redirectMode = document.getElementById("trackingMode").value;
  const qrBox = document.getElementById("trackableQrBox");
  const metaBox = document.getElementById("trackableMeta");

  clearQr("trackableQrBox");
  metaBox.innerHTML = "";

  if (!destinationUrl) {
    alert("Enter a destination URL for the trackable QR code.");
    return;
  }

  try {
    const body = new URLSearchParams({
      action: "createTrackable",
      label,
      destinationUrl,
      redirectMode
    });

    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: "POST",
      body
    });

    const result = await response.json();

    if (!result.ok) {
      metaBox.textContent = JSON.stringify(result);
      return;
    }

    const trackingUrl = result.trackingUrl;

    new QRCode(qrBox, {
      text: trackingUrl,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L
    });

    metaBox.innerHTML = `
      <div><strong>Tracking ID:</strong> ${result.trackingId}</div>
      <div><strong>Tracking URL:</strong> ${trackingUrl}</div>
      <div><strong>Mode:</strong> ${result.redirectMode}</div>
    `;
  } catch (error) {
    metaBox.textContent = "Request failed: " + String(error);
  }
}

function downloadQrFromBox(boxId, filename) {
  const canvas = document.querySelector(`#${boxId} canvas`);
  if (!canvas) {
    alert("Generate the QR code first.");
    return;
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("generateBasicBtn").addEventListener("click", generateBasicQR);
  document.getElementById("generateTrackableBtn").addEventListener("click", generateTrackableQR);

  document.getElementById("downloadBasicBtn").addEventListener("click", () => {
    downloadQrFromBox("basicQrBox", "basic-qr.png");
  });

  document.getElementById("downloadTrackableBtn").addEventListener("click", () => {
    downloadQrFromBox("trackableQrBox", "trackable-qr.png");
  });
});
