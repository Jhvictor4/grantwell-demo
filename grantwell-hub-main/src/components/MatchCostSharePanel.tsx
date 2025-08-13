import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, Plus, FileText, TrendingUp } from "lucide-react";
import { listMatches as listMatchesService, saveMatch as saveMatchService } from "@/services/match";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MatchCostSharePanelProps {
  grantId: string;
}

interface MatchItem {
  id?: string;
  type: 'Cash' | 'In-Kind';
  source: string;
  pledged: number;
  fulfilled: number;
  docs_file_id?: string;
}

export function MatchCostSharePanel({ grantId }: MatchCostSharePanelProps) {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMatch, setNewMatch] = useState<MatchItem>({
    type: 'Cash',
    source: '',
    pledged: 0,
    fulfilled: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMatches();
  }, [grantId]);

  // Realtime: auto-refresh when match/cost-share rows change for this grant
  useEffect(() => {
    const channel = supabase
      .channel('public:grant_matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grant_matches', filter: `grant_id=eq.${grantId}` },
        () => {
          loadMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [grantId]);
  const loadMatches = async () => {
    try {
      setLoading(true);
      const raw = await listMatchesService(grantId);
      const normalized: MatchItem[] = (raw || []).map((d: any) => ({
        id: d.id,
        type: (d.type === 'Cash' ? 'Cash' : 'In-Kind'),
        source: d.source || '',
        pledged: Number(d.pledged) || 0,
        fulfilled: Number(d.fulfilled) || 0,
        docs_file_id: d.docs_file_id || undefined,
      }));
      setMatches(normalized);
    } catch (error) {
      console.error('Error loading matches:', error);
      toast({
        title: "Error",
        description: "Failed to load match/cost-share data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMatch = async () => {
    try {
      await saveMatchService({ ...newMatch, grant_id: grantId });
      setDialogOpen(false);
      setNewMatch({
        type: 'Cash',
        source: '',
        pledged: 0,
        fulfilled: 0
      });
      await loadMatches();
      toast({
        title: "Success",
        description: "Match/cost-share entry saved",
      });
    } catch (error) {
      console.error('Error saving match:', error);
      toast({
        title: "Error",
        description: "Failed to save match/cost-share entry",
        variant: "destructive",
      });
    }
  };

  const totalPledged = matches.reduce((sum, match) => sum + match.pledged, 0);
  const totalFulfilled = matches.reduce((sum, match) => sum + match.fulfilled, 0);
  const fulfillmentRate = totalPledged > 0 ? (totalFulfilled / totalPledged) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Match / Cost-Share Overview
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Match
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Match/Cost-Share Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={newMatch.type} onValueChange={(value: 'Cash' | 'In-Kind') => setNewMatch(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="In-Kind">In-Kind</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    value={newMatch.source}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g., City General Fund, Officer Time, Equipment"
                  />
                </div>
                <div>
                  <Label htmlFor="pledged">Pledged Amount</Label>
                  <Input
                    id="pledged"
                    type="number"
                    value={newMatch.pledged}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, pledged: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="fulfilled">Fulfilled Amount</Label>
                  <Input
                    id="fulfilled"
                    type="number"
                    value={newMatch.fulfilled}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, fulfilled: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <Button onClick={handleSaveMatch} className="w-full">
                  Save Match Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Total Pledged</p>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">${totalPledged.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Total Fulfilled</p>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">${totalFulfilled.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Fulfillment Rate</p>
              <Badge variant={fulfillmentRate >= 100 ? "default" : fulfillmentRate >= 75 ? "secondary" : "destructive"}>
                {fulfillmentRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match/Cost-Share Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : matches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No match/cost-share entries found</p>
              <p className="text-sm">Add entries to track your matching requirements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match, index) => (
                <div key={match.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={match.type === 'Cash' ? 'default' : 'secondary'}>
                        {match.type}
                      </Badge>
                      <span className="font-medium">{match.source}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Pledged: ${match.pledged.toLocaleString()}</span>
                      <span>Fulfilled: ${match.fulfilled.toLocaleString()}</span>
                      <span className={`font-medium ${match.fulfilled >= match.pledged ? 'text-green-600' : 'text-orange-600'}`}>
                        {match.pledged > 0 ? ((match.fulfilled / match.pledged) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {match.docs_file_id && (
                      <Badge variant="outline">
                        <FileText className="h-3 w-3 mr-1" />
                        Documented
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}