import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { CalendarIcon, Plus, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeInput, validateTextInput, validateNumericInput, checkRateLimit, logSecurityEvent } from '@/lib/security';

interface GrantFormProps {
  onGrantCreated?: () => void;
}

const GrantForm: React.FC<GrantFormProps> = ({ onGrantCreated }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    funder: '',
    amount_awarded: '',
    status: 'draft' as 'draft' | 'active' | 'closed',
    coordinator_name: '',
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!checkRateLimit(`grant-create-${user?.id}`, 10, 5)) {
      toast({
        title: "Rate Limit Exceeded",
        description: "Too many attempts. Please try again later.",
        variant: "destructive"
      });
      logSecurityEvent({
        action: 'rate_limit_exceeded',
        details: 'Grant creation rate limit exceeded',
        userId: user?.id,
        severity: 'medium'
      });
      return;
    }

    // Validate required fields
    if (!formData.title || !formData.funder) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Input validation
    const titleValidation = validateTextInput(formData.title, 1, 200);
    if (!titleValidation.isValid) {
      toast({
        title: "Validation Error",
        description: titleValidation.error,
        variant: "destructive"
      });
      return;
    }

    const funderValidation = validateTextInput(formData.funder, 1, 200);
    if (!funderValidation.isValid) {
      toast({
        title: "Validation Error", 
        description: funderValidation.error,
        variant: "destructive"
      });
      return;
    }

    if (formData.amount_awarded && !validateNumericInput(formData.amount_awarded)) {
      toast({
        title: "Validation Error",
        description: "Amount must be a valid positive number",
        variant: "destructive"
      });
      return;
    }

    if (formData.coordinator_name) {
      const coordinatorValidation = validateTextInput(formData.coordinator_name, 0, 100);
      if (!coordinatorValidation.isValid) {
        toast({
          title: "Validation Error",
          description: coordinatorValidation.error,
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);

    const grantData = {
      title: sanitizeInput(formData.title),
      funder: sanitizeInput(formData.funder),
      amount_awarded: formData.amount_awarded ? parseFloat(formData.amount_awarded) : null,
      status: formData.status,
      coordinator_name: formData.coordinator_name ? sanitizeInput(formData.coordinator_name) : null,
      start_date: formData.start_date ? formData.start_date.toISOString().split('T')[0] : null,
      end_date: formData.end_date ? formData.end_date.toISOString().split('T')[0] : null
    };

    const { error } = await supabase
      .from('grants')
      .insert([grantData]);

    if (error) {
      console.error('Error creating grant:', error);
      toast({
        title: "Error",
        description: "Failed to create grant",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Grant created successfully"
      });
      resetForm();
      setOpen(false);
      onGrantCreated?.();
    }

    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      funder: '',
      amount_awarded: '',
      status: 'draft',
      coordinator_name: '',
      start_date: undefined,
      end_date: undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Grant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Grant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Grant Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter grant title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="funder">Funding Agency *</Label>
              <Input
                id="funder"
                value={formData.funder}
                onChange={(e) => setFormData(prev => ({ ...prev, funder: e.target.value }))}
                placeholder="e.g., Department of Justice"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Award Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount_awarded}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_awarded: e.target.value }))}
                  placeholder="0"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coordinator">Grant Coordinator</Label>
            <Input
              id="coordinator"
              value={formData.coordinator_name}
              onChange={(e) => setFormData(prev => ({ ...prev, coordinator_name: e.target.value }))}
              placeholder="Name of person managing this grant"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(formData.start_date, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? format(formData.end_date, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : 'Create Grant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GrantForm;