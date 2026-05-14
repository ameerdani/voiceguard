import { useCallback, useState } from 'react';
import { Upload, FileAudio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  isAnalyzing: boolean;
}

export const AudioUploader = ({ onFileSelect, isAnalyzing }: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'audio/wav' || file.type === 'audio/mpeg' || file.type === 'audio/mp3')) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleAnalyze = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-300",
          "bg-card/50 backdrop-blur-sm",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border/50 hover:border-primary/50",
          selectedFile && "border-primary/30"
        )}
      >
        {/* Scan line effect when dragging */}
        {isDragging && <div className="scan-line" />}
        
        <div className="p-8 sm:p-12">
          {!selectedFile ? (
            <label className="flex flex-col items-center cursor-pointer">
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300",
                "bg-primary/10 border border-primary/20",
                isDragging && "bg-primary/20 scale-110"
              )}>
                <Upload className={cn(
                  "w-10 h-10 text-primary transition-transform duration-300",
                  isDragging && "animate-bounce"
                )} />
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Drop your audio file here
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                or click to browse from your device
              </p>
              <p className="text-sm text-muted-foreground/70 font-mono">
                Supported formats: .wav, .mp3
              </p>
              
              <input
                type="file"
                accept=".wav,.mp3,audio/wav,audio/mpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border/50 mb-6">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={isAnalyzing}
                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <Button
                variant="cyber"
                size="xl"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full sm:w-auto min-w-[200px]"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileAudio className="w-5 h-5" />
                    Analyze Audio
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
