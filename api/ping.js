// ping.js — RTB API Tester request logic

const CRM_CONFIG = {
  ringba: {
    url: "https://rtb.ringba.com/v1/production/.json",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: ({ key, phone, zip, state }) => ({
      key,
      caller_id: phone,
      zip,
      state,
    }),
  },
  retreaver: {
    url: "https://rtb.retreaver.com/rtbs.json",
    buildHeaders: () => ({
      "Content-Type": "application/json",
    }),
    buildBody: ({ key, phone, zip, state }) => ({
      key,
      phone,
      postal_code: zip,
      region: state,
    }),
  },
  callgrid: {
    url: "https://bid.callgrid.com/api/bid/",
    buildHeaders: (key) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    }),
    buildBody: ({ key, phone, zip, state }) => ({
      api_key: key,
      phone_number: phone,
      zip_code: zip,
      state_code: state,
    }),
  },
};

function getInputs() {
  return {
    crm: document.getElementById("crmSelect").value,
    key: document.getElementById("apiKey").value.trim(),
    phone: document.getElementById("phoneNumber").value.trim(),
    zip: document.getElementById("zipCode").value.trim(),
    state: document.getElementById("stateInput").value.trim(),
  };
}

function setLoading(isLoading) {
  const btn = document.getElementById("testBtn");
  const label = document.getElementById("testBtnLabel");
  const icon = document.getElementById("testBtnIcon");
  btn.disabled = isLoading;
  btn.classList.toggle("opacity-60", isLoading);
  btn.classList.toggle("cursor-not-allowed", isLoading);
  label.textContent = isLoading ? "Sending..." : "Send Test Bid Request";
  icon.classList.toggle("animate-spin", isLoading);
}

function setStatusBadge(state, text) {
  const badge = document.getElementById("statusBadge");
  badge.classList.remove("hidden");

  const styles = {
    success: "text-signal-teal border-signal-teal/40 bg-signal-teal/10",
    error: "text-signal-red border-signal-red/40 bg-signal-red/10",
    pending: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  };

  badge.className =
    "text-xs font-mono font-bold px-2.5 py-1 rounded-full border " +
    (styles[state] || styles.pending);
  badge.textContent = text;
}

// Very small syntax highlighter for JSON output, styled via CSS classes
// defined in index.html (.json-key, .json-string, .json-number, .json-bool, .json-null)
function syntaxHighlight(json) {
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function renderResponse({ statusLine, bodyText, isError }) {
  const responseEl = document.getElementById("response");
  responseEl.classList.remove("text-slate-500");

  let formattedBody = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    formattedBody = JSON.stringify(parsed, null, 2);
    responseEl.innerHTML = `<span class="text-slate-500"># ${statusLine}</span>\n${syntaxHighlight(formattedBody)}`;
  } catch (e) {
    // Not valid JSON — show as plain text
    responseEl.innerHTML = `<span class="text-slate-500"># ${statusLine}</span>\n${bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}`;
  }
}

async function testAPI() {
  const { crm, key, phone, zip, state } = getInputs();
  const config = CRM_CONFIG[crm];

  if (!config) {
    setStatusBadge("error", "FAILED");
    renderResponse({
      statusLine: "Configuration error",
      bodyText: `Unknown CRM selection: "${crm}"`,
      isError: true,
    });
    return;
  }

  if (!key) {
    setStatusBadge("error", "FAILED");
    renderResponse({
      statusLine: "Validation error",
      bodyText: "API Key is required before sending a test request.",
      isError: true,
    });
    return;
  }

  setLoading(true);
  setStatusBadge("pending", "SENDING...");

  const headers = config.buildHeaders(key);
  const body = config.buildBody({ key, phone, zip, state });

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let bodyText;
    try {
      bodyText = await res.text();
    } catch (e) {
      bodyText = "(no response body)";
    }

    const statusLine = `HTTP ${res.status} ${res.statusText}`;

    if (res.ok) {
      setStatusBadge("success", "SUCCESS");
    } else {
      setStatusBadge("error", "FAILED");
    }

    renderResponse({ statusLine, bodyText, isError: !res.ok });
  } catch (err) {
    setStatusBadge("error", "FAILED");

    const isLikelyCORS =
      err instanceof TypeError &&
      /fetch|network|failed/i.test(err.message || "");

    const message = isLikelyCORS
      ? "Request blocked — likely a CORS error. Host this on server if CORS error."
      : `Request failed: ${err.message}`;

    renderResponse({
      statusLine: "Network error",
      bodyText: message,
      isError: true,
    });
  } finally {
    setLoading(false);
  }
}

function copyResponse() {
  const responseEl = document.getElementById("response");
  const text = responseEl.innerText;
  const copyBtn = document.getElementById("copyBtn");

  navigator.clipboard
    .writeText(text)
    .then(() => {
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied`;
      setTimeout(() => {
        copyBtn.innerHTML = original;
      }, 1500);
    })
    .catch(() => {
      // Fallback for environments without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
}
