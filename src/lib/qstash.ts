import { Client, Receiver } from '@upstash/qstash'

// QStash client — used by the dispatcher to publish messages
export const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! })

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

/**
 * Reads and verifies an incoming QStash request.
 * In production: validates the QStash signature (cryptographic proof the message came from QStash).
 * In development: falls back to CRON_SECRET bearer token so you can test blast endpoints directly.
 * Returns the parsed JSON body.
 */
export async function verifyQStashRequest(req: Request): Promise<{ orgId: string }> {
  const body = await req.text()

  if (process.env.NODE_ENV === 'production') {
    const signature = req.headers.get('Upstash-Signature') ?? ''
    const isValid = await receiver.verify({ signature, body, url: req.url })
    if (!isValid) throw new Error('Invalid QStash signature')
  } else {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new Error('Unauthorized')
    }
  }

  return JSON.parse(body) as { orgId: string }
}
