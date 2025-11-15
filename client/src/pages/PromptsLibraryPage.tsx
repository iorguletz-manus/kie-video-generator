import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, Plus, Edit2, Copy, Trash2, FileText } from "lucide-react";

interface PromptsLibraryPageProps {
  currentUser: {
    id: number;
    username: string;
    profileImageUrl?: string | null;
  };
}

export default function PromptsLibraryPage({ currentUser }: PromptsLibraryPageProps) {
  const [, setLocation] = useLocation();
  
  // Safety check: if currentUser is null, show loading
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="text-purple-900 text-xl">Loading...</div>
      </div>
    );
  }
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptTemplate, setEditPromptTemplate] = useState("");

  // Queries
  const { data: prompts = [], refetch } = trpc.promptLibrary.list.useQuery({
    userId: currentUser.id,
  });

  // Mutations
  const createMutation = trpc.promptLibrary.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsAdding(false);
      setNewPromptName("");
      setNewPromptTemplate("");
      toast.success("Prompt created successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to create prompt: ${error.message}`);
    },
  });

  const updateMutation = trpc.promptLibrary.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
      toast.success("Prompt updated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to update prompt: ${error.message}`);
    },
  });

  const duplicateMutation = trpc.promptLibrary.duplicate.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Prompt duplicated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to duplicate prompt: ${error.message}`);
    },
  });

  const deleteMutation = trpc.promptLibrary.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Prompt deleted successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to delete prompt: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newPromptName.trim() || !newPromptTemplate.trim()) {
      toast.error("Please fill in both prompt name and template");
      return;
    }

    createMutation.mutate({
      userId: currentUser.id,
      promptName: newPromptName,
      promptTemplate: newPromptTemplate,
    });
  };

  const handleEdit = (promptId: number) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    // Check if default prompt
    if (prompt.isDefault === 1) {
      const confirmed = confirm(
        "Nu-ți recomand să le editezi pe acestea. Ești sigur?"
      );
      if (!confirmed) return;
    }

    setEditingId(promptId);
    setEditPromptName(prompt.promptName);
    setEditPromptTemplate(prompt.promptTemplate);
  };

  const handleUpdate = () => {
    if (!editingId) return;

    if (!editPromptName.trim() || !editPromptTemplate.trim()) {
      toast.error("Please fill in both prompt name and template");
      return;
    }

    updateMutation.mutate({
      id: editingId,
      promptName: editPromptName,
      promptTemplate: editPromptTemplate,
    });
  };

  const handleDuplicate = (promptId: number) => {
    duplicateMutation.mutate({
      id: promptId,
      userId: currentUser.id,
    });
  };

  const handleDelete = (promptId: number) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    if (prompt.isDefault === 1) {
      toast.error("Cannot delete default prompts");
      return;
    }

    const confirmed = confirm(`Delete prompt "${prompt.promptName}"?`);
    if (!confirmed) return;

    deleteMutation.mutate({ id: promptId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-blue-900 mb-2">
                Prompts Library
              </h1>
              <p className="text-blue-700">
                Manage your video generation prompts
              </p>
            </div>

            <Button
              onClick={() => setIsAdding(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Prompt
            </Button>
          </div>
        </div>

        {/* Add New Prompt Form */}
        {isAdding && (
          <Card className="mb-8 border-2 border-green-300">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-900">Add New Prompt</CardTitle>
              <CardDescription>
                Create a custom prompt template for video generation
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Prompt Name</Label>
                <Input
                  placeholder="e.g., My Custom Prompt"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                />
              </div>

              <div>
                <Label>Prompt Template</Label>
                <Textarea
                  placeholder="Enter your prompt template here... Use [INSERT TEXT] for dialogue placeholder."
                  value={newPromptTemplate}
                  onChange={(e) => setNewPromptTemplate(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Create Prompt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setNewPromptName("");
                    setNewPromptTemplate("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Prompt Form */}
        {editingId && (
          <Card className="mb-8 border-2 border-blue-300">
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-900">Edit Prompt</CardTitle>
              <CardDescription>
                Modify prompt name and template
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Prompt Name</Label>
                <Input
                  value={editPromptName}
                  onChange={(e) => setEditPromptName(e.target.value)}
                />
              </div>

              <div>
                <Label>Prompt Template</Label>
                <Textarea
                  value={editPromptTemplate}
                  onChange={(e) => setEditPromptTemplate(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Update Prompt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prompts List */}
        <div className="space-y-4">
          {prompts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No prompts yet. Add your first prompt!</p>
              </CardContent>
            </Card>
          ) : (
            prompts.map((prompt) => (
              <Card
                key={prompt.id}
                className={`border-2 ${
                  prompt.isDefault === 1
                    ? "border-gray-300 bg-gray-50"
                    : "border-blue-200"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle
                        className={`flex items-center gap-2 ${
                          prompt.isDefault === 1
                            ? "text-gray-600"
                            : "text-blue-900"
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                        {prompt.promptName}
                        {prompt.isDefault === 1 && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            DEFAULT
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <pre className="whitespace-pre-wrap font-mono text-xs bg-white p-3 rounded border max-h-32 overflow-y-auto">
                          {prompt.promptTemplate.substring(0, 300)}
                          {prompt.promptTemplate.length > 300 && "..."}
                        </pre>
                      </CardDescription>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(prompt.id)}
                              disabled={prompt.isDefault === 1}
                              className={
                                prompt.isDefault === 1
                                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                  : "border-blue-300 text-blue-700 hover:bg-blue-50"
                              }
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{prompt.isDefault === 1 ? "Cannot edit default prompts" : "Edit prompt"}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDuplicate(prompt.id)}
                              className="border-purple-300 text-purple-700 hover:bg-purple-50"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Duplicate prompt</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(prompt.id)}
                              disabled={prompt.isDefault === 1}
                              className={
                                prompt.isDefault === 1
                                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                  : "border-red-300 text-red-700 hover:bg-red-50"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{prompt.isDefault === 1 ? "Cannot delete default prompts" : "Delete prompt"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
