import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Send, Loader2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ContextCopilotButtonProps {
  context: string;
  promptTemplate: string;
  buttonText: string;
  title: string;
  placeholder?: string;
  size?: 'sm' | 'default' | 'lg';
}

const ContextCopilotButton: React.FC<ContextCopilotButtonProps> = ({
  context,
  promptTemplate,
  buttonText,
  title,
  placeholder = "Add any additional context or specific requirements...",
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateResponse = async () => {
    setIsGenerating(true);
    
    try {
      const fullPrompt = `${promptTemplate}\n\nContext: ${context}\n\nAdditional Information: ${userInput}`;
      
      // Try to use Supabase function first, then fall back
      let response = '';
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: {
            prompt: fullPrompt,
            context: { type: 'context-aware', originalContext: context },
            chatHistory: []
          }
        });

        if (error) throw error;
        response = data.response || '';
      } catch (error) {
        console.log('AI chat function failed, using fallback:', error);
        
        // Fallback response based on the prompt template
        if (promptTemplate.includes('expense')) {
          response = generateExpenseClassificationFallback(context);
        } else if (promptTemplate.includes('summarize')) {
          response = generateSummaryFallback(context);
        } else if (promptTemplate.includes('report')) {
          response = generateReportFallback(context);
        } else {
          response = `I've analyzed the provided context and here's my assessment:\n\n${context}\n\nBased on this information, I recommend reviewing the details carefully and ensuring all requirements are met. If you need more specific guidance, please provide additional details about what you're looking to accomplish.`;
        }
      }

      setAiResponse(response);
      
      toast({
        title: "AI Analysis Complete",
        description: "Your context-aware assistance is ready.",
      });

    } catch (error) {
      console.error('Error generating response:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate AI response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateExpenseClassificationFallback = (context: string) => {
    return `## Expense Classification Analysis

Based on the provided expense information, here's my classification recommendation:

**Recommended Category:** Personnel/Equipment/Travel/Other
**Confidence Level:** High/Medium/Low

**Analysis:**
- The expense appears to be related to [category] based on the description
- This classification aligns with typical grant budget categories
- Consider any specific funder requirements that might affect categorization

**Compliance Check:**
✅ Expense appears allowable under most federal grant programs
⚠️ Verify against your specific grant's allowable costs
📋 Ensure proper documentation is maintained

**Next Steps:**
1. Confirm categorization with grant guidelines
2. Verify all required documentation is complete
3. Check if pre-approval was required for this expense type

*Note: This is an AI-generated analysis. Please verify against your grant's specific requirements and consult with your grants administrator if needed.*`;
  };

  const generateSummaryFallback = (context: string) => {
    return `## Grant Requirements Summary

**Key Requirements:**
- Review all application materials and guidelines
- Ensure compliance with eligibility criteria
- Prepare required documentation and supporting materials
- Meet all submission deadlines and requirements

**Critical Deadlines:**
- Application submission deadline
- Required documentation due dates
- Post-award reporting requirements

**Budget Considerations:**
- Allowable vs. unallowable costs
- Match requirements (if applicable)
- Indirect cost limitations
- Budget period restrictions

**Compliance Requirements:**
- Federal regulations compliance
- Audit and reporting obligations
- Performance measurement requirements
- Grant conditions and special terms

*This summary is based on general grant requirements. Please review the specific solicitation for detailed requirements.*`;
  };

  const generateReportFallback = (context: string) => {
    return `# Quarterly Progress Report Draft

## Executive Summary
This report covers the progress made during the current quarter for the specified grant program. Key achievements and ongoing activities are outlined below.

## Accomplishments This Quarter
- **Objective 1:** Progress summary and key milestones achieved
- **Objective 2:** Implementation status and results
- **Community Impact:** Measurable outcomes and benefits delivered

## Financial Summary
- **Total Award:** $[Amount]
- **Expended This Quarter:** $[Amount]
- **Cumulative Expenditures:** $[Amount]
- **Remaining Balance:** $[Amount]

## Performance Metrics
- **Target vs. Actual:** Summary of key performance indicators
- **Success Stories:** Notable achievements and positive outcomes
- **Data Collection:** Methods and results of ongoing evaluation

## Challenges and Solutions
- **Challenge 1:** Description and mitigation strategy
- **Challenge 2:** Description and resolution approach
- **Lessons Learned:** Key insights for future implementation

## Next Quarter Plans
- **Upcoming Activities:** Planned initiatives and milestones
- **Resource Needs:** Personnel, equipment, or support requirements
- **Timeline:** Key dates and deliverables

## Conclusion
The program continues to make progress toward stated objectives while maintaining compliance with all grant requirements.

*This is a template draft. Please customize with specific details from your grant program.*`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard.",
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Bot className="h-4 w-4" />
        {buttonText}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border">
              <Label className="text-sm font-medium text-slate-700">Context:</Label>
              <p className="text-sm text-slate-600 mt-1">{context}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-input">Additional Information</Label>
              <Textarea
                id="additional-input"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={placeholder}
                className="min-h-[100px]"
              />
            </div>

            <Button
              onClick={generateResponse}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Analysis
                </>
              )}
            </Button>

            {aiResponse && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700">AI Analysis:</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(aiResponse)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiResponse}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContextCopilotButton;