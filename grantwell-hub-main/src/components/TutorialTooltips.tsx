import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ArrowRight, ArrowLeft, Target, HelpCircle } from 'lucide-react';

interface TooltipStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

const tutorialSteps: TooltipStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard"]',
    title: 'Welcome to Grant Manager! 👋',
    content: 'This is your central hub for managing all grant activities. Let\'s take a quick tour!',
    position: 'bottom'
  },
  {
    id: 'grants-overview',
    target: '[data-tour="grants-grid"]',
    title: 'Your Grants',
    content: 'Here you can see all your active grants. Click on any grant to view details, track progress, and manage documents.',
    position: 'top',
    action: 'Click here to explore open grants'
  },
  {
    id: 'budget-tracking',
    target: '[data-tour="budget-summary"]',
    title: 'Budget Tracking 💰',
    content: 'Monitor your grant finances here. Track expenses, view remaining funds, and ensure compliance with budget requirements.',
    position: 'bottom',
    action: 'Track your budget here'
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Stay Updated 📢',
    content: 'Get alerts for deadlines, missing documents, and important updates. Configure your notification preferences in Settings.',
    position: 'left'
  },
  {
    id: 'discover-grants',
    target: '[data-tour="discover-grants"]',
    title: 'Discover New Opportunities 🔍',
    content: 'Find new grant opportunities that match your organization\'s needs. Our AI helps identify the best matches.',
    position: 'bottom'
  },
  {
    id: 'ai-assistance',
    target: '[data-tour="ai-features"]',
    title: 'AI-Powered Tools 🤖',
    content: 'Use our AI assistant to generate narratives, get suggestions, and streamline your grant management workflow.',
    position: 'top'
  }
];

interface TutorialTooltipsProps {
  onComplete?: () => void;
}

const TutorialTooltips: React.FC<TutorialTooltipsProps> = ({ onComplete }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  useEffect(() => {
    // Check if user has seen tutorial before
    const seenTutorial = localStorage.getItem('grant-manager-tutorial-seen');
    if (!seenTutorial) {
      // Show tutorial after a short delay for first-time users
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setHasSeenTutorial(true);
    }
  }, []);

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTutorial = () => {
    setIsActive(false);
    localStorage.setItem('grant-manager-tutorial-seen', 'true');
    setHasSeenTutorial(true);
    onComplete?.();
  };

  const restartTutorial = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const getCurrentStepElement = () => {
    const step = tutorialSteps[currentStep];
    const element = document.querySelector(step.target);
    return element;
  };

  const getTooltipPosition = () => {
    const element = getCurrentStepElement();
    if (!element) return { top: 0, left: 0 };

    const rect = element.getBoundingClientRect();
    const step = tutorialSteps[currentStep];
    
    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - 20;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 20;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 20;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 20;
        break;
    }

    return { top, left };
  };

  if (!isActive && hasSeenTutorial) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={restartTutorial}
        className="fixed bottom-4 right-4 z-50 bg-white border-blue-600 text-blue-600 hover:bg-blue-50"
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        Help
      </Button>
    );
  }

  if (!isActive) return null;

  const step = tutorialSteps[currentStep];
  const element = getCurrentStepElement();
  
  if (!element) {
    // If target element is not found, skip to next step
    setTimeout(nextStep, 100);
    return null;
  }

  const position = getTooltipPosition();

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Highlight the target element */}
      <div
        className="fixed border-4 border-blue-500 rounded-lg z-50 pointer-events-none animate-pulse"
        style={{
          top: element.getBoundingClientRect().top - 4,
          left: element.getBoundingClientRect().left - 4,
          width: element.getBoundingClientRect().width + 8,
          height: element.getBoundingClientRect().height + 8,
        }}
      />

      {/* Tooltip */}
      <Card
        className="fixed z-50 max-w-sm animate-fade-in"
        style={{
          top: position.top,
          left: position.left,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={completeTutorial}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <p className="text-sm text-slate-600 mb-3">{step.content}</p>
          
          {step.action && (
            <Badge variant="outline" className="mb-3 text-xs">
              💡 {step.action}
            </Badge>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full ${
                    index === currentStep 
                      ? 'bg-blue-600' 
                      : index < currentStep 
                      ? 'bg-green-600' 
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Back
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={nextStep}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {currentStep === tutorialSteps.length - 1 ? (
                  'Finish'
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-slate-500 mt-2 text-center">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default TutorialTooltips;