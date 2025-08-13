import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EquipmentCostDatabase } from '@/components/EquipmentCostDatabase';
import { Target, Users, Shield, TrendingUp, Calculator, Plus, Car, Radio, Shield as ShieldIcon } from 'lucide-react';

interface TemplateFieldsProps {
  selectedTemplate: string;
  formData: Record<string, any>;
  onFormDataChange: (field: string, value: any) => void;
}

const TemplateFields: React.FC<TemplateFieldsProps> = ({
  selectedTemplate,
  formData,
  onFormDataChange
}) => {
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any[]>(formData.equipment_list || []);

  function addEquipment(item: any) {
    const newEquipment = [...selectedEquipment, { ...item, quantity: 1 }];
    setSelectedEquipment(newEquipment);
    onFormDataChange('equipment_list', newEquipment);
    setShowEquipmentDialog(false);
  }

  function removeEquipment(index: number) {
    const newEquipment = selectedEquipment.filter((_, i) => i !== index);
    setSelectedEquipment(newEquipment);
    onFormDataChange('equipment_list', newEquipment);
  }

  function updateEquipmentQuantity(index: number, quantity: number) {
    const newEquipment = [...selectedEquipment];
    newEquipment[index].quantity = quantity;
    setSelectedEquipment(newEquipment);
    onFormDataChange('equipment_list', newEquipment);
  }

  function calculateTotalCost() {
    return selectedEquipment.reduce((total, item) => total + (item.current_price * (item.quantity || 1)), 0);
  }

  // Don't render anything for custom template - all fields should be handled by AIGenerationForm
  if (selectedTemplate === 'custom') {
    return null;
  }
  
  if (selectedTemplate === 'cops-hiring') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Users className="h-4 w-4 mr-2" />
          COPS Hiring Program Details
        </h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="officersToHire" className="text-sm font-medium">Number of Officers to Hire *</Label>
            <Input
              id="officersToHire"
              type="number"
              value={formData.officersToHire || ''}
              onChange={(e) => onFormDataChange('officersToHire', e.target.value)}
              placeholder="e.g., 5"
              className="bg-background border-border text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="fundingRequested" className="text-sm font-medium">Requested Amount *</Label>
            <Input
              id="fundingRequested"
              type="number"
              value={formData.fundingRequested || ''}
              onChange={(e) => onFormDataChange('fundingRequested', e.target.value)}
              placeholder="e.g., 500000"
              className="bg-background border-border text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="communityPartnerships" className="text-sm font-medium">Community Partnership Strategy *</Label>
            <Textarea
              id="communityPartnerships"
              value={formData.communityPartnerships || ''}
              onChange={(e) => onFormDataChange('communityPartnerships', e.target.value)}
              placeholder="Describe your community policing partnership strategy..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
          
          <div>
            <Label htmlFor="crimeDataAnalysis" className="text-sm font-medium">Crime Data and Analysis *</Label>
            <Textarea
              id="crimeDataAnalysis"
              value={formData.crimeDataAnalysis || ''}
              onChange={(e) => onFormDataChange('crimeDataAnalysis', e.target.value)}
              placeholder="Provide crime statistics and analysis supporting your request..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>

        {/* Law Enforcement Equipment Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Equipment & Budget Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Equipment from Database
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Select Equipment</DialogTitle>
                </DialogHeader>
                <EquipmentCostDatabase onSelectItem={addEquipment} compact />
              </DialogContent>
            </Dialog>

            {selectedEquipment.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Selected Equipment</h4>
                {selectedEquipment.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded">
                    <div className="flex items-center gap-3">
                      {item.category === 'Vehicles' && <Car className="h-4 w-4" />}
                      {item.category === 'Technology & Communications' && <Radio className="h-4 w-4" />}
                      {item.category === 'Weapons & Protective Gear' && <ShieldIcon className="h-4 w-4" />}
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">{item.manufacturer} {item.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateEquipmentQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="font-medium min-w-[80px]">
                        ${((item.current_price * (item.quantity || 1))).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeEquipment(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <p className="text-lg font-semibold">
                    Total Equipment Cost: ${calculateTotalCost().toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vehicle Acquisition Template
  if (selectedTemplate === 'vehicle-acquisition') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Car className="h-4 w-4 mr-2" />
          Vehicle Fleet Replacement Details
        </h4>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vehicleCount" className="text-sm font-medium">Number of Vehicles Needed *</Label>
              <Input
                id="vehicleCount"
                type="number"
                value={formData.vehicleCount || ''}
                onChange={(e) => onFormDataChange('vehicleCount', e.target.value)}
                placeholder="e.g., 5"
                className="bg-background border-border text-sm"
              />
            </div>
            <div>
              <Label htmlFor="currentFleetAge" className="text-sm font-medium">Current Fleet Average Age (years)</Label>
              <Input
                id="currentFleetAge"
                type="number"
                value={formData.currentFleetAge || ''}
                onChange={(e) => onFormDataChange('currentFleetAge', e.target.value)}
                placeholder="e.g., 8"
                className="bg-background border-border text-sm"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="vehicleJustification" className="text-sm font-medium">Vehicle Replacement Justification *</Label>
            <Textarea
              id="vehicleJustification"
              value={formData.vehicleJustification || ''}
              onChange={(e) => onFormDataChange('vehicleJustification', e.target.value)}
              placeholder="Explain why vehicle replacement is necessary (maintenance costs, reliability issues, etc.)..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>

        {/* Equipment Calculator for Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Vehicle Equipment Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicles from Database
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Select Vehicle Equipment</DialogTitle>
                </DialogHeader>
                <EquipmentCostDatabase onSelectItem={addEquipment} compact />
              </DialogContent>
            </Dialog>

            {selectedEquipment.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Selected Vehicles & Equipment</h4>
                {selectedEquipment.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Car className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">{item.manufacturer} {item.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateEquipmentQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="font-medium min-w-[80px]">
                        ${((item.current_price * (item.quantity || 1))).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeEquipment(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <p className="text-lg font-semibold">
                    Total Vehicle Cost: ${calculateTotalCost().toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Technology Upgrade Template
  if (selectedTemplate === 'technology-upgrade') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Radio className="h-4 w-4 mr-2" />
          Technology Enhancement Details
        </h4>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="officerCount" className="text-sm font-medium">Number of Officers to Equip *</Label>
              <Input
                id="officerCount"
                type="number"
                value={formData.officerCount || ''}
                onChange={(e) => onFormDataChange('officerCount', e.target.value)}
                placeholder="e.g., 50"
                className="bg-background border-border text-sm"
              />
            </div>
            <div>
              <Label htmlFor="technologyType" className="text-sm font-medium">Primary Technology Focus *</Label>
              <Select value={formData.technologyType || ''} onValueChange={(value) => onFormDataChange('technologyType', value)}>
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Select technology type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="body-cameras">Body-Worn Cameras</SelectItem>
                  <SelectItem value="radios">Communications/Radios</SelectItem>
                  <SelectItem value="mobile-data">Mobile Data Terminals</SelectItem>
                  <SelectItem value="surveillance">Surveillance Equipment</SelectItem>
                  <SelectItem value="software">Software/Records Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="technologyJustification" className="text-sm font-medium">Technology Need Justification *</Label>
            <Textarea
              id="technologyJustification"
              value={formData.technologyJustification || ''}
              onChange={(e) => onFormDataChange('technologyJustification', e.target.value)}
              placeholder="Explain the need for this technology upgrade (officer safety, evidence collection, etc.)..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>

        {/* Equipment Calculator for Technology */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Technology Equipment Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Technology from Database
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Select Technology Equipment</DialogTitle>
                </DialogHeader>
                <EquipmentCostDatabase onSelectItem={addEquipment} compact />
              </DialogContent>
            </Dialog>

            {selectedEquipment.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Selected Technology</h4>
                {selectedEquipment.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Radio className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">{item.manufacturer} {item.model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateEquipmentQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="font-medium min-w-[80px]">
                        ${((item.current_price * (item.quantity || 1))).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeEquipment(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <p className="text-lg font-semibold">
                    Total Technology Cost: ${calculateTotalCost().toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedTemplate === 'svpp') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          School Violence Prevention Program Details
        </h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="schoolsServed" className="text-sm font-medium">Number of Schools to be Served *</Label>
            <Input
              id="schoolsServed"
              type="number"
              value={formData.schoolsServed || ''}
              onChange={(e) => onFormDataChange('schoolsServed', e.target.value)}
              placeholder="e.g., 10"
              className="bg-background border-border text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="studentsImpacted" className="text-sm font-medium">Students Impacted *</Label>
            <Input
              id="studentsImpacted"
              type="number"
              value={formData.studentsImpacted || ''}
              onChange={(e) => onFormDataChange('studentsImpacted', e.target.value)}
              placeholder="e.g., 2500"
              className="bg-background border-border text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="preventionStrategy" className="text-sm font-medium">Violence Prevention Strategy *</Label>
            <Textarea
              id="preventionStrategy"
              value={formData.preventionStrategy || ''}
              onChange={(e) => onFormDataChange('preventionStrategy', e.target.value)}
              placeholder="Describe your comprehensive violence prevention strategy..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (selectedTemplate === 'cpd') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Target className="h-4 w-4 mr-2" />
          Community Policing Development Details
        </h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="communityArea" className="text-sm font-medium">Target Community Area *</Label>
            <Input
              id="communityArea"
              value={formData.communityArea || ''}
              onChange={(e) => onFormDataChange('communityArea', e.target.value)}
              placeholder="e.g., Downtown District"
              className="bg-background border-border text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="currentChallenges" className="text-sm font-medium">Current Community Challenges *</Label>
            <Textarea
              id="currentChallenges"
              value={formData.currentChallenges || ''}
              onChange={(e) => onFormDataChange('currentChallenges', e.target.value)}
              placeholder="Describe current public safety challenges in your community..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (selectedTemplate === 'byrne-jag') {
    return (
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-semibold flex items-center">
          <Shield className="h-4 w-4 mr-2" />
          Edward Byrne Memorial JAG Program Details
        </h4>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="jagPurpose" className="text-sm font-medium">JAG Purpose Area *</Label>
            <Select value={formData.jagPurpose || ''} onValueChange={(value) => onFormDataChange('jagPurpose', value)}>
              <SelectTrigger className="bg-background border-border text-sm">
                <SelectValue placeholder="Select JAG Purpose Area" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border shadow-lg">
                <SelectItem value="law-enforcement">Law Enforcement Programs</SelectItem>
                <SelectItem value="prosecution">Prosecution and Court Programs</SelectItem>
                <SelectItem value="prevention">Prevention and Education Programs</SelectItem>
                <SelectItem value="corrections">Corrections and Community Corrections</SelectItem>
                <SelectItem value="drug-treatment">Drug Treatment and Enforcement</SelectItem>
                <SelectItem value="planning">Planning, Evaluation, and Technology</SelectItem>
                <SelectItem value="crime-victim">Crime Victim and Witness Programs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="proposedActivities" className="text-sm font-medium">Proposed Activities *</Label>
            <Textarea
              id="proposedActivities"
              value={formData.proposedActivities || ''}
              onChange={(e) => onFormDataChange('proposedActivities', e.target.value)}
              placeholder="Describe the specific activities to be funded by this JAG award..."
              className="bg-background border-border text-sm min-h-[80px]"
            />
          </div>
        </div>
      </div>
    );
  }


  return null;
};

export default TemplateFields;