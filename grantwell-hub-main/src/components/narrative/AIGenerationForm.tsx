import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Loader2 } from 'lucide-react';
import TemplateFields from './TemplateFields';

interface AIGenerationFormProps {
  selectedTemplate: string;
  onTemplateChange: (template: string) => void;
  formData: Record<string, any>;
  onFormDataChange: (field: string, value: any) => void;
  customPrompt: string;
  onCustomPromptChange: (prompt: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

const grantTemplates = {
  'cops-hiring': {
    name: 'COPS Hiring Program',
    description: 'Community Oriented Policing Services hiring grants'
  },
  'vehicle-acquisition': {
    name: 'Vehicle Fleet Replacement',
    description: 'Police vehicle acquisition and replacement programs'
  },
  'technology-upgrade': {
    name: 'Technology Enhancement',
    description: 'Body cameras, radios, and police technology'
  },
  'training-certification': {
    name: 'Training & Certification',
    description: 'Officer training and professional development'
  },
  'byrne-jag': {
    name: 'Byrne JAG',
    description: 'Justice Assistance Grant program'
  },
  'fema-assistance': {
    name: 'FEMA Emergency Management',
    description: 'Emergency preparedness and response equipment'
  },
  'custom': {
    name: 'Custom Template',
    description: 'Create your own template structure'
  }
};

const AIGenerationForm: React.FC<AIGenerationFormProps> = ({
  selectedTemplate,
  onTemplateChange,
  formData,
  onFormDataChange,
  customPrompt,
  onCustomPromptChange,
  isGenerating,
  onGenerate
}) => {
  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="space-y-3">
        <Label htmlFor="grantTemplate" className="text-base font-medium">Grant Program Template *</Label>
        <Select value={selectedTemplate} onValueChange={onTemplateChange}>
          <SelectTrigger className="bg-background border-border h-10 text-base">
            <SelectValue placeholder="Select a grant program template" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border shadow-lg z-50">
            {Object.entries(grantTemplates).map(([key, template]) => (
              <SelectItem key={key} value={key} className="text-base">
                <div className="flex flex-col">
                  <span className="font-medium">{template.name}</span>
                  <span className="text-sm text-muted-foreground">{template.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Base Information Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="organizationName" className="text-sm font-medium">Organization Name *</Label>
          <input
            id="organizationName"
            type="text"
            value={formData.organizationName || ''}
            onChange={(e) => onFormDataChange('organizationName', e.target.value)}
            placeholder="Your organization name"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>
        
        <div>
          <Label htmlFor="projectTitle" className="text-sm font-medium">Project Title *</Label>
          <input
            id="projectTitle"
            type="text"
            value={formData.projectTitle || ''}
            onChange={(e) => onFormDataChange('projectTitle', e.target.value)}
            placeholder="Your project title"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="problemStatement" className="text-sm font-medium">Problem Statement *</Label>
        <Textarea
          id="problemStatement"
          value={formData.problemStatement || ''}
          onChange={(e) => onFormDataChange('problemStatement', e.target.value)}
          placeholder="Describe the problem or need this grant will address..."
          className="bg-background border-border text-sm min-h-[100px]"
        />
      </div>

      <div>
        <Label htmlFor="goalObjectives" className="text-sm font-medium">Goals and Objectives *</Label>
        <Textarea
          id="goalObjectives"
          value={formData.goalObjectives || ''}
          onChange={(e) => onFormDataChange('goalObjectives', e.target.value)}
          placeholder="Outline the main goals and specific objectives of your project..."
          className="bg-background border-border text-sm min-h-[100px]"
        />
      </div>

      {/* Template-Specific Fields */}
      <TemplateFields
        selectedTemplate={selectedTemplate}
        formData={formData}
        onFormDataChange={onFormDataChange}
      />

      {/* Custom Prompt */}
      <div className="space-y-3">
        <Label htmlFor="customPrompt" className="text-base font-medium">Additional Instructions (Optional)</Label>
        <Textarea
          id="customPrompt"
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="Add any specific requirements, tone, or additional details for the AI to consider..."
          className="bg-background border-border text-sm min-h-[80px]"
        />
      </div>

      {/* Generate Button */}
      <Button 
        onClick={onGenerate}
        disabled={isGenerating || !formData.organizationName || !formData.projectTitle || !formData.problemStatement}
        className="w-full h-12 text-base"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5 mr-2" />
            Generate Narrative
          </>
        )}
      </Button>
    </div>
  );
};

export default AIGenerationForm;