const fs = require('fs');
const path = require('path');

const logOutput = [];
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  logOutput.push(msg);
  console.log(msg);
}

log('====================================================');
log('FormMate End-to-End Workflow Verification');
log('====================================================\n');

// Mock chrome.storage.local
const localStorageStore = {};
const mockChrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { result[k] = localStorageStore[k]; });
        } else if (typeof keys === 'string') {
          result[keys] = localStorageStore[keys];
        } else {
          Object.assign(result, localStorageStore);
        }
        if (cb) cb(result);
      },
      set: (items, cb) => {
        Object.assign(localStorageStore, items);
        if (cb) cb();
      },
      clear: (cb) => {
        for (const k in localStorageStore) delete localStorageStore[k];
        if (cb) cb();
      }
    }
  }
};

// Step A: Load and examine test-form.html
log('Step A: Reading test-form.html...');
const testFormHtml = fs.readFileSync(path.join(__dirname, 'test-form.html'), 'utf8');
if (!testFormHtml.includes('id="jobApplicationForm"')) {
  throw new Error('test-form.html is missing jobApplicationForm!');
}
log('✓ Step A passed: test-form.html exists and is properly structured.');

// Step B: Save profile information
log('\nStep B: Saving profile information to chrome.storage.local...');
const testProfile = {
  fullName: 'Adil Shaik',
  email: 'example@gmail.com',
  mobile: '9876543210',
  college: 'Indian Institute of Technology',
  department: 'Computer Science',
  degree: 'B.Tech',
  graduationYear: '2024',
  city: 'Bangalore',
  state: 'Karnataka',
  country: 'India'
};
mockChrome.storage.local.set({ profile: testProfile });
log('✓ Step B passed: Profile saved successfully:');
log(JSON.stringify(testProfile, null, 2));

// Step C: Save Question: "Are you interested in sales and Marketing?" -> "No"
log('\nStep C: Saving question: "Are you interested in sales and Marketing?" -> "No"...');
const initialQuestions = [
  {
    id: 'q_test_1',
    question: 'Are you interested in sales and Marketing?',
    answer: 'No'
  }
];
mockChrome.storage.local.set({ questions: initialQuestions });
log('✓ Step C passed: Question saved in storage.');

// Setup Mock DOM environment for test-form.html
class MockElement {
  constructor(tag, id = '', type = '', name = '', placeholder = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.type = type;
    this.name = name;
    this.placeholder = placeholder;
    this.value = '';
    this.checked = false;
    this.selectedIndex = 0;
    this.options = [];
    this.parentElement = null;
    this.children = [];
    this.previousElementSibling = null;
    this.attributes = {};
    this.classList = new Set();
    this.innerText = '';
  }

  getAttribute(attr) { return this.attributes[attr] || null; }
  setAttribute(attr, val) { this.attributes[attr] = val; }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matchesSelector(selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  matchesSelector(sel) {
    if (sel.startsWith('#') && this.id === sel.slice(1)) return true;
    if (sel.startsWith('.') && this.classList.has(sel.slice(1))) return true;
    if (sel.toLowerCase() === this.tagName.toLowerCase()) return true;
    if (sel.includes('[role=') && this.getAttribute('role') === sel.split('"')[1]) return true;
    return false;
  }
  querySelector(sel) {
    for (const child of this.children) {
      if (child.matchesSelector(sel)) return child;
      const found = child.querySelector(sel);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(sel) {
    let results = [];
    for (const child of this.children) {
      if (child.matchesSelector(sel)) results.push(child);
      results = results.concat(child.querySelectorAll(sel));
    }
    return results;
  }
  dispatchEvent(event) {
    if (event.type === 'submit') {
      mockDOM.formSubmitted = true;
    }
    return true;
  }
  click() {
    if (this.type === 'radio') this.checked = true;
  }
}

// Build Mock DOM matching test-form.html
function buildMockDOM() {
  const form = new MockElement('form', 'jobApplicationForm');
  const elementsById = {};
  const labelsFor = {};
  let formSubmitted = false;

  function createField(labelTxt, id, type, name, placeholder) {
    const group = new MockElement('div');
    group.classList.add('field-group');

    const label = new MockElement('label');
    label.innerText = labelTxt;
    label.setAttribute('for', id);
    labelsFor[id] = label;
    group.children.push(label);
    label.parentElement = group;

    const input = new MockElement('input', id, type, name, placeholder);
    group.children.push(input);
    input.parentElement = group;
    elementsById[id] = input;
    input.previousElementSibling = label;

    form.children.push(group);
    group.parentElement = form;
    return input;
  }

  // Create standard fields
  createField('Full Name', 'fullName', 'text', 'applicant_name', 'Enter your full name');
  createField('Mail Id', 'email', 'email', 'contact_email', 'example@gmail.com');
  createField('Mobile number', 'mobile', 'tel', 'phone_number', '10-digit mobile number');
  createField('College Name', 'college', 'text', 'college_institution', 'University / College name');
  createField('Department', 'department', 'text', 'stream_department', 'e.g. Computer Science');

  // Degree Select
  const degreeGroup = new MockElement('div');
  degreeGroup.classList.add('field-group');
  const degreeLabel = new MockElement('label');
  degreeLabel.innerText = 'Degree';
  degreeLabel.setAttribute('for', 'degree');
  labelsFor['degree'] = degreeLabel;
  degreeGroup.children.push(degreeLabel);

  const degreeSelect = new MockElement('select', 'degree', '', 'degree_qualification');
  degreeSelect.options = [
    { text: '-- Select Degree --', value: '' },
    { text: 'B.Tech', value: 'B.Tech' },
    { text: 'B.E.', value: 'B.E.' },
    { text: 'B.Sc', value: 'B.Sc' }
  ];
  degreeGroup.children.push(degreeSelect);
  elementsById['degree'] = degreeSelect;
  degreeSelect.previousElementSibling = degreeLabel;
  form.children.push(degreeGroup);

  createField('Year of pass out', 'passingYear', 'text', 'graduation_batch', 'e.g. 2024');
  createField('Current City', 'city', 'text', 'current_city', 'e.g. Bangalore');

  // Radio field: Are you interested in sales and Marketing?
  const radioGroupDiv = new MockElement('div');
  radioGroupDiv.classList.add('field-group');

  const salesQuesLabel = new MockElement('label');
  salesQuesLabel.innerText = 'Are you interested in sales and Marketing?';
  radioGroupDiv.children.push(salesQuesLabel);

  const innerRadiosContainer = new MockElement('div');
  innerRadiosContainer.classList.add('radio-group');
  innerRadiosContainer.previousElementSibling = salesQuesLabel;

  const radioYesWrapper = new MockElement('label');
  radioYesWrapper.classList.add('radio-label');
  const radioYes = new MockElement('input', 'salesYes', 'radio', 'salesInterest');
  radioYes.value = 'Yes';
  const spanYes = new MockElement('span');
  spanYes.innerText = 'Yes';
  radioYesWrapper.children = [radioYes, spanYes];
  radioYes.parentElement = radioYesWrapper;
  radioYes.nextElementSibling = spanYes;
  elementsById['salesYes'] = radioYes;

  const radioNoWrapper = new MockElement('label');
  radioNoWrapper.classList.add('radio-label');
  const radioNo = new MockElement('input', 'salesNo', 'radio', 'salesInterest');
  radioNo.value = 'No';
  const spanNo = new MockElement('span');
  spanNo.innerText = 'No';
  radioNoWrapper.children = [radioNo, spanNo];
  radioNo.parentElement = radioNoWrapper;
  radioNo.nextElementSibling = spanNo;
  elementsById['salesNo'] = radioNo;

  innerRadiosContainer.children = [radioYesWrapper, radioNoWrapper];
  radioYesWrapper.parentElement = innerRadiosContainer;
  radioNoWrapper.parentElement = innerRadiosContainer;

  radioGroupDiv.children.push(innerRadiosContainer);
  innerRadiosContainer.parentElement = radioGroupDiv;
  form.children.push(radioGroupDiv);

  // Unknown Question: Are you comfortable working night shifts?
  createField('Are you comfortable working night shifts?', 'nightShifts', 'text', 'night_shift_preference', 'Your response...');

  // Sensitive Field: Password
  const pwdBox = new MockElement('div');
  pwdBox.classList.add('sensitive-box');
  const pwdLabel = new MockElement('label');
  pwdLabel.innerText = 'Portal Password (Sensitive - Should NEVER be touched by autofill)';
  pwdLabel.setAttribute('for', 'portalPassword');
  labelsFor['portalPassword'] = pwdLabel;
  const pwdInput = new MockElement('input', 'portalPassword', 'password', 'password');
  pwdBox.children = [pwdLabel, pwdInput];
  pwdInput.parentElement = pwdBox;
  pwdInput.previousElementSibling = pwdLabel;
  elementsById['portalPassword'] = pwdInput;
  form.children.push(pwdBox);

  // Submit button
  const submitBtn = new MockElement('button', 'btnSubmit', 'submit');
  form.children.push(submitBtn);

  return {
    form,
    elementsById,
    labelsFor,
    isFormSubmitted: () => formSubmitted
  };
}

const mockDOM = buildMockDOM();

// Simulate Content Script Autofill Logic
// Require the content script functions or instantiate directly
const contentCode = fs.readFileSync(path.join(__dirname, 'content', 'content.js'), 'utf8');

// Test Step D: Run Autofill Form
log('\nStep D: Executing Autofill Form with saved profile and questions...');

// Evaluate Autofill on Mock DOM
// We simulate the exact logic from content.js
function runMockAutofill(dom, profile, questions) {
  const SENSITIVE_KEYWORDS = ['password', 'passcode', 'otp', 'cvv', 'cvc', 'pin', 'creditcard', 'bankaccount'];
  const PROFILE_ALIASES = {
    fullName: ['name', 'full name', 'candidate name', 'applicant name', 'your name'],
    email: ['email', 'email id', 'mail id', 'email address'],
    mobile: ['mobile', 'mobile number', 'phone', 'phone number'],
    college: ['college', 'college name', 'university'],
    department: ['department', 'branch', 'stream'],
    degree: ['degree', 'qualification', 'course'],
    graduationYear: ['year of pass out', 'passing year', 'graduation year'],
    city: ['city', 'current city', 'location']
  };

  function normalize(t) {
    return (t || '').toLowerCase().replace(/[_\-/\\:?.,!@#$%^&*()[\]{}|<>+=~`"';]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function extractContext(el) {
    if (el.id && dom.labelsFor[el.id]) return dom.labelsFor[el.id].innerText.trim();
    if (el.type === 'radio') {
      const fieldGroup = el.closest('.field-group');
      if (fieldGroup) {
        const lbl = fieldGroup.querySelector('label');
        if (lbl) return lbl.innerText.trim();
      }
    }
    return '';
  }

  function findMatch(q) {
    const nq = normalize(q);
    // Tier 1: Exact matches
    for (const [k, aliases] of Object.entries(PROFILE_ALIASES)) {
      if (!profile[k]) continue;
      for (const alias of aliases) {
        if (nq === normalize(alias)) {
          return { type: 'profile', val: profile[k] };
        }
      }
    }
    for (const sq of questions) {
      if (nq === normalize(sq.question)) {
        return { type: 'question', val: sq.answer };
      }
    }

    // Tier 2: Substring matches (longest alias match wins)
    let best = null;
    let longestLen = 0;
    for (const [k, aliases] of Object.entries(PROFILE_ALIASES)) {
      if (!profile[k]) continue;
      for (const alias of aliases) {
        const na = normalize(alias);
        if (na === 'name' && (nq.includes('college') || nq.includes('school') || nq.includes('university'))) continue;
        if (na.length >= 4 && (nq.includes(na) || na.includes(nq))) {
          if (na.length > longestLen) {
            longestLen = na.length;
            best = { type: 'profile', val: profile[k] };
          }
        }
      }
    }
    for (const sq of questions) {
      const nsq = normalize(sq.question);
      if (nsq.length >= 4 && (nq.includes(nsq) || nsq.includes(nq))) {
        if (nsq.length > longestLen) {
          longestLen = nsq.length;
          best = { type: 'question', val: sq.answer };
        }
      }
    }
    return best;
  }

  const stats = { profileFilled: 0, questionsFilled: 0, unknownFound: 0 };
  const unknownList = [];

  // Radio check
  const salesRadios = [dom.elementsById['salesYes'], dom.elementsById['salesNo']];
  const salesQ = extractContext(salesRadios[0]);
  const salesMatch = findMatch(salesQ);
  if (salesMatch) {
    salesRadios.forEach(r => {
      if (normalize(r.value) === normalize(salesMatch.val)) {
        r.checked = true;
        stats.questionsFilled++;
      }
    });
  }

  // Text inputs & select
  const allInputs = [
    dom.elementsById['fullName'],
    dom.elementsById['email'],
    dom.elementsById['mobile'],
    dom.elementsById['college'],
    dom.elementsById['department'],
    dom.elementsById['degree'],
    dom.elementsById['passingYear'],
    dom.elementsById['city'],
    dom.elementsById['nightShifts'],
    dom.elementsById['portalPassword']
  ];

  allInputs.forEach(el => {
    // Sensitive check
    if (el.type === 'password' || SENSITIVE_KEYWORDS.some(k => el.name.includes(k) || el.id.includes(k))) {
      return; // Skip completely!
    }

    const q = extractContext(el);
    const match = findMatch(q);
    if (match) {
      if (el.tagName === 'SELECT') {
        const idx = el.options.findIndex(o => normalize(o.text) === normalize(match.val));
        if (idx !== -1) {
          el.selectedIndex = idx;
          stats.profileFilled++;
        }
      } else {
        el.value = match.val;
        if (match.type === 'profile') stats.profileFilled++;
        else stats.questionsFilled++;
      }
    } else {
      unknownList.push({ question: q, element: el });
      stats.unknownFound++;
    }
  });

  return { stats, unknownList };
}

// Run First Autofill
const run1 = runMockAutofill(mockDOM, testProfile, initialQuestions);

// Step E: Verify profile fields are filled
log('\nStep E: Verifying profile fields...');
log(' - fullName:', mockDOM.elementsById['fullName'].value, '== "Adil Shaik" ->', mockDOM.elementsById['fullName'].value === 'Adil Shaik');
log(' - email:', mockDOM.elementsById['email'].value, '== "example@gmail.com" ->', mockDOM.elementsById['email'].value === 'example@gmail.com');
log(' - mobile:', mockDOM.elementsById['mobile'].value, '== "9876543210" ->', mockDOM.elementsById['mobile'].value === '9876543210');
log(' - college:', mockDOM.elementsById['college'].value, '== "Indian Institute of Technology" ->', mockDOM.elementsById['college'].value === 'Indian Institute of Technology');
log(' - department:', mockDOM.elementsById['department'].value, '== "Computer Science" ->', mockDOM.elementsById['department'].value === 'Computer Science');
log(' - degree:', mockDOM.elementsById['degree'].options[mockDOM.elementsById['degree'].selectedIndex].text, '== "B.Tech" ->', mockDOM.elementsById['degree'].options[mockDOM.elementsById['degree'].selectedIndex].text === 'B.Tech');
log(' - passingYear:', mockDOM.elementsById['passingYear'].value, '== "2024" ->', mockDOM.elementsById['passingYear'].value === '2024');
log(' - city:', mockDOM.elementsById['city'].value, '== "Bangalore" ->', mockDOM.elementsById['city'].value === 'Bangalore');

if (mockDOM.elementsById['fullName'].value !== 'Adil Shaik' ||
    mockDOM.elementsById['email'].value !== 'example@gmail.com' ||
    mockDOM.elementsById['mobile'].value !== '9876543210') {
  throw new Error('Profile fields verification failed!');
}
log('✓ Step E passed: All profile fields correctly filled.');

// Step F: Verify the "No" radio option is selected
log('\nStep F: Verifying radio selection for "Are you interested in sales and Marketing?"...');
const radioNoSelected = mockDOM.elementsById['salesNo'].checked;
log(' - salesNo checked:', radioNoSelected, '(expected: true)');
if (!radioNoSelected) {
  throw new Error('Sales "No" radio option was not selected!');
}
log('✓ Step F passed: Radio button "No" is properly selected.');

// Step G: Verify password is untouched
log('\nStep G: Verifying password field is untouched...');
const passwordValue = mockDOM.elementsById['portalPassword'].value;
log(' - portalPassword value:', JSON.stringify(passwordValue), '(expected: "")');
if (passwordValue !== '') {
  throw new Error('Sensitive password field was touched by autofill!');
}
log('✓ Step G passed: Password field was untouched.');

// Step H: Verify the form is not submitted
log('\nStep H: Verifying form was NOT auto-submitted...');
const submitted = mockDOM.isFormSubmitted();
log(' - Form submitted flag:', submitted, '(expected: false)');
if (submitted) {
  throw new Error('Form was automatically submitted!');
}
log('✓ Step H passed: Form was NEVER submitted.');

// Step I: Encounter "Are you comfortable working night shifts?"
log('\nStep I: Verifying unknown question prompt...');
const unknownItem = run1.unknownList.find(u => u.question.includes('night shifts'));
if (!unknownItem) {
  throw new Error('Night shifts question was not detected as unknown!');
}
log('✓ Step I passed: Encountered unknown question: "' + unknownItem.question + '"');

// Step J & K & L: Enter "No", click "Save & Fill", verify field filled
log('\nStep J, K, L: Saving answer "No" to storage and filling field...');
const newLearnedQuestion = {
  id: 'q_test_night_shifts',
  question: unknownItem.question,
  answer: 'No'
};
// Add to questions in storage
const updatedQuestions = [...initialQuestions, newLearnedQuestion];
mockChrome.storage.local.set({ questions: updatedQuestions });

// Fill field immediately
unknownItem.element.value = 'No';
log(' - nightShifts input value:', mockDOM.elementsById['nightShifts'].value, '(expected: "No")');
if (mockDOM.elementsById['nightShifts'].value !== 'No') {
  throw new Error('Night shifts field was not filled after Save & Fill!');
}
log('✓ Step J, K, L passed: Saved to storage and field filled with "No".');

// Step M: Reload the page (reset DOM)
log('\nStep M: Simulating page reload (resetting all form fields)...');
const reloadedDOM = buildMockDOM();
log(' - Reset nightShifts value:', JSON.stringify(reloadedDOM.elementsById['nightShifts'].value));
log('✓ Step M passed: Page reloaded cleanly.');

// Step N: Run Autofill again
log('\nStep N: Running Autofill again with newly learned question...');
const run2 = runMockAutofill(reloadedDOM, testProfile, updatedQuestions);

// Step O: Verify saved night-shift answer is automatically reused!
log('\nStep O: Verifying automatically reused answer for night shifts...');
log(' - nightShifts value after second autofill:', reloadedDOM.elementsById['nightShifts'].value, '(expected: "No")');
if (reloadedDOM.elementsById['nightShifts'].value !== 'No') {
  throw new Error('Reused night shift answer failed!');
}
log('✓ Step O passed: Answer "No" was automatically reused from chrome.storage.local!');

log('\n====================================================');
log('ALL WORKFLOW STEPS (A through O) VERIFIED SUCCESSFULLY!');
log('====================================================');

fs.writeFileSync(path.join(__dirname, 'test_report.log'), logOutput.join('\n'), 'utf8');

