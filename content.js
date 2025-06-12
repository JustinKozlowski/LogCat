function injectKDLogStyles() {
  if (document.getElementById('kd-log-style')) return;
  const style = document.createElement('style');
  style.id = 'kd-log-style';
  style.textContent = `
    .kd-log-timestamp { color: #2196f3; font-weight: bold; }
    .kd-log-level-info { color: #4caf50; font-weight: bold; }
    .kd-log-level-warn { color: #ff9800; font-weight: bold; }
    .kd-log-level-err { color: #f44336; font-weight: bold; }
    .kd-log-level-def { color: #9e9e9e; font-weight: bold; }
    .kd-log-message { color: #fff; }
    .kd-log-exception { color: #f44336; font-style: italic; }
  `;
  document.head.appendChild(style);
}

function getLevelClass(level) {
  if (!level) return 'kd-log-level-def';
  const l = level.toLowerCase();
  if (l.startsWith('inf')) return 'kd-log-level-info';
  if (l.startsWith('war')) return 'kd-log-level-warn';
  if (l.startsWith('err')) return 'kd-log-level-err';
  return 'kd-log-level-def';
}

const KD_LOG_FORMAT = '[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}';

function formatWithTemplate(json, template) {
  function formatTimestamp(ts, fmt) {
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date)) return '';
    if (fmt === 'HH:mm:ss') {
      return date.toISOString().substr(11, 8);
    }
    return ts;
  }
  function formatLevel(level, fmt) {
    if (!level) return '';
    if (fmt === 'u3') return level.substring(0, 3).toUpperCase();
    return level;
  }
  function formatMessage(json, fmt) {
    return json.RenderedMessage || json.MessageTemplate || '';
  }
  function formatException(json) {
    return json.Exception ? `<span class='kd-log-exception'>${json.Exception}</span>` : '';
  }
  function formatNewLine() {
    return '\n';
  }
  function formatProperty(json, key) {
    if (json[key] !== undefined) return json[key];
    if (json.Properties && json.Properties[key] !== undefined) return json.Properties[key];
    return '';
  }
  return template.replace(/\{([^}:]+)(?::([^}]+))?\}/g, (match, token, fmt) => {
    switch (token) {
      case 'Timestamp':
        return `<span class='kd-log-timestamp'>${formatTimestamp(json.Timestamp, fmt)}</span>`;
      case 'Level':
        return `<span class='${getLevelClass(json.Level)}'>${formatLevel(json.Level, fmt)}</span>`;
      case 'Message':
        return `<span class='kd-log-message'>${formatMessage(json, fmt)}</span>`;
      case 'Exception':
        return formatException(json);
      case 'NewLine':
        return formatNewLine();
      default:
        return formatProperty(json, token);
    }
  });
}

function formatKDLog(json, formatString) {
  return formatWithTemplate(json, formatString || KD_LOG_FORMAT);
}

// Store parsed JSON logs globally for filtering
let kdParsedLogs = [];

function parseKDLogsMessages(formatString) {
  injectKDLogStyles();
  const elements = Array.from(document.querySelectorAll('div.kd-logs-element span'));
  kdParsedLogs = [];
  elements.forEach(span => {
    try {
      // Store the original JSON string in a data attribute if not already present
      if (!span.dataset.json) {
        span.dataset.json = span.textContent;
      }
      const json = JSON.parse(span.dataset.json);
      kdParsedLogs.push({ span, json });
    } catch (e) {
      // Ignore parse errors
    }
  });
}

function applyKDLogFilters(filter, formatString) {
  kdParsedLogs.forEach(({ span }) => {
    let json;
    try {
      json = JSON.parse(span.dataset.json);
    } catch {
      span.parentElement.style.display = 'none';
      return;
    }
    let visible = true;
    if (filter.message && !(json.RenderedMessage || json.MessageTemplate || '').toLowerCase().includes(filter.message.toLowerCase())) {
      visible = false;
    }
    if (visible && filter.level) {
      // Filter lower levels out
      const logLevel = (json.Level || '').toString().toUpperCase();
      const filterLevel = filter.level.toString().toUpperCase();
      if (!logLevel.includes(filterLevel) && !filterLevel.includes(logLevel)) {
        visible = false;
      }
    }
    // Fixe here
    if (visible && filter.timestampFrom) {
      const from = filter.timestampFrom;
      const ts = new Date(json.Timestamp);
      if (!isNaN(ts)) {
        const tsStr = ts.toTimeString().slice(0,5);
        if (tsStr < from) visible = false;
      }
    }
    if (visible && filter.timestampTo) {
      const to = filter.timestampTo;
      const ts = new Date(json.Timestamp);
      if (!isNaN(ts)) {
        const tsStr = ts.toTimeString().slice(0,5);
        if (tsStr > to) visible = false;
      }
    }
    if (visible) {
      span.innerHTML = formatKDLog(json, formatString);
      span.parentElement.style.display = '';
    } else {
      span.parentElement.style.display = 'none';
    }
  });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parseKDLogsMessages') {
    injectKDLogStyles();
    const formatString = request.format;
    const filter = request.filter || {};
    parseKDLogsMessages(formatString);
    applyKDLogFilters(filter, formatString);
    const visibleCount = kdParsedLogs.filter(({ span }) => span.parentElement.style.display !== 'none').length;
    console.log(`Visible logs after filtering: ${visibleCount}`);
    sendResponse(visibleCount);
  }
  return true;
});
