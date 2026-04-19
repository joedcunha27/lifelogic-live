
export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({error: 'no key'})
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(req.body)
  })
  const t = await r.text()
  res.setHeader('content-type', 'application/json')
  return res.status(r.status).send(t)
}
