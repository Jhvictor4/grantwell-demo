import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle, CheckCircle, Clock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getAwardSetup, saveAwardSetup } from "@/services/awardSetup";

interface GrantAwardSetupProps {
  grantId: string;
}

interface AwardSetupData {
  uei?: string;
  duns?: string;
  sam_expiration?: string;
  asap_status?: string;
  asap_account_id?: string;
  award_accepted?: boolean;
  award_acceptance_date?: string;
}

export function GrantAwardSetup({ grantId }: GrantAwardSetupProps) {
  const [setupData, setSetupData] = useState<AwardSetupData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAwardSetup();
  }, [grantId]);

  const loadAwardSetup = async () => {
    try {
      setLoading(true);
      const data = await getAwardSetup(grantId);
      setSetupData(data || {});
    } catch (error) {
      console.error('Error loading award setup:', error);
      toast({
        title: "Error",
        description: "Failed to load award setup data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveAwardSetup({ grant_id: grantId, ...(setupData as any) });
      toast({
        title: "Success",
        description: "Award setup saved successfully",
      });
    } catch (error) {
      console.error('Error saving award setup:', error);
      toast({
        title: "Error",
        description: "Failed to save award setup",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AwardSetupData, value: any) => {
    setSetupData(prev => ({ ...prev, [field]: value }));
  };

  const getSamExpirationStatus = () => {
    if (!setupData.sam_expiration) return null;
    
    const expirationDate = new Date(setupData.sam_expiration);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration < 0) {
      return { status: 'expired', color: 'destructive', icon: AlertTriangle };
    } else if (daysUntilExpiration <= 30) {
      return { status: 'expiring', color: 'secondary', icon: Clock };
    } else {
      return { status: 'valid', color: 'default', icon: CheckCircle };
    }
  };

  const samStatus = getSamExpirationStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading award setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Award Setup & Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SAM.gov Registration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">SAM.gov Registration</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="uei">Unique Entity Identifier (UEI)</Label>
                <Input
                  id="uei"
                  value={setupData.uei || ''}
                  onChange={(e) => updateField('uei', e.target.value)}
                  placeholder="12 character UEI"
                />
              </div>
              <div>
                <Label htmlFor="duns">DUNS Number (Legacy)</Label>
                <Input
                  id="duns"
                  value={setupData.duns || ''}
                  onChange={(e) => updateField('duns', e.target.value)}
                  placeholder="9 digit DUNS (if applicable)"
                />
              </div>
              <div>
                <Label htmlFor="sam_expiration">SAM Registration Expiration</Label>
                <div className="flex gap-2">
                  <Input
                    id="sam_expiration"
                    type="date"
                    value={setupData.sam_expiration || ''}
                    onChange={(e) => updateField('sam_expiration', e.target.value)}
                  />
                  {samStatus && (
                    <Badge variant={samStatus.color as any} className="flex items-center gap-1">
                      <samStatus.icon className="h-3 w-3" />
                      {samStatus.status}
                    </Badge>
                  )}
                </div>
                {samStatus?.status === 'expiring' && (
                  <p className="text-sm text-orange-600 mt-1">
                    Warning: SAM registration expires in {Math.ceil((new Date(setupData.sam_expiration!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ASAP Registration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">ASAP (Automated Standard Application for Payments)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="asap_status">ASAP Status</Label>
                <Select
                  value={setupData.asap_status || ''}
                  onValueChange={(value) => updateField('asap_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ASAP status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="asap_account_id">ASAP Account ID</Label>
                <Input
                  id="asap_account_id"
                  value={setupData.asap_account_id || ''}
                  onChange={(e) => updateField('asap_account_id', e.target.value)}
                  placeholder="ASAP Account Identifier"
                />
              </div>
            </div>
          </div>

          {/* Award Acceptance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Award Acceptance</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="award_accepted"
                  checked={setupData.award_accepted || false}
                  onCheckedChange={(checked) => updateField('award_accepted', checked)}
                />
                <Label htmlFor="award_accepted">Award formally accepted</Label>
              </div>
              
              {setupData.award_accepted && (
                <div>
                  <Label htmlFor="award_acceptance_date">Acceptance Date</Label>
                  <Input
                    id="award_acceptance_date"
                    type="date"
                    value={setupData.award_acceptance_date || ''}
                    onChange={(e) => updateField('award_acceptance_date', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Award Setup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}