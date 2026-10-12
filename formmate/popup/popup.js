// FormMate - Extension Popup Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Autofill elements
  const btnRunAutofill = document.getElementById('btnRunAutofill');
  const autofillResultCard = document.getElementById('autofillResultCard');
  const statProfileFields = document.getElementById('statProfileFields');
  const statSavedQuestions = document.getElementById('statSavedQuestions');
  const statNewQuestionsWrapper = document.getElementById('statNewQuestionsWrapper');
  const statNewQuestions = document.getElementById('statNewQuestions');
  const resultTimestamp = document.getElementById('resultTimestamp');
  const resultNote = document.getElementById('resultNote');

  // Profile elements
  const profileForm = document.getElementById('profileForm');
  const profileSaveIndicator = document.getElementById('profileSaveIndicator');
  const btnAddCustomField = document.getElementById('btnAddCustomField');
  const customFieldsContainer = document.getElementById('customFieldsContainer');

  const profileInputs = [
    'fullName', 'email', 'mobile', 'college', 'department',
    'degree', 'graduationYear', 'city', 'state', 'country'
  ];

  // Questions elements
  const questionFormHeading = document.getElementById('questionFormHeading');
  const editQuestionIdInput = document.getElementById('editQuestionId');
  const inputQuestionText = document.getElementById('inputQuestionText');
  const inputQuestionAnswer = document.getElementById('inputQuestionAnswer');
  const btnSaveQuestion = document.getElementById('btnSaveQuestion');
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  const questionsCount = document.getElementById('questionsCount');
  const filterQuestionsInput = document.getElementById('filterQuestionsInput');
  const questionsList = document.getElementById('questionsList');
  const emptyQuestionsState = document.getElementById('emptyQuestionsState');

  // Settings elements
  const btnExportData = document.getElementById('btnExportData');
  const btnTriggerImport = document.getElementById('btnTriggerImport');
  const importFileInput = document.getElementById('importFileInput');
  const btnClearAllData = document.getElementById('btnClearAllData');

  // State
  let currentQuestions = [];
  let currentProfile = {};

  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetTab = document.getElementById(targetId);
      if (targetTab) {
        targetTab.classList.add('active');
      }
    });
  });

  // Storage Helpers
  function getStorageData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['profile', 'questions'], (result) => {
        resolve({
          profile: result.profile || {},
          questions: Array.isArray(result.questions) ? result.questions : []
        });
      });
    });
  }

  function setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  // Load Initial Data
  async function loadAllData() {
    const data = await getStorageData();
    currentProfile = data.profile;
    currentQuestions = data.questions;

    // Populate profile fields
    profileInputs.forEach(key => {
      const input = document.getElementById(key);
      if (input) {
        input.value = currentProfile[key] || '';
      }
    });

    // Populate custom profile fields
    customFieldsContainer.innerHTML = '';
    if (Array.isArray(currentProfile.customFields)) {
      currentProfile.customFields.forEach(cf => {
        addCustomFieldRow(cf.label || cf.key, cf.value);
      });
    }

    // Render questions
    renderQuestionsList();
  }

  // Custom Field Row Generator
  function addCustomFieldRow(label = '', value = '') {
    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `
      <input type="text" class="custom-field-name" placeholder="Field Name" value="${escapeHtml(label)}">
      <input type="text" class="custom-field-val" placeholder="Value" value="${escapeHtml(value)}">
      <button type="button" class="btn-remove-row" title="Remove Field">&times;</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });

    customFieldsContainer.appendChild(row);
  }

  btnAddCustomField.addEventListener('click', () => {
    addCustomFieldRow('', '');
  });

  // Save Profile Handler
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedProfile = {};
    profileInputs.forEach(key => {
      const input = document.getElementById(key);
      if (input) {
        updatedProfile[key] = input.value.trim();
      }
    });

    // Collect custom fields
    const customFields = [];
    const rows = customFieldsContainer.querySelectorAll('.custom-field-row');
    rows.forEach(r => {
      const nameInput = r.querySelector('.custom-field-name');
      const valInput = r.querySelector('.custom-field-val');
      const label = nameInput.value.trim();
      const val = valInput.value.trim();
      if (label) {
        customFields.push({ label, key: label.toLowerCase().replace(/[^a-z0-9]/g, ''), value: val });
      }
    });
    updatedProfile.customFields = customFields;

    await setStorageData({ profile: updatedProfile });
    currentProfile = updatedProfile;

    profileSaveIndicator.textContent = '✓ Profile data saved successfully!';
    setTimeout(() => {
      profileSaveIndicator.textContent = '';
    }, 2800);
  });

  // Render Questions List
  function renderQuestionsList() {
    const query = (filterQuestionsInput.value || '').trim().toLowerCase();
    questionsCount.textContent = currentQuestions.length;

    questionsList.innerHTML = '';

    const filtered = currentQuestions.filter(q => {
      if (!query) return true;
      return (q.question && q.question.toLowerCase().includes(query)) ||
             (q.answer && q.answer.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      emptyQuestionsState.classList.remove('hidden');
      questionsList.appendChild(emptyQuestionsState);
      return;
    }

    emptyQuestionsState.classList.add('hidden');

    filtered.forEach(q => {
      const card = document.createElement('div');
      card.className = 'question-card';
      card.dataset.id = q.id;
      card.innerHTML = `
        <div class="q-title">${escapeHtml(q.question)}</div>
        <div class="q-answer-wrapper">
          <span class="q-answer-label">Answer:</span>
          <span>${escapeHtml(q.answer)}</span>
        </div>
        <div class="q-actions">
          <button type="button" class="btn-card-action btn-card-edit">Edit</button>
          <button type="button" class="btn-card-action btn-card-delete">Delete</button>
        </div>
      `;

      card.querySelector('.btn-card-edit').addEventListener('click', () => {
        startEditQuestion(q);
      });

      card.querySelector('.btn-card-delete').addEventListener('click', async () => {
        if (confirm(`Delete this saved question?\n\n"${q.question}"`)) {
          await deleteQuestion(q.id);
        }
      });

      questionsList.appendChild(card);
    });
  }

  filterQuestionsInput.addEventListener('input', () => {
    renderQuestionsList();
  });

  // Question CRUD
  btnSaveQuestion.addEventListener('click', async () => {
    const questionText = inputQuestionText.value.trim();
    const answerText = inputQuestionAnswer.value.trim();
    const editId = editQuestionIdInput.value;

    if (!questionText || !answerText) {
      alert('Please provide both question text and an answer.');
      return;
    }

    if (editId) {
      // Update existing
      const idx = currentQuestions.findIndex(q => q.id === editId);
      if (idx !== -1) {
        currentQuestions[idx].question = questionText;
        currentQuestions[idx].answer = answerText;
      }
      resetQuestionForm();
    } else {
      // Add new
      const newQuestion = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        question: questionText,
        answer: answerText
      };
      currentQuestions.unshift(newQuestion);
      resetQuestionForm();
    }

    await setStorageData({ questions: currentQuestions });
    renderQuestionsList();
  });

  function startEditQuestion(q) {
    editQuestionIdInput.value = q.id;
    inputQuestionText.value = q.question;
    inputQuestionAnswer.value = q.answer;
    questionFormHeading.textContent = 'Edit Question';
    btnSaveQuestion.textContent = 'Update Question';
    btnCancelEdit.classList.remove('hidden');
    inputQuestionText.focus();
  }

  btnCancelEdit.addEventListener('click', () => {
    resetQuestionForm();
  });

  function resetQuestionForm() {
    editQuestionIdInput.value = '';
    inputQuestionText.value = '';
    inputQuestionAnswer.value = '';
    questionFormHeading.textContent = 'Add New Question';
    btnSaveQuestion.textContent = 'Save Question';
    btnCancelEdit.classList.add('hidden');
  }

  async function deleteQuestion(id) {
    currentQuestions = currentQuestions.filter(q => q.id !== id);
    if (editQuestionIdInput.value === id) {
      resetQuestionForm();
    }
    await setStorageData({ questions: currentQuestions });
    renderQuestionsList();
  }

  // Backup & Settings
  btnExportData.addEventListener('click', async () => {
    const data = await getStorageData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `formmate-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  btnTriggerImport.addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!imported || typeof imported !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        const validProfile = imported.profile && typeof imported.profile === 'object' ? imported.profile : {};
        const validQuestions = Array.isArray(imported.questions) ? imported.questions : [];

        await setStorageData({
          profile: validProfile,
          questions: validQuestions
        });

        await loadAllData();
        alert('Data imported successfully!');
      } catch (err) {
        alert('Error importing data: Invalid FormMate JSON backup file.');
      }
    };
    reader.readAsText(file);
  });

  btnClearAllData.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all saved FormMate data? This cannot be undone.')) {
      chrome.storage.local.clear(async () => {
        resetQuestionForm();
        await loadAllData();
        alert('All FormMate data has been cleared.');
      });
    }
  });

  // Autofill Execution Handler
  btnRunAutofill.addEventListener('click', async () => {
    btnRunAutofill.disabled = true;
    btnRunAutofill.textContent = 'Scanning form...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showError('No active browser tab found.');
        return;
      }

      // Check if URL is restricted
      const url = tab.url || '';
      if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
        showError('Cannot autofill browser system pages.');
        return;
      }

      // Get latest fresh profile and questions
      const freshData = await getStorageData();

      // Ensure CSS is injected
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
      } catch (e) {
        // Ignore if css already injected or cannot insert
      }

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (e) {
        console.warn('Execute script note:', e);
      }

      // Send autofill message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'RUN_AUTOFILL',
        profile: freshData.profile,
        questions: freshData.questions
      }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Could not communicate with page. Please refresh the page and try again.');
          return;
        }

        if (response && response.success) {
          displayAutofillResults(response.stats);
        } else {
          showError((response && response.message) || 'Autofill encountered an error.');
        }
      });
    } catch (err) {
      showError('Failed to execute autofill: ' + err.message);
    } finally {
      btnRunAutofill.disabled = false;
      btnRunAutofill.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>Autofill Form</span>
      `;
    }
  });

  function displayAutofillResults(stats = {}) {
    const profileCount = stats.profileFilled || 0;
    const questionsCount = stats.questionsFilled || 0;
    const unknownCount = stats.unknownFound || 0;

    statProfileFields.textContent = `${profileCount} field${profileCount === 1 ? '' : 's'} filled`;
    statSavedQuestions.textContent = `${questionsCount} saved question${questionsCount === 1 ? '' : 's'} filled`;

    if (unknownCount > 0) {
      statNewQuestionsWrapper.classList.remove('hidden');
      statNewQuestions.textContent = `${unknownCount} new question${unknownCount === 1 ? '' : 's'} found`;
      resultNote.textContent = 'Check the notification on the page to save new questions!';
    } else {
      statNewQuestionsWrapper.classList.add('hidden');
      resultNote.textContent = 'Review the form on page before manually submitting.';
    }

    resultTimestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    autofillResultCard.classList.remove('hidden');
  }

  function showError(msg) {
    alert(msg);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialize
  loadAllData();
});
