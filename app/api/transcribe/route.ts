import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Get the form data sent from page.tsx
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 2. Prepare the payload for OpenAI
    // We package the blob into a new FormData object specifically for OpenAI
    const openAiFormData = new FormData();
    openAiFormData.append('file', file, 'audio.webm'); 
    openAiFormData.append('model', 'whisper-1');

    // 3. Call the OpenAI Whisper API directly
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAiFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);
      return NextResponse.json(
        { error: data.error?.message || 'Transcription failed at OpenAI' }, 
        { status: response.status }
      );
    }

    // 4. Return the transcribed text to the frontend
    return NextResponse.json({ text: data.text });

  } catch (error) {
    console.error('Server error during transcription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
