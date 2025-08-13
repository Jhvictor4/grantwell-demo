import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Mail, Forward, Zap, Copy, CheckCircle, AlertCircle, Settings } from 'lucide-react';

const EmailForwardingSetup: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [processing, setProcessing] = useState(false);
  const [forwardingEmail, setForwardingEmail] = useState('');

  useEffect(() => {
    // Generate unique forwarding email for this user
    if (user?.email) {
      const emailHash = btoa(user.email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
      setForwardingEmail(`grants-${emailHash}@your-domain.com`);
    }
  }, [user]);

  const handleTestEmail = async () => {
    if (!emailContent.trim() || !emailSubject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both email subject and content to test.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-grant-email', {
        body: {
          emailContent: emailContent,
          userEmail: user?.email,
          subject: emailSubject
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Email Processed Successfully!",
          description: data.grantId 
            ? `Found grant opportunity: ${data.title} from ${data.agency}${data.matchScore > 0 ? ` (${data.matchScore}% match)` : ''}`
            : "Email processed but no grant opportunity detected.",
        });

        // Clear the form on success
        setEmailContent('');
        setEmailSubject('');
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error processing email:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process the email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyForwardingEmail = () => {
    navigator.clipboard.writeText(forwardingEmail);
    toast({
      title: "Copied!",
      description: "Forwarding email address copied to clipboard.",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Mail className="h-5 w-5" />
            Email Grant Discovery Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <Forward className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <strong>How it works:</strong> Forward grant notification emails to your unique address below. 
              Our AI will automatically extract grant details, check against your preferences, and add promising 
              opportunities to your discovery pipeline.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="forwarding-email" className="text-blue-900">Your Grant Forwarding Email</Label>
            <div className="flex gap-2">
              <Input
                id="forwarding-email"
                value={forwardingEmail}
                readOnly
                className="bg-white border-blue-200"
              />
              <Button 
                onClick={copyForwardingEmail}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-blue-700">
              Add this email to your contacts and forward grant notifications from:
              <br />• Grants.gov alerts • Agency newsletters • Federal grant notifications
              <br />• Professional associations • Funding opportunity alerts
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Email Client Setup Instructions
            </h4>
            <div className="space-y-2 text-sm text-blue-800">
              <p><strong>Gmail:</strong> Create a filter to auto-forward grant emails</p>
              <p><strong>Outlook:</strong> Set up a rule to forward messages containing "grant" or "funding"</p>
              <p><strong>Manual:</strong> Simply forward any grant opportunity emails as they arrive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Zap className="h-5 w-5 text-green-600" />
            Test Email Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-subject">Email Subject</Label>
            <Input
              id="test-subject"
              placeholder="e.g., New DOJ Grant Opportunity - Body-Worn Camera Program"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-content">Email Content</Label>
            <Textarea
              id="test-content"
              placeholder="Paste the full content of a grant notification email here to test the AI extraction..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={8}
            />
          </div>

          <Button 
            onClick={handleTestEmail}
            disabled={processing || !emailContent.trim() || !emailSubject.trim()}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing Email...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Test Email Processing
              </>
            )}
          </Button>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Testing:</strong> This will process the email content as if it was forwarded to your unique address. 
              If a grant opportunity is detected, it will be added to your Discover Grants page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <CheckCircle className="h-5 w-5" />
            What Happens Next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-green-800">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold mt-0.5">1</div>
              <p>AI extracts grant details: title, agency, deadline, funding amounts, eligibility</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold mt-0.5">2</div>
              <p>Checks against your grant preferences for smart matching and scoring</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold mt-0.5">3</div>
              <p>Adds to your Discover Grants feed with match percentage and priority flags</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold mt-0.5">4</div>
              <p>Sends notifications for high-value or urgent opportunities</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailForwardingSetup;