// api/ping.js
// Vercel serverless function — runs server-side, so browser never talks
// directly to Ringba/Retreaver/CallGrid. This is what avoids CORS entirely.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ statusCode: 405, ok: false, error: 'Method not allowed' });
  }

  const { crm, apiKey, phone, zip, state } = req.body || {};

  if (!crm || !apiKey) {
    return res.status(400).json({ statusCode: 400, ok: false, error: 'CRM and API Key are required' });
  }

  let url, headers, body;

  switch (crm) {
    case 'ringba':
      url = 'https://rtb.ringba.com/v1/production/.json';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      body = { key: apiKey, caller_id: phone, zip, state };
      break;

    case 'retreaver':
      url = 'https://rtb.retreaver.com/rtbs.json';
      headers = {
        'Content-Type': 'application/json'
      };
      body = { key: apiKey, phone, postal_code: zip, region: state };
      break;

    case 'callgrid':
      url = 'https://bid.callgrid.com/api/bid/';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      body = { api_key: apiKey, phone_number: phone, zip_code: zip, state_code: state };
      break;

    default:
      return res.status(400).json({ statusCode: 400, ok: false, error: 'Unknown CRM selected' });
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const rawText = await upstream.text();
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawText);
    } catch (e) {
      parsedBody = rawText; // upstream didn't return JSON
    }

    return res.status(200).json({
      statusCode: upstream.status,
      ok: upstream.ok,
      crm,
      requestSent: { url, body },
      body: parsedBody
    });
  } catch (err) {
    // Network-level failure reaching the CRM (bad URL, DNS, timeout, etc.)
    return res.status(200).json({
      statusCode: 0,
      ok: false,
      crm,
      error: err.message || 'Network error contacting CRM endpoint'
    });
  }
};
