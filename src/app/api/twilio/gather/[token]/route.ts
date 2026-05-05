import { NextRequest, NextResponse } from 'next/server'
import { performAcceptJob, performDeclineJob } from '@/lib/sub-job-logic'

function twiml(text: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${text}</Say></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await req.formData()
  const digits = body.get('Digits') as string

  if (digits === '1') {
    const result = await performAcceptJob(token)
    if ('success' in result) {
      return twiml('Thank you! You are confirmed for this substitute position. You should receive a confirmation email shortly. Goodbye!')
    }
    if (result.alreadyFilled) {
      return twiml('Sorry, this position has already been filled by another substitute. Thank you for your interest. Goodbye.')
    }
    return twiml('We were unable to process your acceptance. Please check your email for the accept link. Goodbye.')
  }

  if (digits === '2') {
    await performDeclineJob(token)
    return twiml('Thank you. We will reach out to other substitutes. Goodbye.')
  }

  return twiml('We did not understand your selection. Please check your email for the accept and decline links. Goodbye.')
}
