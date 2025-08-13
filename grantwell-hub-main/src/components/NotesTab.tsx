import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { MessageSquare, Plus, Edit2, Save, X } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  grant_id: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

interface NotesTabProps {
  grantId: string;
}

const NotesTab: React.FC<NotesTabProps> = ({ grantId }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    priority: 'medium' as const,
    category: 'general'
  });
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const canEdit = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchNotes();
  }, [grantId]);

  const fetchNotes = async () => {
    try {
      // For now, create example notes since we don't have a notes table
      const exampleNotes: Note[] = [
        {
          id: '1',
          title: 'Grant Application Strategy',
          content: 'Focus on community impact metrics and partnerships with local organizations. Emphasize measurable outcomes and data-driven approaches.',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: user?.email || 'admin@example.com',
          grant_id: grantId,
          priority: 'high',
          category: 'strategy'
        },
        {
          id: '2',
          title: 'Budget Considerations',
          content: 'Remember to allocate 15% for indirect costs and include equipment depreciation in year 2-3 calculations.',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          created_by: user?.email || 'finance@example.com',
          grant_id: grantId,
          priority: 'medium',
          category: 'budget'
        }
      ];
      setNotes(exampleNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    try {
      const note: Note = {
        id: Date.now().toString(),
        ...newNote,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.email || 'user@example.com',
        grant_id: grantId
      };

      setNotes(prev => [note, ...prev]);
      setNewNote({ title: '', content: '', priority: 'medium', category: 'general' });
      setIsAddingNote(false);

      toast({
        title: "Success",
        description: "Note saved successfully"
      });
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Error",
        description: "Failed to save note",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strategy': return 'bg-blue-100 text-blue-800';
      case 'budget': return 'bg-purple-100 text-purple-800';
      case 'compliance': return 'bg-orange-100 text-orange-800';
      case 'general': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-600">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Grant Notes</h3>
        </div>
        {canEdit && (
          <Button 
            onClick={() => setIsAddingNote(true)}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {isAddingNote && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900">New Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Note title"
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              />
              <select
                className="px-3 py-2 border border-slate-300 rounded-md"
                value={newNote.priority}
                onChange={(e) => setNewNote(prev => ({ ...prev, priority: e.target.value as any }))}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <select
                className="px-3 py-2 border border-slate-300 rounded-md"
                value={newNote.category}
                onChange={(e) => setNewNote(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="general">General</option>
                <option value="strategy">Strategy</option>
                <option value="budget">Budget</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <Textarea
              placeholder="Note content..."
              rows={4}
              value={newNote.content}
              onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveNote}
                disabled={!newNote.title || !newNote.content}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNote({ title: '', content: '', priority: 'medium', category: 'general' });
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {notes.map((note) => (
          <Card key={note.id} className="border-slate-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg text-slate-900">{note.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getPriorityColor(note.priority)}>
                      {note.priority} priority
                    </Badge>
                    <Badge className={getCategoryColor(note.category)}>
                      {note.category}
                    </Badge>
                  </div>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap">{note.content}</p>
              <div className="mt-4 text-xs text-slate-500">
                Created by {note.created_by} on {format(new Date(note.created_at), 'MMM dd, yyyy at h:mm a')}
                {note.updated_at !== note.created_at && (
                  <span> • Updated {format(new Date(note.updated_at), 'MMM dd, yyyy')}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {notes.length === 0 && (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No notes have been added to this grant yet.</p>
              {canEdit && (
                <Button 
                  onClick={() => setIsAddingNote(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Note
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NotesTab;