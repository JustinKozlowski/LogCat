// This script runs in the popup and sends a message to the content script to parse messages

document.getElementById('parseBtn').addEventListener('click', async () => {
  const format = document.getElementById('formatInput').value;
  // Get filter values
  const filterMessage = document.getElementById('filterMessage').value;
  const filterTimestampFrom = document.getElementById('filterTimestampFrom').value;
  const filterTimestampTo = document.getElementById('filterTimestampTo').value;
  const filterLevel = document.getElementById('filterLevel').value;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, {
    action: 'parseKDLogsMessages',
    format,
    filter: {
      message: filterMessage,
      timestampFrom: filterTimestampFrom,
      timestampTo: filterTimestampTo,
      level: filterLevel
    }
  }, (response) => {
    const output = document.getElementById('output');
      
    if (chrome.runtime.lastError) {
      showOutputMessage('Error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (response === 0) {
      showOutputMessage('No logs found');
      return;
    }
    showOutputMessage('');
  });
});

// --- Responsive popup width logic for CSP compliance ---
function setPopupWidth(isWide) {
  document.body.classList.toggle('narrow', !isWide);
  document.body.classList.toggle('wide', isWide);
  document.body.style.minWidth = isWide ? '320px' : '160px';
}

// Set initial state to narrow
setPopupWidth(false);

const advancedBtn = document.getElementById('advancedBtn');
const advancedSection = document.getElementById('advancedSection');

advancedBtn.addEventListener('click', () => {
  const isOpening = advancedSection.style.display === 'none';
  advancedSection.style.display = isOpening ? 'block' : 'none';
  setPopupWidth(isOpening);
});

// --- Filtering logic for advanced fields ---
function getFilterValues() {
  return {
    message: document.getElementById('filterMessage').value,
    timestampFrom: document.getElementById('filterTimestampFrom').value,
    timestampTo: document.getElementById('filterTimestampTo').value,
    level: document.getElementById('filterLevel').value
  };
}

function setFilterValues(filter) {
  document.getElementById('filterMessage').value = filter.message || '';
  document.getElementById('filterTimestampFrom').value = filter.timestampFrom || '';
  document.getElementById('filterTimestampTo').value = filter.timestampTo || '';
  document.getElementById('filterLevel').value = filter.level || '';
}

// Use localStorage for filter persistence across popup closes
function saveFilterToStorage() {
  const filter = getFilterValues();
  localStorage.setItem('kdLogFilter', JSON.stringify(filter));
}

function loadFilterFromStorage() {
  const filter = JSON.parse(localStorage.getItem('kdLogFilter') || '{}');
  setFilterValues(filter);
}

// Load filter values on popup open
loadFilterFromStorage();

// Save filter values on change (use 'input' for text, 'change' for select)
['filterMessage', 'filterTimestampFrom', 'filterTimestampTo'].forEach(id => {
  document.getElementById(id).addEventListener('input', saveFilterToStorage);
});
document.getElementById('filterLevel').addEventListener('change', saveFilterToStorage);

function sendFilterUpdate() {
  const format = document.getElementById('formatInput').value;
  const filter = getFilterValues();
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'parseKDLogsMessages',
      format,
      filter
    }, (response) => {
      const output = document.getElementById('output');
      if (chrome.runtime.lastError) {
        output.textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }    });
  });
}

// Only run sendFilterUpdate on parse button click, not on filter field changes

document.getElementById('parseBtn').addEventListener('click', sendFilterUpdate);
document.getElementById('resetFiltersBtn').addEventListener('click', () => {
  setFilterValues({});
  saveFilterToStorage();
});

// Show or hide the output div and set its message from JS
function showOutputMessage(msg) {
  const outputDiv = document.getElementById('output');
  const outputMsg = document.getElementById('outputMessage');
  if (msg) {
    outputDiv.style.display = '';
    outputMsg.textContent = msg;
  } else {
    outputDiv.style.display = 'none';
    outputMsg.textContent = '';
  }
}
