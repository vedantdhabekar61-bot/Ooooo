import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { toFile } from 'openai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const openai = getOpenAI();

    // Convert Blob to a format OpenAI SDK likes using toFile helper
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const file = await toFile(buffer, 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: unknown) {
    console.error('Transcription error:', error);
    
    let errorMessage = 'Transcription failed';
    let statusCode = 500;

    // Safely type-guard the error to access its properties
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check if it's an API error with a status code attached
      if ('status' in error && typeof error.status === 'number') {
        statusCode = error.status;
        if (error.status === 401) {
          errorMessage = 'Invalid OpenAI API Key. Please check your Secrets.';
        }
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
