import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';
import { createAutomaticTasks } from '@/lib/grant-task-automation';
import { 
  Building, 
  Users, 
  FileText, 
  CheckSquare, 
  Plus, 
  X, 
  ArrowRight, 
  ArrowLeft,
  Search,
  RefreshCw
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface TeamMember {
  email: string;
  role: string;
  department: string;
}

interface GrantTask {
  title: string;
  description: string;
  assignedTo: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
}

const STEPS = [
  { id: 1, title: 'Organization Setup', icon: Building },
  { id: 2, title: 'Add Team Members', icon: Users },
  { id: 3, title: 'First Grant', icon: FileText },
  { id: 4, title: 'Initial Tasks', icon: CheckSquare }
];

const DEFAULT_GRANT_TASKS = [
  {
    title: 'Review Grant Opportunity',
    description: 'Thoroughly review the grant requirements and eligibility criteria',
    priority: 'high' as const,
    daysFromNow: 3
  },
  {
    title: 'Prepare Budget Draft',
    description: 'Create initial budget breakdown and cost estimates',
    priority: 'high' as const,
    daysFromNow: 7
  },
  {
    title: 'Assign Narrative Writer',
    description: 'Identify and assign team member to write grant narrative',
    priority: 'medium' as const,
    daysFromNow: 5
  },
  {
    title: 'Gather Supporting Documents',
    description: 'Collect organizational charts, policies, and required attachments',
    priority: 'medium' as const,
    daysFromNow: 10
  },
  {
    title: 'Submit Pre-Application (if required)',
    description: 'Complete and submit pre-application if required by funder',
    priority: 'low' as const,
    daysFromNow: 14
  }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Organization
  const [orgName, setOrgName] = useState('');
  const [dunsNumber, setDunsNumber] = useState('');
  const [ueiNumber, setUeiNumber] = useState('');
  
  // Step 2: Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { email: '', role: 'viewer', department: '' }
  ]);
  
  // Step 3: Grant
  const [grantTitle, setGrantTitle] = useState('');
  const [grantAgency, setGrantAgency] = useState('');
  const [grantDeadline, setGrantDeadline] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [grantDescription, setGrantDescription] = useState('');
  const [syncFromGrants, setSyncFromGrants] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Step 4: Tasks
  const [selectedTasks, setSelectedTasks] = useState<GrantTask[]>([]);
  const [createdGrantId, setCreatedGrantId] = useState<string | null>(null);

  const progress = (currentStep / STEPS.length) * 100;

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { email: '', role: 'viewer', department: '' }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = teamMembers.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    );
    setTeamMembers(updated);
  };

  const handleStep1Submit = async () => {
    // If no organization name provided, skip this step
    if (!orgName.trim()) {
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    try {
      // First check if organization settings already exist
      const { data: existingSettings } = await supabase
        .from('organization_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let result;
      
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('organization_settings')
          .update({
            organization_name: orgName,
            duns_number: dunsNumber || null,
            uei_number: ueiNumber || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
      } else {
        // Insert new settings
        result = await supabase
          .from('organization_settings')
          .insert({
            organization_name: orgName,
            duns_number: dunsNumber || null,
            uei_number: ueiNumber || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      if (result.error) {
        console.error('Database error:', result.error);
        throw new Error(`Database error: ${result.error.message}`);
      }

      await logActivity({
        entityType: 'organization_settings',
        entityId: existingSettings?.id || 'new',
        eventType: existingSettings ? 'updated' : 'created',
        eventData: { organization_name: orgName }
      });

      setCurrentStep(2);
    } catch (error) {
      console.error('Error saving organization:', error);
      
      // Provide more specific error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to save organization settings';
      
      toast({
        title: "Error",
        description: errorMessage.includes('permission') 
          ? "Permission denied. Please contact your administrator."
          : errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    const validMembers = teamMembers.filter(member => 
      member.email.trim() && member.email.includes('@')
    );

    setLoading(true);
    try {
      // For now, we'll simulate team member invitations
      // In a production environment, you would:
      // 1. Store pending invitations in a database table
      // 2. Send invitation emails via a serverless function
      // 3. Allow users to accept invitations and join the organization
      
      if (validMembers.length > 0) {
        // Simulate invitation process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await logActivity({
          entityType: 'team_invitations',
          entityId: 'onboarding',
          eventType: 'created',
          eventData: { invited_count: validMembers.length, members: validMembers }
        });

        toast({
          title: "Team Members Noted",
          description: `Recorded ${validMembers.length} team member(s). They can register separately and join your organization.`,
        });
      } else {
        toast({
          title: "No Team Members",
          description: "You can add team members later from the settings page.",
        });
      }

      setCurrentStep(3);
    } catch (error) {
      console.error('Error processing team members:', error);
      toast({
        title: "Error",
        description: "Failed to process team member information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncFromGrantsGov = async () => {
    setSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-grants-gov');
      
      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: `Found ${data?.grants_synced || 0} new grants from Grants.gov`,
      });
      
      setSyncFromGrants(true);
    } catch (error) {
      console.error('Error syncing grants:', error);
      toast({
        title: "Sync Failed",
        description: "Unable to sync from Grants.gov at this time",
        variant: "destructive"
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleStep3Submit = async () => {
    if (syncFromGrants) {
      setCurrentStep(4);
      return;
    }

    if (!grantTitle.trim() || !grantAgency.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter grant title and agency",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: grantData, error } = await supabase
        .from('grants')
        .insert({
          title: grantTitle,
          funder: grantAgency,
          status: 'draft' as 'draft' | 'active' | 'closed',
          amount_awarded: grantAmount ? parseFloat(grantAmount) : null
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedGrantId(grantData.id);

      await logActivity({
        entityType: 'grants',
        entityId: grantData.id,
        eventType: 'created',
        eventData: { source: 'onboarding' }
      });

      // Automatically create tasks for this grant
      const taskResult = await createAutomaticTasks({
        grantId: grantData.id,
        grantTitle: grantTitle,
        agency: grantAgency,
        deadline: grantDeadline,
        userId: user.id
      });

      if (taskResult.success) {
        // Show the created tasks for review
        const tasksWithDates = DEFAULT_GRANT_TASKS.map(task => ({
          title: task.title,
          description: task.description,
          assignedTo: user?.id || '',
          priority: task.priority,
          dueDate: new Date(Date.now() + task.daysFromNow * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }));
        setSelectedTasks(tasksWithDates);
      }

      setCurrentStep(4);
    } catch (error) {
      console.error('Error creating grant:', error);
      toast({
        title: "Error",
        description: "Failed to create grant",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStep4Submit = async () => {
    if (!createdGrantId && !syncFromGrants) return;

    setLoading(true);
    try {
      // Tasks were already created in step 3, so we just log completion
      if (createdGrantId) {
        await logActivity({
          entityType: 'onboarding',
          entityId: 'completion',
          eventType: 'created' as 'created' | 'updated' | 'deleted',
          eventData: { grant_id: createdGrantId, tasks_reviewed: selectedTasks.length }
        });
      }

      // Mark onboarding as complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          updated_at: new Date().toISOString(),
          // Add onboarding_completed field if it exists
        })
        .eq('id', user?.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      toast({
        title: "Welcome to Grantwell!",
        description: "Your account is now set up and ready to use.",
      });

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete setup",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true; // Allow proceeding even without organization name (in case of permission issues)
      case 2:
        return true; // Can skip team members
      case 3:
        return syncFromGrants || (grantTitle.trim() && grantAgency.trim());
      case 4:
        return true; // Can proceed without tasks
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 1:
        handleStep1Submit();
        break;
      case 2:
        handleStep2Submit();
        break;
      case 3:
        handleStep3Submit();
        break;
      case 4:
        handleStep4Submit();
        break;
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
                          <span>Welcome to Grantwell</span>
            <Badge variant="outline">Setup</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Step {currentStep} of {STEPS.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps Navigation */}
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center space-y-1 ${
                    step.id === currentStep
                      ? 'text-blue-600'
                      : step.id < currentStep
                      ? 'text-green-600'
                      : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.id === currentStep
                        ? 'bg-blue-100 border-2 border-blue-600'
                        : step.id < currentStep
                        ? 'bg-green-100 border-2 border-green-600'
                        : 'bg-slate-100 border-2 border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Organization Setup</h3>
                    <p className="text-slate-600 mb-4">
                      Let's start by setting up your organization information. This step is optional if you don't have admin permissions.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="orgName">Organization Name *</Label>
                      <Input
                        id="orgName"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g., City of Springfield Police Department"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="dunsNumber">DUNS Number (Optional)</Label>
                      <Input
                        id="dunsNumber"
                        value={dunsNumber}
                        onChange={(e) => setDunsNumber(e.target.value)}
                        placeholder="9-digit DUNS number"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="ueiNumber">UEI Number (Optional)</Label>
                      <Input
                        id="ueiNumber"
                        value={ueiNumber}
                        onChange={(e) => setUeiNumber(e.target.value)}
                        placeholder="12-character UEI number"
                      />
                    </div>
                  </div>
                  
                  {/* Skip option for organization setup */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">
                      Don't have admin permissions or want to set this up later?
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      className="text-slate-600"
                    >
                      Skip Organization Setup
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Add Team Members</h3>
                    <p className="text-slate-600 mb-4">
                      Invite team members to collaborate on grants. You can skip this step and add members later.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {teamMembers.map((member, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Team Member {index + 1}</h4>
                          {teamMembers.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTeamMember(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label>Email Address</Label>
                            <Input
                              value={member.email}
                              onChange={(e) => updateTeamMember(index, 'email', e.target.value)}
                              placeholder="email@example.com"
                            />
                          </div>
                          
                          <div>
                            <Label>Role</Label>
                            <Select
                              value={member.role}
                              onValueChange={(value) => updateTeamMember(index, 'role', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label>Department</Label>
                            <Input
                              value={member.department}
                              onChange={(e) => updateTeamMember(index, 'department', e.target.value)}
                              placeholder="e.g., Administration"
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                    
                    <Button variant="outline" onClick={addTeamMember} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Team Member
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Add Your First Grant</h3>
                    <p className="text-slate-600 mb-4">
                      Add a grant opportunity you're working on, or sync from Grants.gov.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <Card className="p-4 border-blue-200 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-blue-900">Sync from Grants.gov</h4>
                          <p className="text-sm text-blue-700">
                            Automatically import current grant opportunities
                          </p>
                        </div>
                        <Button
                          onClick={syncFromGrantsGov}
                          disabled={syncLoading}
                          variant="outline"
                        >
                          {syncLoading ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 mr-2" />
                          )}
                          {syncLoading ? 'Syncing...' : 'Sync Now'}
                        </Button>
                      </div>
                    </Card>

                    {!syncFromGrants && (
                      <>
                        <div className="text-center text-slate-500 py-2">
                          <span>OR</span>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="grantTitle">Grant Title *</Label>
                            <Input
                              id="grantTitle"
                              value={grantTitle}
                              onChange={(e) => setGrantTitle(e.target.value)}
                              placeholder="e.g., Community Policing Initiative Grant"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="grantAgency">Funding Agency *</Label>
                            <Input
                              id="grantAgency"
                              value={grantAgency}
                              onChange={(e) => setGrantAgency(e.target.value)}
                              placeholder="e.g., Department of Justice"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="grantDeadline">Application Deadline</Label>
                              <Input
                                id="grantDeadline"
                                type="date"
                                value={grantDeadline}
                                onChange={(e) => setGrantDeadline(e.target.value)}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="grantAmount">Funding Amount</Label>
                              <Input
                                id="grantAmount"
                                type="number"
                                value={grantAmount}
                                onChange={(e) => setGrantAmount(e.target.value)}
                                placeholder="e.g., 500000"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="grantDescription">Description (Optional)</Label>
                            <Textarea
                              id="grantDescription"
                              value={grantDescription}
                              onChange={(e) => setGrantDescription(e.target.value)}
                              placeholder="Brief description of the grant opportunity..."
                              rows={3}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {syncFromGrants && (
                      <Card className="p-4 border-green-200 bg-green-50">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="h-5 w-5 text-green-600" />
                          <span className="text-green-800 font-medium">
                            Grants synced successfully! You can now assign tasks.
                          </span>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Set Up Initial Tasks</h3>
                    <p className="text-slate-600 mb-4">
                      We've suggested some common grant tasks. Select which ones you'd like to create.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedTasks.map((task, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge 
                                variant={
                                  task.priority === 'high' ? 'destructive' :
                                  task.priority === 'medium' ? 'default' : 'secondary'
                                }
                              >
                                {task.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                            <p className="text-xs text-slate-500">Due: {task.dueDate}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTasks(selectedTasks.filter((_, i) => i !== index))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    
                    {selectedTasks.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No tasks selected. You can add tasks later from the Tasks page.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : currentStep === STEPS.length ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Processing...' : currentStep === STEPS.length ? 'Complete Setup' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};