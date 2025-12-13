import { useState, useEffect, useMemo } from 'react';
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [expandedAds, setExpandedAds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<{ type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad', id: number } | null>(null);
  const [editingName, setEditingName] = useState("");

  // Queries
  const { data: tams = [], refetch: refetchTams } = trpc.tams.list.useQuery({ userId: currentUser.id });
  const { data: coreBeliefs = [], refetch: refetchCoreBeliefs } = trpc.coreBeliefs.list.useQuery({ userId: currentUser.id });
  const { data: emotionalAngles = [], refetch: refetchEmotionalAngles } = trpc.emotionalAngles.list.useQuery({ userId: currentUser.id });
  const { data: ads = [], refetch: refetchAds } = trpc.ads.list.useQuery({ userId: currentUser.id });
  const { data: characters = [] } = trpc.categoryCharacters.list.useQuery({ userId: currentUser.id });
  const { data: contextSessions = [] } = trpc.contextSessions.listByUser.useQuery({ userId: currentUser.id });

  // Debug: Log data to see what we're getting
  useEffect(() => {
    console.log('\n========== CATEGORY MANAGEMENT DATA ==========');
    console.log('[CM] 📊 Total Characters:', characters.length);
    console.log('[CM] 📋 Characters:', characters.map(c => ({ id: c.id, name: c.name })));
    
    console.log('[CM] 📊 Total Context Sessions:', contextSessions.length);
    console.log('[CM] 📋 Context Sessions:', contextSessions.map(s => ({
      id: s.id,
      adId: s.adId,
      characterId: s.characterId,
      hasVideoResults: !!s.videoResults,
      videoResultsType: typeof s.videoResults
    })));
    
    console.log('[CM] 📊 Total ADs:', ads.length);
    console.log('[CM] 📋 ADs:', ads.map(a => ({ id: a.id, name: a.name, emotionalAngleId: a.emotionalAngleId })));
    
    // For each AD, show which characters are used
    ads.forEach(ad => {
      const sessionsForAd = contextSessions.filter(s => s.adId === ad.id);
      const characterIds = sessionsForAd.map(s => s.characterId).filter(Boolean);
      const uniqueCharacterIds = [...new Set(characterIds)];
      const usedCharacters = characters.filter(c => uniqueCharacterIds.includes(c.id));
      
      console.log(`[CM] 🎯 AD ${ad.id} (${ad.name}):`);
      console.log(`  - Sessions for this AD: ${sessionsForAd.length}`);
      console.log(`  - Character IDs: [${characterIds.join(', ')}]`);
      console.log(`  - Unique Character IDs: [${uniqueCharacterIds.join(', ')}]`);
      console.log(`  - Used Characters: [${usedCharacters.map(c => c.name).join(', ')}]`);
    });
    
    console.log('==============================================\n');
  }, [characters, contextSessions, ads]);

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

  const toggleAd = (adId: number) => {
    setExpandedAds(prev => {
      const next = new Set(prev);
      if (next.has(adId)) {
        next.delete(adId);
      } else {
        next.add(adId);
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
    if (!editingId || !editingName.trim()) {
      console.log('[CM Save] ❌ Validation failed:', { editingId, editingName });
      return;
    }

    console.log('[CM Save] 💾 Starting save:', { type: editingId.type, id: editingId.id, newName: editingName.trim() });

    try {
      if (editingId.type === 'tam') {
        console.log('[CM Save] 📤 Calling updateTamMutation...');
        await updateTamMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        console.log('[CM Save] ✅ TAM updated, refetching...');
        await refetchTams();
        console.log('[CM Save] ✅ TAMs refetched');
      } else if (editingId.type === 'coreBelief') {
        console.log('[CM Save] 📤 Calling updateCoreBeliefMutation...');
        await updateCoreBeliefMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        console.log('[CM Save] ✅ Core Belief updated, refetching...');
        await refetchCoreBeliefs();
        console.log('[CM Save] ✅ Core Beliefs refetched');
      } else if (editingId.type === 'emotionalAngle') {
        console.log('[CM Save] 📤 Calling updateEmotionalAngleMutation...');
        await updateEmotionalAngleMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        console.log('[CM Save] ✅ Emotional Angle updated, refetching...');
        await refetchEmotionalAngles();
        console.log('[CM Save] ✅ Emotional Angles refetched');
      } else if (editingId.type === 'ad') {
        console.log('[CM Save] 📤 Calling updateAdMutation...');
        await updateAdMutation.mutateAsync({ id: editingId.id, name: editingName.trim() });
        console.log('[CM Save] ✅ AD updated, refetching...');
        await refetchAds();
        console.log('[CM Save] ✅ ADs refetched');
      }
      console.log('[CM Save] ✅ Save complete!');
      toast.success("Updated successfully!");
      cancelEdit();
    } catch (error: any) {
      console.error('[CM Save] ❌ Error:', error);
      toast.error(`Failed to update: ${error.message}`);
    }
  };

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad';
    id: number;
    name: string;
  } | null>(null);

  // Delete handlers
  const handleDelete = (type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad', id: number, name: string) => {
    // Open confirmation dialog
    setDeleteConfirmation({ open: true, type, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    const { type, id, name } = deleteConfirmation;

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
      toast.success(`Deleted "${name}" successfully!`);
      setDeleteConfirmation(null); // Close dialog
    } catch (error: any) {
      // Backend will throw error if cascade delete is blocked
      toast.error(error.message || `Failed to delete: ${error.message}`);
      setDeleteConfirmation(null); // Close dialog even on error
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
                  <div key={tam.id} className={`border-l-4 border-purple-500 pl-4 rounded-lg ${isExpanded ? 'bg-purple-50/30' : ''}`}>
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
                            <div key={coreBelief.id} className={`border-l-4 border-blue-500 pl-4 rounded-lg ${isCbExpanded ? 'bg-blue-50/30' : ''}`}>
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
                                      <div key={emotionalAngle.id} className={`border-l-4 border-green-500 pl-4 rounded-lg ${isEaExpanded ? 'bg-green-50/30' : ''}`}>
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
                                              const isAdExpanded = expandedAds.has(ad.id);
                                              const isAdEditing = editingId?.type === 'ad' && editingId.id === ad.id;
                                              
                                              // Find characters with generated videos for this AD
                                              const sessionsForAd = contextSessions.filter(session => session.adId === ad.id);
                                              const usedCharacterIds = new Set(
                                                sessionsForAd
                                                  .filter(session => {
                                                    // Check if session has at least 1 successful video
                                                    const videoResults = session.videoResults as any[] | undefined;
                                                    return videoResults && videoResults.some(v => v.status === 'success' && v.videoUrl);
                                                  })
                                                  .map(session => session.characterId)
                                                  .filter(Boolean)
                                              );
                                              const usedCharacters = characters.filter(char => usedCharacterIds.has(char.id));

                                              return (
                                                <div key={ad.id} className={`border-l-4 border-orange-500 pl-4 rounded-lg ${isAdExpanded ? 'bg-orange-50/30' : ''}`}>
                                                  {/* Ad */}
                                                  <div className="flex items-center gap-2 p-2 hover:bg-orange-50 rounded group">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => toggleAd(ad.id)}
                                                      className="p-0 h-6 w-6"
                                                    >
                                                      {isAdExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </Button>
                                                    {isAdExpanded ? <FolderOpen className="w-5 h-5 text-orange-600" /> : <Folder className="w-5 h-5 text-orange-600" />}
                                                    
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
                                                        <span className="flex-1 font-medium text-orange-900" onDoubleClick={() => startEdit('ad', ad.id, ad.name)}>
                                                          {ad.name}
                                                        </span>
                                                        <span className="text-sm text-gray-500">{usedCharacters.length} Characters</span>
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

                                                  {/* Characters */}
                                                  {isAdExpanded && (
                                                    <div className="ml-8 mt-2 space-y-2">
                                                      {usedCharacters.map((character) => (
                                                        <div key={character.id} className="border-l-4 border-pink-500 pl-4">
                                                          <div className="flex items-center gap-2 p-2 hover:bg-pink-50 rounded">
                                                            <div className="w-6 h-6 flex items-center justify-center">
                                                              <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                                                            </div>
                                                            <span className="flex-1 text-pink-900">
                                                              {character.name}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      ))}
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
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmation?.open || false} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmation?.name}"?
              <br />
              <span className="text-red-600 font-semibold">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
