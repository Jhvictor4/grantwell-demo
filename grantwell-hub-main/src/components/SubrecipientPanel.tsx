import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Mail, Phone, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Subrecipient {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  risk_level: 'Low' | 'Medium' | 'High';
  mou_file_id: string | null;
  created_at: string;
}

type RiskLevel = 'Low' | 'Medium' | 'High';

interface SubrecipientPanelProps {
  grantId: string;
}

export default function SubrecipientPanel({ grantId }: SubrecipientPanelProps) {
  const [subrecipients, setSubrecipients] = useState<Subrecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    risk_level: 'Low' as RiskLevel,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSubrecipients();
  }, [grantId]);

  const loadSubrecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('subrecipients')
        .select('*')
        .eq('grant_id', grantId)
        .order('name');

      if (error) throw error;
      setSubrecipients(data as Subrecipient[] || []);
    } catch (error) {
      console.error('Error loading subrecipients:', error);
      toast({
        title: "Error",
        description: "Failed to load subrecipients",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('subrecipients')
        .insert({
          grant_id: grantId,
          ...formData,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subrecipient added successfully"
      });

      setDialogOpen(false);
      setFormData({
        name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        risk_level: 'Low',
      });
      await loadSubrecipients();
    } catch (error) {
      console.error('Error saving subrecipient:', error);
      toast({
        title: "Error",
        description: "Failed to save subrecipient",
        variant: "destructive"
      });
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  if (loading) {
    return <div className="p-4">Loading subrecipients...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Subrecipients</h3>
          <p className="text-sm text-muted-foreground">
            Manage organizations receiving subawards from this grant
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Subrecipient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Subrecipient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter organization name"
                />
              </div>
              
              <div>
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  placeholder="Primary contact person"
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  placeholder="contact@organization.org"
                />
              </div>

              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="risk_level">Risk Level</Label>
                <Select 
                  value={formData.risk_level} 
                  onValueChange={(value: RiskLevel) => setFormData(prev => ({ ...prev, risk_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low Risk</SelectItem>
                    <SelectItem value="Medium">Medium Risk</SelectItem>
                    <SelectItem value="High">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!formData.name}>
                  Save Subrecipient
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {subrecipients.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No subrecipients added yet</p>
              <p className="text-sm">Add organizations that will receive subawards</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subrecipients.map((subrecipient) => (
            <Card key={subrecipient.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">{subrecipient.name}</CardTitle>
                    {subrecipient.contact_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Contact: {subrecipient.contact_name}
                      </p>
                    )}
                  </div>
                  <Badge className={getRiskColor(subrecipient.risk_level)}>
                    {subrecipient.risk_level} Risk
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {subrecipient.contact_email && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 mr-2" />
                      {subrecipient.contact_email}
                    </div>
                  )}
                  {subrecipient.contact_phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      {subrecipient.contact_phone}
                    </div>
                  )}
                  {subrecipient.mou_file_id && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 mr-2" />
                      MOU on file
                    </div>
                  )}
                </div>
                
                {subrecipient.risk_level === 'High' && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <div className="flex items-center text-red-800">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      High-risk subrecipient requires enhanced monitoring
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}