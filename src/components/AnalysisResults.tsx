import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, TrendingUp, Activity, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpectrogramVisualization } from './SpectrogramVisualization';

interface AnalysisResult {
  classification: 'real' | 'fake';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface AnalysisResultsProps {
  result: AnalysisResult;
  audioFile: File;
}

export const AnalysisResults = ({ result, audioFile }: AnalysisResultsProps) => {
  const { classification, confidence, riskLevel } = result;
  
  const isReal = classification === 'real';
  const probFake = isReal ? 1 - confidence : confidence;
  
  // Color coding: green=authentic, yellow=unsure(medium), red=deepfake
  const resultConfig = {
    low: {
      label: 'Low Risk',
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      icon: ShieldCheck,
      glow: 'glow-success',
      cardBorder: 'border-success/30',
      resultTitle: 'AUTHENTIC',
      resultDesc: 'This audio appears to be a genuine human voice recording.',
    },
    medium: {
      label: 'Medium Risk',
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      icon: AlertTriangle,
      glow: 'glow-warning',
      cardBorder: 'border-warning/30',
      resultTitle: 'INCONCLUSIVE',
      resultDesc: 'There is not enough evidence to definitively determine whether this audio is authentic or deepfake. Further analysis may be needed.',
    },
    high: {
      label: 'High Risk',
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      icon: ShieldAlert,
      glow: 'glow-destructive',
      cardBorder: 'border-destructive/30',
      resultTitle: 'DEEPFAKE DETECTED',
      resultDesc: 'This audio shows characteristics of synthetic voice generation.',
    },
  };
  
  const config = resultConfig[riskLevel];
  const RiskIcon = config.icon;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Main Result Card */}
      <div className={cn(
        "glass-card p-8 relative overflow-hidden",
        config.cardBorder
      )}>
        {/* Background glow effect */}
        <div className={cn(
          "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20",
          riskLevel === 'low' ? "bg-success" : riskLevel === 'medium' ? "bg-warning" : "bg-destructive"
        )} />
        
        <div className="relative">
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
            <div className={cn(
              "w-24 h-24 rounded-2xl flex items-center justify-center",
              config.bg,
              config.glow
            )}>
              <RiskIcon className={cn("w-12 h-12", config.color)} />
            </div>
            
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider mb-1">
                Classification Result
              </p>
              <h2 className={cn(
                "text-4xl sm:text-5xl font-bold",
                config.color
              )}>
                {config.resultTitle}
              </h2>
              <p className="text-muted-foreground mt-2">
                {config.resultDesc}
              </p>
            </div>
          </div>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Confidence Score */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Confidence Score</span>
              </div>
              <p className="text-3xl font-bold font-mono text-foreground">
                {(confidence * 100).toFixed(1)}%
              </p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000 rounded-full",
                    riskLevel === 'low' ? "bg-success" : riskLevel === 'medium' ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The confidence score shows how certain the model is about its classification — higher means more confident.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Risk Level */}
            <div className={cn(
              "p-4 rounded-xl border",
              config.bg,
              config.border
            )}>
              <div className="flex items-center gap-2 mb-2">
                <RiskIcon className={cn("w-4 h-4", config.color)} />
                <span className="text-sm text-muted-foreground">Risk Level</span>
              </div>
              <p className={cn("text-3xl font-bold", config.color)}>
                {config.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                P(fake) = {probFake.toFixed(3)}
              </p>
              <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/80">P(fake)</strong> is the model's estimated probability (0–1) that the audio is a deepfake, where values closer to 1 mean more likely fake.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Detection Model */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Model</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                CNN Classifier
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                Mel-Spectrogram Input
              </p>
              <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-start gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A <strong className="text-foreground/80">CNN</strong> analyses the <strong className="text-foreground/80">Mel-spectrogram</strong> (audio as an image of frequency over time) to detect subtle synthesis artefacts, an approach proven effective on benchmarks like ASVspoof.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Spectrogram Visualization */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Mel-Spectrogram Analysis
        </h3>
        <SpectrogramVisualization audioFile={audioFile} />
        <p className="text-sm text-muted-foreground mt-4">
          Visual representation of the audio's frequency content over time. 
          Deepfake voices often exhibit unnatural spectral patterns and artifacts.
        </p>
      </div>
      
      {/* Technical Details */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Analysis Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">File Name</p>
            <p className="font-mono text-foreground truncate">{audioFile.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Sample Rate</p>
            <p className="font-mono text-foreground">16,000 Hz</p>
          </div>
          <div>
            <p className="text-muted-foreground">Features</p>
            <p className="font-mono text-foreground">64 Mel bins</p>
          </div>
          <div>
            <p className="text-muted-foreground">Model Accuracy</p>
            <p className="font-mono text-foreground">95.2%</p>
          </div>
        </div>
      </div>
    </div>
  );
};
