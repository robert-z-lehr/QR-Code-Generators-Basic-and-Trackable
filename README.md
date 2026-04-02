# [QR Code Generator + Trackable QR](https://robert-z-lehr.github.io/QR-Code-Generators-Basic-and-Trackable/)

This starter keeps a simple QR generator and adds a trackable QR generator.
KYC: Know-Your-Customer

## File tree

```text
qr-trackable-starter/
├── .nojekyll
├── index.html
├── styles.css
├── script.js
├── appsscript/
│   └── Code.gs
└── appsscript-setup/
    └── appsscript.json
```

## GitHub Pages

Create a repository, upload `.nojekyll`, `index.html`, `styles.css`, and `script.js`, then go to **Settings > Pages** and set **Source = Deploy from a branch**, **Branch = main**, **Folder = /(root)**.

## Google Sheet tabs and columns

Create tabs:

- `QRCodes`
- `ScanLogs`
- `Settings`

### QRCodes
`trackingId | label | destinationUrl | redirectMode | createdAt | createdBy | scanCount`

### ScanLogs
`timestamp | trackingId | label | destinationUrl | userAgent | queryString | preciseLatitude | preciseLongitude | preciseAccuracyMeters`

### Settings
`key | value`

Rows:
`notificationEmail | your-email@example.com`
`siteBaseUrl | https://YOUR-USERNAME.github.io/YOUR-REPO/`

## Apps Script

1. Create a new Apps Script project.
2. Paste `appsscript/Code.gs`.
3. Replace `appsscript.json` with the included manifest.
4. Set the constants in `Code.gs`.
5. Deploy as **Web app**, **Execute as Me**, **Who has access = Anyone**.
6. Paste the deployed URL into `script.js`.

## Notes

- The simple QR uses the destination directly.
- The trackable QR uses Apps Script to create a unique tracking URL.
- The script sends an email on each scan.
