import { Shield, Phone, AlertTriangle, Zap } from 'lucide-react';

export const HeroSection = () => {
  const features = [
    { icon: Shield, label: 'CNN-Based Detection', desc: 'Deep learning model trained on deepfake datasets' },
    { icon: Zap, label: 'Instant Analysis', desc: 'Real-time audio preprocessing and classification' },
    { icon: AlertTriangle, label: 'Risk Assessment', desc: 'Low, Medium, High risk level scoring' },
  ];

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Phone className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Phone Call Scam Protection</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Detect <span className="text-gradient-primary">Deepfake Voices</span> Before They Deceive
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advanced AI-powered audio forensics to identify synthetic voices in phone call recordings. 
            Protect yourself from voice cloning scams with our CNN-based detection system.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={feature.label}
              className="glass-card p-6 text-center animate-fade-in"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.label}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
