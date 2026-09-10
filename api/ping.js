// api/ping.js
// Vercel serverless function — runs server-side, so browser never talks
// directly to Ringba/Retreaver/CallGrid. This is what avoids CORS entirely.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ statusCode: 405, ok: false, error: 'Method not allowed' });
  }

  const { crm, apiKey, phone, zip, state, rtbId } = req.body || {};

  if (!crm) {
    return res.status(400).json({ statusCode: 400, ok: false, error: 'CRM is required' });
  }

  let url, headers, body;

  switch (crm) {
    case 'ringba':
      if (!rtbId) {
        return res.status(400).json({
          statusCode: 400,
          ok: false,
          error: 'RTB ID is required for Ringba. Get it from your Ringba publisher RTB endpoint URL (the segment before ".json").'
        });
      }
      url = `https://rtb.ringba.com/v1/production/${rtbId}.json`;
      headers = {
        'Content-Type': 'application/json'
      };
      body = { CID: phone, State: state, ZipCode: zip, exposeCallerId: 'yes' };
      break;

    case 'retreaver':
      if (!apiKey) {
        return res.status(400).json({
          statusCode: 400,
          ok: false,
          error: 'API Key (Retreaver postback key) is required.'
        });
      }
      if (!rtbId) {
        return res.status(400).json({
          statusCode: 400,
          ok: false,
          error: 'Publisher ID is required for Retreaver.'
        });
      }
      // Retreaver expects the postback key as a URL query param, not in the body.
      url = `https://rtb.retreaver.com/rtbs.json?key=${encodeURIComponent(apiKey)}`;
      headers = {
        'Content-Type': 'application/json'
      };
      body = { publisher_id: rtbId, caller_number: phone, caller_zip: zip, caller_state: state };
      break;

    case 'callgrid':
      if (!rtbId) {
        return res.status(400).json({
          statusCode: 400,
          ok: false,
          error: 'Grid ID is required for CallGrid. It comes from your CallGrid buyer and forms part of the URL.'
        });
      }
      // CallGrid's identity is the Grid ID in the URL path — no key/token needed.
      url = `https://bid.callgrid.com/api/bid/${rtbId}`;
      headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      body = { CallerId: phone, InboundStateCode: state, InboundZipCode: zip };
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
