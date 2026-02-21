'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X, Check, Edit2, Mic, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Note {
  id: string;
  content: string;
  createdAt: number;
}

// --- Voice Waveform Component ---
function VoiceWaveform() {
  const heights = [20, 35, 25, 40, 30, 45, 20, 30];
  return (
    <div className="flex items-center gap-1.5 h-10">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          animate={{
            height: [10, h, 10],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut"
          }}
          className="w-1.5 bg-white rounded-full opacity-80"
        />
      ))}
    </div>
  );
}

export default function NoteApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Voice States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // FIX 1: Correct TypeScript typing for browser intervals
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');

  // Load notes from local storage
  useEffect(() => {
    const savedNotes = localStorage.getItem('brutalist-notes');
    if (savedNotes) {
      try {
        const parsed = JSON.parse(savedNotes);
        if (Array.isArray(parsed)) {
          setNotes(parsed);
        }
      } catch (e) {
        console.error('Failed to parse notes', e);
      }
    }
  }, []);

  // Save notes to local storage
  useEffect(() => {
    localStorage.setItem('brutalist-notes', JSON.stringify(notes));
  }, [notes]);

  const addNote = (content?: string) => {
    const finalContent = content || newNoteContent;
    if (!finalContent.trim()) return;

    const newNote: Note = {
      id: crypto.randomUUID(),
      content: finalContent,
      createdAt: Date.now(),
    };

    // FIX 2: Functional state update prevents stale data bugs
    setNotes((prev) => [newNote, ...prev]);
    setNewNoteContent('');
    setIsAdding(false);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setNotes(
      notes.map((note) =>
        note.id === editingId ? { ...note, content: editContent } : note
      )
    );
    setEditingId(null);
  };

  // --- Voice Logic ---
  const startRecording = async (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    setIsRecording(true);
    setVoiceError(null);
    setRecordingTime(0);
    
    const now = Date.now();
    startTimeRef.current = now;

    if ('vibrate' in navigator) navigator.vibrate(40);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError("Microphone not supported.");
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // FIX 3: Dynamic MIME type support for Safari/iOS compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        await handleTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          // Optional: Auto-stop after 30 seconds
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: unknown) {
      console.error("Mic error:", err);
      setVoiceError("Permission denied.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    
    const duration = Date.now() - startTimeRef.current;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]); // Success pattern

    // If tap was too short, don't process
    if (duration < 300) {
      setVoiceError("Hold to record");
      setTimeout(() => setVoiceError(null), 2000);
    }
  };

  const handleTranscription = async (blob: Blob) => {
    if (blob.size < 1000) return;
    
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm'); // OpenAI accepts webm file names even if blob is mp4

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      const text = data.text?.trim();
      
      if (text) {
        addNote(text);
      } else {
        setVoiceError("Couldn't hear clearly");
        setTimeout(() => setVoiceError(null), 3000);
      }
      setIsProcessing(false);
    } catch (err) {
      console.error("Transcription error:", err);
      setVoiceError("Processing failed");
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 pb-40">
      <div className="relative w-full max-w-2xl mt-12 mb-20">
        
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-[#E6B3A3] border-[3px] border-black px-10 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-sm">
            <h1 className="font-mono font-bold text-lg tracking-widest uppercase">
              Notes
            </h1>
          </div>
        </div>

        <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[70vh] p-6 md:p-10 relative">
          
          <button
            onClick={() => setIsAdding(true)}
            className="absolute -bottom-6 -right-6 bg-black text-white p-4 rounded-full shadow-[4px_4px_0px_0px_rgba(230,179,163,1)] hover:-translate-y-1 hover:-translate-x-1 transition-transform active:translate-y-0 active:translate-x-0 group z-10"
            title="Add Note"
          >
            <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
          </button>

          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mb-8 border-[3px] border-black p-4 bg-[#F5F2ED] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <textarea
                  autoFocus
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Write something..."
                  className="w-full bg-transparent border-none outline-none resize-none font-sans text-lg min-h-[100px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) addNote();
                  }}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="p-2 border-2 border-black hover:bg-red-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => addNote()}
                    className="p-2 border-2 border-black bg-black text-white hover:bg-gray-800 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {notes.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
                <p className="font-mono text-xl">No notes yet.</p>
                <p className="text-sm mt-2">Click the + to start writing.</p>
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {notes.map((note) => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative border-b-2 border-black/10 pb-4 last:border-0"
                >
                  {editingId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-[#F5F2ED] border-2 border-black p-2 outline-none resize-none font-sans text-lg min-h-[80px]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 border border-black hover:bg-gray-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={saveEdit}
                          className="p-1 border border-black bg-black text-white"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg leading-relaxed whitespace-pre-wrap font-sans">
                        {note.content}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] font-mono opacity-40 uppercase tracking-tighter">
                          {new Date(note.createdAt).toLocaleDateString()} • {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(note)}
                            className="p-1 hover:bg-black hover:text-white border border-transparent hover:border-black transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="p-1 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 z-50 w-full max-w-md px-4">
        
        <AnimatePresence>
          {(isRecording || isProcessing || voiceError) && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              className="bg-black text-white px-8 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center gap-3 border-2 border-[#E6B3A3] w-full"
            >
              {isRecording && (
                <>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="font-mono text-sm font-bold tracking-widest">बोलिए... / SPEAKING...</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-[#E6B3A3]">{recordingTime}s</span>
                  </div>
                  <VoiceWaveform />
                  <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">Auto-detecting Hindi/English</p>
                </>
              )}
              {isProcessing && (
                <div className="flex items-center gap-4 py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#E6B3A3]" />
                  <span className="font-mono text-sm font-bold tracking-widest">PROCESSING INSTANTLY...</span>
                </div>
              )}
              {voiceError && (
                <div className="flex items-center justify-between w-full py-2">
                  <span className="font-mono text-sm text-red-400 font-bold uppercase">{voiceError}</span>
                  <button 
                    onClick={() => setVoiceError(null)}
                    className="text-[10px] font-mono border border-white/20 px-2 py-1 rounded hover:bg-white/10"
                  >
                    DISMISS
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 0.2 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute inset-0 bg-red-500 rounded-full blur-2xl"
              />
            )}
          </AnimatePresence>

          {/* FIX 4: Pointer events instead of touch/mouse events */}
          <motion.button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            whileTap={{ scale: 0.9 }}
            animate={isRecording ? { scale: 1.2 } : { scale: 1 }}
            className={`
              w-24 h-24 rounded-full flex items-center justify-center border-[4px] border-black transition-all duration-200 relative z-10
              ${isRecording ? 'bg-red-500' : 'bg-[#E6B3A3] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:shadow-none active:translate-x-1 active:translate-y-1'}
            `}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-12 h-12 animate-spin text-black" />
            ) : (
              <Mic className={`w-12 h-12 ${isRecording ? 'text-white' : 'text-black'}`} />
            )}
          </motion.button>
        </div>
        
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-40 font-bold">
          {isRecording ? 'Release to finish' : 'Hold to speak'}
        </p>
      </div>

      <footer className="mt-auto py-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50">
          Simple Brutalist Notes • {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
