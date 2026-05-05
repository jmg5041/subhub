import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.substitutes.us'

const client = accountSid && authToken ? twilio(accountSid, authToken) : null

// Normalize to E.164 format (+1XXXXXXXXXX for US numbers)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!client || !fromNumber) {
    console.log(`[SMS] To: ${to}`)
    console.log(`[SMS] ${body}`)
    return
  }

  try {
    const normalized = normalizePhone(to)
    await client.messages.create({ body, from: fromNumber, to: normalized })
    console.log(`[SMS] Sent to ${normalized}`)
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send to ${to}:`, err)
  }
}

export async function makeVoiceCall(to: string, token: string): Promise<void> {
  if (!client || !fromNumber) {
    console.log(`[CALL] Would call: ${to} with token ${token}`)
    return
  }

  try {
    const normalized = normalizePhone(to)
    await client.calls.create({
      url: `${appUrl}/api/twilio/voice/${token}`,
      from: fromNumber,
      to: normalized,
    })
    console.log(`[CALL] Initiated to ${normalized}`)
  } catch (err) {
    console.error(`[CALL ERROR] Failed to call ${to}:`, err)
  }
}
