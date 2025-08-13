import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  FileText, 
  Plus, 
  Search, 
  Copy, 
  Edit3, 
  Trash2, 
  BookOpen,
  Sparkles,
  Filter,
  Users
} from 'lucide-react';

interface AITemplate {
  id: string;
  title: string;
  content: string;
  grant_type: 'JAG' | 'COPS' | 'FEMA' | 'General';
  category: string;
  description: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  usage_count: number;
}

interface AITemplateVaultProps {
  onTemplateSelect?: (template: AITemplate) => void;
}

const AITemplateVault: React.FC<AITemplateVaultProps> = ({ onTemplateSelect }) => {
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<AITemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrantType, setFilterGrantType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AITemplate | null>(null);
  
  const [newTemplate, setNewTemplate] = useState<{
    title: string;
    content: string;
    grant_type: 'JAG' | 'COPS' | 'FEMA' | 'General';
    category: string;
    description: string;
    is_public: boolean;
  }>({
    title: '',
    content: '',
    grant_type: 'General',
    category: 'Project Description',
    description: '',
    is_public: true
  });

  const { userRole, user } = useAuth();
  const { toast } = useToast();

  const canEdit = userRole === 'admin' || userRole === 'manager';

  const grantTypes = ['JAG', 'COPS', 'FEMA', 'General'];
  const categories = [
    'Project Description',
    'Statement of Need', 
    'Goals and Objectives',
    'Project Design',
    'Capabilities',
    'Budget Narrative',
    'Evaluation Plan',
    'Other'
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, filterGrantType, filterCategory]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_templates')
        .select('*')
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as AITemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterGrantType !== 'all') {
      filtered = filtered.filter(template => template.grant_type === filterGrantType);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(template => template.category === filterCategory);
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.title || !newTemplate.content) {
      toast({
        title: "Missing Information",
        description: "Please fill in title and content.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_templates')
        .insert([{
          ...newTemplate,
          created_by: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "Template Created",
        description: "AI template has been created successfully.",
      });

      setNewTemplate({
        title: '',
        content: '',
        grant_type: 'General',
        category: 'Project Description',
        description: '',
        is_public: true
      });
      setShowCreateDialog(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Error",
        description: "Failed to create template.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('ai_templates')
        .update({
          title: newTemplate.title,
          content: newTemplate.content,
          grant_type: newTemplate.grant_type,
          category: newTemplate.category,
          description: newTemplate.description,
          is_public: newTemplate.is_public
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Template Updated",
        description: "AI template has been updated successfully.",
      });

      setEditingTemplate(null);
      setShowCreateDialog(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Error",
        description: "Failed to update template.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('ai_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template Deleted",
        description: "AI template has been deleted successfully.",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  const handleUseTemplate = async (template: AITemplate) => {
    try {
      // Increment usage count
      await supabase
        .from('ai_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', template.id);

      if (onTemplateSelect) {
        onTemplateSelect(template);
      } else {
        // Copy to clipboard
        await navigator.clipboard.writeText(template.content);
        toast({
          title: "Template Copied",
          description: "Template content has been copied to clipboard.",
        });
      }
      
      fetchTemplates(); // Refresh to update usage count
    } catch (error) {
      console.error('Error using template:', error);
      toast({
        title: "Error",
        description: "Failed to use template.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (template: AITemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      title: template.title,
      content: template.content,
      grant_type: template.grant_type,
      category: template.category,
      description: template.description,
      is_public: template.is_public
    });
    setShowCreateDialog(true);
  };

  const resetForm = () => {
    setNewTemplate({
      title: '',
      content: '',
      grant_type: 'General',
      category: 'Project Description',
      description: '',
      is_public: true
    });
    setEditingTemplate(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-slate-600">
            <Sparkles className="h-4 w-4 mr-2 animate-spin" />
            Loading templates...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">AI Template Vault</h2>
            <p className="text-slate-600">Pre-written narrative templates for faster grant writing</p>
          </div>
        </div>
        {canEdit && (
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create AI Template'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newTemplate.title}
                      onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                      placeholder="Template title"
                    />
                  </div>
                  <div>
                    <Label>Grant Type</Label>
                    <Select 
                      value={newTemplate.grant_type} 
                      onValueChange={(value: 'JAG' | 'COPS' | 'FEMA' | 'General') => setNewTemplate({ ...newTemplate, grant_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {grantTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select 
                      value={newTemplate.category} 
                      onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={newTemplate.is_public}
                      onChange={(e) => setNewTemplate({ ...newTemplate, is_public: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_public">Make template public</Label>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Input
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Brief description of the template"
                  />
                </div>

                <div>
                  <Label>Template Content</Label>
                  <Textarea
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    placeholder="Enter your template content here. Use [placeholders] for customizable sections..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterGrantType} onValueChange={setFilterGrantType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Grant Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {grantTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Templates Found</h3>
            <p className="text-slate-600 mb-4">
              {searchTerm || filterGrantType !== 'all' || filterCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first AI template to get started'
              }
            </p>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{template.title}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{template.description}</p>
                  </div>
                  {canEdit && template.created_by === user?.id && (
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(template)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {template.grant_type}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                  {template.is_public && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      Public
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-slate-600 mb-4 line-clamp-3">
                  {template.content.substring(0, 150)}...
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Used {template.usage_count} times
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AITemplateVault;