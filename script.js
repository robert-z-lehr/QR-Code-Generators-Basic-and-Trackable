const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxRKHN-tkaLGizpx8mPCJh-Ak5yWzParxqerFIDLhAQ1fVSoQXBrMk-2k0Jcbe2Mp-8Sg/exec";

function clearAndRenderQRCode(containerId, text) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  new QRCode(container, {
    text,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.L,
  });
}

function downloadQRCode(containerId, filename) {
  const canvas = document.querySelector(`#${containerId} canvas`);
  if (!canvas) {
    alert("Generate a QR code first.");
    return;
  }
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

document.getElementById("generate-basic").addEventListener("click", () => {
  const value = document.getElementById("basic-url").value.trim();
  if (!value) {
    alert("Enter a URL or text for the basic QR code.");
    return;
  }
  clearAndRenderQRCode("basic-qr", value);
});

document.getElementById("download-basic").addEventListener("click", () => {
  downloadQRCode("basic-qr", "basic-qr-code.png");
});

document.getElementById("generate-trackable").addEventListener("click", async () => {
  const label = document.getElementById("track-label").value.trim();
  const destinationUrl = document.getElementById("track-url").value.trim();
  const redirectMode = document.getElementById("track-mode").value;

  if (!destinationUrl) {
    alert("Enter the destination URL for the trackable QR code.");
    return;
  }

  if (!APPS_SCRIPT_WEB_APP_URL || APPS_SCRIPT_WEB_APP_URL.includes("PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE")) {
    alert("Add your Apps Script web app URL to script.js first.");
    return;
  }

  try {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "createTrackableQR",
        label,
        destinationUrl,
        redirectMode
      }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Could not create trackable QR code.");

    clearAndRenderQRCode("trackable-qr", data.trackingUrl);
    document.getElementById("track-meta").innerHTML = `
      <strong>Tracking ID:</strong> ${data.trackingId}<br>
      <strong>Tracking URL:</strong> ${data.trackingUrl}<br>
      <strong>Mode:</strong> ${data.redirectMode}
    `;
  } catch (error) {
    console.error(error);
    alert("Error creating trackable QR code.");
  }
});

document.getElementById("download-trackable").addEventListener("click", () => {
  downloadQRCode("trackable-qr", "trackable-qr-code.png");
});

async function handlePreciseTrackingLanding() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("track") !== "1" || !params.get("id")) return;
  const trackingId = params.get("id");

  document.body.innerHTML = `<main class="page"><div class="panel"><h2>Opening link...</h2><p>Preparing destination.</p></div></main>`;

  let preciseLatitude = null;
  let preciseLongitude = null;
  let preciseAccuracyMeters = null;

  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:7000, maximumAge:0 });
      });
      preciseLatitude = position.coords.latitude;
      preciseLongitude = position.coords.longitude;
      preciseAccuracyMeters = position.coords.accuracy;
    } catch (error) {
      console.warn("Precise location unavailable", error);
    }
  }

  try {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "resolveTrackableQR",
        trackingId,
        preciseLatitude,
        preciseLongitude,
        preciseAccuracyMeters
      }),
    });
    const data = await response.json();
    if (data.ok && data.destinationUrl) {
      window.location.replace(data.destinationUrl);
      return;
    }
  } catch (error) {
    console.error(error);
  }

  document.body.innerHTML = `<main class="page"><div class="panel"><h2>Unable to open destination</h2><p>Tracking service did not return a valid destination.</p></div></main>`;
}
handlePreciseTrackingLanding();
