// api/ping.js — Server-side proxy for the RTB API Tester
//
// Runs on Vercel as a serverless function. Because this executes on the
// server (not in the browser), CORS restrictions from the CRM endpoints
// don't apply here — the browser only ever talks to this same-origin
// /api/ping route.
//
// Local testing: run `vercel dev` from the project root.

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

module.exports = async (req, res) => {
  // Allow the tester page to call this route. Lock this down to your own
  // domain (e.g. "https://your-app.vercel.app") once you're not testing locally.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const { crm, key, phone, zip, state } = req.body || {};
  const config = CRM_CONFIG[crm];

  if (!config) {
    res.status(400).json({ error: `Unknown CRM: "${crm}"` });
    return;
  }

  if (!key) {
    res.status(400).json({ error: "API Key is required." });
    return;
  }

  try {
    const upstreamRes = await fetch(config.url, {
      method: "POST",
      headers: config.buildHeaders(key),
      body: JSON.stringify(config.buildBody({ key, phone, zip, state })),
    });

    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader(
      "Content-Type",
      upstreamRes.headers.get("content-type") || "text/plain"
    );
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: "Upstream request to the CRM failed",
      message: err.message,
    });
  }
};
