const analysisRepo = require('../repositories/analysis.repository');

async function analyze({ prompt, analysisId, userId }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('API_NOT_CONFIGURED'), { status: 500 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(err?.error?.message || 'Lỗi API'),
      { status: response.status }
    );
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  if (analysisId) {
    await analysisRepo.updateAiAnalysis(analysisId, userId, text).catch(() => {});
  }

  return { text };
}

module.exports = { analyze };
