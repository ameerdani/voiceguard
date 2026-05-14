import { Shield, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Header = () => {
  return (
    <header className="w-full border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">VoiceGuard</h1>
            <p className="text-xs text-muted-foreground font-mono">Deepfake Detection</p>
          </div>
        </div>
        
        <Button variant="ghost" size="icon" asChild>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </Button>
      </div>
    </header>
  );
};
