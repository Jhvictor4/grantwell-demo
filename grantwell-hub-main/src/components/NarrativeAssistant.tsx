import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wand2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ContextualFileUpload } from '@/components/ContextualFileUpload';
import TemplateFields from '@/components/narrative/TemplateFields';
import AIGenerationForm from '@/components/narrative/AIGenerationForm';
import NarrativeOutput from '@/components/narrative/NarrativeOutput';
import { logger } from '@/lib/logger';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';

interface NarrativeAssistantProps {
  grantId?: string;
  grantTitle?: string;
  organizationName?: string;
}

export const NarrativeAssistant: React.FC<NarrativeAssistantProps> = ({
  grantId,
  grantTitle,
  organizationName
}) => {
  const { toast } = useToast();
  
  // Form state - optimized initialization
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [formData, setFormData] = useState(() => ({
    projectTitle: grantTitle || '',
    grantType: 'custom',
    organizationName: organizationName || '',
    organizationType: 'Municipal Police Department',
    fundingRequested: '',
    equipmentNeeds: '',
    trainingNeeds: '',
    technologyNeeds: '',
    crimeDataAnalysis: '',
    communityPartnerships: '',
    agencySize: '',
    crimeNeeds: '',
    officerCount: '',
    communityImpact: '',
    jurisdictionSize: '',
    currentStaffing: '',
    retentionPlan: '',
    schoolDistricts: '',
    safetyNeeds: '',
    studentPopulation: '',
    preventionStrategies: '',
    threatAssessment: '',
    mentalHealthSupport: '',
    trainingPrograms: '',
    communitySize: '',
    partnershipGoals: '',
    initiativeFocus: '',
    sustainabilityPlan: '',
    stakeholderEngagement: '',
    problemSolvingApproach: '',
    outreachStrategies: '',
    problemStatement: '',
    populationServed: '',
    strategicGoals: [] as string[],
    additionalNotes: '',
    // Template-specific fields
    officersToHire: '',
    vehicleCount: '',
    currentFleetAge: '',
    vehicleJustification: '',
    technologyType: '',
    technologyJustification: '',
    equipment_list: []
  }));
  const [customPrompt, setCustomPrompt] = useState('');

  // UI state - optimized initialization
  const [narrative, setNarrative] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Event handlers
  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    setFormData(prev => ({ ...prev, grantType: templateKey }));
  };

  const handleFormDataChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNarrativeChange = (newNarrative: string) => {
    setNarrative(newNarrative);
  };

  const saveNarrativeToAttachments = async (content: string) => {
    try {
      if (!grantId) return;
      const { data: { user } } = await supabase.auth.getUser();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `narrative_${timestamp}.txt`;
      const filePath = `grant-documents/${grantId}/${fileName}`;
      const blob = new Blob([content], { type: 'text/plain' });

      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, blob);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('contextual_documents')
        .insert({
          file_name: fileName,
          original_name: fileName,
          file_size: blob.size,
          mime_type: 'text/plain',
          file_path: filePath,
          grant_id: grantId,
          linked_feature: 'attachments',
          uploaded_by: user?.id,
          upload_date: new Date().toISOString()
        });
      if (dbError) throw dbError;

      await logGrantActivityWithDescription(
        grantId,
        'narrative_saved',
        'saved generated narrative to attachments',
        { file_name: fileName }
      );
    } catch (e) {
      logger.error('Failed to save narrative to attachments', e as any);
    }
  };

  const generateNarrative = async () => {
    // Basic validation
    if (!formData.projectTitle.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a project title.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-narrative', {
        body: {
          ...formData,
          customPrompt,
          fundingRequested: parseInt(formData.fundingRequested) || 0,
          grantType: selectedTemplate,
          contextType: 'grant',
          contextId: grantId || 'narrative-assistant',
          grantId: grantId,
          useRAG: true
        }
      });

      if (error) throw error;
      
      setNarrative(data.narrative || 'No narrative generated');
      toast({
        title: "Narrative Generated!",
        description: `Successfully generated narrative.`,
      });
      if (grantId && data?.narrative) {
        await saveNarrativeToAttachments(data.narrative);
      }
    } catch (error) {
      logger.error('Narrative generation failed', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate narrative. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wand2 className="h-5 w-5 mr-2" />
              Narrative Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AIGenerationForm
              selectedTemplate={selectedTemplate}
              formData={formData}
              customPrompt={customPrompt}
              isGenerating={isGenerating}
              onTemplateChange={handleTemplateChange}
              onFormDataChange={handleFormDataChange}
              onCustomPromptChange={setCustomPrompt}
              onGenerate={generateNarrative}
            />
            
            <Separator />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Supporting Documents</h3>
              <ContextualFileUpload
                context_type="grant"
                context_id={grantId || 'narrative-assistant'}
                grantId={grantId}
                acceptedTypes="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                maxSizeMB={10}
                description="Upload supporting documents for your grant application"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Narrative Output */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="h-5 w-5 mr-2" />
              Generated Narrative
            </CardTitle>
          </CardHeader>
          <CardContent>
            {narrative ? (
              <NarrativeOutput
                narrative={narrative}
                onNarrativeChange={handleNarrativeChange}
                grantTitle={formData.projectTitle}
                organizationName={formData.organizationName}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No narrative generated yet. Fill out the form and click "Generate Narrative" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};