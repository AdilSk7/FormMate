// FormMate – Smart Autofill Content Script
(() => {
  // Prevent duplicate execution listeners
  if (window.__FORMMATE_LOADED__) {
    return;
  }
  window.__FORMMATE_LOADED__ = true;

  // Standard Profile Field Aliases
  const PROFILE_ALIASES = {
    fullName: [
      'name', 'full name', 'candidate name', 'applicant name', 'your name',
      'first and last name', 'complete name', 'student name', 'employee name'
    ],
    email: [
      'email', 'email id', 'mail id', 'email address', 'e mail', 'mail',
      'candidate email', 'your email', 'official email', 'personal email'
    ],
    mobile: [
      'mobile', 'mobile number', 'phone', 'phone number', 'contact number',
      'contact no', 'contact', 'whatsapp number', 'cell phone', 'telephone',
      'mobile no', 'phone no', 'cell no'
    ],
    college: [
      'college', 'college name', 'university', 'university name', 'institute',
      'institution', 'school name', 'campus name', 'alma mater'
    ],
    department: [
      'department', 'branch', 'stream', 'specialization', 'field of study',
      'major', 'dept'
    ],
    degree: [
      'degree', 'qualification', 'course', 'educational qualification',
      'program', 'degree level'
    ],
    graduationYear: [
      'year of pass out', 'passing year', 'graduation year', 'year of graduation',
      'pass out year', 'batch', 'yop', 'year of passing', 'completion year'
    ],
    city: [
      'city', 'current city', 'location', 'town', 'residing city', 'current location'
    ],
    state: [
      'state', 'province', 'region'
    ],
    country: [
      'country', 'nationality', 'nation'
    ]
  };

  // Sensitive keywords to strictly shield
  const SENSITIVE_KEYWORDS = [
    'password', 'passcode', 'otp', 'cvv', 'cvc', 'pin', 'upi',
    'creditcard', 'cardnumber', 'debitcard', 'bankaccount',
    'accountnumber', 'ssn', 'aadhar', 'routing', 'security code',
    'secret', 'card number', 'expiry'
  ];

  // Stop words for token similarity
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for',
    'with', 'about', 'against', 'between', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'from', 'up', 'down', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'you', 'your', 'please', 'enter', 'select', 'choose', 'specify',
    'provide', 'what', 'which', 'who', 'how', 'any', 'if'
  ]);

  // Normalized string helper
  function normalizeText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[_\-/\\:?.,!@#$%^&*()[\]{}|<>+=~`"';]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tokenize string excluding stop words
  function getTokens(str) {
    return normalizeText(str)
      .split(' ')
      .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  }

  // Jaccard Token Similarity (0.0 to 1.0)
  function computeTokenSimilarity(strA, strB) {
    const tokensA = new Set(getTokens(strA));
    const tokensB = new Set(getTokens(strB));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return intersection / union;
  }

  // Security check: Ignore password / sensitive fields
  function isSensitiveField(element, contextText = '') {
    if (!element) return false;
    const type = (element.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return true;

    const testStr = [
      type,
      element.id || '',
      element.name || '',
      element.getAttribute('autocomplete') || '',
      element.getAttribute('aria-label') || '',
      element.placeholder || '',
      element.className || '',
      contextText
    ].join(' ').toLowerCase();

    return SENSITIVE_KEYWORDS.some(kw => testStr.includes(kw));
  }

  // Helper to clean up question text (remove required asterisks, question numbers)
  function cleanQuestionText(text) {
    if (!text) return '';
    return text
      .replace(/\s*[\*\u2217]\s*$/g, '') // remove trailing required asterisk
      .replace(/^[\d]+[\.\)]\s*/, '')     // remove leading question numbers (e.g. "1. ")
      .trim();
  }

  // Extract Question / Label context for an element
  function extractQuestionContext(element) {
    if (!element) return '';

    const isOptionControl = (
      element.type === 'radio' ||
      element.type === 'checkbox' ||
      element.getAttribute('role') === 'radio' ||
      element.getAttribute('role') === 'checkbox'
    );

    // If it's a radio or checkbox option, check the enclosing radiogroup or group label first
    if (isOptionControl) {
      const radioGroup = element.closest('[role="radiogroup"], [role="group"], fieldset');
      if (radioGroup) {
        const rgLabel = radioGroup.getAttribute('aria-label');
        if (rgLabel && rgLabel.trim().length > 1 && !['yes', 'no', 'true', 'false'].includes(rgLabel.trim().toLowerCase())) {
          return cleanQuestionText(rgLabel.trim());
        }
        const rgLabelledBy = radioGroup.getAttribute('aria-labelledby');
        if (rgLabelledBy) {
          const ids = rgLabelledBy.split(/\s+/);
          const texts = ids.map(id => {
            const el = document.getElementById(id);
            return el ? el.innerText.trim() : '';
          }).filter(Boolean);
          if (texts.length > 0) return cleanQuestionText(texts.join(' '));
        }
      }
    }

    // 1. Explicit aria-label (on the element itself)
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 1 && !['yes', 'no', 'true', 'false'].includes(ariaLabel.trim().toLowerCase())) {
      return cleanQuestionText(ariaLabel.trim());
    }

    // 2. aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/);
      const texts = ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.innerText.trim() : '';
      }).filter(Boolean);
      if (texts.length > 0) return cleanQuestionText(texts.join(' '));
    }

    // 3. HTML label[for="id"]
    if (element.id && !isOptionControl) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl && labelEl.innerText.trim()) {
        return cleanQuestionText(labelEl.innerText.trim());
      }
    }

    // 4. Enclosing <label> (for text/select/textarea, NOT for individual radio/checkbox option labels)
    if (!isOptionControl) {
      const parentLabel = element.closest('label');
      if (parentLabel && parentLabel.innerText.trim()) {
        return cleanQuestionText(parentLabel.innerText.trim());
      }
    }

    // 5. Google Forms / Semantic Container traversal
    // For radio/checkbox options, look for the parent question item container (e.g. role="listitem")
    let container = element.closest('[role="listitem"], fieldset, div[data-item-id], .field-group, .form-group');
    if (!container && element.closest('[role="radiogroup"]')) {
      const rg = element.closest('[role="radiogroup"]');
      container = rg.closest('[role="listitem"]') || rg.parentElement;
    }
    if (!container) {
      let cur = element.parentElement;
      for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
        if (cur.querySelector('[role="heading"], legend, label, h1, h2, h3, h4, h5, h6')) {
          container = cur;
          break;
        }
        cur = cur.parentElement;
      }
    }

    if (container) {
      // Heading (Google Forms role="heading", or HTML legend / h1-h6)
      const heading = container.querySelector('[role="heading"], legend, h1, h2, h3, h4, h5, h6');
      if (heading && heading.innerText.trim()) {
        return cleanQuestionText(heading.innerText.trim());
      }

      // Google Forms fallback heading classes if present
      const fallbackHeading = container.querySelector('.M7eMe, .freebirdFormviewerViewItemsItemItemTitle');
      if (fallbackHeading && fallbackHeading.innerText.trim()) {
        return cleanQuestionText(fallbackHeading.innerText.trim());
      }

      // Group question label (first label in container that doesn't just wrap this option)
      const labels = container.querySelectorAll('label');
      for (const lbl of labels) {
        if (!lbl.classList.contains('radio-label') && !lbl.classList.contains('checkbox-label') && !lbl.contains(element)) {
          const txt = lbl.innerText.trim();
          if (txt && txt.length > 1) return cleanQuestionText(txt);
        }
      }
    }

    // 6. Preceding sibling label or text
    let targetForPrev = isOptionControl ? (element.closest('.radio-group, .checkbox-group') || element.parentElement) : element;
    let prev = targetForPrev ? targetForPrev.previousElementSibling : element.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'LABEL' || prev.getAttribute('role') === 'heading' || prev.innerText.trim().length > 0) {
        const text = prev.innerText.trim();
        if (text && text.length < 150) return cleanQuestionText(text);
      }
      prev = prev.previousElementSibling;
    }

    // 7. Placeholder or Name attribute as last resort
    if (element.placeholder && element.placeholder.trim()) {
      return element.placeholder.trim();
    }
    if (element.name && element.name.trim()) {
      return element.name.trim();
    }

    return '';
  }

  // Native Value Setter for React / Angular / Google Forms JS reactivity
  function setNativeValue(element, value) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Match question against standard profile, custom profile fields, and saved questions
  function findMatch(rawQuestion, profile = {}, savedQuestions = []) {
    const normQ = normalizeText(rawQuestion);
    if (!normQ) return null;

    // === TIER 1: EXACT MATCHES (Highest Priority) ===

    // 1A. Exact match in Standard Profile Aliases
    for (const [fieldKey, aliases] of Object.entries(PROFILE_ALIASES)) {
      const profileVal = profile[fieldKey];
      if (!profileVal) continue;

      for (const alias of aliases) {
        if (normQ === normalizeText(alias)) {
          return { type: 'profile', key: fieldKey, value: profileVal, matchScore: 1.0 };
        }
      }
    }

    // 1B. Exact match in Custom Profile Fields
    if (Array.isArray(profile.customFields)) {
      for (const cf of profile.customFields) {
        if (!cf.value) continue;
        if (normQ === normalizeText(cf.label || cf.key)) {
          return { type: 'profile_custom', key: cf.label, value: cf.value, matchScore: 1.0 };
        }
      }
    }

    // 1C. Exact match in Saved Custom Questions
    for (const sq of savedQuestions) {
      if (!sq.question || !sq.answer) continue;
      if (normQ === normalizeText(sq.question)) {
        return { type: 'saved_question', id: sq.id, question: sq.question, value: sq.answer, matchScore: 1.0 };
      }
    }

    // === TIER 2: BEST PARTIAL & TOKEN SIMILARITY MATCH ===
    let bestMatch = null;
    let highestScore = 0;

    // 2A. Partial match in Standard Profile Aliases
    for (const [fieldKey, aliases] of Object.entries(PROFILE_ALIASES)) {
      const profileVal = profile[fieldKey];
      if (!profileVal) continue;

      for (const alias of aliases) {
        const normAlias = normalizeText(alias);
        // Avoid generic 'name' substring matching compound names like 'college name'
        if (normAlias === 'name' && (normQ.includes('college') || normQ.includes('school') || normQ.includes('university') || normQ.includes('company') || normQ.includes('father') || normQ.includes('mother'))) {
          continue;
        }

        if (normAlias.length >= 4 && normQ.includes(normAlias)) {
          const score = 0.7 + (normAlias.length / Math.max(normQ.length, normAlias.length)) * 0.25;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = { type: 'profile', key: fieldKey, value: profileVal, matchScore: score };
          }
        } else if (normQ.length >= 4 && normAlias.includes(normQ)) {
          const score = 0.65 + (normQ.length / Math.max(normQ.length, normAlias.length)) * 0.25;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = { type: 'profile', key: fieldKey, value: profileVal, matchScore: score };
          }
        }
      }
    }

    // 2B. Partial match in Custom Profile Fields
    if (Array.isArray(profile.customFields)) {
      for (const cf of profile.customFields) {
        if (!cf.value) continue;
        const normLabel = normalizeText(cf.label || cf.key);
        if (normLabel.length >= 4 && (normQ.includes(normLabel) || normLabel.includes(normQ))) {
          const score = 0.75;
          if (score > highestScore) {
            highestScore = score;
            bestMatch = { type: 'profile_custom', key: cf.label, value: cf.value, matchScore: score };
          }
        }
      }
    }

    // 2C. Partial & Token similarity in Saved Questions
    for (const sq of savedQuestions) {
      if (!sq.question || !sq.answer) continue;
      const normSQ = normalizeText(sq.question);

      // Substring match
      if (normSQ.length >= 4 && normQ.includes(normSQ)) {
        const score = 0.88;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = { type: 'saved_question', id: sq.id, question: sq.question, value: sq.answer, matchScore: score };
        }
      } else if (normQ.length >= 4 && normSQ.includes(normQ)) {
        const score = 0.82;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = { type: 'saved_question', id: sq.id, question: sq.question, value: sq.answer, matchScore: score };
        }
      }

      // Token similarity (Jaccard)
      const tokenScore = computeTokenSimilarity(normQ, normSQ);
      if (tokenScore >= 0.50 && tokenScore > highestScore) {
        highestScore = tokenScore;
        bestMatch = { type: 'saved_question', id: sq.id, question: sq.question, value: sq.answer, matchScore: tokenScore };
      }
    }

    if (bestMatch && highestScore >= 0.60) {
      return bestMatch;
    }

    return null;
  }

  // In-Page UI State for Unknown Questions
  let pendingUnknownQuestions = [];
  let currentUnknownIndex = 0;

  // Show the floating notification badge when new questions are found
  function showUnknownBadge(unknownList) {
    pendingUnknownQuestions = unknownList;
    currentUnknownIndex = 0;

    // Remove existing badge if present
    const existingBadge = document.getElementById('formmate-prompt-badge');
    if (existingBadge) existingBadge.remove();

    if (pendingUnknownQuestions.length === 0) return;

    const firstItem = pendingUnknownQuestions[0];

    const badge = document.createElement('div');
    badge.id = 'formmate-prompt-badge';
    badge.innerHTML = `
      <div class="formmate-badge-header">
        <div class="formmate-badge-title">
          <span>⚡ FormMate</span>
          <small>• New Question</small>
        </div>
        <button class="formmate-badge-close" id="formmateBadgeClose">&times;</button>
      </div>
      <div class="formmate-badge-q">${escapeHtml(firstItem.question)}</div>
      <button class="formmate-badge-btn" id="formmateBadgeOpenBtn">Add Answer</button>
    `;

    document.body.appendChild(badge);

    badge.querySelector('#formmateBadgeClose').addEventListener('click', () => {
      badge.remove();
    });

    badge.querySelector('#formmateBadgeOpenBtn').addEventListener('click', () => {
      badge.remove();
      openUnknownQuestionModal(pendingUnknownQuestions[currentUnknownIndex]);
    });
  }

  // Open in-page learning modal for unknown question
  function openUnknownQuestionModal(item) {
    const existingOverlay = document.getElementById('formmate-modal-overlay');
    if (existingOverlay) existingOverlay.remove();

    if (!item) return;

    const overlay = document.createElement('div');
    overlay.id = 'formmate-modal-overlay';
    overlay.innerHTML = `
      <div class="formmate-modal-card">
        <div class="formmate-modal-header">
          <div class="formmate-modal-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="m9 15 2 2 4-4"></path>
            </svg>
            <span>Learn New Question</span>
          </div>
          <button class="formmate-modal-close" id="formmateModalClose">&times;</button>
        </div>

        <div class="formmate-modal-q-box">
          <div class="formmate-modal-q-label">Detected Question</div>
          <div class="formmate-modal-q-text">${escapeHtml(item.question)}</div>
        </div>

        <div class="formmate-modal-input-group">
          <label class="formmate-modal-input-label" for="formmateAnswerInput">Your Answer</label>
          <input type="text" class="formmate-modal-input" id="formmateAnswerInput" placeholder="Enter answer (e.g. Yes / No / Value)" autofocus>
        </div>

        <div class="formmate-modal-actions">
          <button type="button" class="formmate-modal-btn-skip" id="formmateModalSkip">Skip</button>
          <button type="button" class="formmate-modal-btn-save" id="formmateModalSave">Save & Fill</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const inputField = overlay.querySelector('#formmateAnswerInput');
    inputField.focus();

    // Close
    overlay.querySelector('#formmateModalClose').addEventListener('click', () => {
      overlay.remove();
    });

    // Skip to next question if any
    overlay.querySelector('#formmateModalSkip').addEventListener('click', () => {
      overlay.remove();
      currentUnknownIndex++;
      if (currentUnknownIndex < pendingUnknownQuestions.length) {
        openUnknownQuestionModal(pendingUnknownQuestions[currentUnknownIndex]);
      }
    });

    // Save & Fill
    const saveAction = async () => {
      const answerVal = inputField.value.trim();
      if (!answerVal) {
        inputField.focus();
        return;
      }

      // 1. Save question + answer to chrome.storage.local
      chrome.storage.local.get(['questions'], (res) => {
        const questions = Array.isArray(res.questions) ? res.questions : [];
        const newQ = {
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          question: item.question,
          answer: answerVal
        };
        questions.unshift(newQ);

        chrome.storage.local.set({ questions }, () => {
          // 2. Fill the current field on the page
          fillElement(item.element, item.elementType, answerVal);

          overlay.remove();
          showToast('✓ Saved & filled! Remembered for future forms.');

          // 3. Move to next unknown question if any
          currentUnknownIndex++;
          if (currentUnknownIndex < pendingUnknownQuestions.length) {
            setTimeout(() => {
              openUnknownQuestionModal(pendingUnknownQuestions[currentUnknownIndex]);
            }, 400);
          }
        });
      });
    };

    overlay.querySelector('#formmateModalSave').addEventListener('click', saveAction);

    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAction();
      }
    });
  }

  // Toast confirmation helper
  function showToast(text) {
    const existing = document.getElementById('formmate-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'formmate-toast';
    toast.textContent = text;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // Fill a specific element based on its type
  function fillElement(element, type, answer) {
    if (!element) return false;

    if (type === 'text') {
      setNativeValue(element, answer);
      return true;
    }

    if (type === 'select') {
      const normAnswer = normalizeText(answer);
      let matchedIdx = -1;
      for (let i = 0; i < element.options.length; i++) {
        const optText = normalizeText(element.options[i].text);
        const optVal = normalizeText(element.options[i].value);
        if (optText === normAnswer || optVal === normAnswer || optText.includes(normAnswer) || normAnswer.includes(optText)) {
          matchedIdx = i;
          break;
        }
      }
      if (matchedIdx !== -1) {
        element.selectedIndex = matchedIdx;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    if (type === 'radio_group') {
      const normAnswer = normalizeText(answer);
      const rawAnswerLower = (answer || '').trim().toLowerCase();
      const radios = Array.isArray(element) ? element : Array.from(element.querySelectorAll('input[type="radio"], [role="radio"]'));

      for (const radio of radios) {
        let optLabel = '';

        // Standard radio
        if (radio.tagName === 'INPUT') {
          if (radio.value) optLabel = radio.value;
          if (radio.id) {
            const lbl = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
            if (lbl && lbl.innerText.trim()) optLabel = lbl.innerText.trim();
          }
          if (!optLabel) {
            const parentLbl = radio.closest('label');
            if (parentLbl && parentLbl.innerText.trim()) optLabel = parentLbl.innerText.trim();
          }
          if (!optLabel && radio.nextElementSibling) {
            optLabel = radio.nextElementSibling.innerText.trim();
          }
        } else {
          // Google Forms ARIA radio [role="radio"]
          // 1. Check aria-label
          const ariaLabel = radio.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.trim()) {
            optLabel = ariaLabel.trim();
          }
          // 2. Check data-value
          if (!optLabel && radio.getAttribute('data-value')) {
            optLabel = radio.getAttribute('data-value').trim();
          }
          // 3. Check aria-labelledby
          if (!optLabel && radio.getAttribute('aria-labelledby')) {
            const ids = radio.getAttribute('aria-labelledby').split(/\s+/);
            const texts = ids.map(id => {
              const el = document.getElementById(id);
              return el ? el.innerText.trim() : '';
            }).filter(Boolean);
            if (texts.length > 0) optLabel = texts.join(' ');
          }
          // 4. Check enclosing label or option container
          if (!optLabel) {
            const parentLabel = radio.closest('label') || radio.closest('.nWQGrd');
            if (parentLabel && parentLabel.innerText.trim()) {
              optLabel = parentLabel.innerText.trim();
            }
          }
          // 5. Check sibling or parent text
          if (!optLabel && radio.parentElement) {
            const p = radio.parentElement;
            if (p.nextElementSibling && p.nextElementSibling.innerText.trim()) {
              optLabel = p.nextElementSibling.innerText.trim();
            } else if (p.innerText.trim()) {
              optLabel = p.innerText.trim();
            }
          }
        }

        const normOpt = normalizeText(optLabel);
        const optLower = (optLabel || '').trim().toLowerCase();

        // Matching: case-insensitive, whitespace-tolerant, exact or substring/word match
        const isMatch = (
          normOpt === normAnswer ||
          optLower === rawAnswerLower ||
          (normOpt.length >= 2 && normAnswer === normOpt) ||
          (normOpt && normOpt.split(' ').includes(normAnswer)) ||
          (normAnswer && normAnswer.split(' ').includes(normOpt))
        );

        if (isMatch) {
          if (radio.tagName === 'INPUT') {
            radio.checked = true;
            radio.click();
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            // Google Forms ARIA radio [role="radio"]
            // 1. Dispatch full sequence of pointer/mouse events for Google Forms Closure handlers
            radio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            radio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            radio.click();

            // 2. Also click parent label if present
            const parentLabel = radio.closest('label');
            if (parentLabel && parentLabel !== radio) {
              parentLabel.click();
            }

            // 3. Ensure aria-checked state is set accurately
            radio.setAttribute('aria-checked', 'true');
            radios.forEach(other => {
              if (other !== radio && other.getAttribute('role') === 'radio') {
                other.setAttribute('aria-checked', 'false');
              }
            });

            // 4. Dispatch change event on radiogroup container
            const rg = radio.closest('[role="radiogroup"]');
            if (rg) {
              rg.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          return true;
        }
      }
    }

    if (type === 'checkbox') {
      const normAnswer = normalizeText(answer);
      // Check if answer is positive like "yes", "true", "checked", or matches label
      if (['yes', 'true', '1', 'checked'].includes(normAnswer)) {
        if (element.tagName === 'INPUT') {
          if (!element.checked) {
            element.checked = true;
            element.click();
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else {
          element.click();
          element.setAttribute('aria-checked', 'true');
        }
        return true;
      }
    }

    return false;
  }

  // MAIN AUTOFILL ENGINE
  function runAutofill(profile, savedQuestions) {
    const stats = {
      profileFilled: 0,
      questionsFilled: 0,
      unknownFound: 0
    };

    const unknownItems = [];
    const processedContainers = new Set();
    const processedElements = new Set();

    // 1. Scan Radio Groups & Google Forms ARIA Radios
    const radioGroups = new Map();

    // Standard radio inputs
    const standardRadios = document.querySelectorAll('input[type="radio"]');
    standardRadios.forEach(r => {
      if (isSensitiveField(r)) return;
      const groupKey = r.name || r.closest('[role="listitem"], fieldset, .field-group, .form-group')?.id || r.closest('[role="radiogroup"]') || 'default_rg';
      if (!radioGroups.has(groupKey)) {
        radioGroups.set(groupKey, []);
      }
      radioGroups.get(groupKey).push(r);
      processedElements.add(r);
    });

    // Google Forms ARIA Radios [role="radio"]
    const ariaRadios = document.querySelectorAll('[role="radio"]');
    ariaRadios.forEach(r => {
      if (isSensitiveField(r)) return;
      // Group by radiogroup, listitem, fieldset, or parent container (NEVER closest('div')!)
      const container = r.closest('[role="radiogroup"]') ||
                        r.closest('[role="listitem"]') ||
                        r.closest('fieldset') ||
                        r.parentElement?.closest('[role="radiogroup"], [role="listitem"]') ||
                        r.parentElement;
      const groupKey = container || 'default_aria_rg';
      if (!radioGroups.has(groupKey)) {
        radioGroups.set(groupKey, []);
      }
      radioGroups.get(groupKey).push(r);
      processedElements.add(r);
    });

    // Process all radio groups
    radioGroups.forEach((radios) => {
      if (!radios || radios.length === 0) return;
      const firstRadio = radios[0];
      const questionText = extractQuestionContext(firstRadio);
      if (!questionText) return;

      const match = findMatch(questionText, profile, savedQuestions);
      if (match) {
        const filled = fillElement(radios, 'radio_group', match.value);
        if (filled) {
          if (match.type === 'profile' || match.type === 'profile_custom') {
            stats.profileFilled++;
          } else {
            stats.questionsFilled++;
          }
        }
      } else {
        unknownItems.push({
          question: questionText,
          element: radios,
          elementType: 'radio_group'
        });
      }
    });

    // 2. Scan Text Inputs, Textareas, and Selects
    const formFields = document.querySelectorAll(
      'input:not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="hidden"]):not([type="reset"]):not([type="image"]), textarea, select, [role="checkbox"]'
    );

    formFields.forEach(el => {
      if (processedElements.has(el)) return;

      const questionText = extractQuestionContext(el);

      // Sensitive field check
      if (isSensitiveField(el, questionText)) {
        return; // Strictly never touch sensitive fields!
      }

      processedElements.add(el);

      const isSelect = el.tagName === 'SELECT';
      const isCheckbox = (el.tagName === 'INPUT' && el.type === 'checkbox') || el.getAttribute('role') === 'checkbox';
      const isTextInput = !isSelect && !isCheckbox;

      const match = findMatch(questionText, profile, savedQuestions);

      if (match) {
        let filled = false;
        if (isTextInput) {
          filled = fillElement(el, 'text', match.value);
        } else if (isSelect) {
          filled = fillElement(el, 'select', match.value);
        } else if (isCheckbox) {
          filled = fillElement(el, 'checkbox', match.value);
        }

        if (filled) {
          if (match.type === 'profile' || match.type === 'profile_custom') {
            stats.profileFilled++;
          } else {
            stats.questionsFilled++;
          }
        }
      } else {
        // Unknown question found
        if (questionText && questionText.length > 2) {
          let elementType = 'text';
          if (isSelect) elementType = 'select';
          if (isCheckbox) elementType = 'checkbox';

          unknownItems.push({
            question: questionText,
            element: el,
            elementType
          });
        }
      }
    });

    stats.unknownFound = unknownItems.length;

    // Show unknown question prompt if new questions were discovered
    if (unknownItems.length > 0) {
      showUnknownBadge(unknownItems);
    }

    return stats;
  }

  // HTML escaping utility
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Listen for message from Extension Popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RUN_AUTOFILL') {
      try {
        const stats = runAutofill(request.profile || {}, request.questions || []);
        sendResponse({ success: true, stats });
      } catch (err) {
        console.error('FormMate Autofill error:', err);
        sendResponse({ success: false, message: err.message });
      }
    }
    return true; // Keep message channel open for async response
  });
})();
