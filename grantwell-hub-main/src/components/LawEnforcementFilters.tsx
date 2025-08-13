import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Car, Radio, Target, X } from 'lucide-react';

interface LawEnforcementFiltersProps {
  onFilterChange: (filters: {
    sector: string;
    category: string;
    equipmentType: string;
    fundingRange: string;
  }) => void;
  totalGrants: number;
  filteredCount: number;
}

export function LawEnforcementFilters({ onFilterChange, totalGrants, filteredCount }: LawEnforcementFiltersProps) {
  const [sectorFilter, setSectorFilter] = useState('Law Enforcement');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [fundingRangeFilter, setFundingRangeFilter] = useState('all');

  const lawEnforcementCategories = [
    { value: 'cops-hiring', label: 'COPS Hiring', icon: Target },
    { value: 'byrne-jag', label: 'Byrne JAG', icon: Shield },
    { value: 'fema-assistance', label: 'FEMA Emergency Management', icon: Shield },
    { value: 'equipment-grants', label: 'Equipment Grants', icon: Car },
    { value: 'training-grants', label: 'Training Grants', icon: Target },
    { value: 'technology-grants', label: 'Technology Grants', icon: Radio }
  ];

  const equipmentTypes = [
    'Vehicles',
    'Body Cameras',
    'Communications Equipment',
    'Protective Gear',
    'Weapons',
    'Technology Systems',
    'Training Equipment'
  ];

  const fundingRanges = [
    { value: 'small', label: 'Under $50K', min: 0, max: 50000 },
    { value: 'medium', label: '$50K - $250K', min: 50000, max: 250000 },
    { value: 'large', label: '$250K - $1M', min: 250000, max: 1000000 },
    { value: 'xlarge', label: 'Over $1M', min: 1000000, max: null }
  ];

  function updateFilters(newFilters: {
    sector?: string;
    category?: string; 
    equipmentType?: string;
    fundingRange?: string;
  }) {
    const updatedFilters = {
      sector: newFilters.sector ?? sectorFilter,
      category: newFilters.category ?? categoryFilter,
      equipmentType: newFilters.equipmentType ?? equipmentFilter,
      fundingRange: newFilters.fundingRange ?? fundingRangeFilter
    };

    if (newFilters.sector !== undefined) setSectorFilter(newFilters.sector);
    if (newFilters.category !== undefined) setCategoryFilter(newFilters.category);
    if (newFilters.equipmentType !== undefined) setEquipmentFilter(newFilters.equipmentType);
    if (newFilters.fundingRange !== undefined) setFundingRangeFilter(newFilters.fundingRange);

    onFilterChange(updatedFilters);
  }

  function clearFilters() {
    setSectorFilter('all');
    setCategoryFilter('all');
    setEquipmentFilter('all');
    setFundingRangeFilter('all');
    onFilterChange({
      sector: 'all',
      category: 'all',
      equipmentType: 'all',
      fundingRange: 'all'
    });
  }

  const hasActiveFilters = sectorFilter !== 'all' || categoryFilter !== 'all' || 
                          equipmentFilter !== 'all' || fundingRangeFilter !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Law Enforcement Filters
        </h3>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sector Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Sector</label>
          <Select value={sectorFilter} onValueChange={(value) => updateFilters({ sector: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Sectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              <SelectItem value="Law Enforcement">Law Enforcement</SelectItem>
              <SelectItem value="Public Safety">Public Safety</SelectItem>
              <SelectItem value="Emergency Management">Emergency Management</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Grant Category</label>
          <Select value={categoryFilter} onValueChange={(value) => updateFilters({ category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {lawEnforcementCategories.map(category => {
                const Icon = category.icon;
                return (
                  <SelectItem key={category.value} value={category.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {category.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Equipment Type Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Equipment Type</label>
          <Select value={equipmentFilter} onValueChange={(value) => updateFilters({ equipmentType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {equipmentTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Funding Range Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Funding Range</label>
          <Select value={fundingRangeFilter} onValueChange={(value) => updateFilters({ fundingRange: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Amounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Amounts</SelectItem>
              {fundingRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {sectorFilter !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Sector: {sectorFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ sector: 'all' })}
              />
            </Badge>
          )}
          {categoryFilter !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Category: {lawEnforcementCategories.find(c => c.value === categoryFilter)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ category: 'all' })}
              />
            </Badge>
          )}
          {equipmentFilter !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Equipment: {equipmentFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ equipmentType: 'all' })}
              />
            </Badge>
          )}
          {fundingRangeFilter !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Funding: {fundingRanges.find(r => r.value === fundingRangeFilter)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ fundingRange: 'all' })}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCount} of {totalGrants} law enforcement grants
        {hasActiveFilters && ` (${totalGrants - filteredCount} filtered out)`}
      </div>
    </div>
  );
}