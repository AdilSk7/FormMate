# FormMate – Smart Autofill (Version 1)

**FormMate** is a simple, reliable, and privacy-first browser extension for **Google Chrome** and **Microsoft Edge** (Manifest V3) designed to automatically autofill job application forms and Google Forms using your saved personal details and custom question/answer pairs.

---

## ⚡ Key Highlights

- **100% Offline & Local**: All data remains strictly in your local browser (`chrome.storage.local`). Zero analytics, zero tracking, zero external network requests.
- **On-Demand Scripting**: Uses `activeTab` and `chrome.scripting`. It only runs when you click **Autofill Form**—it does not inject scripts or monitor background web traffic unnecessarily.
- **Google Forms & Standard Form Compatibility**: Discovers inputs via ARIA roles (`[role="radio"]`, `[role="checkbox"]`, `[role="heading"]`), semantic labels, `aria-label`, `aria-labelledby`, and standard HTML input/select/textarea controls.
- **Interactive Question Learning**: Detects unknown questions, prompts you right on the webpage with a simple floating card, and lets you **"Save & Fill"** on the fly—permanently remembering your answer for future forms.
- **Safety First**:
  - **Never automatically submits forms** (you always review and click submit yourself).
  - **Strictly ignores sensitive fields**: Passwords, OTPs, CVVs, card numbers, UPI PINs, and banking fields are never touched.

---

## 📁 Project Structure

```text
formmate/
├── manifest.json         # Chrome & Edge Manifest V3 configuration
├── popup/
│   ├── popup.html        # Clean, modern extension popup UI (~380px wide)
│   ├── popup.css         # Popup styles and component themes
│   └── popup.js          # Profile management, Questions CRUD, Backup/Restore
├── content/
│   ├── content.js        # Form detection, alias matching, and autofill engine
│   └── content.css       # In-page unknown question modal & badge styles
├── icons/
│   ├── icon16.png        # 16x16 extension icon
│   ├── icon48.png        # 48x48 extension icon
│   └── icon128.png       # 128x128 extension icon
├── test-form.html        # Comprehensive local test form
└── README.md             # Documentation and guide
```

---

## 🚀 Installation Guide

### Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `formmate` directory from your file browser.
5. FormMate is now installed! Pin it to your extension toolbar for easy access.

### Microsoft Edge
1. Open Edge and navigate to `edge://extensions/`.
2. Turn on the **Developer mode** toggle in the left sidebar.
3. Click **Load unpacked**.
4. Select the `formmate` directory.
5. FormMate is ready to use on Edge!

### How to Update After Code Changes
1. Go back to `chrome://extensions` or `edge://extensions`.
2. Find **FormMate – Smart Autofill**.
3. Click the **Reload (circular arrow)** button on the extension card.

---

## 🛠️ How to Use FormMate

### 1. Add Personal Data ("My Data" Tab)
1. Click the FormMate icon in your browser toolbar.
2. Select the **My Data** tab.
3. Fill in your information:
   - Full Name
   - Email
   - Mobile Number
   - College Name
   - Department / Branch
   - Degree
   - Year of Pass Out
   - Current City, State, Country
4. *(Optional)* Click **+ Add Field** to add any custom profile fields (e.g., LinkedIn Profile, GitHub, Portfolio).
5. Click **Save Data**. Data is stored immediately in `chrome.storage.local`.

### 2. Add Custom Questions ("Questions" Tab)
1. Switch to the **Questions** tab.
2. Enter a question and your default answer:
   - **Question**: `Are you willing to relocate?`
   - **Answer**: `Yes`
3. Click **Save Question**.
4. You can edit, search, or delete saved questions anytime.

### 3. Autofill Forms ("Autofill" Tab)
1. Open any job application page or Google Form.
2. Click the FormMate extension icon.
3. Click **⚡ Autofill Form**.
4. FormMate will:
   - Scan all visible form questions.
   - Fill profile fields using smart alias matching (e.g., `Mail Id` ➔ `Email`, `Year of pass out` ➔ `graduationYear`).
   - Match and fill saved questions (e.g., radio buttons, text inputs, dropdowns).
   - Display a summary in the popup:
     ```text
     ✓ 6 fields filled
     ✓ 2 saved questions filled
     ⚠ 1 new question found
     ```

### 4. Interactive Learning (Unknown Questions Workflow)
When FormMate encounters a question it hasn't seen before:
1. It **does NOT guess** or fill random data.
2. A floating badge appears on the webpage:
   > **⚡ FormMate • New Question**  
   > *Are you comfortable working night shifts?*  
   > `[ Add Answer ]`
3. Clicking **Add Answer** opens a clean in-page dialog.
4. Enter your answer (e.g., `No`) and click **Save & Fill**.
5. FormMate will:
   - Save the question & answer to `chrome.storage.local`.
   - Fill the field on the current page immediately.
   - Automatically reuse this answer whenever you encounter this question on future forms.

---

## 💾 Backup & Data Management ("Settings" Tab)

- **Export Data (JSON)**: Download a complete backup of your profile and questions as a `.json` file.
- **Import Data (JSON)**: Restore your saved profile and questions from any previous backup file.
- **Clear All Data**: Completely reset and erase stored FormMate data after confirmation.

---

## 🔒 Privacy & Safety Guarantee

- **No Network Requests**: FormMate contains zero `fetch()`, `XMLHttpRequest`, or external script loading.
- **No Third-Party APIs**: No AI APIs, OpenAI keys, or external analytics libraries are used.
- **No Auto-Submit**: FormMate will **never** click a submit button or submit your form. You maintain 100% control over review and submission.
- **Password & Financial Shield**: Sensitive inputs (`password`, `otp`, `cvv`, `creditcard`, `bankaccount`) are strictly ignored.

---

## 🧪 Local Testing Instructions

You can test FormMate locally in under 60 seconds using the bundled `test-form.html`:

1. Open `formmate/test-form.html` in Chrome or Edge (`file:///.../formmate/test-form.html`).
2. Open the FormMate popup and fill in your profile data in **My Data**.
3. Under **Questions**, add:
   - Question: `Are you interested in sales and Marketing?`
   - Answer: `No`
4. Return to the **Autofill** tab and click **Autofill Form**.
5. Verify:
   - Name, Mail Id, Mobile number, College, Department, Pass out year, and Degree are filled.
   - The radio button for "No" is selected under sales interest.
   - The sensitive **Portal Password** field remains completely untouched.
   - The form is **not** submitted.
6. Observe the in-page prompt for `"Are you comfortable working night shifts?"`.
7. Click **Add Answer**, type `No`, and click **Save & Fill**.
8. Refresh `test-form.html` and click **Autofill Form** again to verify the night shifts question is now automatically filled!

---

## 📌 Known Limitations (Version 1)

- **Dynamic iframe forms**: Some cross-origin iframes embedded inside third-party job boards cannot be accessed due to browser security sandbox constraints.
- **Complex Multi-Select Checkbox Grids**: Multiple checkboxes under complex matrix tables are left unmodified to avoid invalid submissions.
- **Deterministic Text Matching**: Question similarity uses normalized token overlap and exact/substring matching. AI-based semantic paraphrase matching is intentionally reserved for future versions.
