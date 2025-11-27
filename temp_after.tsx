
  // Step 4: Create mappings
  const createMappings = () => {
    if (adLines.length === 0) {
      toast.error("Te rog încarcă documentul cu ad-ul mai întâi");
      return;
    }
    if (images.length === 0) {
      toast.error("Te rog încarcă cel puțin o imagine");
      return;
    }
    // Prompturile hardcodate sunt întotdeauna active, nu mai verificăm prompts.length

    // Găsește poza CTA (dacă există) - verifică dacă fileName conține 'CTA'
    const ctaImage = images.find(img => 
      img.fileName?.toUpperCase().includes('CTA') || 
      img.imageName?.toUpperCase().includes('CTA')
    );
    // Default image = prima imagine care NU conține CTA (sau prima imagine dacă toate sunt CTA)
    const defaultImage = images.find(img => 
      !img.fileName?.toUpperCase().includes('CTA') && 
      !img.imageName?.toUpperCase().includes('CTA')
    ) || images[0];
    
    console.log('[CTA Mapping] Images:', images.map(img => ({ fileName: img.fileName, hasCTA: img.fileName?.toUpperCase().includes('CTA') })));
    console.log('[CTA Mapping] CTA Image found:', ctaImage ? ctaImage.fileName : 'NONE');
    console.log('[CTA Mapping] Default Image:', defaultImage ? defaultImage.fileName : 'NONE');
    
    // Filter out labels (categoryNumber === 0) - only use actual text lines
    const textLines = adLines.filter(line => line.categoryNumber > 0);
    
    // Găsește prima linie care conține cuvintele cheie CTA
    const ctaKeywords = ['rescrie', 'cartea', 'carte', 'lacrimi'];
    let firstCTAKeywordIndex = -1;
    
    for (let i = 0; i < textLines.length; i++) {
      const lowerText = textLines[i].text.toLowerCase();
      const hasKeyword = ctaKeywords.some(keyword => lowerText.includes(keyword));
      
      console.log(`[CTA Mapping] Checking line ${i}: section="${textLines[i].section}", text="${textLines[i].text.substring(0, 40)}...", hasKeyword=${hasKeyword}`);
      
      if (hasKeyword) {
        firstCTAKeywordIndex = i;
        console.log(`[CTA Mapping] FOUND! First line with CTA keywords at index ${i}`);
        break;
      }
    }
    
    console.log('[CTA Mapping] First CTA keyword index:', firstCTAKeywordIndex);
    console.log('[CTA Mapping] Total text lines:', textLines.length);
    
    // Log all sections for debugging
    console.log('[CTA Mapping] All sections:', textLines.map((l, i) => `${i}: ${l.section}`).join(', '));
    
    // Creează combinații cu mapare simplificată:
    // - DOAR secțiunea CTA primește imagine CTA
    // - După ce se mapează CTA, toate liniile de jos până la sfârșit primesc aceeași imagine CTA
    // - Restul categoriilor primesc default image
    const newCombinations: Combination[] = textLines.map((line, index) => {
      let selectedImage = defaultImage;
      
      // DOAR dacă există poză CTA ȘI există linie cu keywords CTA ȘI suntem de la prima linie cu keywords până la sfârșit
      const shouldUseCTA = ctaImage && firstCTAKeywordIndex !== -1 && index >= firstCTAKeywordIndex;
      
      console.log(`[CTA Mapping] Line ${index}:`);
      console.log(`  - Section: "${line.section}"`);
      console.log(`  - Text: "${line.text.substring(0, 50)}..."`);
      console.log(`  - firstCTAKeywordIndex: ${firstCTAKeywordIndex}`);
      console.log(`  - index >= firstCTAKeywordIndex: ${index >= firstCTAKeywordIndex}`);
      console.log(`  - shouldUseCTA: ${shouldUseCTA}`);
      
      if (shouldUseCTA) {
        selectedImage = ctaImage;
        console.log(`  - ✅ Using CTA image: ${selectedImage.fileName}`);
      } else {
        console.log(`  - ❌ Using default image: ${selectedImage.fileName}`);
      }
      
      return {
        id: `combo-${index}`,
        text: line.text,
        imageUrl: selectedImage.url,
        imageId: selectedImage.id,
        promptType: line.promptType, // Mapare automată inteligentă
        videoName: line.videoName,
        section: line.section,
        categoryNumber: line.categoryNumber,
        redStart: line.redStart,  // Copiază pozițiile red text din AdLine
        redEnd: line.redEnd,
      };
    });

    setCombinations(newCombinations);
    setDeletedCombinations([]);
    
    console.log('[Create Mappings] Created', newCombinations.length, 'combinations from', textLines.length, 'text lines');
    console.log('[Create Mappings] First 3 texts:', textLines.slice(0, 3).map(l => l.text.substring(0, 50)));
    
    // Save to database before moving to Step 5
    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
      upsertContextSessionMutation.mutate({
        userId: localCurrentUser.id,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep: 4,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations: newCombinations,
        deletedCombinations: [],
        videoResults,
        reviewHistory,
      }, {
        onSuccess: () => {
          console.log('[Step 4] Saved before moving to Step 5');
          setCurrentStep(5); // Go to STEP 5 - Mapping
          
          if (ctaImage && firstCTAIndex !== -1) {
            const ctaLinesCount = textLines.length - firstCTAIndex;
            toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
          } else {
            toast.success(`${newCombinations.length} combinații create cu mapare automată`);
          }
        },
        onError: (error) => {
          console.error('[Step 4] Save failed:', error);
          // Still move to next step (don't block user)
          setCurrentStep(5);
          
          if (ctaImage && firstCTAIndex !== -1) {
            const ctaLinesCount = textLines.length - firstCTAIndex;
            toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
          } else {
            toast.success(`${newCombinations.length} combinații create cu mapare automată`);
          }
        },
      });
    } else {
      setCurrentStep(5);
      
      if (ctaImage && firstCTAIndex !== -1) {
        const ctaLinesCount = textLines.length - firstCTAIndex;
        toast.success(`${newCombinations.length} combinații create. Poza CTA mapata pe secțiunea CTA și toate liniile următoare (${ctaLinesCount} linii)`);
      } else {
        toast.success(`${newCombinations.length} combinații create cu mapare automată`);
      }
    }
  };

  const updateCombinationPromptType = (id: string, promptType: PromptType) => {
    setCombinations(prev =>
      prev.map(combo =>
        combo.id === id ? { ...combo, promptType } : combo
      )
    );
    
    // Lock system removed
  };

  const updateCombinationText = (id: string, text: string) => {
    setCombinations(prev =>
      prev.map(combo =>
        combo.id === id ? { ...combo, text } : combo
      )
    );
  };

  const updateCombinationImage = (id: string, imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setCombinations(prev =>
        prev.map(combo =>
          combo.id === id ? { ...combo, imageUrl: image.url, imageId: image.id } : combo
        )
      );
      
      // Lock system removed
    }
  };

  const removeCombination = (id: string) => {
    const combo = combinations.find(c => c.id === id);
    if (combo) {
      const currentIndex = combinations.findIndex(c => c.id === id);
      // Salvează combinația cu indexul original
      setDeletedCombinations(prev => [{ ...combo, originalIndex: currentIndex }, ...prev]);
      setCombinations(prev => prev.filter(c => c.id !== id));
    }
  };

  const undoDelete = () => {
    if (deletedCombinations.length > 0) {
      const lastDeleted = deletedCombinations[0];
      const originalIndex = (lastDeleted as any).originalIndex ?? combinations.length;
      
      // Restaurează la poziția originală
      setCombinations(prev => {
        const newCombinations = [...prev];
        newCombinations.splice(originalIndex, 0, lastDeleted);
        return newCombinations;
      });
      
      setDeletedCombinations(prev => prev.slice(1));
      toast.success("Combinație restaurată la poziția originală");
    }
  };

  // Step 5: Generate videos
  const generateVideos = async () => {
    if (combinations.length === 0) {
      toast.error("Nu există combinații de generat");
      return;
    }

    // Prompturile hardcodate sunt întotdeauna active, nu mai verificăm prompts.length

    try {
      setCurrentStep(6); // Go to STEP 6 - Generate
      
      // Inițializează rezultatele
      const initialResults: VideoResult[] = combinations.map(combo => ({
        text: combo.text,
        imageUrl: combo.imageUrl,
        status: 'pending' as const,
        videoName: combo.videoName,
        section: combo.section,
        categoryNumber: combo.categoryNumber,
        reviewStatus: null,
        redStart: combo.redStart,  // Copiază pozițiile red text
        redEnd: combo.redEnd,
      }));
      setVideoResults(initialResults);

      // Grupează combinațiile pe tip de prompt
      const combinationsByPrompt: Record<PromptType, typeof combinations> = {
        PROMPT_NEUTRAL: [],
        PROMPT_SMILING: [],
        PROMPT_CTA: [],
        PROMPT_CUSTOM: [],
      };

      combinations.forEach(combo => {
        combinationsByPrompt[combo.promptType].push(combo);
      });

      // Generează pentru fiecare tip de prompt cu batch processing (max 20 per batch)
      const allResults: VideoResult[] = [];
      const BATCH_SIZE = 20; // Max 20 videos per batch

      for (const [promptType, combos] of Object.entries(combinationsByPrompt)) {
        if (combos.length === 0) continue;

        // Căutare prompt: încearcă custom, apoi hardcoded
        let promptTemplate: string;
        let promptName: string;
        
        // Încearcă să găsească prompt custom
        let customPrompt;
        if (promptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (promptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (promptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
          promptName = customPrompt.name;
        } else {
          // Folosește hardcoded prompt de pe backend
          // Backend-ul va folosi HARDCODED_PROMPTS automat
          promptTemplate = `HARDCODED_${promptType}`;
          promptName = promptType;
        }

        // Split în batch-uri de max 20 videos
        const totalBatches = Math.ceil(combos.length / BATCH_SIZE);
        console.log(`[Batch Processing] ${promptType}: ${combos.length} videos, ${totalBatches} batch(es)`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, combos.length);
          const batchCombos = combos.slice(start, end);

          console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Processing ${batchCombos.length} videos (${start + 1}-${end})`);
          
          toast.info(`Processing batch ${batchIndex + 1}/${totalBatches} for ${promptType} (${batchCombos.length} videos)`);

          const result = await generateBatchMutation.mutateAsync({
            userId: currentUser.id,
            promptTemplate: promptTemplate,
            combinations: batchCombos.map(combo => ({
              text: combo.text,
              imageUrl: combo.imageUrl,
            })),
          });

          const batchResults: VideoResult[] = result.results.map((r: any) => {
            // Găsește combo-ul care corespunde textului returnat de API (nu by index!)
            const combo = batchCombos.find(c => c.text === r.text);
            if (!combo) {
              console.error('[CRITICAL] No matching combo found for API result text:', r.text?.substring(0, 50));
              // Fallback la index dacă nu găsim match (nu ar trebui să se întâmple)
              const fallbackCombo = batchCombos[result.results.indexOf(r)];
              return {
                taskId: r.taskId,
                text: r.text,
                imageUrl: r.imageUrl,
                status: r.success ? 'pending' as const : 'failed' as const,
                error: r.error,
                videoName: fallbackCombo?.videoName || 'UNKNOWN',
                section: fallbackCombo?.section || 'UNKNOWN',
                categoryNumber: fallbackCombo?.categoryNumber || 0,
                reviewStatus: null,
                redStart: fallbackCombo?.redStart,
                redEnd: fallbackCombo?.redEnd,
              };
            }
            return {
              taskId: r.taskId,
              text: r.text,
              imageUrl: r.imageUrl,
              status: r.success ? 'pending' as const : 'failed' as const,
              error: r.error,
              videoName: combo.videoName,
              section: combo.section,
              categoryNumber: combo.categoryNumber,
              reviewStatus: null,
              redStart: combo.redStart,  // Copiază pozițiile red text
              redEnd: combo.redEnd,
            };
          });

          allResults.push(...batchResults);
          
          // Delay între batch-uri pentru rate limiting (2 secunde)
          if (batchIndex < totalBatches - 1) {
            console.log(`[Batch Processing] Waiting 2s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      setVideoResults(allResults);
      const successCount = allResults.filter(r => r.status === 'pending').length;
      const failedCount = allResults.filter(r => r.status === 'failed').length;

      toast.success(`${successCount} videouri trimise spre generare`);
      
      if (failedCount > 0) {
        toast.error(`${failedCount} videouri au eșuat`);
      }
      
      // SAVE TO DATABASE after generation
      console.log('[Database Save] Saving session after video generation...');
      upsertContextSessionMutation.mutate({
        userId: localCurrentUser.id,
        tamId: selectedTamId,
        coreBeliefId: selectedCoreBeliefId,
        emotionalAngleId: selectedEmotionalAngleId,
        adId: selectedAdId,
        characterId: selectedCharacterId,
        currentStep: 6,
        rawTextAd,
        processedTextAd,
        adLines,
        prompts,
        images,
        combinations,
        deletedCombinations,
        videoResults: allResults,
        reviewHistory,
      }, {
        onSuccess: () => {
          console.log('[Database Save] Session saved successfully after generation!');
        },
        onError: (error) => {
          console.error('[Database Save] Failed to save session:', error);
          toast.error('Sesiunea nu a putut fi salvată în database, dar e salvată local');
        },
      });
    } catch (error: any) {
      toast.error(`Eroare la generarea videourilo: ${error.message}`);
    }
  };

  const checkVideoStatus = async (taskId: string, index: number) => {
    try {
      console.log(`Checking status for taskId: ${taskId}, index: ${index}`);
      
      const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: {
          'Authorization': 'Bearer a4089052f1c04c6b8be02b026ce87fe8',
        },
      });

      const data = await response.json();
      console.log('Status response:', data);

      if (data.code === 200 && data.data) {
        let status: 'pending' | 'success' | 'failed' = 'pending';
        let videoUrl: string | undefined;
        let errorMessage: string | undefined;

        console.log('Processing video status - successFlag:', data.data.successFlag);
        console.log('Full API response:', JSON.stringify(data.data, null, 2));
        
        if (data.data.successFlag === 1) {
          status = 'success';
          // Verificare alternativă pentru resultUrls (poate fi în data.data sau data.data.response)
          videoUrl = data.data.resultUrls?.[0] || data.data.response?.resultUrls?.[0];
          console.log('Video SUCCESS - URL:', videoUrl);
          console.log('resultUrls location:', data.data.resultUrls ? 'data.data.resultUrls' : 'data.data.response.resultUrls');
        } else if (data.data.successFlag === -1 || data.data.successFlag === 2) {
          // successFlag === -1 sau 2 înseamnă failed
          status = 'failed';
          errorMessage = data.data.errorMessage || data.data.error || data.data.msg || 'Unknown error';
          console.log('Video FAILED - Error:', errorMessage);
        } else if (data.data.errorMessage || data.data.error) {
          // Dacă există errorMessage dar successFlag nu e -1, tot considerăm failed
          status = 'failed';
          errorMessage = data.data.errorMessage || data.data.error;
          console.log('Video FAILED (detected via errorMessage) - Error:', errorMessage);
        } else if (data.data.successFlag === 0) {
          // successFlag === 0 înseamnă pending
          status = 'pending';
          console.log('Video PENDING - successFlag:', data.data.successFlag);
        } else {
          console.log('Video status UNKNOWN - successFlag:', data.data.successFlag);
          console.log('Setting as pending by default');
        }

        setVideoResults(prev =>
          prev.map((v, i) =>
            i === index
              ? {
                  ...v,
                  status: status,
                  videoUrl: videoUrl,
                  error: errorMessage,
                }
              : v
          )
        );
        
        console.log(`Video #${index} updated in videoResults:`, {
          status,
          videoUrl,
          error: errorMessage,
        });

        // Only show toast for NEW status changes (not for videos already loaded from DB)
        const previousVideo = videoResults[index];
        const isNewSuccess = status === 'success' && !previousVideo.videoUrl;
        const isNewFailure = status === 'failed' && previousVideo.status !== 'failed';
        
        if (isNewSuccess) {
          toast.success(`Video #${index + 1} generat cu succes!`);
          
          // Save to DB immediately after success
          const updatedVideoResults = videoResults.map((v, i) =>
            i === index
              ? {
                  ...v,
                  status: status,
                  videoUrl: videoUrl,
                  error: errorMessage,
                }
              : v
          );
          
          await upsertContextSessionMutation.mutateAsync({
            userId: localCurrentUser.id,
            tamId: selectedTamId,
            coreBeliefId: selectedCoreBeliefId!,
            emotionalAngleId: selectedEmotionalAngleId!,
            adId: selectedAdId!,
            characterId: selectedCharacterId!,
            currentStep,
            rawTextAd,
            processedTextAd,
            adLines,
            prompts,
            images,
            combinations,
            deletedCombinations,
            videoResults: updatedVideoResults,
            reviewHistory,
          });
        } else if (isNewFailure) {
          toast.error(`Video #${index + 1} a eșuat: ${errorMessage}`);
        }
        // Nu mai afișăm toast pentru pending - doar UI update
      } else {
        toast.error(`Răspuns invalid de la API: ${data.msg || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error checking video status:', error);
      toast.error(`Eroare la verificarea statusului: ${error.message}`);
    }
  };

  const downloadVideo = (url: string, index: number) => {
    window.open(url, '_blank');
    toast.success(`Descărcare video #${index + 1} pornită`);
  };

  // TEMPORARY: Load sample videos for testing when Kie.ai is down
  const loadSampleVideos = async () => {
    // Task IDs și URL-uri hardcodate (furnizate de user)
    const sampleData = [
      {
        taskId: '352a1aaaaba3352b6652305f2469718d',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/352a1aaaaba3352b6652305f2469718d_1763136934.mp4',
        text: "Pentru femeile care s-au săturat să trăiască de la o lună la alta și cred că 'așa e viața'. Acest mesaj este pentru voi.",
        section: 'HOOKS' as SectionType,
      },
      {
        taskId: 'f4207b34d031dfbfcc06915e8cd8f4d2',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/f4207b34d031dfbfcc06915e8cd8f4d2_1763116288.mp4',
        text: "Pentru femeile care simt că oricât se străduiesc, nu reușesc să iasă din datorii. Acest mesaj este pentru voi.",
        section: 'MIRROR' as SectionType,
      },
      {
        taskId: '119acff811870bcdb8da7cca59d58ddb',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/119acff811870bcdb8da7cca59d58ddb_1763116319.mp4',
        text: "Știu cum e să simți că nu mai poți din cauză că nu mai faci față cu cheltuielile și să-ți vină să renunți la tot.",
        section: 'DCS' as SectionType,
      },
      {
        taskId: '155a3426ecbf0f4548030f333716f597',
        videoUrl: 'https://tempfile.aiquickdraw.com/v/155a3426ecbf0f4548030f333716f597_1763116288.mp4',
        text: "Dacă simți că viața ta e doar despre supraviețuire, cheltuieli, stres și lipsuri, ascultă-mă un minut.",
        section: 'TRANZITION' as SectionType,
      },
    ];
    
    toast.info('Încărcare sample videos...');
    
    try {
      // Creează videoResults cu videoUrl deja completat (hardcodat)
      const sampleResults: VideoResult[] = sampleData.map((data, index) => {
        // Pentru HOOKS folosește HOOK (singular) în nume
        const categoryName = data.section === 'HOOKS' ? 'HOOK' : data.section;
        // Video names are now generated in STEP 2 based on full context
        // For sample videos, use a placeholder format
        const categoryNumber = 1;
        
        return {
          taskId: data.taskId,
          videoName: `SAMPLE_${categoryName}${categoryNumber}`,
          text: data.text,
          imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
          status: 'success' as const,
          videoUrl: data.videoUrl,
          section: data.section,
          categoryNumber: categoryNumber,
          reviewStatus: null,
        };
      });
      
      setVideoResults(sampleResults);
      
      // Creează și combinations pentru sample videos
      const sampleCombinations: Combination[] = sampleData.map((data, index) => {
        // Pentru HOOKS folosește HOOK (singular) în nume
        const categoryName = data.section === 'HOOKS' ? 'HOOK' : data.section;
        // Toate sample videos sunt prima linie din categoria lor (categoryNumber = 1)
        const categoryNumber = 1;
        
        return {
          id: `sample-${index}`,
          text: data.text,
          imageUrl: 'https://via.placeholder.com/270x480/blue/white?text=Sample',
          imageId: `sample-img-${index}`,
          promptType: 'PROMPT_NEUTRAL' as PromptType,
          videoName: `SAMPLE_${categoryName}${categoryNumber}`,
          section: data.section,
          categoryNumber: categoryNumber,
        };
      });
      
      setCombinations(sampleCombinations);
      setCurrentStep(7); // Go to STEP 7 - Check Videos
      
      toast.success(`4/4 sample videos încărcate cu succes!`);
      console.log('Sample videos loaded:', sampleResults.map(v => v.videoName));
    } catch (error: any) {
      toast.error(`Eroare la încărcarea sample videos: ${error.message}`);
    }
  };
  
  // Regenerare toate videouri (failed + rejected)
  const regenerateAll = async () => {
    // Colectează toate videouri care trebuie regenerate: failed SAU rejected SAU duplicate negenerat (status null)
    const toRegenerateIndexes = videoResults
      .map((v, i) => ({ video: v, index: i }))
      .filter(({ video }) => 
        video.status === 'failed' || 
        video.reviewStatus === 'regenerate' ||
        video.status === null  // Include duplicate-uri negenerate
      )
      .map(({ index }) => index);
    
    if (toRegenerateIndexes.length === 0) {
      toast.error('Nu există videouri de regenerat');
      return;
    }

    try {
      toast.info(`Se regenerează ${toRegenerateIndexes.length} videouri...`);
      
      // Grupează pe tip de prompt
      const combinationsByPrompt: Record<PromptType, Array<{ combo: typeof combinations[0], index: number }>> = {
        PROMPT_NEUTRAL: [],
        PROMPT_SMILING: [],
        PROMPT_CTA: [],
        PROMPT_CUSTOM: [],
      };

      toRegenerateIndexes.forEach(index => {
        const combo = combinations[index];
        if (combo) {
          combinationsByPrompt[combo.promptType].push({ combo, index });
        }
      });

      let successCount = 0;
      let failCount = 0;

      // Regenerează pentru fiecare tip de prompt
      for (const [promptType, items] of Object.entries(combinationsByPrompt)) {
        if (items.length === 0) continue;

        // Determină prompt template
        let promptTemplate: string;
        let customPrompt;
        
        if (promptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (promptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (promptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
        } else {
          promptTemplate = `HARDCODED_${promptType}`;
        }

        const result = await generateBatchMutation.mutateAsync({
          userId: currentUser.id,
          promptTemplate: promptTemplate,
          combinations: items.map(({ combo }) => ({
            text: combo.text,
            imageUrl: combo.imageUrl,
          })),
        });

        // Actualizează videoResults
        result.results.forEach((newResult: any, i: number) => {
          const originalIndex = items[i].index;
          
          setVideoResults(prev =>
            prev.map((v, idx) =>
              idx === originalIndex
                  ? {
                    ...v,
                    taskId: newResult.taskId,
                    status: newResult.success ? 'pending' as const : 'failed' as const,
                    error: newResult.error,
                    videoUrl: undefined,
                    reviewStatus: undefined, // Reset review status
                  }
                : v
            )
          );

          if (newResult.success) {
            successCount++;
          } else {
            failCount++;
          }
        });
      }

      if (successCount > 0) {
        toast.success(`${successCount} videouri retrimise pentru generare`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} videouri au eșuat din nou`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare batch: ${error.message}`);
    }
  };

  // ========== DUPLICATE VIDEO FUNCTIONS ==========

  /**
   * Creează un duplicate al unui video card
   * Duplicate-ul va avea status null și va fi regenerat când se apasă "Regenerate All"
   */
  const duplicateVideo = useCallback((videoName: string) => {
    const videoIndex = videoResults.findIndex(v => v.videoName === videoName);
    
    if (videoIndex < 0) {
      toast.error('Video nu găsit');
      return;
    }
    
    const originalVideo = videoResults[videoIndex];
    const originalCombo = combinations[videoIndex];
    
    if (!originalCombo) {
      toast.error('Combinație nu găsită');
      return;
    }
    
    // Generează nume duplicate
    const originalName = getOriginalVideoName(videoName);
    const duplicateName = generateDuplicateName(originalName, videoResults);
    
    // Creează duplicate video result
    // Copiază INPUT-urile (text, imageUrl) dar RESETEAZĂ OUTPUT-urile (taskId, videoUrl, status, reviewStatus)
    const duplicateVideoResult: VideoResult = {
      ...originalVideo, // Copiază toate câmpurile
      videoName: duplicateName,
      // RESET output fields - duplicatul e un video NOU care nu a fost generat încă
      taskId: undefined,
      videoUrl: undefined,
      // RESET status și reviewStatus - duplicatul e un video negenerat
      status: null, // null = not generated yet
      reviewStatus: null, // null = no review yet
      isDuplicate: true,
      duplicateNumber: getDuplicateNumber(duplicateName),
      originalVideoName: originalName,
    };
    
    console.log('[Duplicate Video] Created:', {
      originalName: videoName,
      duplicateName,
      originalStatus: originalVideo.status,
      duplicateStatus: duplicateVideoResult.status,
      originalVideoUrl: originalVideo.videoUrl,
      duplicateVideoUrl: duplicateVideoResult.videoUrl,
    });
    
    // Creează duplicate combination
    const duplicateCombo: Combination = {
      ...originalCombo,
      id: `combo-duplicate-${Date.now()}`,
      videoName: duplicateName,
    };
    
    // Adaugă duplicate după originalul său
    setVideoResults(prev => {
      const newResults = [...prev];
      newResults.splice(videoIndex + 1, 0, duplicateVideoResult);
      return newResults;
    });
    
    setCombinations(prev => {
      const newCombos = [...prev];
      newCombos.splice(videoIndex + 1, 0, duplicateCombo);
      return newCombos;
    });
    
    toast.success(`Duplicate creat: ${duplicateName}`);
  }, [videoResults, combinations]);

  /**
   * Șterge un video card (duplicate sau original)
   * Permite ștergerea oricărui video card
   */
  const deleteDuplicate = useCallback((videoName: string) => {
    // Allow deleting any video card, not just duplicates
    // if (!isDuplicateVideo(videoName)) {
    //   toast.error('Poți șterge doar duplicate-uri (videoName cu _D1, _D2, etc.)');
    //   return;
    // }
    
    const videoIndex = videoResults.findIndex(v => v.videoName === videoName);
    
    if (videoIndex < 0) {
      toast.error('Video nu găsit');
      return;
    }
    
    // Șterge din videoResults și combinations
    setVideoResults(prev => prev.filter((_, i) => i !== videoIndex));
    setCombinations(prev => prev.filter((_, i) => i !== videoIndex));
    
    toast.success(`Duplicate șters: ${videoName}`);
  }, [videoResults]);

  // Expune funcțiile pentru Step6
  useEffect(() => {
    (window as any).__duplicateVideo = duplicateVideo;
    (window as any).__deleteDuplicate = deleteDuplicate;
    
    return () => {
      delete (window as any).__duplicateVideo;
      delete (window as any).__deleteDuplicate;
    };
  }, [duplicateVideo, deleteDuplicate]);

  // Regenerare video cu modificări (Modify & Regenerate)
  const regenerateWithModifications = async (index: number) => {
    const combo = combinations[index];
    
    if (!combo) {
      toast.error('Combinație nu găsită');
      return;
    }
    
    // Text și pozițiile roșu sunt deja în state (modifyDialogueText, modifyRedStart, modifyRedEnd)
    
    // Validare text
    if (modifyDialogueText.trim().length === 0) {
      toast.error('Textul nu poate fi gol!');
      return;
    }
    
    console.log('[Regenerate With Modifications] Using text from state:', modifyDialogueText.substring(0, 50));
    console.log('[Regenerate With Modifications] Red positions:', modifyRedStart, '-', modifyRedEnd);

    try {
      // Determină prompt template
      let promptTemplate: string;
      
      // Dacă utilizatorul a editat promptul custom, folosește-l
      if (modifyPromptText.trim().length > 0) {
        promptTemplate = modifyPromptText;
      } else {
        // Altfel, folosește prompt type selectat
        let customPrompt;
        if (modifyPromptType === 'PROMPT_NEUTRAL') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
        } else if (modifyPromptType === 'PROMPT_SMILING') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
        } else if (modifyPromptType === 'PROMPT_CTA') {
          customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
        }
        
        if (customPrompt) {
          promptTemplate = customPrompt.template;
        } else {
          promptTemplate = `HARDCODED_${modifyPromptType}`;
        }
      }

      const result = await generateBatchMutation.mutateAsync({
        userId: currentUser.id,
        promptTemplate: promptTemplate,
        combinations: [{
          text: modifyDialogueText, // Folosește textul din state
          imageUrl: combo.imageUrl,
        }],
      });

      const newResult = result.results[0];
      
      // Actualizează videoResults și combinations cu noul text
      setVideoResults(prev =>
        prev.map((v, i) =>
          i === index
            ? {
                ...v,
                text: modifyDialogueText, // Update text
                taskId: newResult.taskId,
                status: newResult.success ? 'pending' as const : 'failed' as const,
                error: newResult.error,
                videoUrl: undefined,
              }
            : v
        )
      );
      
      // Update combinations cu noul prompt type și text
      setCombinations(prev =>
        prev.map((c, i) =>
          i === index
            ? {
                ...c,
                text: modifyDialogueText,
                promptType: modifyPromptType,
              }
            : c
        )
      );
      
      // Update adLines with red text positions
      setAdLines(prev => prev.map(line => {
        if (line.text === combo.text) {
          return {
            ...line,
            text: modifyDialogueText,
            charCount: modifyDialogueText.length,
            redStart: modifyRedStart,
            redEnd: modifyRedEnd,
          };
        }
        return line;
      }));

      // Închide form-ul
      setModifyingVideoIndex(null);
      setModifyPromptText('');
      setModifyDialogueText('');

      if (newResult.success) {
        toast.success(`Video #${index + 1} retrimis cu modificări`);
      } else {
        toast.error(`Eroare la retrimite video #${index + 1}: ${newResult.error}`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare cu modificări: ${error.message}`);
    }
  };

  // Regenerare video individual cu aceleași setări
  const regenerateSingleVideo = async (index: number) => {
    const video = videoResults[index];
    const combo = combinations[index];
    
    if (!combo) {
      toast.error('Combinație nu găsită');
      return;
    }

    try {
      // Închide modal-ul IMEDIAT (nu așteaptă după API call)
      setModifyingVideoIndex(null);
      
      // Determină prompt template (custom sau hardcoded)
      let promptTemplate: string;
      const promptType = combo.promptType;
      
      let customPrompt;
      if (promptType === 'PROMPT_NEUTRAL') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('NEUTRAL'));
      } else if (promptType === 'PROMPT_SMILING') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('SMILING'));
      } else if (promptType === 'PROMPT_CTA') {
        customPrompt = prompts.find(p => p.name.toUpperCase().includes('CTA'));
      }
      
      if (customPrompt) {
        promptTemplate = customPrompt.template;
      } else {
        promptTemplate = `HARDCODED_${promptType}`;
      }

      const result = await generateBatchMutation.mutateAsync({
        userId: currentUser.id,
        promptTemplate: promptTemplate,
        combinations: [{
          text: combo.text,
          imageUrl: combo.imageUrl,
        }],
      });

      const newResult = result.results[0];
      
      // Actualizează videoResults cu noul taskId ȘI șterge reviewStatus (forțează re-render)
      setVideoResults(prev => [
        ...prev.map((v, i) =>
          i === index
            ? {
                ...v,
                taskId: newResult.taskId,
                status: newResult.success ? 'pending' as const : 'failed' as const,
                error: newResult.error,
                videoUrl: undefined, // Reset videoUrl
                reviewStatus: null, // Șterge Rejected/Approved când regenerăm
              }
            : v
        )
      ]);

      if (newResult.success) {
        toast.success(`Video #${index + 1} retrimis pentru generare`);
      } else {
        toast.error(`Eroare la retrimite video #${index + 1}: ${newResult.error}`);
      }
    } catch (error: any) {
      toast.error(`Eroare la regenerare: ${error.message}`);
    }
  };
  // Auto-check video status pentru videouri pending (polling)
  useEffect(() => {
    if (videoResults.length === 0) return;

    // Only poll if we're in Step 6 (generation step)
    if (currentStep !== 6) return;

    // Only poll videos that are truly pending (no videoUrl yet)
    const pendingVideos = videoResults.filter(v => v.status === 'pending' && v.taskId && !v.videoUrl);
    if (pendingVideos.length === 0) return;

    console.log(`[Polling] Starting polling for ${pendingVideos.length} truly pending videos`);

    // Check-uri din 5 în 5 secunde de la început
    const interval = setInterval(() => {
      const stillPending = videoResults.filter(v => v.status === 'pending' && v.taskId && !v.videoUrl);
      if (stillPending.length === 0) {
        console.log('[Polling] All videos completed, stopping polling');
        clearInterval(interval);
        return;
      }

      console.log(`[Polling] Checking ${stillPending.length} pending videos...`);
      stillPending.forEach((video) => {
        const actualIndex = videoResults.findIndex(v => v.taskId === video.taskId);
        if (actualIndex !== -1 && video.taskId) {
          checkVideoStatus(video.taskId, actualIndex);
        }
      });
    }, 5000); // 5 secunde

    return () => {
      clearInterval(interval);
    };
  }, [videoResults, currentStep])  // DISABLED: Auto-check când intri în STEP 6 - cauzează false "în curs de regenerare" la refresh
  // Polling-ul de mai sus (line 3047) este suficient pentru videouri pending reale
  // ========== WORD DOCUMENT GENERATION ==========
  const generateWordDocument = useCallback(() => {
    // Group adLines by section
    const linesBySection: Record<SectionType, AdLine[]> = {
      HOOKS: [],
      MIRROR: [],
      DCS: [],
      TRANZITION: [],
      NEW_CAUSE: [],
      MECHANISM: [],
      EMOTIONAL_PROOF: [],
      TRANSFORMATION: [],
      CTA: [],
      OTHER: [],
    };

    adLines.forEach(line => {
      linesBySection[line.section].push(line);
    });

    // Generate HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #16a34a; margin-top: 30px; border-bottom: 2px solid #16a34a; padding-bottom: 5px; }
          .line-item { margin: 15px 0; padding: 10px; background-color: #f9fafb; border-left: 4px solid #2563eb; }
          .video-name { font-weight: bold; color: #1e40af; margin-bottom: 5px; }
          .line-text { margin: 5px 0; line-height: 1.6; }
          .red-text { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Linii Extrase - Step 2</h1>
    `;

    // Add sections
    Object.entries(linesBySection).forEach(([section, lines]) => {
      if (lines.length === 0) return;

      htmlContent += `<h2>${section}</h2>`;

      lines.forEach(line => {
        htmlContent += `<div class="line-item">`;
        htmlContent += `<div class="video-name">${line.videoName}</div>`;
        htmlContent += `<div class="line-text">`;

        // Add text with red highlighting
        if (line.redStart !== undefined && line.redStart >= 0 && line.redEnd !== undefined && line.redEnd >= 0) {
          const before = line.text.substring(0, line.redStart);
          const red = line.text.substring(line.redStart, line.redEnd);
          const after = line.text.substring(line.redEnd);
          htmlContent += `${before}<span class="red-text">${red}</span>${after}`;
        } else {
          htmlContent += line.text;
        }

        htmlContent += `</div></div>`;
      });
    });

    htmlContent += `</body></html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Linii_Extrase_Step2.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Document Word descărcat!');
  }, [adLines]);

  // ========== STEP 6: Review functions (MEMOIZED) ==========
  const acceptVideo = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: 'accepted' as const }
        : v
    ));
    
    setReviewHistory(prev => [...prev, {
      videoName,
      previousStatus: videoResults.find(v => v.videoName === videoName)?.reviewStatus || null,
      newStatus: 'accepted',
    }]);
    
    toast.success(`Video ${videoName} acceptat!`);
  }, [videoResults]);

  const regenerateVideo = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: 'regenerate' as const }
        : v
    ));
    setReviewHistory(prev => [...prev, {
      videoName,
      previousStatus: videoResults.find(v => v.videoName === videoName)?.reviewStatus || null,
      newStatus: 'regenerate',
    }]);
    toast.info(`${videoName} marcat pentru regenerare`);
  }, [videoResults]);

  const undoReviewDecision = useCallback((videoName: string) => {
    setVideoResults(prev => prev.map(v => 
      v.videoName === videoName 
        ? { ...v, reviewStatus: null }
        : v
    ));
    toast.success(`Decizie anulată pentru ${videoName}`);
  }, []);

  const undoReview = useCallback(() => {
    if (reviewHistory.length === 0) {
      toast.error('Nu există acțiuni de anulat');
      return;
    }
    
    const lastAction = reviewHistory[reviewHistory.length - 1];
    
    setVideoResults(prev => prev.map(v => 
      v.videoName === lastAction.videoName 
        ? { ...v, reviewStatus: lastAction.previousStatus }
        : v
    ));
    
    setReviewHistory(prev => prev.slice(0, -1));
    toast.success(`Acțiune anulată pentru ${lastAction.videoName}`);
  }, [reviewHistory]);

  const goToCheckVideos = async () => {
    setCurrentStep(7); // Go to STEP 7 - Check Videos
    
    // Save currentStep to DB
    await upsertContextSessionMutation.mutateAsync({
      userId: localCurrentUser.id,
      tamId: selectedTamId,
      coreBeliefId: selectedCoreBeliefId!,
      emotionalAngleId: selectedEmotionalAngleId!,
      adId: selectedAdId!,
      characterId: selectedCharacterId!,
      currentStep: 7,
      rawTextAd,
      processedTextAd,
      adLines,
      prompts,
      images,
      combinations,
      deletedCombinations,
      videoResults,
      reviewHistory,
    });
  };

  // Navigation
  const goToStep = async (step: number) => {
    // Allow free navigation in both directions
    setCurrentStep(step);
    
    // Save currentStep to DB
    await upsertContextSessionMutation.mutateAsync({
      userId: localCurrentUser.id,
      tamId: selectedTamId,
      coreBeliefId: selectedCoreBeliefId!,
      emotionalAngleId: selectedEmotionalAngleId!,
      adId: selectedAdId!,
      characterId: selectedCharacterId!,
      currentStep: step,
      rawTextAd,
      processedTextAd,
      adLines,
      prompts,
      images,
      combinations,
      deletedCombinations,
      videoResults,
      reviewHistory,
    });
  };

  const goBack = () => {
    if (currentStep > 1) {
      // Dacă sunt modificări, întreabă user
      if (hasModifications) {
        if (!confirm('Ai modificări nesalvate. Sigur vrei să te întorci?')) {
          return;
        }
        setHasModifications(false); // Reset modificări
      }
      setCurrentStep(currentStep - 1);
    }
  };

  // Show loading screen while restoring session
  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header Navigation Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Brand */}
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-yellow-300" />
              <span className="text-white font-bold text-lg">A.I Ads Engine</span>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setLocation("/images-library")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <Images className="w-4 h-4" />
                Images Library
              </button>
              <button
                onClick={() => setLocation("/prompts-library")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Prompts Library
              </button>
              <button
                onClick={() => setLocation("/category-management")}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <Folder className="w-4 h-4" />
                Ads Management
              </button>
              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="flex items-center gap-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            </div>
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-800 transition-colors">
                  {localCurrentUser.profileImageUrl && (
                    <img
                      src={localCurrentUser.profileImageUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border-2 border-white object-cover"
                    />
                  )}
                  {!localCurrentUser.profileImageUrl && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-800 flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {localCurrentUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-white text-sm font-medium">{localCurrentUser.username}</span>
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      <div className="container max-w-6xl mx-auto py-4 md:py-8 px-2 md:px-4">
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={localCurrentUser}
        onProfileUpdated={(updatedUser: any) => {
          setLocalCurrentUser(updatedUser);
          // Update parent component
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }}
      />
      
      {/* Processing Modal for Step 8 batch processing */}
      <ProcessingModal
        open={showProcessingModal}
        ffmpegProgress={processingProgress.ffmpeg}
        whisperProgress={processingProgress.whisper}
        cleanvoiceProgress={processingProgress.cleanvoice}
        currentVideoName={processingProgress.currentVideoName}
        processingStep={processingStep}
      />
      
      {/* Merge Videos Modal for Step 9 → Step 10 */}
      <Dialog open={isMergingStep10} onOpenChange={(open) => {
        if (!open && isMergingStep10) return;
        setIsMergingStep10(open);
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => {
          if (isMergingStep10) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              🔥 Merge Videos
            </DialogTitle>
            <DialogDescription>
              Merging trimmed videos with FFmpeg API...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isMergingStep10 ? (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm font-semibold text-purple-900 mb-2">
                    🔥 Processing...
                  </p>
                  <div className="flex items-center gap-2 text-xs text-purple-700 mb-3">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Merging {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl).length} videos...
                  </div>
                  
                  {/* List videos being merged */}
                  <ul className="text-xs text-purple-700 space-y-1">
                    {videoResults
                      .filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl)
                      .map(v => (
                        <li key={v.videoName} className="truncate">• {v.videoName}</li>
                      ))}
                  </ul>
                </div>
                
                <p className="text-xs text-center text-gray-500">
                  This may take a few minutes...
                </p>
              </>
            ) : (
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-purple-900">
                  ✅ Merge Complete!
                </p>
                <p className="text-sm text-gray-600">
                  Navigating to Step 10...
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Merge Final Videos Modal for Step 10 → Step 11 */}
      <Dialog open={isMergingFinalVideos} onOpenChange={(open) => {
        if (!open && mergeFinalProgress.status === 'processing') return;
        setIsMergingFinalVideos(open);
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => {
          if (mergeFinalProgress.status === 'processing') e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
              🎬 Merge Final Videos
            </DialogTitle>
            <DialogDescription>
              Merging hooks + body into final video combinations...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {mergeFinalProgress.status === 'processing' ? (
              <>
                <div className="space-y-2">
                  <Progress 
                    value={(mergeFinalProgress.current / mergeFinalProgress.total) * 100} 
                    className="h-3"
                  />
                  <p className="text-center text-sm font-medium text-gray-700">
                    {mergeFinalProgress.current}/{mergeFinalProgress.total} final videos merged
                  </p>
                </div>
                
                {mergeFinalProgress.current < mergeFinalProgress.total && mergeFinalProgress.currentVideo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      🎬 Current: {mergeFinalProgress.currentVideo}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Merging hook + body with FFmpeg...
                    </div>
                  </div>
                )}
                
                {mergeFinalProgress.current < mergeFinalProgress.total && (
                  <p className="text-xs text-center text-gray-500">
                    ⏱️ Estimated time: ~{Math.ceil((mergeFinalProgress.total - mergeFinalProgress.current) * 10 / 60)} {Math.ceil((mergeFinalProgress.total - mergeFinalProgress.current) * 10 / 60) === 1 ? 'minute' : 'minutes'}
                  </p>
                )}
              </>
            ) : mergeFinalProgress.status === 'complete' ? (
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-green-900">
                  ✅ Merge Complete!
                </p>
                <p className="text-sm text-gray-600">
                  {mergeFinalProgress.current} final videos created successfully
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Trimming Modal for Step 8 → Step 9 */}
      <Dialog open={isTrimmingModalOpen} onOpenChange={(open) => {
        // Prevent closing during processing
        if (!open && trimmingProgress.status === 'processing') return;
        setIsTrimmingModalOpen(open);
      }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => {
          // Prevent closing by clicking outside during processing
          if (trimmingProgress.status === 'processing') e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {trimmingProgress.status === 'processing' && (
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              )}
              ✂️ Procesare Videouri (FFmpeg + CleanVoice)
            </DialogTitle>
            <DialogDescription>
              Tăiem fiecare video la timestamps-urile detectate și înlocuim audio cu versiunea procesată de CleanVoice...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {trimmingProgress.status === 'processing' ? (
              <>
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress 
                    value={(trimmingProgress.current / trimmingProgress.total) * 100} 
                    className="h-3"
                  />
                  <p className="text-center text-sm font-medium text-gray-700">
                    {trimmingProgress.current}/{trimmingProgress.total} videouri tăiate
                  </p>
                </div>
                
                {/* Removed: Current Video popup - replaced by progress bars */}
                
                {/* Estimated Time */}
                {trimmingProgress.current < trimmingProgress.total && (
                  <p className="text-xs text-center text-gray-500">
                    ⏱️ Timp estimat rămas: ~{Math.ceil((trimmingProgress.total - trimmingProgress.current) * 10 / 60)} {Math.ceil((trimmingProgress.total - trimmingProgress.current) * 10 / 60) === 1 ? 'minut' : 'minute'}
                  </p>
                )}
              </>
            ) : trimmingProgress.status === 'complete' || trimmingProgress.status === 'partial' ? (
              <>
                {/* Results Summary */}
                <div className={`${trimmingProgress.status === 'complete' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
                  <p className="text-sm font-semibold mb-3">
                    {trimmingProgress.status === 'complete' ? '✅ All videos trimmed successfully!' : '⚠️ Trimming completed with errors'}
                  </p>
                  
                  {/* Success List */}
                  {trimmingProgress.successVideos.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-green-700 mb-1">✅ Success ({trimmingProgress.successVideos.length}):</p>
                      <div className="max-h-32 overflow-y-auto bg-white rounded p-2 text-xs">
                        {trimmingProgress.successVideos.map((v, i) => (
                          <div key={i} className="text-green-600">• {v.name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Failed List */}
                  {trimmingProgress.failedVideos.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-red-700 mb-1">❌ Failed ({trimmingProgress.failedVideos.length}):</p>
                      <div className="max-h-32 overflow-y-auto bg-white rounded p-2 text-xs">
                        {trimmingProgress.failedVideos.map((v, i) => (
                          <div key={i} className="text-red-600">
                            • {v.name}<br />
                            <span className="text-gray-500 ml-3">{v.error} (Retry {v.retries}/3)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Warning for rate limit */}
                  {trimmingProgress.failedVideos.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-2 mt-2">
                      <p className="text-xs text-orange-700">
                        ⚠️ WARNING: FFmpeg API has max 10 requests per minute limit
                      </p>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {trimmingProgress.successVideos.length > 0 && (
                      <button
                        onClick={() => {
                          setIsTrimmingModalOpen(false);
                          setCurrentStep(9);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        ✅ Continue to Step 9
                      </button>
                    )}
                    {trimmingProgress.failedVideos.length > 0 && (
                      <button
                        onClick={() => {
                          // TODO: Implement retry logic
                          toast.info('Retry functionality coming soon!');
                        }}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        🔄 Retry Failed ({trimmingProgress.failedVideos.length})
                      </button>
                    )}
                    <button
                      onClick={() => setIsTrimmingModalOpen(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      ❌ Close
                    </button>
                  </div>
                </div>
              </>
            ) : trimmingProgress.status === 'error' ? (
              <>
                {/* Error Message */}
                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <X className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900 mb-1">
                      Trimming failed
                    </p>
                    <p className="text-sm text-gray-600">
                      {trimmingProgress.message}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cut & Merge Modal */}
      <Dialog open={isMergeModalOpen} onOpenChange={setIsMergeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ✂️ Cut & Merge (Test)
            </DialogTitle>
            <DialogDescription>
              Preview merged video (temporary - not saved to database)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!mergedVideoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">{mergeProgress}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Merge complete! Preview below:
                  </p>
                </div>
                
                <video
                  src={mergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                <p className="text-xs text-gray-500 text-center">
                  💡 This is a temporary preview. Click "TRIM ALL VIDEOS" to save final cuts.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                setIsMergeModalOpen(false);
                setMergedVideoUrl(null);
                setMergeProgress('');
              }}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Download ZIP Progress Modal */}
      <Dialog open={isDownloadZipModalOpen} onOpenChange={setIsDownloadZipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Descarcă Arhivă ZIP
            </DialogTitle>
            <DialogDescription>
              Creez arhiva cu toate videoclipurile acceptate...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 text-center">{downloadZipProgress}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Sample Merge Modal */}
      <Dialog open={isSampleMergeModalOpen} onOpenChange={(open) => {
        setIsSampleMergeModalOpen(open);
        if (!open) {
          setEditingNoteId(null);
          setEditingNoteText('');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎬 Sample Merge ALL Videos
            </DialogTitle>
            <DialogDescription>
              Preview all videos merged together (temporary - not saved to database)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!sampleMergedVideoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">{sampleMergeProgress}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-900">
                    ✅ Sample merge complete! Preview below:
                  </p>
                </div>
                
                {/* Video Player */}
                <video
                  src={sampleMergedVideoUrl}
                  controls
                  className="w-full rounded-lg border border-gray-300"
                  style={{ maxHeight: '400px' }}
                />
                
                {/* Video List with Notes */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Videos in this merge:</h3>
                  <div className="space-y-2">
                    {sampleMergeVideos.map((video) => (
                      <div key={video.name} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{video.name}</p>
                          
                          {/* Note editor */}
                          {editingNoteId === video.name ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="Add note for Step 9..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    // 1. Update sampleMergeVideos INSTANTLY
                                    const updatedVideos = sampleMergeVideos.map(v =>
                                      v.name === video.name ? { ...v, note: editingNoteText } : v
                                    );
                                    setSampleMergeVideos(updatedVideos);
                                    
                                    // 2. Update videoResults INSTANTLY
                                    const updatedVideoResults = videoResults.map(v =>
                                      v.videoName === video.name ? { ...v, step9Note: editingNoteText } : v
                                    );
                                    setVideoResults(updatedVideoResults);
                                    
                                    // 3. Close editing mode INSTANTLY
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                    toast.success('Note saved!');
                                    
                                    // 4. Save to database in BACKGROUND (no await)
                                    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                      upsertContextSessionMutation.mutate({
                                        userId: currentUser.id,
                                        coreBeliefId: selectedCoreBeliefId,
                                        emotionalAngleId: selectedEmotionalAngleId,
                                        adId: selectedAdId,
                                        characterId: selectedCharacterId,
                                        currentStep,
                                        rawTextAd,
                                        processedTextAd,
                                        adLines,
                                        prompts,
                                        images,
                                        combinations,
                                        deletedCombinations,
                                        videoResults: updatedVideoResults,
                                        reviewHistory,
                                      });
                                    }
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            video.note && (
                              <p className="mt-1 text-xs text-gray-600">📝 {video.note}</p>
                            )
                          )}
                        </div>
                        
                        {/* Add Note link */}
                        {editingNoteId !== video.name && (
                          <button
                            onClick={() => {
                              setEditingNoteId(video.name);
                              setEditingNoteText(video.note);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                          >
                            {video.note ? 'Edit note' : 'Add note'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  💡 This is a temporary preview. Click "TRIM ALL VIDEOS" to save final cuts.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                setIsSampleMergeModalOpen(false);
                setSampleMergedVideoUrl(null);
                setSampleMergeProgress('');
                setEditingNoteId(null);
                setEditingNoteText('');
              }}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



        {/* Context Selector */}
        <div className="mb-4 p-3 bg-white border border-blue-200 rounded-lg shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              Select Your Working Context
            </h2>
            <p className="text-sm text-gray-600">Choose all 5 categories to start working. This context will apply to all steps.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* TAM */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                1. TAM
              </Label>
              <Select 
                value={selectedTamId?.toString() || ''} 
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new TAM name:');
                    if (name && name.trim()) {
                      const result = await createTamMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        name: name.trim(),
                      });
                      setSelectedTamId(result.id);
                      refetchTams();
                      toast.success('TAM created!');
                    }
                  } else if (value) {
                    setSelectedTamId(parseInt(value));
                    // Reset dependent selections
                    setSelectedCoreBeliefId(null);
                    setSelectedEmotionalAngleId(null);
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select TAM" />
                </SelectTrigger>
                <SelectContent>
                  {tams.map((tam, index) => (
                    <SelectItem key={tam.id} value={tam.id.toString()}>{index + 1}. {tam.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New TAM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Core Belief */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                2. Core Belief
              </Label>
              <Select 
                value={selectedCoreBeliefId?.toString() || ''}
                disabled={!selectedTamId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Core Belief name:');
                    if (name && name.trim()) {
                      const result = await createCoreBeliefMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        tamId: selectedTamId,
                        name: name.trim(),
                      });
                      setSelectedCoreBeliefId(result.id);
                      refetchCoreBeliefs();
                      toast.success('Core Belief created!');
                    }
                  } else if (value) {
                    setSelectedCoreBeliefId(parseInt(value));
                    // Reset dependent selections
                    setSelectedEmotionalAngleId(null);
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Core Belief" />
                </SelectTrigger>
                <SelectContent>
                  {coreBeliefs.map((cb, index) => (
                    <SelectItem key={cb.id} value={cb.id.toString()}>{index + 1}. {cb.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Core Belief</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Emotional Angle */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                3. Emotional Angle
              </Label>
              <Select 
                value={selectedEmotionalAngleId?.toString() || ''}
                disabled={!selectedCoreBeliefId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Emotional Angle name:');
                    if (name && name.trim()) {
                      const result = await createEmotionalAngleMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        coreBeliefId: selectedCoreBeliefId,
                        name: name.trim(),
                      });
                      setSelectedEmotionalAngleId(result.id);
                      refetchEmotionalAngles();
                      toast.success('Emotional Angle created!');
                    }
                  } else if (value) {
                    setSelectedEmotionalAngleId(parseInt(value));
                    // Reset dependent selections
                    setSelectedAdId(null);
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Emotional Angle" />
                </SelectTrigger>
                <SelectContent>
                  {emotionalAngles.map((ea, index) => (
                    <SelectItem key={ea.id} value={ea.id.toString()}>{index + 1}. {ea.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Emotional Angle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ad */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                4. Ad
              </Label>
              <Select 
                value={selectedAdId?.toString() || ''}
                disabled={!selectedEmotionalAngleId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Ad name:');
                    if (name && name.trim()) {
                      const result = await createAdMutation.mutateAsync({
                        userId: localCurrentUser.id,
                        emotionalAngleId: selectedEmotionalAngleId,
                        name: name.trim(),
                      });
                      setSelectedAdId(result.id);
                      setSelectedCharacterId(null); // Reset character for new AD
                      refetchAds();
                      toast.success('Ad created!');
                    }
                  } else if (value) {
                    setSelectedAdId(parseInt(value));
                    // Reset character
                    setSelectedCharacterId(null);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Ad" />
                </SelectTrigger>
                <SelectContent>
                  {ads.map((ad, index) => (
                    <SelectItem key={ad.id} value={ad.id.toString()}>{index + 1}. {ad.name}</SelectItem>
                  ))}
                  <SelectItem value="new">+ New Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Character (Required) */}
            <div>
              <Label className="text-sm font-semibold text-blue-900 mb-2 block">
                5. Character *
              </Label>
              <Select 
                value={selectedCharacterId?.toString() || ''}
                disabled={!selectedAdId}
                onValueChange={async (value) => {
                  if (value === 'new') {
                    const name = prompt('Enter new Character name:');
                    if (name && name.trim()) {
                      // Check for duplicate character name
                      const isDuplicate = categoryCharacters.some(char => char.name.toLowerCase() === name.trim().toLowerCase());
                      if (isDuplicate) {
                        toast.error(`Character "${name.trim()}" already exists!`);
                        return;
                      }
                      try {
                        const result = await createCharacterMutation.mutateAsync({
                          userId: localCurrentUser.id,
                          name: name.trim(),
                        });
                        await refetchCharacters();
                        setSelectedCharacterId(result.id);
                        toast.success('Character created!');
                      } catch (error: any) {
                        toast.error(`Failed to create character: ${error.message}`);
                      }
                    }
                  } else if (value) {
                    const newCharacterId = parseInt(value);
                    // Simply update character selection without auto-duplicate
                    setSelectedCharacterId(newCharacterId);
                    previousCharacterIdRef.current = newCharacterId;
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Character" />
                </SelectTrigger>
                <SelectContent>
                  {/* UNUSED Characters */}
                  {sortedCategoryCharacters.unused.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-600 bg-green-50">
                        ✨ UNUSED ({sortedCategoryCharacters.unused.length})
                      </div>
                      {sortedCategoryCharacters.unused.map((char) => (
                        <SelectItem key={char.id} value={char.id.toString()}>
                          <div className="flex items-center gap-2">
                            {char.thumbnailUrl && (
                              <img 
                                src={char.thumbnailUrl} 
                                alt={char.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span>{char.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* USED Characters */}
                  {sortedCategoryCharacters.used.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-t">
                        📋 USED ({sortedCategoryCharacters.used.length})
                      </div>
                      {sortedCategoryCharacters.used.map((char) => (
                        <SelectItem key={char.id} value={char.id.toString()}>
                          <div className="flex items-center gap-2">
                            {char.thumbnailUrl && (
                              <img 
                                src={char.thumbnailUrl} 
                                alt={char.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span>{char.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  <SelectItem value="new">+ New Character</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          

        </div>

        {/* Context Required Warning */}
        {(!selectedTamId || !selectedCoreBeliefId || !selectedEmotionalAngleId || !selectedAdId || !selectedCharacterId) && (
          <div className="mb-8 p-6 bg-red-50 border-2 border-red-300 rounded-lg">
            <h3 className="text-xl font-bold text-red-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">⛔</span>
              Context Required
            </h3>
            <p className="text-red-700">Please select all 5 categories (TAM, Core Belief, Emotional Angle, Ad, Character) in the context selector above to access the workflow steps.</p>
          </div>
        )}

        {/* Breadcrumbs - Professional & Consistent */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
        <div className="w-full mb-8">
          <div className="flex items-center justify-between px-6 py-6 bg-white rounded-lg shadow-sm border border-gray-200">
            {[
              { num: 1, label: "Prepare", fullLabel: "Prepare Ad" },
              { num: 2, label: "Extract", fullLabel: "Extracted Lines" },
              { num: 3, label: "Prompts", fullLabel: "Prompts" },
              { num: 4, label: "Images", fullLabel: "Images" },
              { num: 5, label: "Mapping", fullLabel: "Mapping" },
              { num: 6, label: "Generate", fullLabel: "Generate" },
              { num: 7, label: "Check", fullLabel: "Check Videos" },
              { num: 8, label: "Cut Prep", fullLabel: "Prepare for Cut" },
              { num: 9, label: "Trimmed", fullLabel: "Trimmed Videos" },
              { num: 10, label: "Merge", fullLabel: "Merge Videos" },
              { num: 11, label: "Final", fullLabel: "Final Videos" },
            ].map((step, index, array) => (
              <div key={step.num} className="contents">
                {/* Step Container */}
                <div className="flex flex-col items-center gap-2 relative group">
                  {/* Badge */}
                  <button
                    onClick={() => goToStep(step.num)}
                    title={step.fullLabel}
                    className={`
                      w-14 h-14 rounded-full 
                      flex items-center justify-center 
                      font-bold text-lg
                      transition-all duration-200
                      relative z-10
                      ${
                        currentStep === step.num
                          ? "bg-blue-600 text-white shadow-lg ring-4 ring-blue-200"
                          : currentStep > step.num
                          ? "bg-green-500 text-white shadow-md hover:bg-green-600 hover:scale-105"
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }
                    `}
                  >
                    {currentStep > step.num ? (
                      <Check className="w-7 h-7" />
                    ) : (
                      step.num
                    )}
                  </button>
                  
                  {/* Label */}
                  <span className={`
                    text-xs font-semibold text-center
                    whitespace-nowrap
                    transition-colors duration-200
                    ${
                      currentStep === step.num
                        ? "text-blue-900 font-bold"
                        : currentStep > step.num
                        ? "text-green-700"
                        : "text-gray-500"
                    }
                  `}>
                    {step.label}
                  </span>
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                    <div className="bg-gray-900 text-white text-xs py-1 px-3 rounded shadow-lg whitespace-nowrap">
                      {step.fullLabel}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < array.length - 1 && (
                  <div className="flex-1 flex items-center px-2">
                    <div className={`
                      h-1 w-full rounded-full
                      transition-all duration-300
                      ${
                        currentStep > step.num ? "bg-green-500" : "bg-gray-200"
                      }
                    `} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Back Button */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && currentStep > 1 && (
          <div className="mb-4">
            <Button
              onClick={goBack}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Înapoi la STEP {currentStep - 1}
            </Button>
          </div>
        )}
        
        {/* All Steps - Only show if context is complete */}
        {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
        <>
        {/* STEP 1: Prepare Text Ad */}
        {currentStep === 1 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 1 - Prepare Text Ad
              </CardTitle>
              <CardDescription>
                Selectează categoriile și pregătește textul ad-ului (118-125 caractere).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-8 px-3 md:px-8 pb-4 md:pb-8">
              {/* Context Info */}
              <div className="mb-6 p-4 bg-blue-50/50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Context</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Core Belief:</span>
                    <p className="text-blue-900 font-semibold">{coreBeliefs.find(cb => cb.id === selectedCoreBeliefId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Emotional Angle:</span>
                    <p className="text-blue-900 font-semibold">{emotionalAngles.find(ea => ea.id === selectedEmotionalAngleId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Ad:</span>
                    <p className="text-blue-900 font-semibold">{ads.find(ad => ad.id === selectedAdId)?.name || 'Not selected'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Character:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedCharacterId && categoryCharacters.find(char => char.id === selectedCharacterId)?.thumbnailUrl && (
                        <img 
                          src={categoryCharacters.find(char => char.id === selectedCharacterId)?.thumbnailUrl || ''} 
                          alt="Character"
                          className="w-8 h-8 rounded-full object-cover border-2 border-blue-300"
                        />
                      )}
                      <p className="text-blue-900 font-semibold">{categoryCharacters.find(char => char.id === selectedCharacterId)?.name || 'Not selected'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COPY CONTEXT Button */}
              <div className="mb-6">
                <Button
                  onClick={async () => {
                    // Check if current context has data to copy
                    if (!rawTextAd || rawTextAd.trim().length === 0) {
                      toast.error('Current Ad has no data to copy. Please add content first.');
                      return;
                    }
                    
                    // Find all available target Ads for current context (exclude current Ad)
                    const targetAds = ads.filter(ad => 
                      ad.emotionalAngleId === selectedEmotionalAngleId && ad.id !== selectedAdId
                    );
                    
                    if (targetAds.length === 0) {
                      toast.error('No other Ads available for this Emotional Angle');
                      return;
                    }
                    
                    // Show selection dialog
                    const adNames = targetAds.map(ad => `${ad.id}. ${ad.name}`).join('\n');
                    const selection = prompt(`Copy context TO which Ad?\n\n${adNames}\n\nEnter Ad ID:`);
                    
                    if (!selection) return;
                    
                    const targetAdId = parseInt(selection);
                    const targetAd = targetAds.find(ad => ad.id === targetAdId);
                    
                    if (!targetAd) {
                      toast.error('Invalid Ad ID');
                      return;
                    }
                    
                    // Confirm action
                    if (!confirm(`Copy context FROM current Ad \"${ads.find(ad => ad.id === selectedAdId)?.name}\" TO \"${targetAd.name}\"?\n\nThis will overwrite Step 1-3 data in the target Ad.`)) {
                      return;
                    }
                    
                    // Copy Step 1-3 data to target Ad
                    const updatedSession = {
                      userId: localCurrentUser.id,
                      tamId: selectedTamId!,
                      coreBeliefId: selectedCoreBeliefId!,
                      emotionalAngleId: selectedEmotionalAngleId!,
                      adId: targetAdId,
                      characterId: selectedCharacterId!,
                      currentStep: 4, // Set to Step 4
                      rawTextAd,
                      processedTextAd,
                      adLines: JSON.stringify(adLines),
                      prompts: '[]',
                      images: '[]',
                      combinations: '[]',
                      deletedCombinations: '[]',
                      videoResults: '[]',
                      reviewHistory: '[]',
                    };
                    
                    upsertContextSessionMutation.mutate(updatedSession, {
                      onSuccess: () => {
                        toast.success(`Context copied to \"${targetAd.name}\"!`);
                      },
                      onError: (error: any) => {
                        toast.error(`Failed to copy context: ${error.message}`);
                      },
                    });
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={!selectedAdId || !selectedCharacterId || adLines.length === 0}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  COPY CONTEXT TO ANOTHER AD
                </Button>
                <p className="text-xs text-gray-500 mt-2">Copy Step 1-3 data from current Ad to another Ad with the same character</p>
              </div>

              {/* OLD CATEGORIES - TO BE REMOVED */}
              <div className="hidden">
                <div className="mb-4">
                  <Label className="text-blue-900 font-medium mb-2 block">Core Belief:</Label>
                  <Select 
                    value={selectedCoreBeliefId?.toString() || ''} 
                    onValueChange={async (value) => {
                      if (value === 'new') {
                        const name = prompt('Enter new Core Belief name:');
                        if (name && name.trim()) {
                          const result = await createCoreBeliefMutation.mutateAsync({
                            userId: localCurrentUser.id,
                            name: name.trim(),
                          });
                          await refetchCoreBeliefs();
                          setSelectedCoreBeliefId(result.id);
                          setSelectedEmotionalAngleId(null);
                          setSelectedAdId(null);
                          toast.success('Core Belief created!');
                        }
                      } else {
                        setSelectedCoreBeliefId(parseInt(value));
                        setSelectedEmotionalAngleId(null);
                        setSelectedAdId(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Core Belief" />
                    </SelectTrigger>
                    <SelectContent>
                      {coreBeliefs.map((cb) => (
                        <SelectItem key={cb.id} value={cb.id.toString()}>{cb.name}</SelectItem>
                      ))}
                      <SelectItem value="new">+ New Core Belief</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Emotional Angle */}
                {selectedCoreBeliefId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Emotional Angle:</Label>
                    <Select 
                      value={selectedEmotionalAngleId?.toString() || ''} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Emotional Angle name:');
                          if (name && name.trim()) {
                            const result = await createEmotionalAngleMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              coreBeliefId: selectedCoreBeliefId,
                              name: name.trim(),
                            });
                            await refetchEmotionalAngles();
                            setSelectedEmotionalAngleId(result.id);
                            setSelectedAdId(null);
                            toast.success('Emotional Angle created!');
                          }
                        } else {
                          setSelectedEmotionalAngleId(parseInt(value));
                          setSelectedAdId(null);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Emotional Angle" />
                      </SelectTrigger>
                      <SelectContent>
                        {emotionalAngles.map((ea) => (
                          <SelectItem key={ea.id} value={ea.id.toString()}>{ea.name}</SelectItem>
                        ))}
                        <SelectItem value="new">+ New Emotional Angle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Ad */}
                {selectedEmotionalAngleId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Ad:</Label>
                    <Select 
                      value={selectedAdId?.toString() || ''} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Ad name:');
                          if (name && name.trim()) {
                            const result = await createAdMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              emotionalAngleId: selectedEmotionalAngleId,
                              name: name.trim(),
                            });
                            await refetchAds();
                            setSelectedAdId(result.id);
                            setSelectedCharacterId(null); // Reset character for new AD
                            toast.success('Ad created!');
                          }
                        } else {
                          setSelectedAdId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Ad" />
                      </SelectTrigger>
                      <SelectContent>
                        {ads.map((ad) => (
                          <SelectItem key={ad.id} value={ad.id.toString()}>{ad.name}</SelectItem>
                        ))}
                        <SelectItem value="new">+ New Ad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Character (Optional) */}
                {selectedAdId && (
                  <div className="mb-4">
                    <Label className="text-blue-900 font-medium mb-2 block">Character (Optional):</Label>
                    <Select 
                      value={selectedCharacterId?.toString() || 'none'} 
                      onValueChange={async (value) => {
                        if (value === 'new') {
                          const name = prompt('Enter new Character name:');
                          if (name && name.trim()) {
                            // Check for duplicate character name
                            const isDuplicate = categoryCharacters.some(char => char.name.toLowerCase() === name.trim().toLowerCase());
                            if (isDuplicate) {
                              toast.error(`Character "${name.trim()}" already exists!`);
                              return;
                            }
                            const result = await createCharacterMutation.mutateAsync({
                              userId: localCurrentUser.id,
                              name: name.trim(),
                            });
                            await refetchCharacters();
                            setSelectedCharacterId(result.id);
                            toast.success('Character created!');
                          }
                        } else if (value === 'none') {
                          setSelectedCharacterId(null);
                        } else {
                          setSelectedCharacterId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Character (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        
                        {/* UNUSED Characters */}
                        {sortedCategoryCharacters.unused.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-green-600 bg-green-50">
                              ✨ UNUSED ({sortedCategoryCharacters.unused.length})
                            </div>
                            {sortedCategoryCharacters.unused.map((char) => (
                              <SelectItem key={char.id} value={char.id.toString()}>{char.name}</SelectItem>
                            ))}
                          </>
                        )}
                        
                        {/* USED Characters */}
                        {sortedCategoryCharacters.used.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border-t">
                              📋 USED ({sortedCategoryCharacters.used.length})
                            </div>
                            {sortedCategoryCharacters.used.map((char) => (
                              <SelectItem key={char.id} value={char.id.toString()}>{char.name}</SelectItem>
                            ))}
                          </>
                        )}
                        <SelectItem value="new">+ New Character</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Show text input section only after all required categories are selected */}
              {selectedTamId && selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId && (
                <>
                  {/* Input Method Selector */}
                  <div className="mb-6">
                    <Label className="text-blue-900 font-medium mb-2 block">Input Method:</Label>
                    <Select value={textAdMode} onValueChange={(value: 'upload' | 'paste' | 'google-doc') => setTextAdMode(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload">Upload Ad</SelectItem>
                        <SelectItem value="paste">Paste Ad</SelectItem>
                        <SelectItem value="google-doc">Google Doc Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Upload Mode */}
                  {textAdMode === 'upload' && (
                    <div className="mb-6">
                      <div
                        className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                        onClick={() => document.getElementById('text-upload')?.click()}
                        onDrop={handleTextFileDrop}
                        onDragOver={handleTextFileDragOver}
                      >
                        {rawTextAd && uploadedFileName ? (
                          <>
                            <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                            <p className="text-blue-900 font-semibold mb-1">{uploadedFileName}</p>
                            <p className="text-sm text-gray-600 mb-2">{(rawTextAd.length / 1024).toFixed(1)} KB • {rawTextAd.length} characters</p>
                            <p className="text-xs text-blue-600 hover:text-blue-800">Click to replace</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <p className="text-blue-900 font-medium mb-2">Drop text file here or click to upload</p>
                            <p className="text-sm text-gray-500 italic">Suportă .txt, .doc, .docx</p>
                          </>
                        )}
                        <input
                          id="text-upload"
                          type="file"
                          accept=".txt,.doc,.docx"
                          className="hidden"
                          onChange={handleTextFileUpload}
                        />
                      </div>
                      {rawTextAd && (
                        <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                          <p className="text-sm text-gray-700 mb-2"><strong>Preview:</strong></p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{rawTextAd.replace(/\n\s*\n\s*\n+/g, '\n\n').substring(0, 200)}{rawTextAd.length > 200 ? '...' : ''}</p>
                          <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Paste Mode */}
                  {textAdMode === 'paste' && (
                    <div className="mb-6">
                      <Label className="text-blue-900 font-medium mb-2 block">Paste your ad text:</Label>
                      <textarea
                        value={rawTextAd}
                        onChange={(e) => setRawTextAd(e.target.value)}
                        className="w-full h-40 p-4 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="Paste your ad text here..."
                      />
                      {rawTextAd && (
                        <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                      )}
                    </div>
                  )}

                  {/* Google Doc Mode */}
                  {textAdMode === 'google-doc' && (
                    <div className="mb-6">
                      <Label className="text-blue-900 font-medium mb-2 block">Google Doc Link:</Label>
                      <input
                        type="text"
                        placeholder="Paste Google Doc link here (e.g., https://docs.google.com/document/d/...)" 
                        className="w-full p-4 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none mb-4"
                        onPaste={async (e) => {
                          const link = e.clipboardData.getData('text');
                          if (link.includes('docs.google.com/document')) {
                            try {
                              // Extract document ID from link
                              const docIdMatch = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
                              if (!docIdMatch) {
                                toast.error('Invalid Google Doc link format');
                                return;
                              }
                              const docId = docIdMatch[1];
                              
                              // Convert to export URL (plain text)
                              const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
                              
                              toast.info('Fetching Google Doc content...');
                              
                              // Fetch the document content
                              const response = await fetch(exportUrl);
                              if (!response.ok) {
                                toast.error('Failed to fetch Google Doc. Make sure the document is publicly accessible.');
                                return;
                              }
                              
                              const text = await response.text();
                              setRawTextAd(text);
                              setUploadedFileName('Google Doc');
                              toast.success('Google Doc loaded successfully!');
                            } catch (error) {
                              console.error('Error fetching Google Doc:', error);
                              toast.error('Failed to load Google Doc');
                            }
                          } else {
                            toast.error('Please paste a valid Google Doc link');
                          }
                        }}
                      />
                      {rawTextAd && (
                        <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg">
                          <p className="text-sm text-gray-700 mb-2"><strong>Preview:</strong></p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{rawTextAd.substring(0, 200)}{rawTextAd.length > 200 ? '...' : ''}</p>
                          <p className="text-xs text-gray-500 mt-2">{rawTextAd.length} characters</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={processText}
                      disabled={!rawTextAd || rawTextAd.trim().length === 0 || processTextAdMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                    >
                      {processTextAdMutation.isPending ? 'Processing...' : (
                        <>
                          <FileEdit className="w-5 h-5 mr-2" />
                          Next: Prepare Ad
                          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Text Ad Document */}
        {currentStep === 2 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 2 - Text Ad Document
              </CardTitle>
              <CardDescription>
                Încărcă documentul cu ad-ul (.docx). Liniile vor fi extrase automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Document Upload (only shown when no lines available) */}
              {adLines.length === 0 && (
                <div className="mb-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-900 text-sm">
                    ⚠️ No lines available from STEP 1. Please go back to STEP 1 to process text.
                  </p>
                </div>
              )}
              
              <div
                onDrop={handleAdDocumentDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50"
                onClick={() => !adDocument && document.getElementById('ad-upload')?.click()}
                style={{ display: adDocument || adLines.length > 0 ? 'none' : 'block' }}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <p className="text-blue-900 font-medium mb-2">
                  Drop document here or click to upload
                </p>
                <p className="text-sm text-gray-500 italic">Suportă .docx, .doc</p>
              </div>
              <input
                id="ad-upload"
                type="file"
                accept=".docx,.doc"
                className="hidden"
                onChange={handleAdDocumentSelect}
              />
              
              {/* Buton șterge document */}
              {adDocument && (
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      setAdDocument(null);
                      setAdLines([]);
                      const input = document.getElementById('ad-upload') as HTMLInputElement;
                      if (input) input.value = '';
                      toast.success('Document șters. Poți încărca altul.');
                    }}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Șterge document
                  </Button>
                </div>
              )}

              {adLines.length > 0 && (
                <div className="mt-6">
                  {deletedLinesHistory.length > 0 && (
                    <div className="mb-4">
                      <Button
                        onClick={() => {
                          const lastDeleted = deletedLinesHistory[0];
                          setAdLines(prev => [...prev, lastDeleted]);
                          setDeletedLinesHistory(prev => prev.slice(1));
                          toast.success(`Linie restaurată: ${lastDeleted.videoName}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Undo2 className="w-4 h-4" />
                        UNDO - Restaurează ultima linie ștearsă
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-blue-900">
                      {adLines.filter(l => l.categoryNumber > 0).length} linii extrase:
                    </p>
                  </div>
                  <div className="space-y-2">
                    {adLines.map((line) => {
                      // If categoryNumber is 0, this is a label (section header)
                      if (line.categoryNumber === 0) {
                        // Check if this is a subcategory (H1-H100) or main category
                        const isSubcategory = /^H\d+$/.test(line.text);
                        
                        return (
                          <div key={line.id} className="mt-4 mb-2">
                            {isSubcategory ? (
                              <h4 className="font-bold text-blue-700 text-base border-b border-blue-200 pb-1">
                                {line.text}
                              </h4>
                            ) : (
                              <h3 className="font-bold text-blue-800 text-lg border-b-2 border-blue-300 pb-1">
                                {line.text}
                              </h3>
                            )}
                          </div>
                        );
                      }
                      
                      // Otherwise, it's a content line
                      // Split text into normal (black) and added (red) parts
                      const hasRedText = line.redStart !== undefined && line.redStart >= 0 && line.redEnd !== undefined;
                      const redText = hasRedText ? line.text.substring(line.redStart, line.redEnd) : '';
                      const whiteBeforeRed = hasRedText ? line.text.substring(0, line.redStart) : '';
                      const whiteAfterRed = hasRedText ? line.text.substring(line.redEnd) : line.text;
                      
                      // Determine display order: if RED is at start (redStart = 0), show RED first
                      const redAtStart = hasRedText && line.redStart === 0;
                      
                      return (
                        <div key={line.id} className="ml-4" data-line-id={line.id}>
                          <div className="p-3 bg-white rounded border border-blue-200 text-sm relative">
                            {/* Edit and Delete Buttons */}
                            <div className="absolute top-2 right-2 flex gap-2">
                              <Button
                                onClick={() => {
                                  if (confirm(`Șterge linia "${line.videoName}"?`)) {
                                    // Save to history before deleting
                                    setDeletedLinesHistory(prev => [line, ...prev]);
                                    setAdLines(prev => prev.filter(l => l.id !== line.id));
                                    toast.success('Linie ștearsă (UNDO disponibil)');
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                              >
                                Del
                              </Button>
                              <Button
                                onClick={() => {
                                  if (editingLineId === line.id) {
                                    setEditingLineId(null);
                                  } else {
                                    setEditingLineId(line.id);
                                    // Normalize text: remove excessive line breaks (3+ newlines → 2 newlines)
                                    const normalizedText = line.text.replace(/\n\s*\n\s*\n+/g, '\n\n');
                                    setEditingLineText(normalizedText);
                                    setEditingLineRedStart(line.redStart ?? -1);
                                    setEditingLineRedEnd(line.redEnd ?? -1);
                                  }
                                }}
                                variant="outline"
                                size="sm"
                              >
                                {editingLineId === line.id ? 'Cancel' : 'Edit'}
                              </Button>
                            </div>
                            
                            {/* Name above text */}
                            <div className="mb-1">
                              <span className="text-xs text-gray-500 italic">{line.videoName}</span>
                            </div>
                            
                            {/* Text with red highlighting */}
                            <p className="text-gray-800 mb-2 pr-16">
                              {redAtStart && <span className="text-red-600 font-medium">{redText}</span>}
                              {whiteBeforeRed}
                              {!redAtStart && hasRedText && <span className="text-red-600 font-medium">{redText}</span>}
                              {whiteAfterRed}
                            </p>
                            
                            {/* Character count */}
                            <div className="text-xs text-gray-500">
                              {line.charCount} caractere
                            </div>
                          </div>
                          
                          {/* Inline Edit Form */}
                          {editingLineId === line.id && (
                            <div className="mt-2 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
                              <h5 className="font-bold text-blue-900">Edit Text</h5>
                              
                              {/* Textarea */}
                              <div>
                                <Label className="text-sm text-gray-700 mb-1 block">Text:</Label>
                                <textarea
                                  value={editingLineText}
                                  onChange={(e) => {
                                    setEditingLineText(e.target.value);
                                  }}
                                  className="w-full h-20 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  placeholder="Enter text..."
                                />
                                <div className={`text-xs mt-1 ${
                                  editingLineText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-600'
                                }`}>
                                  {editingLineText.length} / 125 characters
                                  {editingLineText.length > 125 && (
                                    <span className="ml-2">⚠️ Warning: Exceeds 125 characters!</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Mark RED/BLACK Buttons */}
                              <div>
                                <Label className="text-sm text-gray-700 mb-2 block">Mark text as RED:</Label>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => {
                                      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                                      if (textarea) {
                                        const start = textarea.selectionStart;
                                        const end = textarea.selectionEnd;
                                        if (start !== end) {
                                          setEditingLineRedStart(start);
                                          setEditingLineRedEnd(end);
                                          toast.success('Text marked as RED');
                                        } else {
                                          toast.error('Please select text first');
                                        }
                                      }
                                    }}
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Mark as RED
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setEditingLineRedStart(-1);
                                      setEditingLineRedEnd(-1);
                                      toast.success('RED marking removed');
                                    }}
                                    size="sm"
                                    variant="outline"
                                  >
                                    Clear RED
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Preview */}
                              {editingLineRedStart >= 0 && editingLineRedEnd > editingLineRedStart && (
                                <div>
                                  <Label className="text-sm text-gray-700 mb-1 block">Preview:</Label>
                                  <div className="p-3 bg-white border border-gray-300 rounded">
                                    <p className="text-gray-800">
                                      {editingLineText.substring(0, editingLineRedStart)}
                                      <span className="text-red-600 font-medium">
                                        {editingLineText.substring(editingLineRedStart, editingLineRedEnd)}
                                      </span>
                                      {editingLineText.substring(editingLineRedEnd)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Save Button */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setAdLines(prev => prev.map(l => {
                                      if (l.id === line.id) {
                                        return {
                                          ...l,
                                          text: editingLineText,
                                          charCount: editingLineText.length,
                                          redStart: editingLineRedStart,
                                          redEnd: editingLineRedEnd,
                                        };
                                      }
                                      return l;
                                    }));
                                    // Lock system removed
                                    
                                    toast.success('Text saved!');
                                    setEditingLineId(null);
                                    
                                    // Auto-scroll back to the edited line
                                    setTimeout(() => {
                                      const element = document.querySelector(`[data-line-id="${line.id}"]`);
                                      if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }, 100);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingLineId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="px-6 py-3"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        // Save to database before moving to next step
                        if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                          upsertContextSessionMutation.mutate({
                            userId: localCurrentUser.id,
                            coreBeliefId: selectedCoreBeliefId,
                            emotionalAngleId: selectedEmotionalAngleId,
                            adId: selectedAdId,
                            characterId: selectedCharacterId,
                            currentStep: 2,
                            rawTextAd,
                            processedTextAd,
                            adLines,
                            prompts,
                            images,
                            combinations,
                            deletedCombinations,
                            videoResults,
                            reviewHistory,
                          }, {
                            onSuccess: () => {
                              console.log('[Step 2] Saved before moving to Step 3');
                              setCurrentStep(3);
                            },
                            onError: (error) => {
                              console.error('[Step 2] Save failed:', error);
                              // Still move to next step (don't block user)
                              setCurrentStep(3);
                            },
                          });
                        } else {
                          setCurrentStep(3);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Next: Choose Prompts
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}
              
              {/* OLD CONTENT - TO BE REMOVED */}
              <div className="hidden">
              <div className="mb-6">
                <Label className="text-blue-900 font-medium mb-2 block">Tip prompturi:</Label>
                <Select value={promptMode} onValueChange={(value: 'hardcoded' | 'custom' | 'manual') => setPromptMode(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hardcoded">Prompturi hardcodate</SelectItem>
                    <SelectItem value="custom">Adaugă prompturi custom</SelectItem>
                    <SelectItem value="manual">Manual prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode: Prompturi hardcodate */}
              {promptMode === 'hardcoded' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="mb-2">
                    <span className="font-medium text-green-900">Prompturi hardcodate (întotdeauna active)</span>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>✓ PROMPT_NEUTRAL - pentru secțiuni până la TRANSFORMATION</p>
                    <p>✓ PROMPT_SMILING - pentru TRANSFORMATION și CTA</p>
                    <p>✓ PROMPT_CTA - pentru CTA cu carte</p>
                  </div>
                </div>
              )}

              {/* Mode: Upload prompturi custom */}
              {promptMode === 'custom' && (
              <div className="mb-4">
                <p className="font-medium text-blue-900 mb-3">Adaugă prompturi custom (opțional):</p>
                
                {/* Upload .docx */}
                <div
                  onDrop={handlePromptDocumentDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50 mb-4"
                  onClick={() => document.getElementById('prompt-upload')?.click()}
                >
                  <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-900 font-medium mb-2">
                    Drop prompt documents here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 italic">Suportă .docx, .doc (maxim 3 fișiere)</p>
                  <input
                    id="prompt-upload"
                    type="file"
                    accept=".docx,.doc"
                    multiple
                    className="hidden"
                    onChange={handlePromptDocumentSelect}
                  />
                </div>

                {prompts.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-blue-900">
                        {prompts.length} prompturi custom încărcate:
                      </p>
                      <Button
                        onClick={() => {
                          setPrompts([]);
                          const input = document.getElementById('prompt-upload') as HTMLInputElement;
                          if (input) input.value = '';
                          toast.success('Toate prompturile custom au fost șterse.');
                        }}
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Șterge toate
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {prompts.map((prompt) => (
                        <div key={prompt.id} className="p-3 bg-white rounded border border-blue-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900">{prompt.name}</span>
                          <button
                            onClick={() => removePrompt(prompt.id)}
                            className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                 )}
              </div>
              )}

              {/* Mode: Manual prompt */}
              {promptMode === 'manual' && (
                <div className="mb-4">
                  <div className="border-2 border-blue-300 rounded-lg p-4 bg-white">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                      Scrie prompt manual (trebuie să conțină [INSERT TEXT]):
                    </label>
                    <textarea
                      value={manualPromptText}
                      onChange={(e) => setManualPromptText(e.target.value)}
                      placeholder="Exemplu: Generate a video with the following text: [INSERT TEXT]. Make it engaging and professional."
                      className="w-full h-32 p-3 border border-blue-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={() => {
                        if (!manualPromptText.includes('[INSERT TEXT]')) {
                          toast.error('Promptul trebuie să conțină [INSERT TEXT]');
                          return;
                        }
                        if (manualPromptText.trim().length === 0) {
                          toast.error('Promptul nu poate fi gol');
                          return;
                        }
                        
                        const newPrompt: UploadedPrompt = {
                          id: `manual-${Date.now()}`,
                          name: `Custom Prompt #${prompts.length + 1}`,
                          template: manualPromptText,
                          file: null, // Prompt manual, fără fișier
                        };
                        
                        setPrompts(prev => [...prev, newPrompt]);
                        setManualPromptText('');
                        toast.success('Prompt manual adăugat!');
                      }}
                      disabled={!manualPromptText.includes('[INSERT TEXT]') || manualPromptText.trim().length === 0}
                      className="mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                      Adaugă Prompt Manual
                    </Button>
                  </div>
                </div>
              )}

              {/* Buton continuare - întotdeauna vizibil */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  Next: Choose Prompts
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
              </div>
              {/* END OLD CONTENT */}
            </CardContent>
          </Card>
        )}



        {/* STEP 3: Prompts */}
        {currentStep === 3 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <FileText className="w-5 h-5" />
                STEP 3 - Prompts
              </CardTitle>
              <CardDescription>
                Prompturile hardcodate sunt întotdeauna active. Poți adăuga și prompturi custom (.docx).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Hardcoded Prompts Info */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="mb-2">
                  <span className="font-medium text-green-900">Prompturi hardcodate (întotdeauna active)</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p>✓ PROMPT_NEUTRAL - pentru secțiuni până la TRANSFORMATION</p>
                  <p>✓ PROMPT_SMILING - pentru TRANSFORMATION și CTA</p>
                  <p>✓ PROMPT_CTA - pentru CTA cu carte</p>
                </div>
              </div>

              {/* Upload Custom Prompts */}
              <div className="mb-4">
                <p className="font-medium text-blue-900 mb-3">Adaugă prompturi custom (opțional):</p>
                
                <div
                  onDrop={handlePromptDocumentDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50/50 mb-4"
                  onClick={() => document.getElementById('prompt-upload')?.click()}
                >
                  <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-blue-900 font-medium mb-2">
                    Drop prompt documents here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 italic">Suportă .docx, .doc (maxim 3 fișiere)</p>
                  <input
                    id="prompt-upload"
                    type="file"
                    accept=".docx,.doc"
                    multiple
                    className="hidden"
                    onChange={handlePromptDocumentSelect}
                  />
                </div>
              </div>

              {/* Display uploaded prompts */}
              {prompts.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-blue-900 mb-3">
                    {prompts.length} prompturi custom încărcate:
                  </p>
                  <Button
                    onClick={() => {
                      setPrompts([]);
                      const input = document.getElementById('prompt-upload') as HTMLInputElement;
                      if (input) input.value = '';
                      toast.success('Toate prompturile custom au fost șterse.');
                    }}
                    variant="outline"
                    size="sm"
                    className="mb-3"
                  >
                    Șterge toate prompturile
                  </Button>
                  <div className="space-y-2">
                    {prompts.map((prompt) => (
                      <div key={prompt.id} className="p-3 bg-white rounded border border-blue-200 flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium text-blue-900">{prompt.name}</p>
                          <p className="text-xs text-gray-500 truncate">{prompt.template.substring(0, 100)}...</p>
                        </div>
                        <Button
                          onClick={() => {
                            setPrompts(prev => prev.filter(p => p.id !== prompt.id));
                            toast.success(`Prompt "${prompt.name}" șters.`);
                          }}
                          variant="outline"
                          size="sm"
                          className="ml-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    // Save to database before moving to next step
                    if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                      upsertContextSessionMutation.mutate({
                        userId: localCurrentUser.id,
                        coreBeliefId: selectedCoreBeliefId,
                        emotionalAngleId: selectedEmotionalAngleId,
                        adId: selectedAdId,
                        characterId: selectedCharacterId,
                        currentStep: 3,
                        rawTextAd,
                        processedTextAd,
                        adLines,
                        prompts,
                        images,
                        combinations,
                        deletedCombinations,
                        videoResults,
                        reviewHistory,
                      }, {
                        onSuccess: () => {
                          console.log('[Step 3] Saved before moving to Step 4');
                          setCurrentStep(4);
                        },
                        onError: (error) => {
                          console.error('[Step 3] Save failed:', error);
                          // Still move to next step (don't block user)
                          setCurrentStep(4);
                        },
                      });
                    } else {
                      setCurrentStep(4);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  <Images className="w-5 h-5 mr-2" />
                  Next: Select Images
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Images */}
        {currentStep === 4 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <ImageIcon className="w-5 h-5" />
                STEP 4 - Images
              </CardTitle>
              <CardDescription>
                Upload images or select from library (9:16 recommended)
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              {/* TABS */}
              <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
                <button
                  onClick={() => setStep4ActiveTab('library')}
                  className={`flex-1 py-3 px-6 font-semibold transition-all rounded-t-lg ${
                    step4ActiveTab === 'library'
                      ? 'bg-green-500 text-white border-b-4 border-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📚 Select from Library ({libraryImages.length})
                </button>
                <button
                  onClick={() => setStep4ActiveTab('upload')}
                  className={`flex-1 py-3 px-6 font-semibold transition-all rounded-t-lg ${
                    step4ActiveTab === 'upload'
                      ? 'bg-blue-500 text-white border-b-4 border-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📤 Manual Upload
                </button>
              </div>
              
              {/* TAB CONTENT: Manual Upload */}
              {step4ActiveTab === 'upload' && (
                <div>
                  {/* Character Selector (only in Manual Upload) */}
                  <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                    <label className="block text-sm font-medium text-purple-900 mb-2">
                      Select Character *
                    </label>
                    <Select 
                      value={selectedCharacterId?.toString() || ''} 
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          const newName = prompt('Nume caracter nou:');
                          if (newName && newName.trim()) {
                            createCharacterMutation.mutate({
                              userId: localCurrentUser.id,
                              name: newName.trim(),
                            }, {
                              onSuccess: (newChar) => {
                                setSelectedCharacterId(newChar.id);
                                toast.success(`Caracter "${newName}" creat!`);
                              },
                            });
                          }
                        } else {
                          setSelectedCharacterId(parseInt(value));
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select or create character" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">+ New Character</SelectItem>
                        {categoryCharacters?.map((char) => (
                          <SelectItem key={char.id} value={char.id.toString()}>
                            {char.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedCharacterId && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ Trebuie să selectezi un caracter înainte de a încărca imagini
                      </p>
                    )}
                  </div>
                  
                  <div
                    onDrop={handleImageDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors ${
                      selectedCharacterId ? 'cursor-pointer bg-blue-50' : 'cursor-not-allowed opacity-50 bg-gray-50'
                    }`}
                    onClick={() => selectedCharacterId && document.getElementById('image-upload')?.click()}
                  >
                    <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-blue-900 mb-2">
                      Drop images here or click to upload
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports .jpg, .png, .webp (9:16 recommended)
                    </p>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                      disabled={!selectedCharacterId}
                    />
                  </div>
                  
                  {/* Upload Progress */}
                  {uploadingFiles.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">
                          Uploading {uploadingFiles.length} image(s)...
                        </span>
                        <span className="text-sm font-bold text-blue-900">
                          {uploadProgress}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* TAB CONTENT: Select from Library */}
              {step4ActiveTab === 'library' && (
                <div>
                  {/* Search + Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search images by name..."
                        value={librarySearchQuery}
                        onChange={(e) => setLibrarySearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <Select value={libraryCharacterFilter} onValueChange={setLibraryCharacterFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by character" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Characters</SelectItem>
                        {libraryCharacters
                          .filter((char) => char && char.trim() !== "")
                          .map((char) => (
                            <SelectItem key={char} value={char}>
                              {char}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Images Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto mb-6 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                    {libraryImages
                      .filter((img) => {
                        const query = librarySearchQuery.toLowerCase();
                        const matchesSearch = img.imageName.toLowerCase().includes(query);
                        const matchesCharacter = libraryCharacterFilter === "all" || img.characterName === libraryCharacterFilter;
                        return matchesSearch && matchesCharacter;
                      })
                      .map((img) => (
                        <div
                          key={img.id}
                          className={`relative group cursor-pointer rounded border-2 transition-all ${
                            selectedLibraryImages.includes(img.id)
                              ? 'border-green-500 ring-2 ring-green-300 shadow-lg'
                              : 'border-gray-200 hover:border-green-400 hover:shadow-md'
                          }`}
                          onClick={() => {
                            setSelectedLibraryImages((prev) =>
                              prev.includes(img.id)
                                ? prev.filter((id) => id !== img.id)
                                : [...prev, img.id]
                            );
                          }}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.imageName}
                            className="w-full aspect-[9/16] object-cover rounded"
                          />
                          {selectedLibraryImages.includes(img.id) && (
                            <div className="absolute top-1 right-1 bg-green-600 text-white rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                            {img.imageName}
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Add Selected Button */}
                  {selectedLibraryImages.length > 0 && (
                    <Button
                      onClick={() => {
                        const existingImageIds = images.map(img => img.id);
                        const newImages = libraryImages
                          .filter((img) => selectedLibraryImages.includes(img.id))
                          .filter((img) => !existingImageIds.includes(`library-${img.id}`))
                          .map((img) => ({
                            id: `library-${img.id}`,
                            url: img.imageUrl,
                            file: null,
                            fileName: img.imageName,
                            isCTA: false,
                            fromLibrary: true,
                          }));
                        
                        if (newImages.length === 0) {
                          toast.warning('All selected images are already added!');
                          setSelectedLibraryImages([]);
                          return;
                        }
                        
                        setImages((prev) => [...prev, ...newImages]);
                        setSelectedLibraryImages([]);
                        toast.success(`${newImages.length} images added from library!`);
                      }}
                      className="bg-green-600 hover:bg-green-700 w-full text-lg py-6"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Add {selectedLibraryImages.length} Selected Image(s)
                    </Button>
                  )}
                </div>
              )}
              
              {/* SELECTED IMAGES PREVIEW (common for both tabs) */}
              {images.length > 0 && (
                <div className="mt-8 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Selected Images ({images.length})
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.fileName}
                          className="w-full aspect-[9/16] object-cover rounded border-2 border-gray-300"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg hover:scale-110 border-2 border-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {image.fromLibrary && (
                          <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                            Library
                          </div>
                        )}
                        <p className="text-xs text-center mt-1 text-gray-600 truncate">
                          {image.fileName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Next Button */}
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={createMappings}
                  disabled={images.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  <Grid3x3 className="w-5 h-5 mr-2" />
                  Next: Create Mappings ({adLines.filter(l => l.categoryNumber > 0).length})
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* STEP 5: Mapping */}
        {currentStep === 5 && combinations.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <MapIcon className="w-5 h-5" />
                STEP 5 - Mapping (Text + Image + Prompt)
              </CardTitle>
              <CardDescription>
                Configurează combinațiile de text, imagine și prompt pentru fiecare video. Maparea este făcută automat.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {deletedCombinations.length > 0 && (
                <div className="mb-4">
                  <Button
                    onClick={undoDelete}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Undo2 className="w-4 h-4" />
                    UNDO - Restaurează ultima combinație ștearsă
                  </Button>
                </div>
              )}

              <div className="space-y-4 max-h-[600px] overflow-y-auto mb-6">
                {combinations.map((combo, index) => (
                  <div key={combo.id} className="p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      {/* Image selector */}
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Imagine #{index + 1}
                        </label>
                        <select
                          value={combo.imageId}
                          onChange={(e) => updateCombinationImage(combo.id, e.target.value)}
                          className="w-full p-2 border border-blue-300 rounded text-sm mb-2"
                        >
                          {images.map((img) => (
                            <option key={img.id} value={img.id}>
                              {img.fileName}
                            </option>
                          ))}
                        </select>
                        <img
                          src={combo.imageUrl}
                          alt="Selected"
                          className="w-16 aspect-[9/16] object-cover rounded border-2 border-blue-300"
                        />
                      </div>

                      {/* Text and prompt selector */}
                      <div className="flex-1">
                        {/* Video Name */}
                        <label className="block text-xs font-medium text-blue-900 mb-1">
                          Video Name
                        </label>
                        <div className="text-xs text-blue-700 mb-3 font-mono bg-blue-50 p-2 rounded border border-blue-200">
                          {combo.videoName}
                        </div>
                        
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Text pentru Dialogue
                        </label>
                        <Textarea
                          value={combo.text}
                          readOnly
                          disabled
                          className="text-sm mb-3 min-h-[80px] bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        
                        <label className="block text-xs font-medium text-blue-900 mb-2">
                          Prompt Type
                        </label>
                        <select
                          value={combo.promptType}
                          onChange={(e) => updateCombinationPromptType(combo.id, e.target.value as PromptType)}
                          className="w-full p-2 border border-blue-300 rounded text-sm"
                        >
                          <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                          <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                          <option value="PROMPT_CTA">PROMPT_CTA</option>
                        </select>
                      </div>

                      {/* Delete button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => removeCombination(combo.id)}
                          className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          title="Șterge combinația"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 p-4 bg-blue-100 rounded-lg">
                <p className="text-blue-900 font-medium">
                  📊 Statistici: {combinations.length} videouri vor fi generate
                </p>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={generateVideos}
                  disabled={generateBatchMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-8 text-lg"
                >
                  {generateBatchMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Se generează...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5 mr-2" />
                      Next: Generate ({combinations.length})
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Generate Results */}
        {currentStep === 6 && videoResults.length > 0 && (
          <Card className="mb-8 border-2 border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Play className="w-5 h-5" />
                STEP 6 - Videouri Generate
              </CardTitle>
              <CardDescription>
                Urmărește progresul generării videourilo și descarcă-le.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Filtru videouri STEP 5 */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium text-blue-900">Filtrează videouri:</label>
                <select
                  value={step5Filter}
                  onChange={(e) => setStep5Filter(e.target.value as 'all' | 'accepted' | 'regenerate')}
                  className="px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Afișează Toate ({videoResults.length})</option>
                  <option value="accepted">Doar Acceptate ({acceptedCount})</option>
                  <option value="regenerate">Pentru Regenerare ({regenerateCount})</option>
                </select>
              </div>
              <div className="space-y-4">
                {step5FilteredVideos.map((result, index) => {
                  // Calculate real index in videoResults once to avoid multiple findIndex calls
                  const realIndex = videoResults.findIndex(v => v.videoName === result.videoName);
                  
                  return (
                  <div key={result.videoName} id={`video-card-${result.videoName}`} className="p-3 md:p-4 bg-white rounded-lg border-2 border-blue-200">
                    <div className="flex flex-row items-start gap-3">
                      <img
                        src={result.imageUrl}
                        alt="Video thumbnail"
                        className="w-20 sm:w-12 flex-shrink-0 aspect-[9/16] object-cover rounded border-2 border-blue-300"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-600 font-bold mb-1">
                          {result.videoName}
                        </p>
                        <p className="text-sm text-blue-900 mb-2">
                          <span className="font-medium">Text:</span>{' '}
                          {result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0 ? (
                            <>
                              {result.text.substring(0, result.redStart)}
                              <span className="text-red-600 font-bold">{result.text.substring(result.redStart, result.redEnd)}</span>
                              {result.text.substring(result.redEnd)}
                            </>
                          ) : (
                            result.text
                          )}
                        </p>
                        {result.taskId && (
                          <p className="text-xs text-blue-700 mb-1">
                            TaskID: {result.taskId}
                          </p>
                        )}
                        {(result as any).regenerationNote && (
                          <p className="text-xs text-orange-600 font-medium mb-1">
                            ⚠️ {(result as any).regenerationNote}
                          </p>
                        )}
                        {combinations[index]?.promptType && (
                          <p className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Prompt:</span> {combinations[index].promptType}
                          </p>
                        )}
                        {result.internalNote && (
                          <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-2 mb-2">
                            <p className="text-xs text-yellow-800 font-medium mb-1">
                              📝 Internal Note:
                            </p>
                            <p className="text-xs text-yellow-900 whitespace-pre-wrap">
                              {result.internalNote}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {result.status === 'pending' && (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                              <span className="text-sm text-orange-600 font-medium">În curs de generare... (auto-refresh la 5s)</span>
                            </>
                          )}
                          {result.status === 'success' && result.videoUrl && result.reviewStatus !== 'regenerate' && (
                            <>
                              {false && result.reviewStatus === 'regenerate' ? (
                                <div className="flex items-center gap-2 justify-between w-full">
                                  {/* Status Respinse - small, left */}
                                  <div className="flex items-center gap-2 bg-red-50 border-2 border-red-500 px-3 py-2 rounded-lg">
                                    <X className="w-5 h-5 text-red-600" />
                                    <span className="text-sm text-red-700 font-bold">Respinse</span>
                                  </div>
                                  
                                  {/* Buton Modify & Regenerate - small, right */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      console.log('[Modify & Regenerate] Clicked for rejected video:', result.videoName, 'realIndex:', realIndex);
                                      
                                      if (realIndex < 0) {
                                        toast.error('Video nu găsit în videoResults');
                                        return;
                                      }
                                      
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      // Initialize red text positions from combination
                                      const combo = combinations[realIndex];
                                      if (combo) {
                                        // Find the original line to get red text positions
                                        const originalLine = adLines.find(l => l.text === combo.text);
                                        if (originalLine) {
                                          setModifyRedStart(originalLine.redStart ?? -1);
                                          setModifyRedEnd(originalLine.redEnd ?? -1);
                                        } else {
                                          setModifyRedStart(-1);
                                          setModifyRedEnd(-1);
                                        }
                                      }
                                      
                                      // Scroll to form
                                      setTimeout(() => {
                                        const formElement = document.querySelector(`[data-modify-form="${realIndex}"]`);
                                        if (formElement) {
                                          formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }, 100);
                                    }}
                                    className="w-full sm:w-auto border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 bg-green-50 border-2 border-green-500 px-3 py-2 rounded-lg">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-green-700 font-bold">Generated</span>
                                </div>
                              )}
                            </>
                          )}
                          {(result.status === 'failed' || result.status === null || result.reviewStatus === 'regenerate') && (
                            <>
                              <div className="flex-1">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 ${
                                  result.reviewStatus === 'regenerate'
                                    ? 'bg-orange-50 border-2 border-orange-500'
                                    : 'bg-red-50 border-2 border-red-500'
                                }`}>
                                  <X className={`w-5 h-5 ${
                                    result.reviewStatus === 'regenerate' ? 'text-orange-600' : 'text-red-600'
                                  }`} />
                                  <span className={`text-sm font-bold ${
                                    result.reviewStatus === 'regenerate' ? 'text-orange-700' : 'text-red-700'
                                  }`}>
                                    {result.status === 'failed' ? 'Failed' : result.status === null ? 'Not Generated Yet' : 'Rejected'}
                                  </span>
                                </div>
                                {result.status === 'failed' && (
                                  <p className="text-sm text-red-600">
                                    {result.error || 'Unknown error'}
                                  </p>
                                )}
                                <div className="hidden">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      // Initialize text and red positions from videoResults
                                      setModifyDialogueText(result.text);
                                      
                                      // Load red text positions if they exist
                                      if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                        setModifyRedStart(result.redStart);
                                        setModifyRedEnd(result.redEnd);
                                        console.log('[Modify Dialog] Loading red text:', result.redStart, '-', result.redEnd);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                        console.log('[Modify Dialog] No red text found');
                                      }
                                    }}
                                    className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      duplicateVideo(result.videoName);
                                    }}
                                    className="flex-1 border-blue-500 text-blue-700 hover:bg-blue-50"
                                  >
                                    Duplicate
                                  </Button>
                                  
                                  {/* Delete Duplicate button (doar pentru duplicate-uri) */}
                                  {result.isDuplicate && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        deleteDuplicate(result.videoName);
                                      }}
                                      className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                                    >
                                      Delete Duplicate
                                    </Button>
                                  )}
                                </div>
                                
                                {/* Edited X min/sec ago */}
                                {editTimestamps[realIndex] && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <Clock className="w-3 h-3 text-orange-500" />
                                    <p className="text-xs text-orange-500 font-bold">
                                      Edited {(() => {
                                        const diffMs = currentTime - editTimestamps[realIndex];
                                        const minutes = Math.floor(diffMs / 60000);
                                        if (minutes >= 1) {
                                          return `${minutes} min ago`;
                                        } else {
                                          const seconds = Math.floor(diffMs / 1000);
                                          return `${seconds} sec ago`;
                                        }
                                      })()}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Modify & Regenerate Form */}
                                {modifyingVideoIndex === realIndex && (
                                  <div 
                                    data-modify-form={realIndex}
                                    className="mt-4 p-3 sm:p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Edit Video</h5>
                                    
                                    {/* Radio: Vrei să regenerezi mai multe videouri? - COMMENTED OUT */}
                                    {/* <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                                      <label className="text-sm font-medium text-gray-700 block mb-2">Vrei să regenerezi mai multe videouri?</label>
                                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={!regenerateMultiple}
                                            onChange={() => {
                                              setRegenerateMultiple(false);
                                              setRegenerateVariantCount(1);
                                              setRegenerateVariants([]);
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Nu</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="radio"
                                            name="multipleRegens"
                                            checked={regenerateMultiple}
                                            onChange={() => {
                                              setRegenerateMultiple(true);
                                              // Inițializează variante cu valorile curente
                                              const idx = modifyingVideoIndex !== null ? modifyingVideoIndex : 0;
                                              const initialVariant = {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageUrl: videoResults[idx]?.imageUrl || combinations[idx]?.imageUrl || '',
                                              };
                                              // Crează array cu regenerateVariantCount variante
                                              const variants = Array(regenerateVariantCount).fill(null).map(() => ({ ...initialVariant }));
                                              setRegenerateVariants(variants);
                                              console.log('[Regenerate Multiple] Initialized', variants.length, 'variants');
                                            }}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-sm">Da</span>
                                        </label>
                                      </div>
                                    </div> */}
                                    
                                    {/* Selector număr regenerări (dacă Da) */}
                                    {regenerateMultiple && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-1">Câte regenerări vrei? (1-10):</label>
                                        <select
                                          value={regenerateVariantCount}
                                          onChange={(e) => {
                                            const count = parseInt(e.target.value);
                                            setRegenerateVariantCount(count);
                                            
                                            // Ajustează array-ul de variante
                                            const currentVariants = [...regenerateVariants];
                                            if (count > currentVariants.length) {
                                              // Adaugă variante noi (copie după prima)
                                              const idx = modifyingVideoIndex !== null ? modifyingVideoIndex : 0;
                                              const template = currentVariants[0] || {
                                                promptType: modifyPromptType,
                                                promptText: modifyPromptText,
                                                dialogueText: modifyDialogueText,
                                                imageUrl: videoResults[idx]?.imageUrl || combinations[idx]?.imageUrl || '',
                                              };
                                              while (currentVariants.length < count) {
                                                currentVariants.push({ ...template });
                                              }
                                            } else {
                                              // Șterge variante în plus
                                              currentVariants.splice(count);
                                            }
                                            setRegenerateVariants(currentVariants);
                                          }}
                                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                        >
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                            <option key={n} value={n}>{n} regenerări</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                    
                                    {/* Rendering dinamic: 1 secțiune (Nu) sau N secțiuni (Da) */}
                                    {!regenerateMultiple ? (
                                      /* Mod single (Nu) - 1 secțiune */
                                      <>
                                    {/* Select Prompt Type */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                      <select
                                        value={modifyPromptType}
                                        onChange={async (e) => {
                                          const newType = e.target.value as PromptType;
                                          setModifyPromptType(newType);
                                          
                                          // Când user selectează PROMPT_CUSTOM → încarcă textul salvat
                                          if (newType === 'PROMPT_CUSTOM' && customPrompts[modifyingVideoIndex!]) {
                                            setModifyPromptText(customPrompts[modifyingVideoIndex!]);
                                          } else if (newType !== 'PROMPT_CUSTOM') {
                                            // Încarcă template din Prompt Library (database)
                                            const promptFromLibrary = promptLibrary.find(p => p.promptName === newType);
                                            if (promptFromLibrary?.promptTemplate) {
                                              setModifyPromptText(promptFromLibrary.promptTemplate);
                                            } else {
                                              setModifyPromptText('');
                                              toast.warning(`Prompt ${newType} nu a fost găsit în sesiune`);
                                            }
                                          }
                                        }}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                      >
                                        {/* Prompturi din Prompt Library (database) */}
                                        {promptLibrary.map(p => (
                                          <option key={p.id} value={p.promptName}>{p.promptName}</option>
                                        ))}
                                        {/* PROMPT_CUSTOM apare doar dacă există în sesiune pentru acest video */}
                                        {modifyingVideoIndex !== null && customPrompts[modifyingVideoIndex] && (
                                          <option value="PROMPT_CUSTOM">PROMPT_CUSTOM (session)</option>
                                        )}
                                      </select>
                                    </div>
                                    
                                    {/* Edit Prompt Text (optional) */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Prompt (optional):</label>
                                      <Textarea
                                        value={modifyPromptText}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          setModifyPromptText(newText);
                                          
                                          // Când user editează prompt text → switch automat la PROMPT_CUSTOM și salvează în sesiune
                                          if (newText.trim().length > 0) {
                                            // Verifică dacă textul este diferit de template-ul original
                                            const originalPrompt = promptLibrary.find(p => p.promptName === modifyPromptType);
                                            const isModified = !originalPrompt || newText !== originalPrompt.promptTemplate;
                                            
                                            if (isModified && modifyPromptType !== 'PROMPT_CUSTOM') {
                                              // Switch la PROMPT_CUSTOM și salvează în sesiune
                                              setModifyPromptType('PROMPT_CUSTOM');
                                              if (modifyingVideoIndex !== null) {
                                                setCustomPrompts(prev => ({
                                                  ...prev,
                                                  [modifyingVideoIndex]: newText,
                                                }));
                                              }
                                            }
                                          }
                                        }}
                                        placeholder={
                                          modifyPromptType === 'PROMPT_CUSTOM'
                                            ? 'Introdu promptul custom aici'
                                            : `Editează ${modifyPromptType} sau lasă gol pentru a folosi promptul hardcodat`
                                        }
                                        rows={3}
                                        className="text-sm min-h-[60px] max-h-[150px] resize-y overflow-y-auto"
                                      />
                                    </div>
                                    
                                    {/* Edit Dialogue Text - Textarea Simplu */}
                                    <div>
                                      <label className="text-sm font-medium text-gray-700 block mb-1">Edit Text:</label>
                                      
                                      {/* Textarea pentru editare */}
                                      <Textarea
                                        value={modifyDialogueText}
                                        onChange={(e) => setModifyDialogueText(e.target.value)}
                                        onSelect={(e: any) => {
                                          const start = e.target.selectionStart;
                                          const end = e.target.selectionEnd;
                                          // Salvează selecția pentru marcare roșu
                                          if (end > start) {
                                            (window as any).__textSelection = { start, end };
                                          }
                                        }}
                                        className="min-h-[80px] text-sm"
                                        placeholder="Introdu textul aici..."
                                      />
                                      
                                      {/* Butoane pentru marcare roșu */}
                                      <div className="flex gap-2 mt-2">
                                        <Button
                                          onClick={() => {
                                            const selection = (window as any).__textSelection;
                                            if (selection && selection.end > selection.start) {
                                              setModifyRedStart(selection.start);
                                              setModifyRedEnd(selection.end);
                                              toast.success('Text marcat ca roșu!');
                                            } else {
                                              toast.warning('Selectează textul pe care vrei să-l marchezi ca roșu');
                                            }
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className="bg-red-600 text-white hover:bg-red-700"
                                          type="button"
                                        >
                                          Mark as RED
                                        </Button>
                                        <Button
                                          onClick={() => {
                                            setModifyRedStart(-1);
                                            setModifyRedEnd(-1);
                                            toast.success('Marcare roșu ștearsă!');
                                          }}
                                          variant="outline"
                                          size="sm"
                                          type="button"
                                          disabled={modifyRedStart < 0}
                                        >
                                          Clear RED
                                        </Button>
                                      </div>
                                      
                                      {/* Preview cu text roșu */}
                                      {modifyRedStart >= 0 && modifyRedEnd > modifyRedStart && (
                                        <div className="mt-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <label className="text-sm text-blue-900 font-bold">👁️ Preview: Textul cu roșu va arăta astfel:</label>
                                          </div>
                                          <div className="p-3 bg-white rounded border border-blue-200 text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                                            {modifyDialogueText.substring(0, modifyRedStart)}
                                            <span style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2', padding: '2px 4px', borderRadius: '3px' }}>
                                              {modifyDialogueText.substring(modifyRedStart, modifyRedEnd)}
                                            </span>
                                            {modifyDialogueText.substring(modifyRedEnd)}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Character count */}
                                      <p className={`text-xs mt-1 ${
                                        modifyDialogueText.length > 125 ? 'text-orange-600 font-bold' : 'text-gray-500'
                                      }`}>
                                        {modifyDialogueText.length} caractere{modifyDialogueText.length > 125 ? ` ⚠️ Warning: ${modifyDialogueText.length - 125} caractere depășite!` : ''}
                                      </p>
                                    </div>
                                    
                                    {/* Mini Image Library Selector */}
                                    <div className="mt-4">
                                      <label className="text-sm font-medium text-gray-700 block mb-2">🖼️ Select Image:</label>
                                      
                                      {/* Character Filter */}
                                      <div className="mb-3">
                                        <select
                                          value={modifyImageCharacterFilter || 'all'}
                                          onChange={(e) => setModifyImageCharacterFilter(e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                        >
                                          <option value="all">All Characters</option>
                                          {libraryCharacters.map(char => (
                                            <option key={char} value={char}>{char}</option>
                                          ))}
                                        </select>
                                      </div>
                                      
                                      {/* Image Grid */}
                                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded border border-gray-200">
                                        {libraryImages
                                          .filter(img => modifyImageCharacterFilter === 'all' || img.characterName === modifyImageCharacterFilter)
                                          .map(img => {
                                            const isSelected = modifyingVideoIndex !== null && combinations[modifyingVideoIndex]?.imageUrl === img.imageUrl;
                                            return (
                                              <div
                                                key={img.id}
                                                onClick={() => {
                                                  if (modifyingVideoIndex !== null) {
                                                    // Update combination with new image
                                                    const updatedCombinations = [...combinations];
                                                    updatedCombinations[modifyingVideoIndex] = {
                                                      ...updatedCombinations[modifyingVideoIndex],
                                                      imageUrl: img.imageUrl,
                                                      imageId: img.id.toString(),
                                                    };
                                                    setCombinations(updatedCombinations);
                                                    
                                                    // Update video card thumbnail as well
                                                    const updatedVideoResults = [...videoResults];
                                                    if (updatedVideoResults[modifyingVideoIndex]) {
                                                      updatedVideoResults[modifyingVideoIndex] = {
                                                        ...updatedVideoResults[modifyingVideoIndex],
                                                        imageUrl: img.imageUrl,
                                                      };
                                                      setVideoResults(updatedVideoResults);
                                                    }
                                                    
                                                    // Lock system removed
                                                  }
                                                }}
                                                className={`relative cursor-pointer rounded border-2 transition-all ${
                                                  isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:border-blue-400'
                                                }`}
                                              >
                                                <img
                                                  src={img.thumbnailUrl || img.imageUrl}
                                                  alt={img.imageName}
                                                  className="w-full h-48 object-cover rounded"
                                                  style={{ aspectRatio: '6/16' }}
                                                />
                                                {isSelected && (
                                                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                      </div>
                                      
                                      {/* Selected Image Info */}
                                      {modifyingVideoIndex !== null && combinations[modifyingVideoIndex] && (
                                        <p className="text-xs text-gray-600 mt-2">
                                          Selected: {libraryImages.find(img => img.imageUrl === combinations[modifyingVideoIndex].imageUrl)?.imageName || 'Unknown'}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Buttons (mod single) */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          // SAVE: salvează modificări fără regenerare
                                          const index = modifyingVideoIndex;
                                          console.log('[Save Modify] Starting save | index:', index, '| videoResults.length:', videoResults.length, '| step5Filter:', step5Filter);
                                          
                                          // Text și pozițiile roșu sunt deja în state (modifyDialogueText, modifyRedStart, modifyRedEnd)
                                          console.log('[Save Modify] Saving text with red positions:', modifyRedStart, '-', modifyRedEnd);
                                          
                                          // Dacă user a editat prompt text → salvează ca PROMPT_CUSTOM DOAR în sesiune (nu în database)
                                          if (modifyPromptType === 'PROMPT_CUSTOM' && modifyPromptText.trim().length > 0) {
                                            // Salvează în state pentru sesiune (dispare la expirarea sesiunii)
                                            setCustomPrompts(prev => ({
                                              ...prev,
                                              [index]: modifyPromptText,
                                            }));
                                            console.log('[Prompt Save] Custom prompt saved to session (not database):', index);
                                          }
                                          
                                          const updatedCombinations = [...combinations];
                                          updatedCombinations[index] = {
                                            ...updatedCombinations[index],
                                            text: modifyDialogueText,
                                            promptType: modifyPromptType,
                                          };
                                          setCombinations(updatedCombinations);
                                          
                                          // Update adLines with red text positions
                                          setAdLines(prev => prev.map(line => {
                                            if (line.text === combinations[index].text) {
                                              return {
                                                ...line,
                                                text: modifyDialogueText,
                                                charCount: modifyDialogueText.length,
                                                redStart: modifyRedStart,
                                                redEnd: modifyRedEnd,
                                              };
                                            }
                                            return line;
                                          }));
                                          
                                          // Capture updated state BEFORE setVideoResults
                                          let updatedVideoResults: any[] = [];
                                          
                                          // Update videoResults cu noul text ȘI red positions (forțează re-render)
                                          setVideoResults(prev => {
                                            updatedVideoResults = prev.map((v, i) =>
                                              i === index ? { 
                                                ...v, 
                                                text: modifyDialogueText,
                                                redStart: modifyRedStart,
                                                redEnd: modifyRedEnd,
                                                _forceUpdate: Date.now(), // Force React to detect change
                                              } : v
                                            );
                                            console.log('[Save Modify] BEFORE return - Updated text for index', index, ':', modifyDialogueText.substring(0, 50));
                                            return [...updatedVideoResults];
                                          });
                                          
                                          console.log('[Save Modify] AFTER setVideoResults - Updated videoResults[' + index + '] with red text:', modifyRedStart, '-', modifyRedEnd);
                                          
                                          // Salvează timestamp pentru "Edited X min ago"
                                          setEditTimestamps(prev => ({
                                            ...prev,
                                            [index]: Date.now(),
                                          }));
                                          
                                          // SAVE TO DATABASE with captured updated state
                                          console.log('[Database Save] Saving after text modification...');
                                          
                                          upsertContextSessionMutation.mutate({
                                            userId: localCurrentUser.id,
                                            tamId: selectedTamId,
                                            coreBeliefId: selectedCoreBeliefId,
                                            emotionalAngleId: selectedEmotionalAngleId,
                                            adId: selectedAdId,
                                            characterId: selectedCharacterId,
                                            currentStep,
                                            rawTextAd,
                                            processedTextAd,
                                            adLines,
                                            prompts,
                                            images,
                                            combinations: updatedCombinations,
                                            deletedCombinations,
                                            videoResults: updatedVideoResults,
                                            reviewHistory,
                                          }, {
                                            onSuccess: () => {
                                              console.log('[Database Save] Modifications saved to database!');
                                            },
                                            onError: (error) => {
                                              console.error('[Database Save] Failed:', error);
                                            },
                                          });
                                          
                                          toast.success('Modificări salvate!');
                                          setModifyingVideoIndex(null);
                                          
                                          // Auto-scroll to video card after save
                                          setTimeout(() => {
                                            const videoCard = document.getElementById(`video-card-${videoResults[index]?.videoName}`);
                                            if (videoCard) {
                                              videoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                          }, 100);
                                        }}
                                        disabled={modifyDialogueText.trim().length === 0}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                      >
                                        Save
                                      </Button>
                                      {/* <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => regenerateWithModifications(index)}
                                        disabled={generateBatchMutation.isPending || modifyDialogueText.trim().length === 0}
                                        className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                      >
                                        {generateBatchMutation.isPending ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                            Se trimite...
                                          </>
                                        ) : (
                                          'Save & Regenerate'
                                        )}
                                      </Button> */}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setModifyingVideoIndex(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                    </>
                                    ) : (
                                      /* Mod multiple (Da) - N secțiuni */
                                      <>
                                        {regenerateVariants.map((variant, variantIndex) => (
                                          <div key={variantIndex} className="p-3 bg-gray-50 border border-gray-300 rounded space-y-2">
                                            <h6 className="font-bold text-gray-900">Varianta {variantIndex + 1}</h6>
                                            
                                            {/* Prompt Type */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Prompt Type:</label>
                                              <select
                                                value={variant.promptType}
                                                onChange={async (e) => {
                                                  const newType = e.target.value as PromptType;
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], promptType: newType };
                                                  
                                                  // Încărcă text hardcodat dacă nu e CUSTOM
                                                  if (newType !== 'PROMPT_CUSTOM') {
                                                     try {
                                                       const response = await fetch(`/api/trpc/prompt.getHardcodedPrompt?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { promptType: newType } }))}`);
                                                       const data = await response.json();
                                                       if (data[0]?.result?.data?.promptText) {
                                                         updated[variantIndex].promptText = data[0].result.data.promptText;
                                                      }
                                                    } catch (error) {
                                                      console.error('Eroare la încărcare prompt:', error);
                                                    }
                                                  }
                                                  
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                              >
                                                <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                                                <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                                                <option value="PROMPT_CTA">PROMPT_CTA</option>
                                                <option value="PROMPT_CUSTOM">PROMPT_CUSTOM</option>
                                              </select>
                                            </div>
                                            
                                            {/* Edit Prompt Text */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Edit Prompt:</label>
                                              <Textarea
                                                value={variant.promptText}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], promptText: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                placeholder="Introdu promptul aici"
                                                className="text-xs min-h-[60px]"
                                              />
                                            </div>
                                            
                                            {/* Edit Dialogue Text */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Edit Text:</label>
                                              <Textarea
                                                value={variant.dialogueText}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], dialogueText: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="text-xs min-h-[50px]"
                                              />
                                              <p className={`text-xs mt-1 ${
                                                variant.dialogueText.length > 125 ? 'text-red-600 font-bold' : 'text-gray-500'
                                              }`}>
                                                {variant.dialogueText.length} caractere{variant.dialogueText.length > 125 ? ` - ${variant.dialogueText.length - 125} depășite!` : ''}
                                              </p>
                                            </div>
                                            
                                            {/* Select Image */}
                                            <div>
                                              <label className="text-xs font-medium text-gray-700 block mb-1">Imagine:</label>
                                              <select
                                                value={variant.imageUrl}
                                                onChange={(e) => {
                                                  const updated = [...regenerateVariants];
                                                  updated[variantIndex] = { ...updated[variantIndex], imageUrl: e.target.value };
                                                  setRegenerateVariants(updated);
                                                }}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                              >
                                                {images.map((img) => (
                                                  <option key={img.id} value={img.url}>{img.id}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        ))}
                                        
                                        {/* Buttons (mod multiple) - SAVE + REGENERATE ALL */}
                                        <div className="space-y-2">
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              onClick={() => {
                                                // SAVE toate variantele
                                                toast.success(`${regenerateVariants.length} variante salvate!`);
                                                setModifyingVideoIndex(null);
                                              }}
                                              className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                              Save All
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => setModifyingVideoIndex(null)}
                                              className="flex-1"
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                          
                                          {/* Regenerate All - trimite toate variantele pentru generare
                                          <Button
                                            size="sm"
                                            onClick={async () => {
                                              if (modifyingVideoIndex === null || modifyingVideoIndex < 0) {
                                                toast.error('Selectează un video pentru regenerare');
                                                return;
                                              }
                                              
                                              // Validare: toate variantele trebuie să aibă text valid
                                              const invalidVariants = regenerateVariants.filter(v => 
                                                v.dialogueText.trim().length === 0
                                              );
                                              
                                              if (invalidVariants.length > 0) {
                                                toast.error('Toate variantele trebuie să aibă text valid');
                                                return;
                                              }
                                              
                                              try {
                                                // Detectare setări identice
                                                const firstVariant = regenerateVariants[0];
                                                const allIdentical = regenerateVariants.every(v => 
                                                  v.promptType === firstVariant.promptType &&
                                                  v.promptText === firstVariant.promptText &&
                                                  v.dialogueText === firstVariant.dialogueText &&
                                                  v.imageUrl === firstVariant.imageUrl
                                                );
                                                
                                                if (allIdentical && regenerateVariants.length > 1) {
                                                  toast.info(`Se vor face ${regenerateVariants.length} regenerări cu aceleași setări (nu se vor crea duplicate)`);
                                                } else {
                                                  toast.info(`Se regenerează ${regenerateVariants.length} variant${regenerateVariants.length > 1 ? 'e' : 'ă'} în paralel...`);
                                                }
                                                
                                                // Pregătește variantele pentru backend
                                                const variantsForBackend = regenerateVariants.map((variant) => ({
                                                  promptType: variant.promptType,
                                                  promptText: variant.promptText || undefined,
                                                  dialogueText: variant.dialogueText,
                                                  imageUrl: variant.imageUrl,
                                                }));
                                                
                                                // Trimite toate variantele la backend pentru generare paralelă
                                                const result = await generateMultipleVariantsMutation.mutateAsync({
                                                  variants: variantsForBackend,
                                                });
                                                
                                                // Procesează rezultatele
                                                if (allIdentical && regenerateVariants.length > 1) {
                                                  // Setări identice: TOATE regenerările înlocuiesc același video (nu creăm duplicate)
                                                  // Folosim doar prima variantă (toate sunt identice)
                                                  const firstResult = result.results[0];
                                                  const firstVariant = regenerateVariants[0];
                                                  
                                                  if (firstResult.success) {
                                                    setVideoResults(prev =>
                                                      prev.map((v, i) =>
                                                        i === modifyingVideoIndex
                                                          ? {
                                                              ...v,
                                                              text: firstVariant.dialogueText,
                                                              imageUrl: firstVariant.imageUrl,
                                                              taskId: firstResult.taskId || '',
                                                              status: 'pending' as const,
                                                              error: undefined,
                                                              videoUrl: undefined,
                                                              regenerationNote: `${regenerateVariants.length} regenerări cu aceleași setări`,
                                                            }
                                                          : v
                                                      )
                                                    );
                                                    
                                                    setCombinations(prev =>
                                                      prev.map((c, i) =>
                                                        i === modifyingVideoIndex
                                                          ? {
                                                              ...c,
                                                              text: firstVariant.dialogueText,
                                                              imageUrl: firstVariant.imageUrl,
                                                              promptType: firstVariant.promptType,
                                                            }
                                                          : c
                                                      )
                                                    );
                                                  }
                                                } else {
                                                  // Setări diferite: creăm duplicate pentru variantele 2, 3, etc.
                                                  for (let variantIndex = 0; variantIndex < result.results.length; variantIndex++) {
                                                    const newResult = result.results[variantIndex];
                                                    const variant = regenerateVariants[variantIndex];
                                                    
                                                    if (variantIndex === 0 && newResult.success) {
                                                      // Prima variantă înlocuiește videoul original
                                                      setVideoResults(prev =>
                                                        prev.map((v, i) =>
                                                          i === modifyingVideoIndex
                                                            ? {
                                                                ...v,
                                                                text: variant.dialogueText,
                                                                imageUrl: variant.imageUrl,
                                                                taskId: newResult.taskId || '',
                                                                status: 'pending' as const,
                                                                error: undefined,
                                                                videoUrl: undefined,
                                                              }
                                                            : v
                                                        )
                                                      );
                                                      
                                                      // Update combinations
                                                      setCombinations(prev =>
                                                        prev.map((c, i) =>
                                                          i === modifyingVideoIndex
                                                            ? {
                                                                ...c,
                                                                text: variant.dialogueText,
                                                                imageUrl: variant.imageUrl,
                                                                promptType: variant.promptType,
                                                              }
                                                            : c
                                                        )
                                                      );
                                                    } else if (variantIndex > 0 && newResult.success) {
                                                      // Variantele următoare se adaugă ca videouri noi
                                                      const originalVideo = videoResults[modifyingVideoIndex];
                                                      const originalCombo = combinations[modifyingVideoIndex];
                                                      
                                                      setVideoResults(prev => [
                                                        ...prev,
                                                        {
                                                          text: variant.dialogueText,
                                                          imageUrl: variant.imageUrl,
                                                          taskId: newResult.taskId || '',
                                                          status: 'pending' as const,
                                                          error: undefined,
                                                          videoName: `${originalVideo.videoName}_V${variantIndex + 1}`,
                                                          section: originalVideo.section,
                                                          categoryNumber: originalVideo.categoryNumber,
                                                          reviewStatus: null,
                                                        },
                                                      ]);
                                                      
                                                      setCombinations(prev => [
                                                        ...prev,
                                                        {
                                                          ...originalCombo,
                                                          text: variant.dialogueText,
                                                          imageUrl: variant.imageUrl,
                                                          promptType: variant.promptType,
                                                          videoName: `${originalCombo.videoName}_V${variantIndex + 1}`,
                                                        },
                                                      ]);
                                                    }
                                                  }
                                                }
                                                
                                                // Toast final cu rezultate
                                                const successCount = result.results.filter((r: any) => r.success).length;
                                                const failCount = result.results.filter((r: any) => !r.success).length;
                                                
                                                if (successCount > 0) {
                                                  toast.success(`${successCount} variant${successCount > 1 ? 'e trimise' : 'ă trimisă'} pentru generare!`);
                                                }
                                                if (failCount > 0) {
                                                  toast.error(`${failCount} variant${failCount > 1 ? 'e au eșuat' : 'ă a eșuat'}`);
                                                }
                                                
                                                // Reset form
                                                setModifyingVideoIndex(null);
                                                setRegenerateVariants([]);
                                              } catch (error: any) {
                                                toast.error(`Eroare la regenerare: ${error.message}`);
                                              }
                                            }}
                                            disabled={generateMultipleVariantsMutation.isPending}
                                            className="w-full bg-orange-600 hover:bg-orange-700"
                                          >
                                            {generateMultipleVariantsMutation.isPending ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                Se regenerează...
                                              </>
                                            ) : (
                                              `Regenerate All (${regenerateVariants.length} variante)`
                                            )}
                                          </Button> */}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                            </>
                          )}
                          
                          {/* NULL Status (duplicate negenerat) */}
                          {result.status === null && result.isDuplicate && (
                            <>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-400 px-3 py-2 rounded-lg mb-2">
                                  <Clock className="w-5 h-5 text-gray-600" />
                                  <span className="text-sm text-gray-700 font-bold">
                                    Not Generated Yet (Duplicate {result.duplicateNumber})
                                  </span>
                                </div>
                                <div className="hidden">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setModifyingVideoIndex(realIndex);
                                      const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                                      setModifyPromptType(currentPromptType);
                                      
                                      // Încărcă prompt text by default
                                      if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                        // Dacă video are PROMPT_CUSTOM salvat → afișează-l
                                        setModifyPromptText(customPrompts[realIndex]);
                                      } else {
                                        // Încărcă template-ul promptului din Prompt Library
                                        const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                        if (promptFromLibrary?.promptTemplate) {
                                          setModifyPromptText(promptFromLibrary.promptTemplate);
                                        } else {
                                          setModifyPromptText('');
                                        }
                                      }
                                      
                                      setModifyDialogueText(result.text);
                                      
                                      if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                        setModifyRedStart(result.redStart);
                                        setModifyRedEnd(result.redEnd);
                                      } else {
                                        setModifyRedStart(-1);
                                        setModifyRedEnd(-1);
                                      }
                                    }}
                                    className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                  >
                                    Modify & Regenerate
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      deleteDuplicate(result.videoName);
                                    }}
                                    className="flex-1 border-red-500 text-red-700 hover:bg-red-50"
                                  >
                                    Delete Duplicate
                                  </Button>
                                </div>
                                
                                {/* Modify & Regenerate Form pentru duplicate */}
                                {modifyingVideoIndex === realIndex && (
                                  <div 
                                    data-modify-form={realIndex}
                                    className="mt-4 p-3 sm:p-4 bg-white border-2 border-orange-300 rounded-lg space-y-3"
                                  >
                                    <h5 className="font-bold text-orange-900">Edit Video</h5>
                                    
                                    {/* Aici va fi formularul - va folosi același formular ca pentru failed */}
                                    {/* TODO: Add form fields */}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Butoane verticale în dreapta */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                          {/* Edit button */}
                          <button
                            onClick={() => {
                              console.log('[Edit Modal] Opening for:', result.videoName, '| realIndex:', realIndex, '| step5Filter:', step5Filter);
                              if (realIndex === -1) {
                                console.error('[Edit Modal] Cannot open - video not found in videoResults:', result.videoName);
                                return;
                              }
                              setModifyingVideoIndex(realIndex);
                              const currentPromptType = combinations[realIndex]?.promptType || 'PROMPT_NEUTRAL';
                              setModifyPromptType(currentPromptType);
                              
                              if (currentPromptType === 'PROMPT_CUSTOM' && customPrompts[realIndex]) {
                                setModifyPromptText(customPrompts[realIndex]);
                              } else {
                                const promptFromLibrary = promptLibrary.find(p => p.promptName === currentPromptType);
                                if (promptFromLibrary?.promptTemplate) {
                                  setModifyPromptText(promptFromLibrary.promptTemplate);
                                } else {
                                  setModifyPromptText('');
                                }
                              }
                              
                              setModifyDialogueText(result.text);
                              
                              if (result.redStart !== undefined && result.redEnd !== undefined && result.redStart >= 0) {
                                setModifyRedStart(result.redStart);
                                setModifyRedEnd(result.redEnd);
                              } else {
                                setModifyRedStart(-1);
                                setModifyRedEnd(-1);
                              }
                              
                              // Preselect character in Select Image dropdown
                              const currentImageUrl = combinations[realIndex]?.imageUrl;
                              if (currentImageUrl) {
                                const currentImage = libraryImages.find(img => img.imageUrl === currentImageUrl);
                                if (currentImage?.characterName) {
                                  setModifyImageCharacterFilter(currentImage.characterName);
                                } else {
                                  setModifyImageCharacterFilter('all');
                                }
                              } else {
                                setModifyImageCharacterFilter('all');
                              }
                            }}
                            className="px-2 py-1.5 border border-orange-500 text-orange-700 hover:bg-orange-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          
                          {/* Regenerate button */}
                          <button
                            onClick={() => {
                              regenerateSingleVideo(realIndex);
                            }}
                            className="px-2 py-1.5 border border-green-500 text-green-700 hover:bg-green-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Regenerate"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Regen</span>
                          </button>
                          
                          {/* Duplicate button */}
                          <button
                            onClick={() => {
                              duplicateVideo(result.videoName);
                            }}
                            className="px-2 py-1.5 border border-blue-500 text-blue-700 hover:bg-blue-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Duplicate"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <span>Dupl</span>
                          </button>
                          
                          {/* Delete button - available for all videos */}
                          <button
                            onClick={() => {
                              deleteDuplicate(result.videoName);
                            }}
                            className="px-2 py-1.5 border border-red-500 text-red-700 hover:bg-red-50 rounded flex items-center gap-1.5 transition-colors text-xs font-medium"
                            title="Delete"
                          >
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Del</span>
                          </button>
                        </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Buton Regenerate ALL (Failed + Rejected) */}
              {videoResults.some(v => v.status === 'failed' || v.reviewStatus === 'regenerate') && modifyingVideoIndex === null && (
                <div className="mt-6">
                  <Button
                    onClick={regenerateAll}
                    disabled={generateBatchMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 w-full py-4 text-base"
                  >
                    {generateBatchMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Se regenerează...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Regenerate ALL ({(() => {
                          const failedCount = videoResults.filter(v => v.status === 'failed').length;
                          const rejectedCount = videoResults.filter(v => v.reviewStatus === 'regenerate').length;
                          // Rejected videos use regenerateVariantCount if regenerateMultiple is enabled
                          const rejectedTotal = regenerateMultiple ? rejectedCount * regenerateVariantCount : rejectedCount;
                          return failedCount + rejectedTotal;
                        })()})
                      </>
                    )}
                  </Button>
                </div>
              )}
              

              {/* Buton pentru a trece la STEP 7 */}
              {videoResults.some(v => v.status === 'success') && (
                <div className="mt-6 flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(5)}
                    className="px-6 py-3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={goToCheckVideos}
                    className="bg-green-600 hover:bg-green-700 px-8 py-8 text-lg"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Next: Check ({videoResults.filter(v => v.status === 'success').length})
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 7 REMOVED - Nu mai există, funcționalitatea e în STEP 5 */}
        {false && (
          <Card className="mb-8 border-2 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <Undo2 className="w-5 h-5" />
                STEP 7 - Regenerare Avansată
              </CardTitle>
              <CardDescription>
                Regenerează videouri cu setări personalizate. Poți crea multiple variante pentru fiecare video.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Selectare video pentru regenerare */}
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-orange-900 mb-3">
                  Selectează videoul care trebuie regenerat:
                </p>
                <select
                  className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={selectedVideoIndex}
                  onChange={(e) => {
                    const index = parseInt(e.target.value);
                    setSelectedVideoIndex(index);
                    
                    if (index >= 0) {
                      const video = videoResults[index];
                      const combo = combinations[index];
                      // Inițializează prima variantă cu datele actuale
                      setRegenerateVariants([{
                        promptType: combo?.promptType || 'PROMPT_NEUTRAL',
                        promptText: '',
                        dialogueText: video.text,
                        imageUrl: video.imageUrl,
                      }]);
                    } else {
                      setRegenerateVariants([]);
                    }
                  }}
                >
                  <option value="-1">Selectează un video...</option>
                  {videoResults.map((video, index) => (
                    <option key={index} value={index}>
                      {video.videoName} - {video.status === 'failed' ? 'FAILED' : video.text.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {regenerateVariants.length > 0 && (
                <>
                  {/* Radio button: Vrei să regenerezi mai multe videouri? */}
                  <div className="mb-6 p-4 bg-white border-2 border-orange-300 rounded-lg">
                    <p className="font-medium text-orange-900 mb-3">
                      Vrei să regenerezi mai multe videouri?
                    </p>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="regenerateMultiple"
                          checked={!regenerateMultiple}
                          onChange={() => {
                            setRegenerateMultiple(false);
                            setRegenerateVariantCount(1);
                            // Păstrează doar prima variantă
                            setRegenerateVariants(prev => [prev[0]]);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-orange-900">Nu</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="regenerateMultiple"
                          checked={regenerateMultiple}
                          onChange={() => setRegenerateMultiple(true)}
                          className="w-4 h-4"
                        />
                        <span className="text-orange-900">Da</span>
                      </label>
                    </div>

                    {/* Selector număr variante (1-10) */}
                    {regenerateMultiple && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-orange-900 mb-2">
                          Câte variante vrei să generezi? (1-10)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={regenerateVariantCount}
                          onChange={(e) => {
                            const count = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                            setRegenerateVariantCount(count);
                            
                            // Ajustează array-ul de variante
                            setRegenerateVariants(prev => {
                              const newVariants = [...prev];
                              while (newVariants.length < count) {
                                newVariants.push({
                                  promptType: 'PROMPT_NEUTRAL',
                                  promptText: '',
                                  dialogueText: prev[0]?.dialogueText || '',
                                  imageUrl: prev[0]?.imageUrl || '',
                                });
                              }
                              return newVariants.slice(0, count);
                            });
                          }}
                          className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* UI pentru fiecare variantă */}
                  <div className="space-y-6 mb-6">
                    {regenerateVariants.map((variant, variantIndex) => (
                      <div key={variantIndex} className="p-4 bg-white border-2 border-orange-300 rounded-lg">
                        <h4 className="font-bold text-orange-900 mb-4 text-lg border-b-2 border-orange-200 pb-2">
                          Variantă #{variantIndex + 1}
                        </h4>
                        
                        {/* Select Prompt Type */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Tip Prompt:
                          </label>
                          <select
                            value={variant.promptType}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, promptType: e.target.value as PromptType | 'custom' }
                                    : v
                                )
                              );
                            }}
                            className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="PROMPT_NEUTRAL">PROMPT_NEUTRAL</option>
                            <option value="PROMPT_SMILING">PROMPT_SMILING</option>
                            <option value="PROMPT_CTA">PROMPT_CTA</option>
                            <option value="custom">Custom (scrie manual)</option>
                            {prompts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Textarea Prompt Custom (dacă e selectat custom sau vrea să modifice) */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Prompt Text (opțional - override hardcoded):
                          </label>
                          <textarea
                            value={variant.promptText}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, promptText: e.target.value }
                                    : v
                                )
                              );
                            }}
                            placeholder="Lasă gol pentru a folosi promptul selectat mai sus, sau scrie aici pentru a-l modifica temporar..."
                            className="w-full h-24 p-3 border border-orange-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        {/* Select Imagine */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Imagine:
                          </label>
                          <select
                            value={variant.imageUrl}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, imageUrl: e.target.value }
                                    : v
                                )
                              );
                            }}
                            className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {images.map(img => (
                              <option key={img.id} value={img.url}>
                                {img.url.split('/').pop()?.substring(0, 50)}
                              </option>
                            ))}
                          </select>
                          {/* Preview imagine */}
                          {variant.imageUrl && (
                            <img
                              src={variant.imageUrl}
                              alt="Preview"
                              className="mt-2 w-32 h-32 object-cover rounded border-2 border-orange-300"
                            />
                          )}
                        </div>

                        {/* Textarea Text Dialogue */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-orange-900 mb-2">
                            Text Dialogue:
                          </label>
                          <textarea
                            value={variant.dialogueText}
                            onChange={(e) => {
                              setRegenerateVariants(prev =>
                                prev.map((v, i) =>
                                  i === variantIndex
                                    ? { ...v, dialogueText: e.target.value }
                                    : v
                                )
                              );
                            }}
                            className={`w-full h-24 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 ${
                              variant.dialogueText.length > 125
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-orange-300 focus:ring-orange-500'
                            }`}
                          />
                          <p className={`text-sm mt-1 ${
                            variant.dialogueText.length > 125 ? 'text-red-600 font-bold' : 'text-gray-600'
                          }`}>
                            {variant.dialogueText.length} caractere{variant.dialogueText.length > 125 ? ` - ${variant.dialogueText.length - 125} caractere depășite!` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Butoane acțiune */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <Button
                      onClick={async () => {
                        if (selectedVideoIndex < 0) {
                          toast.error('Selectează un video pentru regenerare');
                          return;
                        }

                        // Validare: toate variantele trebuie să aibă text valid (nu mai blochez pentru > 125)
                        const invalidVariants = regenerateVariants.filter(v => 
                          v.dialogueText.trim().length === 0
                        );
                        
                        if (invalidVariants.length > 0) {
                          toast.error('Toate variantele trebuie să aibă text valid (minim 1 caracter)');
                          return;
                        }

                        try {
                          toast.info(`Se regenerează ${regenerateVariants.length} variant${regenerateVariants.length > 1 ? 'e' : 'ă'} în paralel...`);
                          
                          // Pregătește toate variantele pentru backend
                          const variantsForBackend = regenerateVariants.map((variant, variantIndex) => {
                            // Determină prompt template
                            let promptTemplate: string = '';
                            let promptText: string | undefined = undefined;
                            
                            if (variant.promptText.trim().length > 0) {
                              // Folosește prompt custom scris manual
                              promptText = variant.promptText;
                            } else if (variant.promptType === 'custom') {
                              // Skip - va fi gestionat de backend
                              promptText = '';
                            } else {
                              // Folosește prompt custom din listă
                              const customPrompt = prompts.find(p => p.id === variant.promptType);
                              if (customPrompt) {
                                promptText = customPrompt.template;
                              }
                            }
                            
                            return {
                              promptType: variant.promptType,
                              promptText: promptText,
                              dialogueText: variant.dialogueText,
                              imageUrl: variant.imageUrl,
                            };
                          });
                          
                          // Trimite toate variantele la backend pentru generare paralelă
                          const result = await generateMultipleVariantsMutation.mutateAsync({
                            variants: variantsForBackend,
                          });
                          
                          // Procesează rezultatele
                          for (let variantIndex = 0; variantIndex < result.results.length; variantIndex++) {
                            const newResult = result.results[variantIndex];
                            const variant = regenerateVariants[variantIndex];
                            
                            // Actualizează videoResults: adaugă sau înlocuiește
                            if (variantIndex === 0 && newResult.success) {
                              // Prima variantă înlocuiește videoul original
                              setVideoResults(prev =>
                                prev.map((v, i) =>
                                  i === selectedVideoIndex
                                    ? {
                                        ...v,
                                        text: variant.dialogueText,
                                        imageUrl: variant.imageUrl,
                                        taskId: newResult.taskId,
                                        status: newResult.success ? 'pending' as const : 'failed' as const,
                                        error: newResult.error,
                                        videoUrl: undefined,
                                      }
                                    : v
                                )
                              );
                              
                              // Update combinations
                              setCombinations(prev =>
                                prev.map((c, i) =>
                                  i === selectedVideoIndex
                                    ? {
                                        ...c,
                                        text: variant.dialogueText,
                                        imageUrl: variant.imageUrl,
                                      }
                                    : c
                                )
                              );
                            } else if (variantIndex > 0 && newResult.success) {
                              // Variantele următoare se adaugă ca videouri noi
                              const originalVideo = videoResults[selectedVideoIndex];
                              const originalCombo = combinations[selectedVideoIndex];
                              
                              setVideoResults(prev => [
                                ...prev,
                                {
                                  text: variant.dialogueText,
                                  imageUrl: variant.imageUrl,
                                  taskId: newResult.taskId || '',
                                  status: 'pending' as const,
                                  error: undefined,
                                  videoName: `${originalVideo.videoName}_V${variantIndex + 1}`,
                                  section: originalVideo.section,
                                  categoryNumber: originalVideo.categoryNumber,
                                  reviewStatus: null,
                                },
                              ]);
                              
                              setCombinations(prev => [
                                ...prev,
                                {
                                  ...originalCombo,
                                  text: variant.dialogueText,
                                  imageUrl: variant.imageUrl,
                                  videoName: `${originalCombo.videoName}_V${variantIndex + 1}`,
                                },
                              ]);
                            }
                          }
                          
                          // Toast final cu rezultate
                          const successCount = result.results.filter((r: any) => r.success).length;
                          const failCount = result.results.filter((r: any) => !r.success).length;
                          
                          if (successCount > 0) {
                            toast.success(`${successCount} variant${successCount > 1 ? 'e trimise' : 'ă trimisă'} pentru generare!`);
                          }
                          if (failCount > 0) {
                            toast.error(`${failCount} variant${failCount > 1 ? 'e au eșuat' : 'ă a eșuat'}`);
                          }

                          // Reset form
                          setSelectedVideoIndex(-1);
                          setRegenerateVariants([]);
                          setRegenerateMultiple(false);
                          setRegenerateVariantCount(1);
                          
                          // Revino la STEP 6 pentru a verifica progresul
                          setCurrentStep(6);
                          toast.success('Regenerare completă! Verifică progresul la STEP 6.');
                        } catch (error: any) {
                          toast.error(`Eroare la regenerare: ${error.message}`);
                        }
                      }}
                      disabled={generateBatchMutation.isPending || selectedVideoIndex < 0}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 py-6 text-lg"
                    >
                      {generateBatchMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Se regenerează...
                        </>
                      ) : (
                        <>
                          <Undo2 className="w-5 h-5 mr-2" />
                          Regenerate ({regenerateVariants.length} variant{regenerateVariants.length > 1 ? 'e' : 'ă'})
                        </>
                      )}
                    </Button>

                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Check Videos (Final Review) */}
        {currentStep === 7 && videoResults.length > 0 && (() => {
          console.log('STEP 7 RENDER - videoResults:', videoResults.map(v => ({
            videoName: v.videoName,
            status: v.status,
            hasVideoUrl: !!v.videoUrl,
            videoUrl: v.videoUrl?.substring(0, 50) + '...',
          })));
          return true;
        })() && (
          <Card className="mb-8 border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Video className="w-5 h-5" />
                STEP 7 - Check Videos
              </CardTitle>
              <CardDescription>
                Review videourilo generate. Acceptă sau marchează pentru regenerare.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              {/* Filtru videouri + Sample Merge button */}
              <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium text-green-900">Filtrează videouri:</label>
                  <select
                    value={videoFilter}
                    onChange={(e) => setVideoFilter(e.target.value as 'all' | 'accepted' | 'failed' | 'no_decision')}
                    className="px-4 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Afișează Toate ({videoResults.length})</option>
                    <option value="accepted">Doar Acceptate ({acceptedCount})</option>
                    <option value="failed">Doar Failed/Pending ({failedCount})</option>
                    <option value="no_decision">Doar Fără Decizie ({videosWithoutDecisionCount})</option>
                  </select>
                  <span className="text-xs text-gray-500 italic">Filtru funcționează doar la refresh</span>
                </div>
                

              </div>
              
              {/* Buton UNDO */}
              {reviewHistory.length > 0 && (
                <div className="mb-6">
                  <Button
                    onClick={undoReview}
                    variant="outline"
                    className="border-orange-500 text-orange-700 hover:bg-orange-50"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    UNDO ({reviewHistory.length} acțiuni)
                  </Button>
                </div>
              )}

              {/* Organizare pe categorii */}
              {['HOOKS', 'MIRROR', 'DCS', 'TRANZITION', 'NEW_CAUSE', 'MECHANISM', 'EMOTIONAL_PROOF', 'TRANSFORMATION', 'CTA'].map(category => {
                // Filtrare videouri: doar cele generate cu succes (status === 'success' și videoUrl există)
                // Use step6FilteredVideos to prevent auto-remove on decision change
                let categoryVideos = step6FilteredVideos.filter(v => 
                  v.section === category && 
                  v.status === 'success' && 
                  v.videoUrl
                );
                
                if (categoryVideos.length === 0) return null;
                
                return (
                  <div key={category} className="mb-8">
                    <h3 className="text-xl font-bold text-green-900 mb-4 border-b-2 border-green-300 pb-2">
                      {category}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryVideos.map((video) => {
                        console.log(`Rendering video ${video.videoName}:`, {
                          status: video.status,
                          hasVideoUrl: !!video.videoUrl,
                          videoUrl: video.videoUrl,
                        });
                        return (
                        <div key={video.videoName} className="p-4 bg-white rounded-lg border-2 border-green-200">
                          {/* TITLE */}
                          <h4 className="font-bold text-green-900 mb-2 text-lg">{video.videoName}</h4>
                          
                          {/* Text with red highlighting */}
                          <p className="text-sm text-gray-700 mb-3">
                            {video.redStart !== undefined && video.redStart >= 0 && video.redEnd !== undefined && video.redEnd >= 0 ? (
                              <>
                                {video.text.substring(0, video.redStart)}
                                <span className="text-red-600 font-bold">
                                  {video.text.substring(video.redStart, video.redEnd)}
                                </span>
                                {video.text.substring(video.redEnd)}
                              </>
                            ) : (
                              video.text
                            )}
                          </p>
                          
                          {/* VIDEO PLAYER SIMPLU */}
                          {video.videoUrl ? (
                            <video
                              controls
                              preload="metadata"
                              className="w-full max-w-[300px] mx-auto aspect-[9/16] object-cover rounded border-2 border-green-300 mb-3"
                            >
                              <source src={video.videoUrl} type="video/mp4" />
                              Browserul tău nu suportă video HTML5.
                            </video>
                          ) : (
                            <div className="w-full max-w-[300px] mx-auto aspect-[9/16] bg-blue-50 border-2 border-blue-300 rounded mb-3 flex flex-col items-center justify-center p-4">
                              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                              <p className="text-sm text-blue-700 font-medium">Se încarcă video...</p>
                            </div>
                          )}
                          
                          {/* BUTOANE ACCEPT/REGENERATE/DOWNLOAD */}
                          <div className="space-y-2">
                            {/* Butoane Accept/Regenerate - dispar după click */}
                            {!video.reviewStatus ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => acceptVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                
                                <Button
                                  onClick={() => regenerateVideo(video.videoName)}
                                  size="sm"
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Regenerate
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-2 items-center">
                                  {/* Status după decizie */}
                                  <div className={`flex-1 px-3 py-2 rounded text-xs font-medium text-center ${
                                    video.reviewStatus === 'accepted' 
                                      ? 'bg-green-100 text-green-700 border border-green-300'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                  }`}>
                                    {video.reviewStatus === 'accepted' ? (
                                      <><Check className="w-3 h-3 inline mr-1" />Acceptat</>
                                    ) : (
                                      <><X className="w-3 h-3 inline mr-1" />Regenerare</>
                                    )}
                                  </div>
                                  
                                  {/* UNDO individual */}
                                  <Button
                                    onClick={() => undoReviewDecision(video.videoName)}
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-400 text-gray-700 hover:bg-gray-100 text-xs py-1"
                                  >
                                    <Undo2 className="w-3 h-3 mr-1" />
                                    Undo
                                  </Button>
                                </div>
                                
                                {/* Add Note button (doar pentru Regenerare) */}
                                {video.reviewStatus === 'regenerate' && (
                                  <div>
                                    {editingNoteVideoName === video.videoName ? (
                                      <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-3 space-y-2">
                                        <textarea
                                          value={noteText}
                                          onChange={(e) => setNoteText(e.target.value)}
                                          placeholder="Add internal note..."
                                          className="w-full p-2 border border-yellow-300 rounded text-xs bg-white"
                                          rows={3}
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            onClick={() => {
                                              // Save note - update state first
                                              const updatedVideoResults = videoResults.map(v =>
                                                v.videoName === video.videoName
                                                  ? { ...v, internalNote: noteText }
                                                  : v
                                              );
                                              
                                              setVideoResults([...updatedVideoResults]);
                                              
                                              // Save to DB with updated results
                                              upsertContextSessionMutation.mutate({
                                                userId: localCurrentUser.id,
                                                tamId: selectedTamId,
                                                coreBeliefId: selectedCoreBeliefId,
                                                emotionalAngleId: selectedEmotionalAngleId,
                                                adId: selectedAdId,
                                                characterId: selectedCharacterId,
                                                currentStep,
                                                rawTextAd,
                                                processedTextAd,
                                                adLines,
                                                prompts,
                                                images,
                                                combinations,
                                                deletedCombinations,
                                                videoResults: updatedVideoResults,
                                                reviewHistory,
                                              });
                                              
                                              toast.success('Note saved!');
                                              setEditingNoteVideoName(null);
                                              setNoteText('');
                                            }}
                                            size="sm"
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            onClick={() => {
                                              setEditingNoteVideoName(null);
                                              setNoteText('');
                                            }}
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 text-xs"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        onClick={() => {
                                          setEditingNoteVideoName(video.videoName);
                                          setNoteText(video.internalNote || '');
                                        }}
                                        size="sm"
                                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1"
                                      >
                                        {video.internalNote ? '📝 Edit Note' : '📝 Add Note'}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Buton Download Individual */}
                            {video.videoUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    toast.info(`Descarcă ${video.videoName}...`);
                                    const response = await fetch(video.videoUrl!);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `${video.videoName}.mp4`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);
                                    toast.success(`${video.videoName} descărcat!`);
                                  } catch (error) {
                                    console.error('Download error:', error);
                                    toast.error(`Eroare la descărcare: ${error}`);
                                  }
                                }}
                                className="w-full border-blue-500 text-blue-700 hover:bg-blue-50 text-xs py-1"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {/* Statistici și Buton Next Step */}
              <div className="mt-8 p-6 bg-gray-50 border-2 border-gray-300 rounded-lg">
                {/* Statistici */}
                <div className="mb-4">
                  <p className="text-lg font-semibold text-gray-900 mb-2">Statistici Review:</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700">
                      <Check className="w-4 h-4 inline mr-1" />
                      {acceptedCount} acceptate
                    </span>
                    <span className="text-red-700">
                      <X className="w-4 h-4 inline mr-1" />
                      {regenerateCount} pentru regenerare
                    </span>
                    <span className="text-gray-600">
                      {videosWithoutDecision.length} fără decizie
                    </span>
                  </div>
                </div>
                

                {/* Buton Regenerate Selected - afișează întotdeauna dacă există videouri marcate */}
                {videoResults.some(v => v.reviewStatus === 'regenerate') && (
                  <Button
                    onClick={() => {
                      // Setează filtrul la 'regenerate' în Step 6
                      setStep5Filter('regenerate');
                      toast.info('Regenerare videouri marcate...');
                      setCurrentStep(6);
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg mb-4"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Regenerate Selected ({regenerateCount})
                  </Button>
                )}
                
                {/* Warning pentru videouri fără decizie */}
                {videosWithoutDecision.length > 0 && (
                  <div className="bg-red-100 border-2 border-red-700 rounded p-4 text-center">
                    <p className="text-red-900 font-medium">
                      ⚠️ {videosWithoutDecision.length} videouri fără decizie
                    </p>
                    <p className="text-sm text-red-800 mt-1">
                      Poți regenera videouri marcate chiar dacă nu ai luat decizie pentru toate.
                    </p>
                  </div>
                )}
                
                {/* Download buttons - moved inside Statistics container */}
                {acceptedVideosWithUrl.length > 0 && (
                  <div className="mt-4">
                    <Button
                      onClick={async () => {
                        const acceptedVideos = acceptedVideosWithUrl;
                      
                      if (acceptedVideos.length === 0) {
                        toast.error('Nu există videouri acceptate pentru download');
                        return;
                      }
                      
                      setIsDownloadZipModalOpen(true);
                      setDownloadZipProgress('Pregătesc arhiva ZIP...');
                      
                      try {
                        const zip = new JSZip();
                        
                        // Order videos by category: HOOKS, MIRROR, DCS, TRANZITION, NEW_CAUSE, MECHANISM, EMOTIONAL_PROOF, TRANSFORMATION, CTA
                        const categoryOrder = ['HOOKS', 'MIRROR', 'DCS', 'TRANZITION', 'NEW_CAUSE', 'MECHANISM', 'EMOTIONAL_PROOF', 'TRANSFORMATION', 'CTA'];
                        const orderedVideos: typeof acceptedVideos = [];
                        
                        categoryOrder.forEach(category => {
                          const categoryVideos = acceptedVideos.filter(v => v.section === category);
                          orderedVideos.push(...categoryVideos);
                        });
                        
                        // Download and add each video to ZIP with numbered prefix
                        for (let i = 0; i < orderedVideos.length; i++) {
                          const video = orderedVideos[i];
                          const videoNumber = i + 1;
                          
                          setDownloadZipProgress(`Descarc video ${videoNumber}/${orderedVideos.length}: ${video.videoName}...`);
                          
                          try {
                            const response = await fetch(video.videoUrl!);
                            const blob = await response.blob();
                            
                            // Add numbered prefix to filename
                            const filename = `${videoNumber}. ${video.videoName}.mp4`;
                            zip.file(filename, blob);
                          } catch (error) {
                            console.error(`Eroare la download ${video.videoName}:`, error);
                            toast.error(`Eroare la download ${video.videoName}`);
                          }
                        }
                        
                        setDownloadZipProgress('Creez arhiva ZIP...');
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        
                        setDownloadZipProgress('Descarc arhiva...');
                        const url = window.URL.createObjectURL(zipBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Accepted_Videos_${new Date().toISOString().split('T')[0]}.zip`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        
                        toast.success(`Arhiva ZIP cu ${orderedVideos.length} videouri descărcată!`);
                        setIsDownloadZipModalOpen(false);
                        setDownloadZipProgress('');
                      } catch (error: any) {
                        console.error('Eroare la crearea arhivei ZIP:', error);
                        toast.error(`Eroare: ${error.message}`);
                        setIsDownloadZipModalOpen(false);
                        setDownloadZipProgress('');
                      }
                    }}
                      className="w-auto mx-auto block border-2 border-blue-600 bg-white hover:bg-blue-50 text-blue-600 px-4 py-2 text-sm"
                    >
                      <Download className="w-4 h-4 mr-2 inline" />
                      Download Videos ({acceptedVideosWithUrl.length})
                    </Button>
                    
                    {/* Link pentru descărcare document Word cu liniile din Step 2 */}
                    <div className="mt-3 text-center">
                      <button
                        onClick={generateWordDocument}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Descarcă document Word cu toate liniile extrase
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Buton Video Editing - Step 8 */}
              {acceptedVideosWithUrl.length > 0 && (
                <div className="mt-8 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(6)}
                      className="px-6 py-3"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={async () => {
                        console.log('[Video Editing] 🔍 Total videos in videoResults:', videoResults.length);
                        console.log('[Video Editing] 🔍 All video names:', videoResults.map(v => v.videoName));
                        
                        // Filter only approved videos with videoUrl
                        const approvedVideos = videoResults.filter(v => {
                          const isAccepted = v.reviewStatus === 'accepted';
                          const isSuccess = v.status === 'success';
                          const hasUrl = !!v.videoUrl;
                          
                          console.log(`[Video Editing] 🔍 ${v.videoName}:`, {
                            reviewStatus: v.reviewStatus,
                            isAccepted,
                            status: v.status,
                            isSuccess,
                            hasUrl,
                            videoUrl: v.videoUrl?.substring(0, 50) + '...',
                            PASSES_FILTER: isAccepted && isSuccess && hasUrl
                          });
                          
                          return isAccepted && isSuccess && hasUrl;
                        });
                        
                        if (approvedVideos.length === 0) {
                          toast.error('Nu există videouri acceptate cu URL valid pentru editare');
                          return;
                        }
                        
                        // Process ALL approved videos (with or without red text)
                        const videosToProcess = approvedVideos;
                        
                        if (videosToProcess.length === 0) {
                          toast.error('❌ Nu există videouri acceptate! Verifică Step 7.');
                          return;
                        }
                        
                        console.log(`[Video Editing] ✅ Approved videos (${approvedVideos.length}):`, approvedVideos.map(v => v.videoName));
                        console.log(`[Video Editing] Starting batch processing for ${videosToProcess.length} videos (with and without red text)`);
                        console.log(`[Video Editing] 📋 Videos to process:`, videosToProcess.map(v => ({
                          name: v.videoName,
                          hasRedText: v.redStart !== undefined && v.redEnd !== undefined,
                          redStart: v.redStart,
                          redEnd: v.redEnd
                        })));
                        
                        // CLEAR old Step 8 data (editStatus, whisperTranscript, cutPoints, etc.) before starting new batch
                        // This preserves videos in Step 7 while removing Step 8 processing data
                        setVideoResults(prev => prev.map(v => 
                          v.editStatus === 'processed' 
                            ? { 
                                ...v, 
                                editStatus: null,
                                whisperTranscript: undefined,
                                cutPoints: undefined,
                                words: undefined,
                                audioUrl: undefined,
                                waveformData: undefined,
                                trimStatus: null,
                                trimmedVideoUrl: undefined,
                                acceptRejectStatus: null
                              }
                            : v
                        ));
                        
                        // Reset progress BEFORE opening modal to avoid showing old value
                        setProcessingProgress({ 
                          ffmpeg: { current: 0, total: videosToProcess.length },
                          whisper: { current: 0, total: videosToProcess.length },
                          cleanvoice: { current: 0, total: videosToProcess.length },
                          currentVideoName: '' 
                        });
                        setProcessingStep(null);
                        
                        // Open ProcessingModal and start batch processing
                        setShowProcessingModal(true);
                        
                        try {
                          await batchProcessVideosWithWhisper(videosToProcess);
                          
                          // Close modal and go to Step 8
                          setShowProcessingModal(false);
                          setCurrentStep(8);
                          toast.success(`✅ ${videosToProcess.length} videouri procesate cu succes!`);
                        } catch (error: any) {
                          console.error('[Video Editing] Batch processing error:', error);
                          setShowProcessingModal(false);
                          toast.error(`Eroare la procesarea videouri: ${error.message}`);
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 px-8 py-8 text-lg"
                      disabled={acceptedVideosWithUrl.length === 0}
                    >
                      Next: Auto-Prepare for Cutting ({acceptedVideosWithUrl.length})
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 8: Video Editing */}
        {currentStep === 8 && (() => {
          // Filter approved videos that have videoUrl
          let approvedVideos = videoResults.filter(v => 
            v.reviewStatus === 'accepted' && 
            v.status === 'success' && 
            v.videoUrl
          );
          
          // Apply Step 8 filter
          if (step8Filter === 'accepted') {
            // Show videos that are accepted OR don't have recutStatus set yet (null/undefined)
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'accepted' || !v.recutStatus);
          } else if (step8Filter === 'recut') {
            approvedVideos = approvedVideos.filter(v => v.recutStatus === 'recut');
          } else if (step8Filter === 'unlocked') {
            approvedVideos = approvedVideos.filter(v => !v.isStartLocked || !v.isEndLocked);
          } else if (step8Filter === 'problems') {
            // Filter videos with problems (status is NOT 'success')
            // This checks the final badge status (green/yellow/red) from VideoEditorV2
            approvedVideos = approvedVideos.filter(v => 
              v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success'
            );
          } else if (step8Filter === 'with_notes') {
            // Filter videos with step9Note
            approvedVideos = approvedVideos.filter(v => v.step9Note);
          }
          return (
            <Card className="mb-8 border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Video className="w-5 h-5" />
                  STEP 8 - Video Editing
                </CardTitle>
                <CardDescription>
                  Editează videouri approved: ajustează START și END pentru tăiere în Step 9.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Filter Dropdown */}
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-purple-900">Filtrează videouri:</label>
                      <select
                        value={step8Filter}
                        onChange={(e) => setStep8Filter(e.target.value as 'all' | 'accepted' | 'recut' | 'unlocked' | 'problems' | 'with_notes')}
                        className="px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="all">Toate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length})</option>
                        <option value="accepted">Acceptate ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (v.recutStatus === 'accepted' || !v.recutStatus)).length})</option>
                        <option value="recut">Necesită Retăiere ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.recutStatus === 'recut').length})</option>
                        <option value="unlocked">Fără Lock ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (!v.isStartLocked || !v.isEndLocked)).length})</option>
                        <option value="problems">Possible Problems ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success').length})</option>
                        <option value="with_notes">With Notes ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.step9Note).length})</option>
                      </select>
                    </div>
                    
                    {/* Check Video with Problems link */}
                    {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && v.editingDebugInfo?.status && v.editingDebugInfo.status !== 'success').length > 0 && (
                      <button
                        onClick={() => setStep8Filter('problems')}
                        className="text-sm text-red-600 hover:text-red-700 underline font-medium"
                      >
                        Check Video with Problems
                      </button>
                    )}
                  </div>
                  
                  {/* Sample Merge ALL Videos button */}
                  {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length > 1 && (
                    <Button
                      onClick={async () => {
                        console.log('[Sample Merge] Starting from Step 8 button...');
                        
                        // Get ALL accepted videos (not filtered)
                        const allAcceptedVideos = videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl);
                        
                        // Prepare video list with notes
                        const videoList = allAcceptedVideos.map(v => ({
                          name: v.videoName,
                          note: v.step9Note || ''
                        }));
                        
                        setSampleMergeVideos(videoList);
                        setIsSampleMergeModalOpen(true);
                        
                        // Smart cache: check if markers were modified
                        const currentHash = JSON.stringify(allAcceptedVideos.map(v => ({
                          name: v.videoName,
                          startMs: Math.round(v.cutPoints?.startKeep || 0),
                          endMs: Math.round(v.cutPoints?.endKeep || 0),
                        })));
                        
                        console.log('[Sample Merge] Cache check:');
                        console.log('[Sample Merge]   Initial hash:', initialVideosHash);
                        console.log('[Sample Merge]   Current hash:', currentHash);
                        console.log('[Sample Merge]   Last merged hash:', lastMergedVideosHash);
                        console.log('[Sample Merge]   Has cached video:', !!sampleMergedVideoUrl);
                        
                        // Check if we have a cached video with the same hash
                        if (currentHash === lastMergedVideosHash && sampleMergedVideoUrl) {
                          console.log('[Sample Merge] ✅ Cache hit! Using cached video.');
                          setSampleMergeProgress('');
                          return;
                        }
                        
                        // Check if markers were modified compared to initial state
                        const markersModified = initialVideosHash && currentHash !== initialVideosHash;
                        if (markersModified) {
                          console.log('[Sample Merge] ⚠️ Markers were modified, retransmitting to FFmpeg...');
                        } else {
                          console.log('[Sample Merge] 🆕 First merge or cache miss, proceeding...');
                        }
                        
                        // Only clear if cache miss
                        setSampleMergedVideoUrl(null);
                        setSampleMergeProgress('Preparing videos...');
                        
                        try {
                          // Extract original URLs
                          const extractOriginalUrl = (url: string) => {
                            if (url.startsWith('/api/proxy-video?url=')) {
                              const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                              return urlParam ? decodeURIComponent(urlParam) : url;
                            }
                            return url;
                          };
                          
                          const videos = allAcceptedVideos.map(v => ({
                            url: extractOriginalUrl(v.videoUrl),
                            name: v.videoName,
                            startMs: v.cutPoints?.startKeep || 0,
                            endMs: v.cutPoints?.endKeep || 0,
                          }));
                          
                          console.log('[Sample Merge] Videos:', videos);
                          setSampleMergeProgress(`Uploading ${videos.length} videos to FFmpeg API...`);
                          
                          const result = await cutAndMergeAllMutation.mutateAsync({
                            videos,
                            ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                          });
                          
                          console.log('[Sample Merge] Success!', result);
                          setSampleMergedVideoUrl(result.downloadUrl);
                          setLastMergedVideosHash(currentHash);
                          setSampleMergeProgress('');
                        } catch (error: any) {
                          console.error('[Sample Merge] Error:', error);
                          setSampleMergeProgress(`Error: ${error.message}`);
                          toast.error(`Sample merge failed: ${error.message}`);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      size="sm"
                    >
                      🎬 Sample Merge ALL Videos
                    </Button>
                  )}
                </div>
                

                {approvedVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Nu există videouri approved pentru editare.</p>
                    <Button
                      onClick={() => setCurrentStep(7)}
                      className="mt-4"
                    >
                      Înapoi la Step 7
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Video Editors - One per approved video */}
                    {approvedVideos.map((video, videoIndex) => {
                      // Convert waveformData JSON string to data URI for Peaks.js
                      // Use proper UTF-8 to base64 encoding (btoa doesn't handle UTF-8 correctly)
                      const peaksUrl = video.waveformData 
                        ? `data:application/json;base64,${btoa(unescape(encodeURIComponent(video.waveformData)))}`
                        : '';
                      
                      // Calculate duration from whisperTranscript (actual audio duration)
                      // DO NOT use cutPoints.endKeep as it changes when user adjusts markers!
                      // Whisper returns duration in seconds, use directly
                      const duration = video.whisperTranscript?.duration || 10; // Use actual audio duration in seconds
                      
                      return (
                        <div key={video.videoName} className="space-y-4">
                          {/* Display Notes from Step 7 and Step 9 */}
                          {(video.internalNote || video.step9Note) && (
                            <div className="space-y-2">
                              {video.internalNote && (
                                <div className="p-3 bg-blue-50 border border-blue-300 rounded">
                                  <p className="text-sm text-gray-700">
                                    <strong className="text-blue-900">Step 7 Note:</strong> {video.internalNote}
                                  </p>
                                </div>
                              )}

                            </div>
                          )}
                          
                          <VideoEditorV2
                            key={`${video.videoName}-${video.audioUrl || 'no-audio'}-${video.step9Note || 'no-note'}`}
                            video={{
                            id: video.videoName, // Use videoName as unique identifier
                            videoName: video.videoName,
                            videoUrl: `/api/proxy-video?url=${encodeURIComponent(video.videoUrl!)}`,
                            audioUrl: video.audioUrl || '',
                            peaksUrl: peaksUrl,
                            cutPoints: video.cutPoints || { startKeep: 0, endKeep: duration * 1000 }, // Default: full video
                            duration: duration,
                            text: video.text,
                            redStart: video.redStart,
                            redEnd: video.redEnd,
                            // Restore persisted lock state
                            isStartLocked: video.isStartLocked,
                            isEndLocked: video.isEndLocked,
                            step9Note: video.step9Note,
                            editingDebugInfo: video.editingDebugInfo,
                            }}
                            nextVideo={videoIndex < approvedVideos.length - 1 ? {
                              videoName: approvedVideos[videoIndex + 1].videoName,
                              videoUrl: approvedVideos[videoIndex + 1].videoUrl!,
                              cutPoints: approvedVideos[videoIndex + 1].cutPoints || { startKeep: 0, endKeep: 10000 },
                            } : null}
                            onCutAndMerge={async (video1, video2) => {
                              console.log('[Cut & Merge] Starting merge:', video1.videoName, '+', video2.videoName);
                              
                              setIsMergeModalOpen(true);
                              
                              // Smart cache: check if markers were modified
                              // Skip if cutPoints is null (videos without red text)
                              if (!video1.cutPoints || !video2.cutPoints) {
                                toast.error('❌ Cannot merge videos without cut points');
                                return;
                              }
                              
                              const currentHash = JSON.stringify({
                                video1Name: video1.videoName,
                                video1Start: Math.round(video1.cutPoints.startKeep),
                                video1End: Math.round(video1.cutPoints.endKeep),
                                video2Name: video2.videoName,
                                video2Start: Math.round(video2.cutPoints.startKeep),
                                video2End: Math.round(video2.cutPoints.endKeep),
                              });
                              
                              console.log('[Cut & Merge] Cache check:');
                              console.log('[Cut & Merge]   Initial hash:', initialPairHash);
                              console.log('[Cut & Merge]   Current hash:', currentHash);
                              console.log('[Cut & Merge]   Last merged hash:', lastMergedPairHash);
                              console.log('[Cut & Merge]   Has cached video:', !!mergedVideoUrl);
                              
                              // Check if we have a cached video with the same hash
                              if (currentHash === lastMergedPairHash && mergedVideoUrl) {
                                console.log('[Cut & Merge] ✅ Cache hit! Using cached video.');
                                setMergeProgress('');
                                return;
                              }
                              
                              // Check if this is first click (no initial hash set)
                              const isFirstClick = !initialPairHash;
                              
                              if (isFirstClick) {
                                // First click: set initial hash and proceed with merge
                                setInitialPairHash(currentHash);
                                console.log('[Cut & Merge] 🆕 First click - Initial pair hash set:', currentHash);
                              } else {
                                // Subsequent clicks: check if markers were modified
                                const markersModified = currentHash !== initialPairHash;
                                if (markersModified) {
                                  console.log('[Cut & Merge] ⚠️ Markers were modified, retransmitting to FFmpeg...');
                                  // Update initial hash to current for next comparison
                                  setInitialPairHash(currentHash);
                                } else {
                                  console.log('[Cut & Merge] 🔁 Re-merge with same markers (cache miss).');
                                }
                              }
                              
                              // Clear old video before starting new merge
                              setMergedVideoUrl(null);
                              setMergeProgress('Uploading videos to FFmpeg API...');
                              
                              try{
                                // Extract original URLs from proxy URLs
                                const extractOriginalUrl = (proxyUrl: string) => {
                                  if (proxyUrl.startsWith('/api/proxy-video?url=')) {
                                    const urlParam = new URLSearchParams(proxyUrl.split('?')[1]).get('url');
                                    return urlParam ? decodeURIComponent(urlParam) : proxyUrl;
                                  }
                                  return proxyUrl;
                                };
                                
                                const video1OriginalUrl = extractOriginalUrl(video1.videoUrl);
                                const video2OriginalUrl = extractOriginalUrl(video2.videoUrl);
                                
                                console.log('[Cut & Merge] Original URLs:', {
                                  video1: video1OriginalUrl,
                                  video2: video2OriginalUrl,
                                });
                                
                                const result = await cutAndMergeMutation.mutateAsync({
                                  video1Url: video1OriginalUrl,
                                  video1Name: video1.videoName,
                                  video1StartMs: video1.cutPoints.startKeep,
                                  video1EndMs: video1.cutPoints.endKeep,
                                  video2Url: video2OriginalUrl,
                                  video2Name: video2.videoName,
                                  video2StartMs: video2.cutPoints.startKeep,
                                  video2EndMs: video2.cutPoints.endKeep,
                                  ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                                });
                                
                                if (result.success && result.downloadUrl) {
                                  setMergedVideoUrl(result.downloadUrl);
                                  setLastMergedPairHash(currentHash);
                                  setMergeProgress('Merge complete!');
                                } else {
                                  throw new Error('Merge failed');
                                }
                              } catch (error: any) {
                                console.error('[Cut & Merge] Error:', error);
                                toast.error(`Merge failed: ${error.message}`);
                                setIsMergeModalOpen(false);
                              }
                            }}
                            onReprocess={async (videoName) => {
                              console.log('[Reprocesare] Starting re-processing for:', videoName);
                              
                              // Find the video to re-process
                              const videoToReprocess = videoResults.find(v => v.videoName === videoName);
                              if (!videoToReprocess) {
                                toast.error('Video not found!');
                                return;
                              }
                              
                              // Log BEFORE reprocesare
                              console.log('[Reprocesare] BEFORE - cutPoints:', {
                                startKeep: videoToReprocess.cutPoints?.startKeep,
                                endKeep: videoToReprocess.cutPoints?.endKeep,
                                redPosition: videoToReprocess.cutPoints?.redPosition,
                                confidence: videoToReprocess.cutPoints?.confidence
                              });
                              
                              // Reset progress and open modal
                              setProcessingProgress({ 
                                ffmpeg: { current: 0, total: 1 },
                                whisper: { current: 0, total: 1 },
                                cleanvoice: { current: 0, total: 1 },
                                currentVideoName: videoName 
                              });
                              setProcessingStep(null);
                              setShowProcessingModal(true);
                              
                              try {
                                // Call batch processing with single video
                                // batchProcessVideosWithWhisper already updates videoResults internally
                                const resultsMap = await batchProcessVideosWithWhisper([videoToReprocess]);
                                
                                // Check if processing was successful
                                const result = resultsMap.get(videoName);
                                if (result) {
                                  // Log AFTER reprocesare (from backend)
                                  console.log('[Reprocesare] AFTER (from backend) - cutPoints:', {
                                    startKeep: result.cutPoints?.startKeep,
                                    endKeep: result.cutPoints?.endKeep,
                                    redPosition: result.cutPoints?.redPosition,
                                    confidence: result.cutPoints?.confidence
                                  });
                                  
                                  // Log AFTER state update
                                  setTimeout(() => {
                                    const updatedVideo = videoResults.find(v => v.videoName === videoName);
                                    console.log('[Reprocesare] AFTER (in state) - cutPoints:', {
                                      startKeep: updatedVideo?.cutPoints?.startKeep,
                                      endKeep: updatedVideo?.cutPoints?.endKeep,
                                      redPosition: updatedVideo?.cutPoints?.redPosition,
                                      confidence: updatedVideo?.cutPoints?.confidence
                                    });
                                  }, 100);
                                  
                                  toast.success(`✅ ${videoName} reprocesed successfully!`);
                                } else {
                                  toast.error(`❌ Failed to reprocess ${videoName}`);
                                }
                              } catch (error: any) {
                                console.error('[Reprocesare] Error:', error);
                                toast.error(`Error: ${error.message}`);
                              } finally {
                                setShowProcessingModal(false);
                              }
                            }}
                            onTrimChange={(videoId, cutPoints, isStartLocked, isEndLocked) => {
                            // Update local state when user adjusts trim markers or lock state
                            // videoId is actually videoName (unique identifier)
                            console.log('[DEBUG onTrimChange] 🔵 CALLED', {
                              videoId,
                              cutPoints: {
                                startKeep: cutPoints.startKeep,
                                endKeep: cutPoints.endKeep
                              },
                              isStartLocked,
                              isEndLocked,
                              matchingVideo: videoResults.find(v => v.videoName === videoId)?.videoName
                            });
                            
                            // Use functional update to get the LATEST state and prevent race conditions
                            setVideoResults(prev => {
                              const updatedVideoResults = prev.map(v =>
                                v.videoName === videoId
                                  ? { 
                                      ...v, 
                                      cutPoints,
                                      isStartLocked: isStartLocked,
                                      isEndLocked: isEndLocked,
                                    }
                                  : v
                              );
                              
                              // Immediate save to database using the UPDATED state
                              // This ensures we save the correct values even when changing markers rapidly
                              if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                const thisVideoCutPoints = updatedVideoResults.find(v => v.videoName === videoId)?.cutPoints;
                                console.log('[VideoEditorV2] 🟢 SAVING TO DB', {
                                  videoId,
                                  cutPoints_param: `start=${cutPoints.startKeep} end=${cutPoints.endKeep}`,
                                  cutPoints_inUpdatedArray: `start=${thisVideoCutPoints?.startKeep} end=${thisVideoCutPoints?.endKeep}`,
                                  isStartLocked,
                                  isEndLocked,
                                  updatedVideoResults_length: updatedVideoResults.length
                                });
                                
                                upsertContextSessionMutation.mutate({
                                  userId: currentUser.id,
                                  coreBeliefId: selectedCoreBeliefId,
                                  emotionalAngleId: selectedEmotionalAngleId,
                                  adId: selectedAdId,
                                  characterId: selectedCharacterId,
                                  currentStep,
                                  rawTextAd,
                                  processedTextAd,
                                  adLines,
                                  prompts,
                                  images,
                                  combinations,
                                  deletedCombinations,
                                  videoResults: updatedVideoResults,
                                  reviewHistory,
                                }, {
                                  onSuccess: () => {
                                    console.log('[VideoEditorV2] ✅ DB SAVE SUCCESS', {
                                      videoId,
                                      savedCutPoints: updatedVideoResults.find(v => v.videoName === videoId)?.cutPoints
                                    });
                                  },
                                  onError: (error) => {
                                    console.error('[VideoEditorV2] ❌ DB SAVE FAILED', {
                                      videoId,
                                      error: error.message
                                    });
                                  },
                                });
                              }
                              
                              return updatedVideoResults;
                            });
                          }}
                          />
                        </div>
                      );
                    })}

                    {/* Navigation Buttons */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <Button
                          onClick={() => setCurrentStep(7)}
                          variant="outline"
                          className="px-6 py-3"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>

                        {/* Center buttons group */}
                        <div className="flex flex-row items-center gap-2 flex-nowrap">
                          {/* Sample Merge Video button - always show if we have approved videos (ignore filter) */}
                          {videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length > 1 && (
                            <Button
                              onClick={async () => {
                            console.log('[Sample Merge] Starting...');
                            
                            // Prepare video list with notes
                            const videoList = approvedVideos.map(v => ({
                              name: v.videoName,
                              note: v.step9Note || ''
                            }));
                            
                            setSampleMergeVideos(videoList);
                            setIsSampleMergeModalOpen(true);
                            
                            // Smart cache: check if markers were modified
                            const currentHash = JSON.stringify(approvedVideos.map(v => ({
                              name: v.videoName,
                              startMs: Math.round(v.cutPoints?.startKeep || 0),
                              endMs: Math.round(v.cutPoints?.endKeep || 0),
                            })));
                            
                            // Check if markers were modified compared to initial state
                            const markersModified = initialVideosHash && currentHash !== initialVideosHash;
                            console.log('[Sample Merge] Markers modified:', markersModified);
                            console.log('[Sample Merge] Initial hash:', initialVideosHash);
                            console.log('[Sample Merge] Current hash:', currentHash);
                            
                            // Use cache if markers NOT modified AND we have cached video
                            if (!markersModified && currentHash === lastMergedVideosHash && sampleMergedVideoUrl) {
                              console.log('[Sample Merge] Cache hit! No markers modified, using cached video.');
                              setSampleMergeProgress('');
                              return;
                            }
                            
                            if (markersModified) {
                              console.log('[Sample Merge] Markers were modified, retransmitting to FFmpeg...');
                            }
                            
                            // Only clear if cache miss
                            setSampleMergedVideoUrl(null);
                            setSampleMergeProgress('Preparing videos...');
                            
                            try {
                              // Extract original URLs
                              const extractOriginalUrl = (url: string) => {
                                if (url.startsWith('/api/proxy-video?url=')) {
                                  const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
                                  return urlParam ? decodeURIComponent(urlParam) : url;
                                }
                                return url;
                              };
                              
                              const videos = approvedVideos.map(v => ({
                                url: extractOriginalUrl(v.videoUrl),
                                name: v.videoName,
                                startMs: v.cutPoints?.startKeep || 0,
                                endMs: v.cutPoints?.endKeep || 0,
                              }));
                              
                              console.log('[Sample Merge] Videos:', videos);
                              setSampleMergeProgress(`Uploading ${videos.length} videos to FFmpeg API...`);
                              
                              const result = await cutAndMergeAllMutation.mutateAsync({
                                videos,
                                ffmpegApiKey: localCurrentUser.ffmpegApiKey || '',
                              });
                              
                              console.log('[Sample Merge] Success!', result);
                              setSampleMergedVideoUrl(result.downloadUrl);
                              setLastMergedVideosHash(currentHash);
                              setSampleMergeProgress('');
                            } catch (error) {
                              console.error('[Sample Merge] Error:', error);
                              setSampleMergeProgress(`Error: ${error.message}`);
                              toast.error(`Sample merge failed: ${error.message}`);
                            }
                          }}
                              className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                              size="sm"
                            >
                              🎬 Sample Merge ALL Videos
                            </Button>
                          )}
                        </div>

                        {/* Buton TRIM ALL VIDEOS - va trimite la FFmpeg API pentru cutting */}
                        <Button
                          onClick={() => {
                            // Open trimming modal
                            setIsTrimmingModalOpen(true);
                            // Start trimming process
                            handleTrimAllVideos();
                          }}
                          className="bg-red-600 hover:bg-red-700 px-8 py-8 text-lg"
                        >
                          {(() => {
                            const hasTrimmedVideos = videoResults.some(v => v.trimmedVideoUrl);
                            const count = hasTrimmedVideos 
                              ? videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl && (!v.trimmedVideoUrl || v.recutStatus === 'recut')).length
                              : videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.videoUrl).length;
                            return (
                              <>
                                Next: Trim All Videos ({count})
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </>
                            );
                          })()}
                        </Button>

                        {/* Check Videos button - only show if we have trimmed videos */}
                        {videoResults.some(v => v.trimmedVideoUrl) && (
                          <Button
                            onClick={() => setCurrentStep(9)}
                            className="bg-green-600 hover:bg-green-700 px-8 py-8 text-lg"
                          >
                            {(() => {
                              const count = approvedVideos.filter(v => v.trimmedVideoUrl).length;
                              return (
                                <>
                                  Next: Check Videos ({count})
                                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </>
                              );
                            })()}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* STEP 9: Final Trimmed Videos */}
        {currentStep === 9 && (() => {
          let trimmedVideos = videoResults.filter(v => 
            v.reviewStatus === 'accepted' && 
            v.trimmedVideoUrl
          );
          
          // Apply filter
          if (step9Filter === 'accepted') {
            trimmedVideos = trimmedVideos.filter(v => v.recutStatus === 'accepted');
          } else if (step9Filter === 'recut') {
            trimmedVideos = trimmedVideos.filter(v => v.recutStatus === 'recut');
          }
          
          return (
            <Card className="mb-8 border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Video className="w-5 h-5" />
                  Cut Videos
                </CardTitle>
                <CardDescription>
                  Videoclipurile tăiate și gata pentru download.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {trimmedVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Nu există videouri trimmed încă.</p>
                    <Button
                      onClick={() => setCurrentStep(8)}
                      className="mt-4"
                    >
                      Înapoi la Step 8
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Filter and Sample Merge button */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-blue-900">Filtrează videouri:</label>
                        <select
                          value={step9Filter || 'all'}
                          onChange={(e) => setStep9Filter(e.target.value as 'all' | 'accepted' | 'recut')}
                          className="px-4 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">Toate ({trimmedVideos.length})</option>
                          <option value="accepted">Acceptate ({trimmedVideos.filter(v => v.recutStatus === 'accepted').length})</option>
                          <option value="recut">Necesită Retăiere ({trimmedVideos.filter(v => v.recutStatus === 'recut').length})</option>
                        </select>
                      </div>
                      

                      
                      {/* UNDO Button */}
                      {recutHistory.length > 0 && (
                        <Button
                          onClick={() => {
                            const lastAction = recutHistory[recutHistory.length - 1];
                            // Restore previous status
                            setVideoResults(prev => prev.map(v =>
                              v.videoName === lastAction.videoName
                                ? { ...v, recutStatus: lastAction.previousStatus }
                                : v
                            ));
                            // Remove from history
                            setRecutHistory(prev => prev.slice(0, -1));
                            toast.success(`Acțiune anulată pentru ${lastAction.videoName}`);
                          }}
                          variant="outline"
                          className="border-orange-500 text-orange-700 hover:bg-orange-50"
                        >
                          <Undo2 className="w-4 h-4 mr-2" />
                          UNDO ({recutHistory.length} acțiuni)
                        </Button>
                      )}
                    </div>
                    
                    {/* Grid de videoclipuri */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {trimmedVideos.map((video) => (
                        <div key={video.id} className="border-2 border-blue-200 rounded-lg p-4 bg-white">
                          {/* Video Name */}
                          <h3 className="text-sm font-bold text-gray-900 mb-2 text-center">
                            {video.videoName}
                          </h3>
                          
                          {/* Video Player with milliseconds display */}
                          <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '9/16' }}>
                            <video
                              ref={(el) => {
                                if (el && !el.dataset.initialized) {
                                  el.dataset.initialized = 'true';
                                  const timeDisplay = el.nextElementSibling as HTMLElement;
                                  if (timeDisplay) {
                                    el.addEventListener('timeupdate', () => {
                                      const current = el.currentTime.toFixed(3);
                                      const duration = el.duration ? el.duration.toFixed(3) : '0.000';
                                      timeDisplay.textContent = `${current}s / ${duration}s`;
                                    });
                                    el.addEventListener('loadedmetadata', () => {
                                      const duration = el.duration.toFixed(3);
                                      timeDisplay.textContent = `0.000s / ${duration}s`;
                                    });
                                  }
                                }
                              }}
                              src={video.trimmedVideoUrl}
                              className="absolute top-0 left-0 w-full h-full object-contain"
                              controls
                              playsInline
                            />
                            {/* Time display overlay */}
                            <div className="absolute bottom-12 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                              0.000s / 0.000s
                            </div>
                          </div>
                          
                          {/* Video Text */}
                          {video.text && (
                            <p className="text-xs text-gray-700 mb-3 text-center">
                              {video.redStart !== undefined && video.redEnd !== undefined ? (
                                <>
                                  {video.text.substring(0, video.redStart)}
                                  <span className="text-red-600 font-bold">
                                    {video.text.substring(video.redStart, video.redEnd)}
                                  </span>
                                  {video.text.substring(video.redEnd)}
                                </>
                              ) : (
                                video.text
                              )}
                            </p>
                          )}
                          

                          
                          {/* Step 9 Note Display */}
                          {video.step9Note && (
                            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                              <p className="text-gray-700"><strong>Note:</strong> {video.step9Note}</p>
                            </div>
                          )}
                          
                          {/* Accept/Recut Buttons - same design as Step 7 */}
                          <div className="space-y-2 mb-3">
                            {!video.recutStatus ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: 'accepted' }
                                        : v
                                    ));
                                    toast.success(`✅ ${video.videoName} acceptat!`);
                                  }}
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </Button>
                                
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: 'recut' }
                                        : v
                                    ));
                                    toast.info(`✂️ ${video.videoName} marcat pentru retăiere!`);
                                  }}
                                  size="sm"
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Recut
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center">
                                {/* Status badge after decision */}
                                <div className={`flex-1 px-3 py-2 rounded text-xs font-medium text-center ${
                                  video.recutStatus === 'accepted' 
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                  {video.recutStatus === 'accepted' ? (
                                    <><Check className="w-3 h-3 inline mr-1" />Acceptat</>
                                  ) : (
                                    <><RefreshCw className="w-3 h-3 inline mr-1" />Recut</>
                                  )}
                                </div>
                                
                                {/* UNDO button */}
                                <Button
                                  onClick={() => {
                                    setVideoResults(prev => prev.map(v =>
                                      v.videoName === video.videoName
                                        ? { ...v, recutStatus: null }
                                        : v
                                    ));
                                    toast.info('Decizie anulată');
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-400 text-gray-700 hover:bg-gray-100 text-xs py-1"
                                >
                                  <Undo2 className="w-3 h-3 mr-1" />
                                  Undo
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Add Note Button (doar pentru Recut) */}
                          {video.recutStatus === 'recut' && (
                            <div className="mb-3">
                              {editingStep9NoteVideoName === video.videoName ? (
                                <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-3 space-y-2">
                                  <textarea
                                    value={step9NoteText}
                                    onChange={(e) => setStep9NoteText(e.target.value)}
                                    placeholder="Add internal note..."
                                    className="w-full p-2 border border-yellow-300 rounded text-xs bg-white"
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => {
                                        // Save note to state
                                        const updatedVideoResults = videoResults.map(v =>
                                          v.videoName === video.videoName
                                            ? { ...v, step9Note: step9NoteText }
                                            : v
                                        );
                                        setVideoResults(updatedVideoResults);
                                        
                                        // Save to database immediately
                                        if (selectedCoreBeliefId && selectedEmotionalAngleId && selectedAdId && selectedCharacterId) {
                                          upsertContextSessionMutation.mutate({
                                            userId: currentUser.id,
                                            coreBeliefId: selectedCoreBeliefId,
                                            emotionalAngleId: selectedEmotionalAngleId,
                                            adId: selectedAdId,
                                            characterId: selectedCharacterId,
                                            currentStep,
                                            rawTextAd,
                                            processedTextAd,
                                            adLines,
                                            prompts,
                                            images,
                                            combinations,
                                            deletedCombinations,
                                            videoResults: updatedVideoResults,
                                            reviewHistory,
                                          }, {
                                            onSuccess: () => {
                                              console.log('[Step9] Note saved to DB');
                                              toast.success(`Note saved for ${video.videoName}`);
                                            },
                                          });
                                        }
                                        
                                        setEditingStep9NoteVideoName(null);
                                        setStep9NoteText('');
                                      }}
                                      size="sm"
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setEditingStep9NoteVideoName(null);
                                        setStep9NoteText('');
                                      }}
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs py-1"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => {
                                    setEditingStep9NoteVideoName(video.videoName);
                                    setStep9NoteText(video.step9Note || '');
                                  }}
                                  size="sm"
                                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1"
                                >
                                  {video.step9Note ? '📝 Edit Note' : '📝 Add Note'}
                                </Button>
                              )}
                            </div>
                          )}
                          
                          {/* Download Link */}
                          <button
                            onClick={async () => {
                              try {
                                // Fetch video as blob to force download
                                const response = await fetch(video.trimmedVideoUrl!);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${video.videoName}.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                // Clean up blob URL
                                setTimeout(() => URL.revokeObjectURL(url), 100);
                                
                                toast.success(`Downloading ${video.videoName}...`);
                              } catch (error: any) {
                                toast.error(`Download failed: ${error.message}`);
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 underline flex items-center justify-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Navigation Buttons */}
                    <div className="flex justify-between gap-4 mt-6">
                      <Button
                        onClick={() => setCurrentStep(8)}
                        variant="outline"
                        className="px-8 py-6 text-base"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </Button>
                      
                      <Button
                        onClick={handleMergeVideos}
                        className="bg-purple-600 hover:bg-purple-700 px-8 py-6 text-base"
                        disabled={isMergingStep10}
                      >
                        {isMergingStep10 ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            {mergeStep10Progress || 'Merging...'}
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Next: Merge Videos ({videoResults.filter(v => v.reviewStatus === 'accepted' && v.status === 'success' && v.trimmedVideoUrl).length})
                          </>
                        )}
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* STEP 10: Merge Videos */}
        {currentStep === 10 && (
          <Card className="mb-8 border-2 border-indigo-200">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                STEP 10 - Merge Videos
              </CardTitle>
              <CardDescription>
                Select hooks and body video to create final merged video
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-8">
                {/* STEP 1 - Choose Hooks */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-indigo-900">STEP 1 - Choose Hooks</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const hookVideos = videoResults.filter(v => 
                            v.trimmedVideoUrl && 
                            v.videoName.toLowerCase().includes('hook')
                          );
                          setSelectedHooks(hookVideos.map(v => v.videoName));
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedHooks([])}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  
                  {(() => {
                    let hookVideos = videoResults.filter(v => 
                      v.trimmedVideoUrl && 
                      v.videoName.toLowerCase().includes('hook')
                    );
                    
                    // Filter out individual variations if merged version exists
                    const displayHooks = hookVideos.filter(v => {
                      // If this is a variation (A, B, C, D), check if merged version exists
                      const match = v.videoName.match(/(.*HOOK\d+)[A-Z](.*)/);
                      if (match) {
                        const baseName = match[1] + match[2];
                        // Hide variation if merged version exists
                        return !hookMergedVideos[baseName];
                      }
                      return true;
                    });
                    
                    // Add merged hooks to display
                    const mergedHooksList = Object.entries(hookMergedVideos).map(([baseName, cdnUrl]) => ({
                      videoName: baseName.replace(/(_[^_]+)$/, 'M$1'),
                      trimmedVideoUrl: cdnUrl,
                      text: 'Merged hook variation',
                    }));
                    
                    const allHooks = [...displayHooks, ...mergedHooksList];
                    
                    if (allHooks.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">No hook videos available</p>
                      );
                    }
                    
                    return (
                      <div className="relative">
                        <div className="overflow-x-auto pb-4">
                          <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
                            {allHooks.map(video => (
                              <div key={video.videoName} className="flex-shrink-0" style={{ width: '270px' }}>
                                <div className="space-y-2">
                                  {/* Checkbox */}
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedHooks.includes(video.videoName)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedHooks([...selectedHooks, video.videoName]);
                                        } else {
                                          setSelectedHooks(selectedHooks.filter(h => h !== video.videoName));
                                        }
                                      }}
                                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                  </div>
                                  
                                  {/* Video Name */}
                                  <p className="text-xs font-semibold text-gray-900 text-center truncate">
                                    {video.videoName}
                                  </p>
                                  
                                  {/* Video Player */}
                                  <video
                                    src={video.trimmedVideoUrl}
                                    controls
                                    className="w-full rounded-lg border border-gray-300"
                                    style={{ height: '480px', objectFit: 'contain' }}
                                  />
                                  
                                  {/* Video Text (without red text) */}
                                  <p className="text-xs text-gray-600 text-center line-clamp-2">
                                    {video.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* STEP 2 - Choose Body */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-indigo-900">STEP 2 - Choose Body</h3>
                  
                  {(() => {
                    // Check if we have merged body video
                    if (bodyMergedVideoUrl) {
                      return (
                        <div className="flex justify-start">
                          <div className="flex-shrink-0" style={{ width: '270px' }}>
                            <div className="space-y-2">
                              {/* Checkbox */}
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedBody === 'body_merged'}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBody('body_merged');
                                    } else {
                                      setSelectedBody(null);
                                    }
                                  }}
                                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                              </div>
                              
                              {/* Video Name */}
                              <p className="text-xs font-semibold text-gray-900 text-center truncate">
                                Body (Merged)
                              </p>
                              
                              {/* Video Player */}
                              <video
                                src={bodyMergedVideoUrl}
                                controls
                                className="w-full rounded-lg border border-gray-300"
                                style={{ height: '480px', objectFit: 'contain' }}
                              />
                              
                              {/* Info */}
                              <p className="text-xs text-gray-600 text-center line-clamp-2">
                                All body videos merged
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Fallback: Show first body video
                    const bodyVideos = videoResults.filter(v => 
                      v.trimmedVideoUrl && 
                      !v.videoName.toLowerCase().includes('hook')
                    );
                    
                    if (bodyVideos.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">No body videos available. Click "Next: Merge Videos" in Step 9 first.</p>
                      );
                    }
                    
                    const bodyVideo = bodyVideos[0];
                    
                    return (
                      <div className="flex justify-start">
                        <div className="flex-shrink-0" style={{ width: '270px' }}>
                          <div className="space-y-2">
                            {/* Checkbox */}
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedBody === bodyVideo.videoName}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBody(bodyVideo.videoName);
                                  } else {
                                    setSelectedBody(null);
                                  }
                                }}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                            </div>
                            
                            {/* Video Name */}
                            <p className="text-xs font-semibold text-gray-900 text-center truncate">
                              {bodyVideo.videoName}
                            </p>
                            
                            {/* Video Player */}
                            <video
                              src={bodyVideo.trimmedVideoUrl}
                              controls
                              className="w-full rounded-lg border border-gray-300"
                              style={{ height: '480px', objectFit: 'contain' }}
                            />
                            
                            {/* Video Text */}
                            <p className="text-xs text-gray-600 text-center line-clamp-2">
                              {bodyVideo.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Final Videos (combinations) Preview */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold text-indigo-900">Final Videos (combinations)</h3>
                  
                  {(() => {
                    // Calculate combinations based on selected hooks and body
                    const combinations: string[] = [];
                    
                    if (selectedHooks.length > 0 && selectedBody) {
                      // Extract context and character from body or first hook
                      const referenceVideo = selectedBody === 'body_merged' 
                        ? videoResults.find(v => !v.videoName.toLowerCase().includes('hook'))
                        : videoResults.find(v => v.videoName === selectedBody);
                      
                      if (!referenceVideo && selectedHooks.length > 0) {
                        // Fallback to first hook
                        const firstHookName = selectedHooks[0];
                        const hookVideo = videoResults.find(v => v.videoName === firstHookName);
                        if (hookVideo) {
                          const contextMatch = hookVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
                          const characterMatch = hookVideo.videoName.match(/_([^_]+)$/);
                          const context = contextMatch ? contextMatch[1] : 'MERGED';
                          const character = characterMatch ? characterMatch[1] : 'TEST';
                          
                        selectedHooks.forEach((hookName, index) => {
                          // Extract hook number from name (e.g., HOOK3M_TEST → HOOK3)
                          const hookMatch = hookName.match(/HOOK(\d+)[A-Z]?/);
                          const hookNumber = hookMatch ? hookMatch[1] : (index + 1);
                          
                          // Extract image name from imageUrl
                          let imageName = '';
                          if (hookVideo && hookVideo.imageUrl) {
                            // Extract filename from URL: .../Alina_1-1763565542441-8ex9ipx3ruv.png → Alina_1
                            const urlParts = hookVideo.imageUrl.split('/');
                            const filename = urlParts[urlParts.length - 1];
                            const nameMatch = filename.match(/^(.+?)-\d+/);
                            imageName = nameMatch ? nameMatch[1] : '';
                          }
                          
                          const finalName = imageName 
                            ? `${context}_${character}_${imageName}_HOOK${hookNumber}`
                            : `${context}_${character}_HOOK${hookNumber}`;
                          combinations.push(finalName);
                        });
                        }
                      } else if (referenceVideo) {
                        const contextMatch = referenceVideo.videoName.match(/^(T\d+_C\d+_E\d+_AD\d+)/);
                        const characterMatch = referenceVideo.videoName.match(/_([^_]+)$/);
                        const context = contextMatch ? contextMatch[1] : 'MERGED';
                        const character = characterMatch ? characterMatch[1] : 'TEST';
                        
                        selectedHooks.forEach((hookName, index) => {
                          // Extract hook number from name
                          const hookMatch = hookName.match(/HOOK(\d+)[A-Z]?/);
                          const hookNumber = hookMatch ? hookMatch[1] : (index + 1);
                          
                          // Find the hook video to get imageUrl
                          const hookVideo = videoResults.find(v => v.videoName === hookName);
                          
                          // Extract image name from imageUrl
                          let imageName = '';
                          if (hookVideo && hookVideo.imageUrl) {
                            // Extract filename from URL: .../Alina_1-1763565542441-8ex9ipx3ruv.png → Alina_1
                            const urlParts = hookVideo.imageUrl.split('/');
                            const filename = urlParts[urlParts.length - 1];
                            const nameMatch = filename.match(/^(.+?)-\d+/);
                            imageName = nameMatch ? nameMatch[1] : '';
                          }
                          
                          const finalName = imageName 
                            ? `${context}_${character}_${imageName}_HOOK${hookNumber}`
                            : `${context}_${character}_HOOK${hookNumber}`;
                          combinations.push(finalName);
                        });
                      }
                    }
                    
                    if (combinations.length === 0) {
                      return (
                        <p className="text-gray-600 text-sm">Select hooks and body to preview final video combinations</p>
                      );
                    }
                    
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                        <p className="text-xs text-gray-600 mb-2">
                          {combinations.length} final video{combinations.length > 1 ? 's' : ''} will be created:
                        </p>
                        <div className="space-y-1">
                          {combinations.map((name, index) => (
                            <p key={index} className="text-xs font-mono text-gray-800">
                              {name}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex justify-between items-center gap-4 mt-6">
                  <Button
                    onClick={() => setCurrentStep(9)}
                    variant="outline"
                    className="px-8 py-6 text-base"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </Button>
                  
                  <Button
                    onClick={handleMergeFinalVideos}
                    className="bg-green-600 hover:bg-green-700 px-8 py-6 text-base"
                    disabled={selectedHooks.length === 0 || !selectedBody || isMergingFinalVideos}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Next: Merge Final Videos
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* STEP 11: Final Videos */}
        {currentStep === 11 && (
          <Card className="shadow-xl border-2 border-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="text-3xl font-bold text-green-900 flex items-center gap-3">
                <span className="bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">11</span>
                🎬 Final Videos
              </CardTitle>
              <CardDescription className="text-base text-gray-700 mt-2">
                Your final video combinations are ready! Download individual videos or all at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {finalVideos.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No final videos yet. Go back to Step 10 to merge videos.</p>
                ) : (
                  <>
                    {/* Videos Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {finalVideos.map((video, index) => (
                        <div key={index} className="space-y-3 p-4 border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                          {/* Video Name */}
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {video.videoName}
                          </p>
                          
                          {/* Video Player */}
                          <video
                            src={video.cdnUrl}
                            controls
                            className="w-full rounded-lg border border-gray-300"
                            style={{ height: '320px', objectFit: 'cover' }}
                          />
                          
                          {/* Download Button */}
                          <Button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = video.cdnUrl;
                              link.download = `${video.videoName}.mp4`;
                              link.click();
                              toast.success(`📥 Downloading ${video.videoName}...`);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Download All ZIP Button */}
                    <div className="flex justify-center mt-8">
                      <Button
                        onClick={async () => {
                          toast.info('📦 Preparing ZIP archive...');
                          // TODO: Implement ZIP download
                          toast.success('🎉 All videos ready for download!');
                        }}
                        className="bg-green-600 hover:bg-green-700 px-12 py-8 text-xl font-bold shadow-xl"
                      >
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download All Videos (ZIP)
                        <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>
    </div>
  );
}
