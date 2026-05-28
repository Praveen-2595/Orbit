import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const FALLBACK_MODEL = 'claude-sonnet-4-5'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Set ANTHROPIC_API_KEY on the server.' },
      { status: 503 },
    )
  }

  let body: { system?: string; messages?: ChatMessage[] }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { system, messages } = body

  if (!system || typeof system !== 'string') {
    return NextResponse.json({ error: 'Missing system prompt' }, { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
  }

  const sanitizedMessages = messages
    .filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .slice(-20)

  if (sanitizedMessages.length === 0) {
    return NextResponse.json({ error: 'No valid messages' }, { status: 400 })
  }

  try {
    const MODEL = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL
    console.log("[ORBIT] Using model:", MODEL)

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: sanitizedMessages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : 'AI request failed'
      
      // If error suggests invalid model, try fallback
      if (errorMessage.includes('model') && MODEL !== FALLBACK_MODEL) {
        console.log("[ORBIT] Model failed, trying fallback:", FALLBACK_MODEL)
        
        const fallbackResponse = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: FALLBACK_MODEL,
            max_tokens: 1024,
            system,
            messages: sanitizedMessages,
          }),
        })

        const fallbackData = await fallbackResponse.json()

        if (fallbackResponse.ok) {
          const textBlock = Array.isArray(fallbackData.content)
            ? fallbackData.content.find(
                (block: { type?: string; text?: string }) =>
                  block?.type === 'text' && typeof block.text === 'string',
              )
            : null

          const message = textBlock?.text

          if (message) {
            console.log("[ORBIT] Fallback model succeeded")
            return NextResponse.json({ message, model: FALLBACK_MODEL })
          }
        }
      }
      
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    const textBlock = Array.isArray(data.content)
      ? data.content.find(
          (block: { type?: string; text?: string }) =>
            block?.type === 'text' && typeof block.text === 'string',
        )
      : null

    const message = textBlock?.text

    if (!message) {
      return NextResponse.json(
        { error: 'Unexpected response from AI provider' },
        { status: 502 },
      )
    }

    return NextResponse.json({ message, model: MODEL })
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach AI provider' },
      { status: 502 },
    )
  }
}
