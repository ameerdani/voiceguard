import { useState, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { AudioUploader } from '@/components/AudioUploader';
import { AudioRecorder } from '@/components/AudioRecorder';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Upload, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isModelAvailable, predict, type Prediction } from '@/lib/deepfakeModel';
import { validateAudioFile } from '@/lib/security';
import { toast } from '@/hooks/use-toast';

interface AnalysisResult {
  classification: 'real' | 'fake';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload');
  const [resetKey, setResetKey] = useState(0);
  const predictionPromiseRef = useRef<Promise<Prediction | null> | null>(null);

  const runPrediction = useCallback(async (file: File): Promise<Prediction | null> => {
    const available = await isModelAvailable();
    if (!available) {
      toast({
        title: 'Trained CNN not deployed',
        description:
          'Running heuristic-only analysis. Drop a trained TF.js model into public/model/ for full CNN inference.',
      });
    }
    try {
      return await predict(file);
    } catch (err) {
      console.error('Prediction failed:', err);
      toast({
        title: 'Inference failed',
        description: err instanceof Error ? err.message : 'Could not analyse the audio.',
        variant: 'destructive',
      });
      return null;
    }
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const check = await validateAudioFile(file);
      if (!check.ok) {
        toast({
          title: 'File rejected',
          description: check.reason,
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setIsAnalyzing(true);
      setAnalysisComplete(false);
      setResult(null);
      predictionPromiseRef.current = runPrediction(file);
    },
    [runPrediction]
  );

  const handleAnalysisComplete = useCallback(async () => {
    const prediction = await (predictionPromiseRef.current ?? Promise.resolve(null));
    const probFake = prediction ? prediction.probFake : 0.5;

    const classification: 'real' | 'fake' = probFake >= 0.5 ? 'fake' : 'real';
    const confidence = probFake >= 0.5 ? probFake : 1 - probFake;

    let riskLevel: 'low' | 'medium' | 'high';
    if (probFake < 0.4) riskLevel = 'low';
    else if (probFake < 0.7) riskLevel = 'medium';
    else riskLevel = 'high';

    setResult({ classification, confidence, riskLevel });
    setIsAnalyzing(false);
    setAnalysisComplete(true);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setResult(null);
    setInputMode('upload');
    setResetKey((k) => k + 1);
    predictionPromiseRef.current = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        <HeroSection />
        
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            {!analysisComplete ? (
              <>
                {/* Mode Selector */}
                {!isAnalyzing && (
                  <div className="flex justify-center gap-4 mb-8">
                    <button
                      onClick={() => setInputMode('upload')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 border",
                        inputMode === 'upload'
                          ? "bg-primary/10 border-primary/50 text-primary"
                          : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      <Upload className="w-4 h-4" />
                      Upload Audio File
                    </button>
                    <button
                      onClick={() => setInputMode('record')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 border",
                        inputMode === 'record'
                          ? "bg-primary/10 border-primary/50 text-primary"
                          : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      <Mic className="w-4 h-4" />
                      Record Audio Live
                    </button>
                  </div>
                )}

                {inputMode === 'upload' ? (
                  <AudioUploader 
                    key={`upload-${resetKey}`}
                    onFileSelect={handleFileSelect}
                    isAnalyzing={isAnalyzing}
                  />
                ) : (
                  <AudioRecorder
                    key={`record-${resetKey}`}
                    onRecordingComplete={handleFileSelect}
                    isAnalyzing={isAnalyzing}
                  />
                )}
                
                {isAnalyzing && (
                  <div className="mt-8">
                    <AnalysisProgress 
                      isAnalyzing={isAnalyzing}
                      onComplete={handleAnalysisComplete}
                    />
                  </div>
                )}
              </>
            ) : result && selectedFile && (
              <div className="space-y-6">
                <AnalysisResults result={result} audioFile={selectedFile} />
                
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/40 text-primary font-medium hover:bg-primary/20 hover:border-primary transition-all duration-200 cursor-pointer"
                  >
                    ← Analyze another file
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        
        {/* Footer */}
        <footer className="py-8 border-t border-border/50">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Final Year Project — Bachelor of Information Technology (Hons) in Computer System Security
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Universiti Kuala Lumpur · 2026
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
