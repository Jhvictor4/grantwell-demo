import { useState, useEffect } from "react";
import { Send, Copy, Edit, Lightbulb, FileText, DollarSign, Scale, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface AIAssistantTabProps {
  grantId: string;
}

interface Conversation {
  id: string;
  prompt_type: string;
  input_data: any;
  ai_response: string;
  status: string;
  created_at: string;
}

const AIAssistantTab = ({ grantId }: AIAssistantTabProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPromptType, setSelectedPromptType] = useState("");
  const [inputData, setInputData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const { toast } = useToast();

  const promptTypes = [
    {
      value: "narrative",
      label: "Grant Narrative",
      icon: FileText,
      description: "Generate compelling project narratives and descriptions"
    },
    {
      value: "budget_justification",
      label: "Budget Justification", 
      icon: DollarSign,
      description: "Create detailed budget justifications and cost breakdowns"
    },
    {
      value: "compliance",
      label: "Compliance Documentation",
      icon: Scale,
      description: "Generate compliance statements and regulatory documentation"
    },
    {
      value: "stakeholder_engagement",
      label: "Stakeholder Engagement",
      icon: Users,
      description: "Draft community engagement and partnership strategies"
    }
  ];

  const narrativeFields: Array<{key: string; label: string; type: string; options?: string[]}> = [
    { key: "project_title", label: "Project Title", type: "text" },
    { key: "problem_statement", label: "Problem Statement", type: "textarea" },
    { key: "goals", label: "Project Goals", type: "textarea" },
    { key: "methodology", label: "Methodology", type: "textarea" },
    { key: "expected_outcomes", label: "Expected Outcomes", type: "textarea" },
  ];

  const budgetFields: Array<{key: string; label: string; type: string; options?: string[]}> = [
    { key: "total_amount", label: "Total Budget Amount", type: "number" },
    { key: "personnel_cost", label: "Personnel Costs", type: "number" },
    { key: "equipment_cost", label: "Equipment Costs", type: "number" },
    { key: "operational_cost", label: "Operational Costs", type: "number" },
    { key: "justification_focus", label: "Focus Area", type: "select", options: ["Equipment", "Personnel", "Training", "Technology"] },
  ];

  const complianceFields: Array<{key: string; label: string; type: string; options?: string[]}> = [
    { key: "regulatory_framework", label: "Regulatory Framework", type: "select", options: ["Federal", "State", "Local", "Multi-jurisdiction"] },
    { key: "compliance_areas", label: "Compliance Areas", type: "textarea" },
    { key: "existing_policies", label: "Existing Policies", type: "textarea" },
    { key: "risk_assessment", label: "Risk Assessment", type: "textarea" },
  ];

  const stakeholderFields: Array<{key: string; label: string; type: string; options?: string[]}> = [
    { key: "community_size", label: "Community Size", type: "number" },
    { key: "stakeholder_groups", label: "Key Stakeholder Groups", type: "textarea" },
    { key: "engagement_goals", label: "Engagement Goals", type: "textarea" },
    { key: "communication_channels", label: "Communication Channels", type: "textarea" },
  ];

  useEffect(() => {
    fetchConversations();
  }, [grantId]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('grant_id', grantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      logger.error('Error fetching conversations', error);
    }
  };

  const getFieldsForPromptType = (promptType: string) => {
    switch (promptType) {
      case "narrative": return narrativeFields;
      case "budget_justification": return budgetFields;
      case "compliance": return complianceFields;
      case "stakeholder_engagement": return stakeholderFields;
      default: return [];
    }
  };

  const generateMockResponse = (promptType: string, data: any) => {
    const responses = {
      narrative: `**Project Narrative: ${data.project_title || 'Law Enforcement Enhancement Project'}**

**Problem Statement:**
${data.problem_statement || 'Our police department faces significant challenges in modern law enforcement, including outdated equipment, insufficient training resources, and limited community engagement capabilities.'}

**Project Goals:**
${data.goals || 'This project aims to enhance public safety through improved officer training, modernized equipment, and strengthened community partnerships.'}

**Methodology:**
${data.methodology || 'We will implement a phased approach focusing on technology upgrades, comprehensive training programs, and community outreach initiatives.'}

**Expected Outcomes:**
${data.expected_outcomes || 'Anticipated results include reduced crime rates, improved officer effectiveness, enhanced community trust, and measurable improvements in public safety metrics.'}

**Community Impact:**
This initiative will directly benefit our community by providing more effective law enforcement services, fostering stronger police-community relationships, and creating a safer environment for all residents.`,

      budget_justification: `**Budget Justification for ${data.total_amount ? `$${Number(data.total_amount).toLocaleString()}` : 'Grant Funding Request'}**

**Personnel Costs: ${data.personnel_cost ? `$${Number(data.personnel_cost).toLocaleString()}` : '$150,000'}**
These funds will support the hiring and training of qualified personnel essential to project success. This includes specialized training for existing staff and recruitment of new team members with expertise in modern law enforcement techniques.

**Equipment Costs: ${data.equipment_cost ? `$${Number(data.equipment_cost).toLocaleString()}` : '$75,000'}**
Equipment investments are critical for operational effectiveness. Funds will be allocated for modern technology solutions, safety equipment, and specialized tools that enhance officer capabilities and ensure public safety.

**Operational Costs: ${data.operational_cost ? `$${Number(data.operational_cost).toLocaleString()}` : '$25,000'}**
Operational expenses support day-to-day project activities, including utilities, maintenance, transportation, and administrative costs necessary for successful project implementation.

**Cost-Effectiveness Analysis:**
This budget allocation ensures maximum impact per dollar invested, with careful consideration of long-term sustainability and measurable outcomes that justify the investment in public safety enhancement.`,

      compliance: `**Compliance Documentation for ${data.regulatory_framework || 'Multi-Jurisdictional'} Framework**

**Regulatory Compliance Overview:**
This project ensures full compliance with all applicable ${data.regulatory_framework || 'federal, state, and local'} regulations governing law enforcement operations and grant fund utilization.

**Key Compliance Areas:**
${data.compliance_areas || 'Civil rights protections, data privacy requirements, financial accountability standards, personnel qualification standards, and community engagement protocols.'}

**Existing Policy Alignment:**
${data.existing_policies || 'Our department maintains comprehensive policies that align with constitutional requirements, civil rights protections, and professional law enforcement standards.'}

**Risk Assessment and Mitigation:**
${data.risk_assessment || 'We have identified potential compliance risks and implemented robust mitigation strategies including regular audits, staff training, and oversight mechanisms.'}

**Monitoring and Reporting:**
Continuous compliance monitoring will be maintained through quarterly reviews, staff training updates, and regular reporting to ensure ongoing adherence to all regulatory requirements.`,

      stakeholder_engagement: `**Stakeholder Engagement Strategy for Community of ${data.community_size ? Number(data.community_size).toLocaleString() : '50,000'} Residents**

**Key Stakeholder Groups:**
${data.stakeholder_groups || 'Community leaders, neighborhood associations, local businesses, schools, youth organizations, senior centers, and advocacy groups represent our primary engagement partners.'}

**Engagement Goals:**
${data.engagement_goals || 'Build trust through transparency, gather community input on safety priorities, establish ongoing communication channels, and create collaborative problem-solving opportunities.'}

**Communication Strategy:**
${data.communication_channels || 'Multi-channel approach including town halls, social media engagement, community surveys, neighborhood meetings, and partnership with local media outlets.'}

**Partnership Development:**
We will establish formal partnerships with community organizations, creating advisory committees and regular feedback mechanisms to ensure community voices are heard and incorporated into project planning and implementation.

**Measurable Outcomes:**
Success will be measured through community satisfaction surveys, attendance at engagement events, partnership agreements signed, and documented improvements in police-community relations.`
    };

    return responses[promptType as keyof typeof responses] || "AI response generated successfully.";
  };

  const generateResponse = async () => {
    if (!selectedPromptType) {
      toast({
        title: "Please select a prompt type",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setCurrentResponse("");

    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResponse = generateMockResponse(selectedPromptType, inputData);
      setCurrentResponse(mockResponse);

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('ai_conversations')
          .insert({
            grant_id: grantId,
            user_id: user.id,
            prompt_type: selectedPromptType,
            input_data: inputData,
            ai_response: mockResponse,
            status: 'completed'
          });

        if (!error) {
          fetchConversations();
        }
      }

      toast({
        title: "Response Generated",
        description: "AI assistant has generated your content successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Content has been copied to your clipboard.",
    });
  };

  const editInDocument = (text: string) => {
    toast({
      title: "Opening Editor",
      description: "Opening content in document editor...",
    });
    // In a real implementation, this would open a document editor
  };

  const renderInputFields = () => {
    const fields = getFieldsForPromptType(selectedPromptType);
    
    return fields.map((field) => (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key}>{field.label}</Label>
        {field.type === "textarea" ? (
          <Textarea
            id={field.key}
            value={inputData[field.key] || ""}
            onChange={(e) => setInputData(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            rows={3}
          />
        ) : field.type === "select" ? (
          <Select 
            value={inputData[field.key] || ""} 
            onValueChange={(value) => setInputData(prev => ({ ...prev, [field.key]: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={field.key}
            type={field.type}
            value={inputData[field.key] || ""}
            onChange={(e) => setInputData(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        )}
      </div>
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Grant Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-type">Select Content Type</Label>
              <Select value={selectedPromptType} onValueChange={setSelectedPromptType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose what you need help with..." />
                </SelectTrigger>
                <SelectContent>
                  {promptTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPromptType && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {promptTypes.find(t => t.value === selectedPromptType)?.description}
                </p>
              </div>
            )}

            {selectedPromptType && (
              <div className="space-y-4">
                <h4 className="font-medium">Input Information</h4>
                {renderInputFields()}
                <Button 
                  onClick={generateResponse} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Generate Content
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Conversations */}
        {conversations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversations.slice(0, 5).map((conversation) => (
                  <div 
                    key={conversation.id} 
                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => setCurrentResponse(conversation.ai_response)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">
                        {promptTypes.find(t => t.value === conversation.prompt_type)?.label || conversation.prompt_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conversation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.ai_response.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Output Panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Content</CardTitle>
              {currentResponse && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(currentResponse)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => editInDocument(currentResponse)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit in Document
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentResponse ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap p-4 bg-muted rounded-lg">
                  {currentResponse}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AI Assistant Ready</h3>
                <p>Select a content type and provide information to generate AI-powered grant content.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {currentResponse && (
          <Card>
            <CardHeader>
              <CardTitle>Content Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>
                <Button variant="outline" className="justify-start">
                  <Send className="h-4 w-4 mr-2" />
                  Add to Application
                </Button>
                <Button variant="outline" className="justify-start">
                  <Edit className="h-4 w-4 mr-2" />
                  Revise Content
                </Button>
                <Button variant="outline" className="justify-start">
                  <Copy className="h-4 w-4 mr-2" />
                  Export to Word
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AIAssistantTab;