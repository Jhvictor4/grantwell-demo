import { useState, useEffect } from 'react';
import { Search, Filter, Download, DollarSign, Calendar, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface EquipmentItem {
  id: string;
  category: string;
  subcategory: string | null;
  item_name: string;
  manufacturer: string | null;
  model: string | null;
  current_price: number;
  price_date: string;
  description: string | null;
  typical_lifespan_years: number | null;
  maintenance_cost_annual: number | null;
}

interface EquipmentCostDatabaseProps {
  onSelectItem?: (item: EquipmentItem) => void;
  compact?: boolean;
}

export function EquipmentCostDatabase({ onSelectItem, compact = false }: EquipmentCostDatabaseProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<EquipmentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const categories = [
    'Vehicles',
    'Technology & Communications',
    'Weapons & Protective Gear',
    'Training & Education',
    'Facilities & Operations'
  ];

  useEffect(() => {
    fetchEquipment();
  }, []);

  useEffect(() => {
    filterEquipment();
  }, [equipment, searchTerm, selectedCategory]);

  async function fetchEquipment() {
    try {
      const { data, error } = await supabase
        .from('equipment_costs')
        .select('*')
        .order('category', { ascending: true })
        .order('item_name', { ascending: true });

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast({
        title: "Error",
        description: "Failed to load equipment database",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  function filterEquipment() {
    let filtered = equipment;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredEquipment(filtered);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function exportEquipment() {
    const csvContent = [
      ['Category', 'Item Name', 'Manufacturer', 'Model', 'Price', 'Price Date', 'Lifespan (Years)', 'Annual Maintenance'],
      ...filteredEquipment.map(item => [
        item.category,
        item.item_name,
        item.manufacturer || '',
        item.model || '',
        item.current_price,
        item.price_date,
        item.typical_lifespan_years || '',
        item.maintenance_cost_annual || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-costs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equipment Cost Database</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {filteredEquipment.map(item => (
            <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectItem?.(item)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.item_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {item.manufacturer} {item.model}
                    </p>
                    <Badge variant="secondary" className="mt-1">{item.category}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{formatCurrency(item.current_price)}</p>
                    <p className="text-xs text-muted-foreground">As of {new Date(item.price_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Equipment Cost Database
            </CardTitle>
            <CardDescription>
              Current market pricing for law enforcement equipment
            </CardDescription>
          </div>
          <Button onClick={exportEquipment} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4">
          {filteredEquipment.map(item => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-lg">{item.item_name}</h3>
                    <p className="text-muted-foreground">
                      {item.manufacturer} {item.model}
                    </p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{item.category}</Badge>
                      {item.subcategory && (
                        <Badge variant="outline">{item.subcategory}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-xl text-primary">
                        {formatCurrency(item.current_price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>As of {new Date(item.price_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {item.typical_lifespan_years && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Lifespan:</span>
                        <span className="ml-2 font-medium">{item.typical_lifespan_years} years</span>
                      </div>
                    )}
                    {item.maintenance_cost_annual && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Annual maintenance:</span>
                        <span className="font-medium">{formatCurrency(item.maintenance_cost_annual)}</span>
                      </div>
                    )}
                    {onSelectItem && (
                      <Button onClick={() => onSelectItem(item)} size="sm" className="w-full">
                        Select Item
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredEquipment.length === 0 && (
          <div className="text-center py-8">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No equipment found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}