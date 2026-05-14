import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  isAnalyzing: boolean;
}

export const AudioRecorder = ({ onRecordingComplete, isAnalyzing }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        onRecordingComplete(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      console.error('Microphone access denied');
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-card p-8 sm:p-12 text-center">
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-300",
          isRecording
            ? "bg-destructive/20 border-2 border-destructive/50 animate-pulse"
            : "bg-primary/10 border border-primary/20"
        )}>
          {isRecording ? (
            <Mic className="w-10 h-10 text-destructive" />
          ) : (
            <Mic className="w-10 h-10 text-primary" />
          )}
        </div>

        {isRecording && (
          <p className="text-3xl font-mono font-bold text-foreground mb-4">
            {formatTime(recordingTime)}
          </p>
        )}

        <h3 className="text-xl font-semibold text-foreground mb-2">
          {isRecording ? 'Recording in progress...' : 'Record audio from your microphone'}
        </h3>
        <p className="text-muted-foreground mb-6">
          {isRecording
            ? 'Click stop when you\'re done recording'
            : 'Click the button below to start recording live audio for analysis'}
        </p>

        {!isRecording ? (
          <Button
            variant="cyber"
            size="xl"
            onClick={startRecording}
            disabled={isAnalyzing}
            className="min-w-[200px]"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Recording
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="xl"
            onClick={stopRecording}
            className="min-w-[200px]"
          >
            <Square className="w-5 h-5" />
            Stop & Analyze
          </Button>
        )}
      </div>
    </div>
  );
};
