import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Download, Edit3, Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface NarrativeOutputProps {
  narrative: string;
  onNarrativeChange: (narrative: string) => void;
  grantTitle?: string;
  organizationName?: string;
}

const NarrativeOutput: React.FC<NarrativeOutputProps> = ({
  narrative,
  onNarrativeChange,
  grantTitle,
  organizationName
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarrative, setEditedNarrative] = useState(narrative);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(narrative);
      toast({
        title: "Copied to clipboard",
        description: "Narrative has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy narrative to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: grantTitle || "Grant Narrative",
                    bold: true,
                    size: 32,
                  }),
                ],
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: organizationName || "Organization",
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [new TextRun("")],
              }),
              ...narrative.split('\n').map(line => 
                new Paragraph({
                  children: [new TextRun(line)],
                })
              ),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${grantTitle || 'grant-narrative'}.docx`);
      
      toast({
        title: "Download successful",
        description: "Narrative has been downloaded as a Word document.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download narrative.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = () => {
    onNarrativeChange(editedNarrative);
    setIsEditing(false);
    toast({
      title: "Changes saved",
      description: "Your edits have been saved successfully.",
    });
  };

  const startEdit = () => {
    setEditedNarrative(narrative);
    setIsEditing(true);
  };

  if (!narrative) {
    return null;
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">Generated Narrative</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ready for Review
              </Badge>
              <span className="text-xs text-muted-foreground">
                {narrative.split(' ').length} words
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-3"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-3"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={isEditing ? handleSaveEdit : startEdit}
              className="h-8 px-3"
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-6">
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedNarrative}
              onChange={(e) => setEditedNarrative(e.target.value)}
              className="min-h-[600px] font-mono text-sm leading-relaxed bg-muted/30"
              placeholder="Edit your narrative here..."
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 text-foreground" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-semibold mb-3 mt-6 text-foreground" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-medium mb-2 mt-4 text-foreground" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 text-foreground leading-relaxed" {...props} />,
                ul: ({node, ...props}) => <ul className="mb-4 ml-6 list-disc text-foreground" {...props} />,
                ol: ({node, ...props}) => <ol className="mb-4 ml-6 list-decimal text-foreground" {...props} />,
                li: ({node, ...props}) => <li className="mb-1 text-foreground" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-4" {...props} />
                ),
              }}
            >
              {narrative}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NarrativeOutput;