# HMH Muster System

Emergency Muster Check-In System for HMH — built for real-time employee accountability during emergencies and drills.

---

## System Overview

| Page | Purpose |
|---|---|
| `index.html` | Coordinator selects their muster location |
| `coordinator.html` | Live check-in page — NFC tap or manual search |
| `checkin.html` | NFC tap landing page — auto checks employee in |
| `dashboard.html` | Manager dashboard — PIN protected, all 16 locations live |

**16 Muster Locations:** ML 1, 2, 3, 5-1, 5-2 (2nd Shift), 6, 8, 9, 11, 12, 13-1, 13-2 Finance, 13-2 I.T, 13-2 PM-Sales, 13-2 Services, 14

**Color Coding:**
- 🔴 Red = Not checked in
- 🟢 Green = Checked in at their assigned location
- 🔵 Blue = Checked in at a different location (shows which one)

---

## 1. Enable GitHub Pages

1. Go to **Settings** → **Pages** in this repository
2. Under **Source**, select `main` branch and `/ (root)` folder
3. Click **Save**
4. Your site will be live at: `https://HMH-emergencycard.github.io/HMH-Muster-System/`

---

## 2. Firebase Setup

The system uses Firebase Realtime Database for live sync across all devices.

### Steps:
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `HMH-Muster-System`
3. Disable Google Analytics (not needed) → **Create project**
4. In the left sidebar click **Build** → **Realtime Database**
5. Click **Create Database** → choose **Start in test mode** → **Enable**
6. Click the **gear icon** → **Project settings**
7. Scroll to **Your apps** → click **Web** (`</>`)
8. Register the app → copy the `firebaseConfig` object
9. Open `js/app.js` in this repo and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:        "YOUR_ACTUAL_API_KEY",
  authDomain:    "your-project.firebaseapp.com",
  databaseURL:   "https://your-project-default-rtdb.firebaseio.com",
  projectId:     "your-project-id",
  ...
};
```

### Firebase Security Rules (recommended):
In Firebase Console → Realtime Database → Rules, paste:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
> For production, restrict write access to authenticated users only.

---

## 3. Add HMH Logo

1. Save your HMH logo as `logo.png` in the root of this repository
2. It will automatically appear in the header of all pages
3. Recommended size: 200px wide, transparent background PNG

---

## 4. Connect SharePoint / Excel (Future)

The employee roster is currently stored as sample data in `js/app.js`. To connect your live SharePoint Excel file:

1. Your IT Admin needs to register an app in **Azure Active Directory**
2. Grant it `Files.Read` permission for Microsoft Graph API
3. Get an access token and call:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives/{drive-id}/items/{file-id}/workbook/worksheets/{sheet}/usedRange
   ```
4. Map the response columns to the employee format:
   ```js
   { workerId, name, position, supervisoryOrg, phone, assignedLocation }
   ```
5. Replace the `EMPLOYEES` array in `js/app.js` with the live data

**Excel Tab to Location ID mapping:**

| Excel Tab | Location ID in app |
|---|---|
| ML 1 | ML1 |
| ML 2 | ML2 |
| ML 3 | ML3 |
| ML 5-1 | ML5-1 |
| ML 5-2 | ML5-2 |
| ML 6 | ML6 |
| ML 8 | ML8 |
| ML 9 | ML9 |
| ML 11 | ML11 |
| ML 12 | ML12 |
| ML 13-1 | ML13-1 |
| ML 13-2 Finance | ML13-2-Finance |
| ML 13-2 I.T | ML13-2-IT |
| ML 13-2 PM-Sales | ML13-2-PMSales |
| ML 13-2 Services | ML13-2-Services |
| ML 14 | ML14 |

---

## 5. Change Manager Dashboard PIN

Open `js/dashboard.js` and change:
```js
const CORRECT_PIN = '1234';
```
to your desired PIN. Manager access list can be added here once confirmed.

---

## 6. How to Program NFC Stickers

Each employee badge needs an NFC sticker programmed with their Worker ID URL.

### App to use:
- **Android:** [NFC Tools](https://play.google.com/store/apps/details?id=com.wakdev.wdnfc) (free)
- **iPhone:** [NFC Tools](https://apps.apple.com/app/nfc-tools/id1252962749) (free)

### URL format to write to each sticker:
```
https://HMH-emergencycard.github.io/HMH-Muster-System/checkin.html?id=WORKER_ID
```

**Example for employee EMP042:**
```
https://HMH-emergencycard.github.io/HMH-Muster-System/checkin.html?id=EMP042
```

### Steps in NFC Tools:
1. Open NFC Tools → **Write** → **Add a record** → **URL**
2. Paste the employee's URL
3. Tap **Write** → hold phone to NFC sticker
4. Done ✅

> **Note:** NFC auto-scan on the coordinator page only works on **Android Chrome**. iPhone users tap the sticker which opens `checkin.html` directly and checks them in automatically.

---

## 7. Starting a Session During an Emergency

1. Coordinators open the site on their phone: `https://HMH-emergencycard.github.io/HMH-Muster-System/`
2. Tap their **muster location card**
3. Tap **Start Session** — this creates a live check-in session in Firebase
4. Begin checking employees in via NFC tap or manual search
5. Managers open `dashboard.html`, enter PIN `1234`, and watch all locations update live

---

## 8. Coordinator Instructions (Phone Use)

1. Open the muster site on your phone
2. Tap your location
3. Tap **Start Session**
4. **Android Chrome:** Tap **Start NFC Scan** — hold employee badges to your phone to instantly check in
5. **iPhone:** Use the **search bar** — type employee name or ID and tap their row to check in
6. Watch rows turn green as employees check in
7. Blue rows mean the employee checked in at a different location
8. Managers can view the live dashboard at any time

---

## File Structure

```
index.html          <- Home page / location selector
coordinator.html    <- Coordinator check-in page
dashboard.html      <- Manager dashboard (PIN protected)
checkin.html        <- NFC tap auto check-in page
logo.png            <- Add your HMH logo here
js/
  app.js            <- Firebase config + employee roster + shared logic
  coordinator.js    <- Coordinator page logic
  dashboard.js      <- Dashboard real-time logic
css/
  muster.css        <- All styles (HMH branded)
README.md           <- This file
```
