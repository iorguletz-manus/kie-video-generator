import { useState, useEffect, useMemo } from 'react';
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronDown, Edit2, Trash2, Search, Plus, Folder, FolderOpen } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface CategoryManagementPageProps {
  currentUser: {
    id: number;
    username: string;
    profileImageUrl?: string | null;
  };
}

export default function CategoryManagementPage({ currentUser }: CategoryManagementPageProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTams, setExpandedTams] = useState<Set<number>>(new Set());
  const [expandedCoreBeliefs, setExpandedCoreBeliefs] = useState<Set<number>>(new Set());
  const [expandedEmotionalAngles, setExpandedEmotionalAngles] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<{ type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad', id: number } | null>(null);
  const [editingName, setEditingName] = useState("");

  // Queries
  const { data: tams = [], refetch: refetchTams } = trpc.tams.list.useQuery({ userId: currentUser.id });
  const { data: coreBeliefs = [], refetch: refetchCoreBeliefs } = trpc.coreBeliefs.list.useQuery({ userId: currentUser.id });
  const { data: emotionalAngles = [], refetch: refetchEmotionalAngles } = trpc.emotionalAngles.list.useQuery({ userId: currentUser.id });
  const { data: ads = [], refetch: refetchAds } = trpc.ads.list.useQuery({ userId: currentUser.id });
  const { data: characters = [] } = trpc.characters.list.useQuery({ userId: currentUser.id });
  const { data: contextSessions = [] } = trpc.contextSessions.listByUser.useQuery({ userId: currentUser.id });

  // Expand all by default
  useEffect(() => {
    if (tams.length > 0) {
      setExpandedTams(new Set(tams.map(t => t.id)));
    }
  }, [tams]);

  useEffect(() => {
    if (coreBeliefs.length > 0) {
      setExpandedCoreBeliefs(new Set(coreBeliefs.map(cb => cb.id)));
    }
  }, [coreBeliefs]);

  useEffect(() => {
    if (emotionalAngles.length > 0) {
      setExpandedEmotionalAngles(new Set(emotionalAngles.map(ea => ea.id)));
    }
  }, [emotionalAngles]);

  // Mutations
  const updateTamMutation = trpc.tams.update.useMutation();
  const deleteTamMutation = trpc.tams.delete.useMutation();
  const updateCoreBeliefMutation = trpc.coreBeliefs.update.useMutation();
  const deleteCoreBeliefMutation = trpc.coreBeliefs.delete.useMutation();
  const updateEmotionalAngleMutation = trpc.emotionalAngles.update.useMutation();
  const deleteEmotionalAngleMutation = trpc.emotionalAngles.delete.useMutation();
  const updateAdMutation = trpc.ads.update.useMutation();
  const deleteAdMutation = trpc.ads.delete.useMutation();

  // Toggle expand/collapse
  const toggleTam = (tamId: number) => {
    setExpandedTams(prev => {
      const next = new Set(prev);
      if (next.has(tamId)) {
        next.delete(tamId);
      } else {
        next.add(tamId);
      }
      return next;
    });
  };

  const toggleCoreBelief = (coreBeliefId: number) => {
    setExpandedCoreBeliefs(prev => {
      const next = new Set(prev);
      if (next.has(coreBeliefId)) {
        next.delete(coreBeliefId);
      } else {
        next.add(coreBeliefId);
      }
      return next;
    });
  };

  const toggleEmotionalAngle = (emotionalAngleId: number) => {
    setExpandedEmotionalAngles(prev => {
      const next = new Set(prev);
      if (next.has(emotionalAngleId)) {
        next.delete(emotionalAngleId);
      } else {
        next.add(emotionalAngleId);
      }
      return next;
    });
  };

  // Edit handlers
  const startEdit = (type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad', id: number, currentName: string) => {
    setEditingId({ type, id });
    setEditingName(currentName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      if (editingId.type === 'tam') {
        await updateTamMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        await refetchTams();
      } else if (editingId.type === 'coreBelief') {
        await updateCoreBeliefMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        await refetchCoreBeliefs();
      } else if (editingId.type === 'emotionalAngle') {
        await updateEmotionalAngleMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        await refetchEmotionalAngles();
      } else if (editingId.type === 'ad') {
        await updateAdMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        await refetchAds();
      }
      toast.success("Updated successfully!");
      cancelEdit();
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  // Delete handlers
  const handleDelete = async (type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad', id: number, name: string) => {
    let warningMessage = `Delete "${name}"?`;
    
    if (type === 'tam') {
      const relatedCoreBeliefs = coreBeliefs.filter(cb => cb.tamId === id);
      const relatedEmotionalAngles = emotionalAngles.filter(ea => relatedCoreBeliefs.some(cb => cb.id === ea.coreBeliefId));
      const relatedAds = ads.filter(ad => relatedEmotionalAngles.some(ea => ea.id === ad.emotionalAngleId));
      warningMessage = `Delete TAM "${name}"?\n\nThis will also delete:\n- ${relatedCoreBeliefs.length} Core Beliefs\n- ${relatedEmotionalAngles.length} Emotional Angles\n- ${relatedAds.length} Ads`;
    } else if (type === 'coreBelief') {
      const relatedEmotionalAngles = emotionalAngles.filter(ea => ea.coreBeliefId === id);
      const relatedAds = ads.filter(ad => relatedEmotionalAngles.some(ea => ea.id === ad.emotionalAngleId));
      warningMessage = `Delete Core Belief "${name}"?\n\nThis will also delete:\n- ${relatedEmotionalAngles.length} Emotional Angles\n- ${relatedAds.length} Ads`;
    } else if (type === 'emotionalAngle') {
      const relatedAds = ads.filter(ad => ad.emotionalAngleId === id);
      warningMessage = `Delete Emotional Angle "${name}"?\n\nThis will also delete:\n- ${relatedAds.length} Ads`;
    }

    const confirmed = confirm(warningMessage);
    if (!confirmed) return;

    try {
      if (type === 'tam') {
        await deleteTamMutation.mutateAsync({ id });
        await refetchTams();
        await refetchCoreBeliefs();
        await refetchEmotionalAngles();
        await refetchAds();
      } else if (type === 'coreBelief') {
        await deleteCoreBeliefMutation.mutateAsync({ id });
        await refetchCoreBeliefs();
        await refetchEmotionalAngles();
        await refetchAds();
      } else if (type === 'emotionalAngle') {
        await deleteEmotionalAngleMutation.mutateAsync({ id });
        await refetchEmotionalAngles();
        await refetchAds();
      } else if (type === 'ad') {
        await deleteAdMutation.mutateAsync({ id });
        await refetchAds();
      }
      toast.success("Deleted successfully!");
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    totalTams: tams.length,
    totalCoreBeliefs: coreBeliefs.length,
    totalEmotionalAngles: emotionalAngles.length,
    totalAds: ads.length,
  }), [tams, coreBeliefs, emotionalAngles, ads]);

  // Filter by search
  const filteredTams = useMemo(() => {
    if (!searchQuery.trim()) return tams;
    const query = searchQuery.toLowerCase();
    return tams.filter(tam => tam.name.toLowerCase().includes(query));
  }, [tams, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* App Header */}
      <AppHeader
        currentUser={currentUser}
        onLogout={() => setLocation("/login")}
      />
      
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold text-purple-900">Category Management</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
            <Input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 border-purple-300 focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="text-sm opacity-90">TAMs</div>
              <div className="text-3xl font-bold">{stats.totalTams}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="text-sm opacity-90">Core Beliefs</div>
              <div className="text-3xl font-bold">{stats.totalCoreBeliefs}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="text-sm opacity-90">Emotional Angles</div>
              <div className="text-3xl font-bold">{stats.totalEmotionalAngles}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="text-sm opacity-90">Ads</div>
              <div className="text-3xl font-bold">{stats.totalAds}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tree View */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {filteredTams.map((tam) => {
                const isExpanded = expandedTams.has(tam.id);
                const tamCoreBeliefs = coreBeliefs.filter(cb => cb.tamId === tam.id);
                const isEditing = editingId?.type === 'tam' && editingId.id === tam.id;

                return (
                  <div key={tam.id} className="border-l-4 border-purple-500 pl-4">
                    {/* TAM */}
                    <div className="flex items-center gap-2 p-2 hover:bg-purple-50 rounded group">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTam(tam.id)}
                        className="p-0 h-6 w-6"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                      {isExpanded ? <FolderOpen className="w-5 h-5 text-purple-600" /> : <Folder className="w-5 h-5 text-purple-600" />}
                      
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button size="sm" onClick={saveEdit} className="h-8 bg-green-600 hover:bg-green-700">Save</Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8">Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 font-semibold text-purple-900" onDoubleClick={() => startEdit('tam', tam.id, tam.name)}>
                            {tam.name}
                          </span>
                          <span className="text-sm text-gray-500">{tamCoreBeliefs.length} Core Beliefs</span>
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit('tam', tam.id, tam.name)}
                              className="h-6 w-6 p-0 hover:bg-blue-100"
                            >
                              <Edit2 className="w-3 h-3 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete('tam', tam.id, tam.name)}
                              className="h-6 w-6 p-0 hover:bg-red-100"
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Core Beliefs */}
                    {isExpanded && (
                      <div className="ml-8 mt-2 space-y-2">
                        {tamCoreBeliefs.map((coreBelief) => {
                          const isCbExpanded = expandedCoreBeliefs.has(coreBelief.id);
                          const cbEmotionalAngles = emotionalAngles.filter(ea => ea.coreBeliefId === coreBelief.id);
                          const isCbEditing = editingId?.type === 'coreBelief' && editingId.id === coreBelief.id;

                          return (
                            <div key={coreBelief.id} className="border-l-4 border-blue-500 pl-4">
                              {/* Core Belief */}
                              <div className="flex items-center gap-2 p-2 hover:bg-blue-50 rounded group">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCoreBelief(coreBelief.id)}
                                  className="p-0 h-6 w-6"
                                >
                                  {isCbExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </Button>
                                {isCbExpanded ? <FolderOpen className="w-5 h-5 text-blue-600" /> : <Folder className="w-5 h-5 text-blue-600" />}
                                
                                {isCbEditing ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <Input
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit();
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      className="h-8"
                                      autoFocus
                                    />
                                    <Button size="sm" onClick={saveEdit} className="h-8 bg-green-600 hover:bg-green-700">Save</Button>
                                    <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8">Cancel</Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="flex-1 font-medium text-blue-900" onDoubleClick={() => startEdit('coreBelief', coreBelief.id, coreBelief.name)}>
                                      {coreBelief.name}
                                    </span>
                                    <span className="text-sm text-gray-500">{cbEmotionalAngles.length} Emotional Angles</span>
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEdit('coreBelief', coreBelief.id, coreBelief.name)}
                                        className="h-6 w-6 p-0 hover:bg-blue-100"
                                      >
                                        <Edit2 className="w-3 h-3 text-blue-600" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete('coreBelief', coreBelief.id, coreBelief.name)}
                                        className="h-6 w-6 p-0 hover:bg-red-100"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-600" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Emotional Angles */}
                              {isCbExpanded && (
                                <div className="ml-8 mt-2 space-y-2">
                                  {cbEmotionalAngles.map((emotionalAngle) => {
                                    const isEaExpanded = expandedEmotionalAngles.has(emotionalAngle.id);
                                    const eaAds = ads.filter(ad => ad.emotionalAngleId === emotionalAngle.id);
                                    const isEaEditing = editingId?.type === 'emotionalAngle' && editingId.id === emotionalAngle.id;

                                    return (
                                      <div key={emotionalAngle.id} className="border-l-4 border-green-500 pl-4">
                                        {/* Emotional Angle */}
                                        <div className="flex items-center gap-2 p-2 hover:bg-green-50 rounded group">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleEmotionalAngle(emotionalAngle.id)}
                                            className="p-0 h-6 w-6"
                                          >
                                            {isEaExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                          </Button>
                                          {isEaExpanded ? <FolderOpen className="w-5 h-5 text-green-600" /> : <Folder className="w-5 h-5 text-green-600" />}
                                          
                                          {isEaEditing ? (
                                            <div className="flex-1 flex items-center gap-2">
                                              <Input
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') saveEdit();
                                                  if (e.key === 'Escape') cancelEdit();
                                                }}
                                                className="h-8"
                                                autoFocus
                                              />
                                              <Button size="sm" onClick={saveEdit} className="h-8 bg-green-600 hover:bg-green-700">Save</Button>
                                              <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8">Cancel</Button>
                                            </div>
                                          ) : (
                                            <>
                                              <span className="flex-1 font-medium text-green-900" onDoubleClick={() => startEdit('emotionalAngle', emotionalAngle.id, emotionalAngle.name)}>
                                                {emotionalAngle.name}
                                              </span>
                                              <span className="text-sm text-gray-500">{eaAds.length} Ads</span>
                                              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => startEdit('emotionalAngle', emotionalAngle.id, emotionalAngle.name)}
                                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                                >
                                                  <Edit2 className="w-3 h-3 text-blue-600" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => handleDelete('emotionalAngle', emotionalAngle.id, emotionalAngle.name)}
                                                  className="h-6 w-6 p-0 hover:bg-red-100"
                                                >
                                                  <Trash2 className="w-3 h-3 text-red-600" />
                                                </Button>
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {/* Ads */}
                                        {isEaExpanded && (
                                          <div className="ml-8 mt-2 space-y-2">
                                            {eaAds.map((ad) => {
                                              const isAdEditing = editingId?.type === 'ad' && editingId.id === ad.id;

                                              return (
                                                <div key={ad.id} className="border-l-4 border-orange-500 pl-4">
                                                  {/* Ad */}
                                                  <div className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded group">
                                                    <div className="w-6 h-6 flex items-center justify-center">
                                                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                    </div>
                                                    
                                                    {isAdEditing ? (
                                                      <div className="flex-1 flex items-center gap-2">
                                                        <Input
                                                          value={editingName}
                                                          onChange={(e) => setEditingName(e.target.value)}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit();
                                                            if (e.key === 'Escape') cancelEdit();
                                                          }}
                                                          className="h-8"
                                                          autoFocus
                                                        />
                                                        <Button size="sm" onClick={saveEdit} className="h-8 bg-green-600 hover:bg-green-700">Save</Button>
                                                        <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8">Cancel</Button>
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <div className="flex-1">
                                                          <span className="text-orange-900" onDoubleClick={() => startEdit('ad', ad.id, ad.name)}>
                                                            {ad.name}
                                                          </span>
                                                          {/* Character names used in this AD */}
                                                          {(() => {
                                                            // Find all unique character IDs used in this AD
                                                            const usedCharacterIds = new Set(
                                                              contextSessions
                                                                .filter(session => session.adId === ad.id)
                                                                .map(session => session.characterId)
                                                                .filter(Boolean)
                                                            );
                                                            const usedCharacters = characters.filter(char => usedCharacterIds.has(char.id));
                                                            
                                                            if (usedCharacters.length > 0) {
                                                              return (
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                  {usedCharacters.map(char => (
                                                                    <span key={char.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                                                      {char.name}
                                                                    </span>
                                                                  ))}
                                                                </div>
                                                              );
                                                            }
                                                            return null;
                                                          })()}
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => startEdit('ad', ad.id, ad.name)}
                                                            className="h-6 w-6 p-0 hover:bg-blue-100"
                                                          >
                                                            <Edit2 className="w-3 h-3 text-blue-600" />
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleDelete('ad', ad.id, ad.name)}
                                                            className="h-6 w-6 p-0 hover:bg-red-100"
                                                          >
                                                            <Trash2 className="w-3 h-3 text-red-600" />
                                                          </Button>
                                                        </div>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
