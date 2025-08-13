import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  FileText, 
  BookOpen, 
  CheckCircle, 
  ArrowRight, 
  Lightbulb, 
  Target, 
  Users,
  Send,
  Wand2,
  MessageSquare,
  Copy,
  Download,
  Loader2,
  Sparkles
} from 'lucide-react';
import AITemplateVault from '@/components/AITemplateVault';
import { NarrativeAssistant } from '@/components/NarrativeAssistant';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CopilotPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('narrative');
  const [userInput, setUserInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [grantContext, setGrantContext] = useState<any>({
    grantType: '',
    organization: '',
    requestAmount: '',
    purpose: ''
  });
  const { toast } = useToast();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when chat history changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Handle incoming template data from router state
  useEffect(() => {
    const templateData = location.state?.templateData;
    if (templateData) {
      // Pre-fill the copilot with template content
      setUserInput(`Please help me write a ${templateData.title} for ${templateData.agency}. Here's what I need to include: ${templateData.description}`);
      setGrantContext({
        grantType: templateData.id,
        title: templateData.title,
        agency: templateData.agency,
        description: templateData.description,
        difficulty: templateData.difficulty
      });
      
      // Clear the router state to prevent re-triggering
      window.history.replaceState({}, document.title);
      
      toast({
        title: "Template Loaded",
        description: `Ready to help with ${templateData.title}`,
      });
    }
  }, [location.state, toast]);

  const handleStartWriting = async (templateId: string) => {
    setIsNavigating(true);
    
    // Find the template type
    const template = narrativeTypes.find(t => t.id === templateId);
    if (template) {
      toast({
        title: "Loading Template",
        description: `Opening ${template.title}...`,
      });
      
      // Small delay to show loading state, then navigate
      setTimeout(() => {
        navigate('/copilot', {
          state: {
            templateData: template
          }
        });
        setIsNavigating(false); // Reset loading state after navigation
      }, 500);
    } else {
      setIsNavigating(false);
      toast({
        title: "Template Not Found",
        description: "Unable to load the selected template.",
        variant: "destructive"
      });
    }
  };

  // Reset navigation state when component unmounts
  useEffect(() => {
    return () => {
      setIsNavigating(false);
    };
  }, []);

  const generateAIResponse = async () => {
    if (!userInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter your question or text for AI assistance.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Add user message to chat history (persist full history)
      const newChatHistory = [...chatHistory, { role: 'user' as const, content: userInput }];
      setChatHistory(newChatHistory);

      // Try to use Supabase function first, then fall back to client-side generation
      let response = '';
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: {
            prompt: userInput,
            context: grantContext,
            chatHistory: newChatHistory
          }
        });

        if (error) throw error;
        response = data.response || '';
      } catch (error) {
        console.log('AI chat function failed, using fallback:', error);
        
        // Fallback AI-style response generation
        response = generateFallbackResponse(userInput, grantContext);
      }

      // Add AI response to chat history
      setChatHistory([...newChatHistory, { role: 'assistant', content: response }]);
      setAiResponse(response);
      setUserInput(''); // Clear input after sending

      toast({
        title: "AI Response Generated",
        description: "Your grant writing assistance is ready.",
      });

    } catch (error) {
      console.error('Error generating AI response:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate AI response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackResponse = (input: string, context: any) => {
    const inputLower = input.toLowerCase();
    
    // Conversational openers
    if (inputLower.includes('hello') || inputLower.includes('hi') || inputLower.includes('hey')) {
      return `Hello! 👋 I'm your AI grant writing expert, and I'm excited to help you succeed with your grant applications! 

**I Can Help You With:**
- Writing compelling narratives and needs statements
- Developing realistic budgets and justifications  
- Creating SMART objectives and measurable outcomes
- Understanding funder requirements and priorities
- Reviewing and improving existing content
- Grant strategy and deadline management

**What's On Your Mind Today?**
Feel free to ask me anything - whether you're just starting out, stuck on a section, or want me to review something you've written. I'm here to make grant writing easier and more successful for you!

What would you like to work on first?`;
    }

    // Grant writing specific responses with more conversational tone
    if (inputLower.includes('need') || inputLower.includes('problem') || inputLower.includes('statement')) {
      return `Great question! The needs statement is absolutely crucial - it's where you convince funders that your community truly needs their support. Let me help you craft something compelling:

**🎯 The Perfect Needs Statement Formula:**

**1. Start With Impact:** "Our community faces [specific challenge] that directly impacts [number] residents..."

**2. Use Data That Tells a Story:**
- Recent crime statistics that show trends
- Specific gaps in services or resources  
- Community feedback or survey results
- Comparison to state/national averages

**3. Connect to Real Consequences:**
- How does this problem affect daily life?
- What happens if nothing changes?
- Who is most vulnerable?

**✨ Pro Tips from My Experience:**
- Lead with your strongest statistic
- Use local data whenever possible
- Include quotes from community members if you have them
- Keep it factual but don't be afraid to show the human impact

**Want me to help you with a specific part?** For example:
- "Help me find the right statistics for [your issue]"
- "Review this draft needs statement: [paste it here]"
- "How do I make this more compelling?"

What aspect of your needs statement would you like to tackle first?`;
    }

    if (inputLower.includes('budget') || inputLower.includes('cost') || inputLower.includes('money') || inputLower.includes('funding')) {
      return `Ah, the budget section - where many great proposals either shine or stumble! Don't worry, I'll help you create a budget that makes funders confident in your financial planning:

**💰 Budget Strategy That Works:**

**1. Start With Your Goals, Then Price Them:**
- What exactly do you want to accomplish?
- What resources (people, equipment, training) do you need?
- How much will each component realistically cost?

**2. The "Goldilocks" Budget:**
- Not too high (looks wasteful)
- Not too low (looks unrealistic)  
- Just right (thoroughly justified)

**3. Essential Categories to Consider:**
- **Personnel (usually 60-80%):** Salaries, benefits, overtime
- **Equipment:** Vehicles, technology, protective gear
- **Training:** Courses, certifications, conferences
- **Administrative (max 15%):** Office supplies, utilities, communications

**🔍 Reviewer-Friendly Tips:**
- Round to nearest $100 (shows you did real research)
- Include detailed justifications for large items
- Use local salary/cost data
- Show you've shopped around for equipment

**What's your specific budget challenge?** I can help with:
- "Calculate realistic salary costs for [specific position]"
- "Review these equipment costs: [list items]"
- "Is this administrative percentage too high?"
- "Help me justify this $X expense"

What part of your budget needs attention?`;
    }

    // Default encouraging response
    return `That's a great question! I'm here to help you succeed with your grant writing, no matter where you are in the process.

**🤖 About Me:** I'm your AI grant writing expert, trained specifically to help law enforcement and public safety professionals win funding. I understand the unique challenges you face and the language that resonates with funders.

**💬 How I Can Help:**
- **Writing Support:** Draft any section from scratch or improve existing content
- **Strategic Advice:** Choose the right grants, plan your approach, maximize your chances
- **Review & Feedback:** Detailed critiques to make your application stronger
- **Problem Solving:** Stuck on something specific? Let's work through it together
- **Encouragement:** Grant writing is hard work - I'm here to keep you motivated!

**🎯 Best Ways to Work With Me:**
- Be specific about what you need: "Help me write..." or "Review this..." or "I'm confused about..."
- Share context when helpful: grant type, deadline, specific requirements
- Ask follow-up questions - we can go as deep as you need
- Don't worry about asking "basic" questions - I'm here to help at any level

**What's your biggest grant writing challenge right now?** Whether it's getting started, overcoming writer's block, meeting a tight deadline, or polishing a final draft - let's tackle it together!

Just tell me what's on your mind and I'll provide specific, actionable help. 🚀`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard.",
    });
  };

  const clearChat = () => {
    setChatHistory([]);
    setAiResponse('');
    setUserInput('');
    toast({
      title: "Chat Cleared",
      description: "Conversation history has been cleared.",
    });
  };

  const narrativeTypes = [
    {
      id: 'jag',
      title: 'JAG Grant Narrative',
      description: 'Justice Assistance Grant applications with law enforcement focus',
      agency: 'Department of Justice',
      difficulty: 'Intermediate',
      estimatedTime: '45-60 minutes'
    },
    {
      id: 'fema',
      title: 'FEMA Grant Narrative',
      description: 'Emergency management and disaster preparedness funding',
      agency: 'FEMA',
      difficulty: 'Advanced',
      estimatedTime: '60-90 minutes'
    },
    {
      id: 'state',
      title: 'State Grant Narrative',
      description: 'State-level funding opportunities for local law enforcement',
      agency: 'State Government',
      difficulty: 'Beginner',
      estimatedTime: '30-45 minutes'
    },
    {
      id: 'cops',
      title: 'COPS Grant Narrative',
      description: 'Community Oriented Policing Services funding applications',
      agency: 'Department of Justice',
      difficulty: 'Intermediate',
      estimatedTime: '60-75 minutes'
    }
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Narrative Assistant</h1>
          <p className="text-slate-600">Your Complete Grant Writing Solution - Templates, Structured Generation & AI Chat</p>
        </div>
        <div className="flex items-center space-x-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            AI Powered
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="narrative" className="flex items-center space-x-2">
            <Wand2 className="h-4 w-4" />
            <span>Narrative Assistant</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" />
            <span>Vault</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Narrative Assistant */}
        <TabsContent value="narrative" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Wand2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Grant Application Narrative Generator</h2>
            </div>
            <p className="text-slate-600 text-sm">
              Fill out the form below to generate a comprehensive, professional grant narrative using AI.
            </p>
            
            <NarrativeAssistant />
          </div>
        </TabsContent>

        {/* Tab 2: Templates + AI Chat */}
        <TabsContent value="templates" className="space-y-6">
          {/* Quick Start Templates Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Quick Start Templates</h2>
            </div>
            <p className="text-slate-600 text-sm">
              Choose a template to get started with structured grant writing assistance.
            </p>
            
            <Card className="border-slate-200">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {narrativeTypes.map((type) => (
                    <Card key={type.id} className="border-slate-200 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-semibold text-slate-900">
                            {type.title}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {type.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{type.description}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-xs text-slate-500">
                            <Users className="h-3 w-3 mr-1" />
                            {type.agency}
                          </div>
                          <div className="flex items-center text-xs text-slate-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {type.estimatedTime}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleStartWriting(type.id)}
                          disabled={isNavigating}
                        >
                          {isNavigating ? (
                            <>
                              <Sparkles className="h-3 w-3 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              Start Writing
                              <ArrowRight className="h-3 w-3 ml-2" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Chat Copilot */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">AI Chat Copilot</h2>
            </div>
            <p className="text-slate-600 text-sm">
              Have a conversation with your AI grant writing expert. Ask questions, get feedback, or request help with specific sections.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chat Interface */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      {chatHistory.length > 0 ? 'Conversation with AI Grant Expert' : 'Start Conversation with AI Grant Expert'}
                    </CardTitle>
                    <p className="text-sm text-slate-600">
                      {chatHistory.length > 0 
                        ? 'Continue your conversation below'
                        : 'Your expert partner for successful grant applications'
                      }
                    </p>
                  </CardHeader>
                  <CardContent>
                    {/* Conversation History */}
                    {chatHistory.length > 0 && (
                      <div 
                        ref={chatScrollRef}
                        className="space-y-4 max-h-[400px] overflow-y-auto mb-6 border-b pb-4 scroll-smooth"
                      >
                        {chatHistory.map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] p-4 rounded-lg ${
                              message.role === 'user' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <div className="text-xs opacity-75 mb-2 font-medium">
                                {message.role === 'user' ? 'You' : 'AI Grant Expert'}
                              </div>
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                              {message.role === 'assistant' && (
                                <div className="flex justify-end mt-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(message.content)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy Response
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Continuous Input Area */}
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={chatHistory.length > 0 
                            ? "Continue the conversation... ask follow-up questions or request help with something new"
                            : "Ask me anything about grant writing, budgets, narratives, or get help with specific sections..."
                          }
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          className="min-h-[100px] resize-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              generateAIResponse();
                            }
                          }}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={generateAIResponse}
                          disabled={isGenerating || !userInput.trim()}
                          className="flex-grow"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating Response...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              {chatHistory.length > 0 ? 'Send Message' : 'Start Conversation'}
                            </>
                          )}
                        </Button>
                        {chatHistory.length > 0 && (
                          <Button variant="outline" onClick={clearChat}>
                            New Conversation
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Help Sidebar */}
              <div className="space-y-4">
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900">Quick Examples</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-left justify-start h-auto p-3"
                        onClick={() => setUserInput("Help me write a compelling needs statement for our community policing initiative")}
                      >
                        <div>
                          <div className="font-medium text-sm">Needs Statement</div>
                          <div className="text-xs text-slate-500">Get help writing compelling needs</div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-left justify-start h-auto p-3"
                        onClick={() => setUserInput("What should I include in my program objectives for a COPS hiring grant?")}
                      >
                        <div>
                          <div className="font-medium text-sm">Program Objectives</div>
                          <div className="text-xs text-slate-500">Create SMART objectives</div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-left justify-start h-auto p-3"
                        onClick={() => setUserInput("Help me justify the budget for additional officers in our grant application")}
                      >
                        <div>
                          <div className="font-medium text-sm">Budget Justification</div>
                          <div className="text-xs text-slate-500">Explain costs effectively</div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-left justify-start h-auto p-3"
                        onClick={() => setUserInput("Review and improve this grant section: [paste your text here]")}
                      >
                        <div>
                          <div className="font-medium text-sm">Review & Improve</div>
                          <div className="text-xs text-slate-500">Get feedback on existing text</div>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900">Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-start space-x-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>Be specific about what section you need help with</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>Provide context about your department and community</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>You can paste existing text for review and improvement</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Vault */}
        <TabsContent value="vault" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Template Vault</h2>
            </div>
            <p className="text-slate-600 text-sm">
              Access our library of proven grant templates and examples.
            </p>
            
            <AITemplateVault />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default CopilotPage;