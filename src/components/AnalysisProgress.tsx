import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisStep {
  id: string;
  label: string;
  description: string;
}

const analysisSteps: AnalysisStep[] = [
  { id: 'preprocess', label: 'Preprocessing', description: 'Resampling, mono conversion, silence trimming' },
  { id: 'normalize', label: 'Normalization', description: 'Loudness normalization & fixed duration' },
  { id: 'extract', label: 'Feature Extraction', description: 'Computing log-Mel spectrogram features' },
  { id: 'classify', label: 'Classification', description: 'Running CNN deepfake detection model' },
  { id: 'finalize', label: 'Finalizing', description: 'Calculating confidence & risk level' },
];

interface AnalysisProgressProps {
  isAnalyzing: boolean;
  onComplete: () => void;
}

export const AnalysisProgress = ({ isAnalyzing, onComplete }: AnalysisProgressProps) => {
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStep(-1);
      setCompletedSteps([]);
      return;
    }

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < analysisSteps.length) {
        setCurrentStep(stepIndex);
        
        if (stepIndex > 0) {
          setCompletedSteps(prev => [...prev, analysisSteps[stepIndex - 1].id]);
        }
        
        stepIndex++;
      } else {
        setCompletedSteps(prev => [...prev, analysisSteps[analysisSteps.length - 1].id]);
        clearInterval(interval);
        setTimeout(onComplete, 500);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isAnalyzing, onComplete]);

  if (!isAnalyzing && completedSteps.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-card p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Analysis in Progress
        </h3>
        
        <div className="space-y-4">
          {analysisSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === index;
            const isPending = currentStep < index;
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl transition-all duration-300",
                  isCompleted && "bg-success/5 border border-success/20",
                  isCurrent && "bg-primary/5 border border-primary/20",
                  isPending && "opacity-40"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300",
                  isCompleted && "bg-success/20 text-success",
                  isCurrent && "bg-primary/20 text-primary",
                  isPending && "bg-muted text-muted-foreground"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-sm font-mono">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={cn(
                    "font-medium transition-colors duration-300",
                    isCompleted && "text-success",
                    isCurrent && "text-primary",
                    isPending && "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Progress bar */}
        <div className="mt-6 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out animate-progress-flow"
            style={{ 
              width: `${((completedSteps.length) / analysisSteps.length) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
};
