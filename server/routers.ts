import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { HARDCODED_PROMPTS } from "./hardcodedPrompts";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { saveVideoTask, updateVideoTask } from "./videoCache";
import { processVideoForEditing, cutVideoWithFFmpegAPI, WhisperWord, CutPoints } from "./videoEditing";
import { parseAdDocument, parsePromptDocument, replaceInsertText, parseAdDocumentWithSections, PromptType } from "./documentParser";
import { processAdDocument, addRedOnLine1 } from "./text-processor";
import { createAppUser, getAppUserByUsername, getAppUserById, updateAppUser, createAppSession, getAppSessionsByUserId, updateAppSession, deleteAppSession, createUserImage, getUserImagesByUserId, getUserImagesByCharacter, updateUserImage, deleteUserImage, getUniqueCharacterNames, createUserPrompt, getUserPromptsByUserId, getUserPromptById, updateUserPrompt, deleteUserPrompt, createTam, getTamsByUserId, getTamById, updateTam, deleteTam, createCoreBelief, getCoreBeliefsByUserId, getCoreBeliefsByTamId, getCoreBeliefById, updateCoreBelief, deleteCoreBelief, createEmotionalAngle, getEmotionalAnglesByUserId, getEmotionalAnglesByCoreBeliefId, getEmotionalAngleById, updateEmotionalAngle, deleteEmotionalAngle, createAd, getAdsByUserId, getAdsByEmotionalAngleId, getAdById, updateAd, deleteAd, createCharacter, getCharactersByUserId, getCharacterById, updateCharacter, deleteCharacter, getContextSession, upsertContextSession, deleteContextSession, getDb } from "./db";
import { contextSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { seedDefaultPromptsForUser } from "./seedDefaultPrompts";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // App Auth router for simple username/password authentication
  appAuth: router({
    // Register new user
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Check if username already exists
        const existingUser = await getAppUserByUsername(input.username);
        if (existingUser) {
          throw new Error('Username already exists');
        }

        // Create new user
             const result = await createAppUser({
          username: input.username,
          password: input.password, // Plain text per requirement
        });

        // Fetch the created user
        const user = await getAppUserByUsername(input.username);
        if (!user) {
          throw new Error('Failed to create user');
        }

        // Seed default prompts for new user
        await seedDefaultPromptsForUser(user.id);

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            profileImageUrl: user.profileImageUrl,
          },
        };
      }),

    // Login
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        const user = await getAppUserByUsername(input.username);
        if (!user || user.password !== input.password) {
          throw new Error('Invalid username or password');
        }

        // Seed default prompts for user (if not already seeded)
        await seedDefaultPromptsForUser(user.id);

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            profileImageUrl: user.profileImageUrl,
            kieApiKey: user.kieApiKey,
            openaiApiKey: user.openaiApiKey,
            ffmpegApiKey: user.ffmpegApiKey,
          },
        };
      }),

    // Get current user by ID
    getMe: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const user = await getAppUserById(input.userId);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          profileImageUrl: user.profileImageUrl,
          kieApiKey: user.kieApiKey,
          openaiApiKey: user.openaiApiKey,
          ffmpegApiKey: user.ffmpegApiKey,
        };
      }),

    // Update profile (password + profile image)
    updateProfile: publicProcedure
      .input(z.object({
        userId: z.number(),
        password: z.string().optional(),
        profileImageUrl: z.string().optional(),
        kieApiKey: z.string().optional(),
        openaiApiKey: z.string().optional(),
        ffmpegApiKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const updateData: Partial<{ password: string; profileImageUrl: string | null; kieApiKey: string | null; openaiApiKey: string | null; ffmpegApiKey: string | null }> = {};
        if (input.password) updateData.password = input.password;
        if (input.profileImageUrl !== undefined) updateData.profileImageUrl = input.profileImageUrl;
        if (input.kieApiKey !== undefined) updateData.kieApiKey = input.kieApiKey;
        if (input.openaiApiKey !== undefined) updateData.openaiApiKey = input.openaiApiKey;
        if (input.ffmpegApiKey !== undefined) updateData.ffmpegApiKey = input.ffmpegApiKey;

        await updateAppUser(input.userId, updateData);

        const user = await getAppUserById(input.userId);
        return {
          success: true,
          user: user ? {
            id: user.id,
            username: user.username,
            profileImageUrl: user.profileImageUrl,
            kieApiKey: user.kieApiKey,
            openaiApiKey: user.openaiApiKey,
            ffmpegApiKey: user.ffmpegApiKey,
          } : null,
        };
      }),
  }),

  // App Session router for managing user sessions
  appSession: router({
    // Create new session
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string(),
        data: z.string(), // JSON string
      }))
      .mutation(async ({ input }) => {
        await createAppSession({
          userId: input.userId,
          name: input.name,
          data: input.data,
        });

        return { success: true };
      }),

    // Get all sessions for a user
    getByUserId: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        const sessions = await getAppSessionsByUserId(input.userId);
        return sessions;
      }),

    // Update session
    update: publicProcedure
      .input(z.object({
        sessionId: z.number(),
        name: z.string().optional(),
        data: z.string().optional(), // JSON string
      }))
      .mutation(async ({ input }) => {
        const updateData: Partial<{ name: string; data: string }> = {};
        if (input.name) updateData.name = input.name;
        if (input.data) updateData.data = input.data;

        await updateAppSession(input.sessionId, updateData);
        return { success: true };
      }),

    // Delete session
    delete: publicProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await deleteAppSession(input.sessionId);
        return { success: true };
      }),
  }),

  prompt: router({
    // Get hardcoded prompt text
    getHardcodedPrompt: publicProcedure
      .input(z.object({
        promptType: z.enum(['PROMPT_NEUTRAL', 'PROMPT_SMILING', 'PROMPT_CTA']),
      }))
      .query(({ input }) => {
        const promptText = HARDCODED_PROMPTS[input.promptType];
        if (!promptText) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Prompt ${input.promptType} nu există`,
          });
        }
        return { promptText };
      }),
  }),

  video: router({
    // Upload imagine pe Manus CDN
    uploadImage: publicProcedure
      .input(z.object({
        imageData: z.string(),
        fileName: z.string(),
        userId: z.number().optional(), // Optional userId pentru organizare per user
        sessionId: z.string().optional(), // Optional sessionId pentru organizare per sesiune
      }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Generează nume unic pentru imagine
          const randomSuffix = Math.random().toString(36).substring(2, 15);
          const timestamp = Date.now();
          // Organizare în subfoldere: {userId}/{sessionId}/{timestamp}.png
          const userFolder = input.userId ? `user-${input.userId}` : 'default';
          const sessionFolder = input.sessionId || 'default';
          const fileName = `${userFolder}/${sessionFolder}/${timestamp}-${randomSuffix}.png`;
          
          // BunnyCDN configuration (hardcoded)
          const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b'; // Storage Password (Read-Write)
          const BUNNYCDN_STORAGE_ZONE = 'manus-storage'; // Storage Zone ID: 1258323, Username: manus-storage
          const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net'; // Pull Zone ID: 4856013
          
          // Upload direct pe BunnyCDN Storage
          console.log('[Upload] Starting BunnyCDN upload for:', fileName);
          const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
          
          const uploadResponse = await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
              'Content-Type': 'image/png',
            },
            body: buffer,
          });
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[Upload] BunnyCDN upload failed:', errorText);
            throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${errorText}`);
          }
          
          // Construiește URL-ul public pentru imagine
          const imageUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
          console.log('[Upload] BunnyCDN upload successful:', imageUrl);
          
          if (!imageUrl || !imageUrl.startsWith('http')) {
            throw new Error('Invalid URL returned from upload');
          }
          
          return { success: true, imageUrl: imageUrl };
        } catch (error: any) {
          console.error('Error uploading image:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to upload image: ${error.message || 'Unknown error'}`,
          });
        }
      }),

    // Generare video cu Kie.ai
    generateVideo: publicProcedure
      .input(z.object({
        userId: z.number(),
        prompt: z.string(),
        imageUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get user's API key
          const user = await getAppUserById(input.userId);
          if (!user?.kieApiKey) {
            throw new Error('Kie API Key not configured. Please set it in Settings.');
          }

          const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${user.kieApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: input.prompt,
              imageUrls: [input.imageUrl],
              model: 'veo3_fast',
              generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
              aspectRatio: '9:16',
            }),
          });

          const data = await response.json();
          
          // Gestionare erori specifice
          if (!response.ok) {
            let errorMessage = 'Failed to generate video';
            
            if (response.status === 402) {
              errorMessage = 'Insufficient credits on Kie.ai account. Please add credits to continue.';
            } else if (response.status === 401) {
              errorMessage = 'Invalid API key. Please check your Kie.ai API key.';
            } else if (response.status === 403) {
              errorMessage = 'You do not have access permissions. This may be due to: insufficient credits, invalid API key, or account restrictions. Please check your Kie.ai account.';
            } else if (response.status === 429) {
              errorMessage = 'Rate limit exceeded. Please try again later.';
            } else if (response.status === 400) {
              errorMessage = `Bad request: ${data.msg || 'Invalid parameters'}`;
            } else if (response.status === 422) {
              errorMessage = `Validation error: ${data.msg || 'Invalid input data'}`;
            } else if (data.msg) {
              errorMessage = `Kie.ai API error: ${data.msg}`;
            }
            
            throw new TRPCError({
              code: response.status === 402 ? 'PAYMENT_REQUIRED' as any : 'BAD_REQUEST',
              message: errorMessage,
            });
          }
          
          if (data.code === 200 && data.data?.taskId) {
            saveVideoTask(data.data.taskId, input.prompt, input.imageUrl);
            
            return { 
              success: true, 
              taskId: data.data.taskId,
              message: 'Video generation started successfully'
            };
          } else {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: data.msg || 'Failed to generate video - no taskId received',
            });
          }
        } catch (error: any) {
          console.error('Error generating video:', error);
          
          if (error instanceof TRPCError) {
            throw error;
          }
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Network error: ${error.message || 'Failed to connect to Kie.ai API'}`,
          });
        }
      }),

    // Verificare status video
    checkVideoStatus: publicProcedure
      .input(z.object({
        userId: z.number(),
        taskId: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get user's API key
          const user = await getAppUserById(input.userId);
          if (!user?.kieApiKey) {
            throw new Error('Kie API Key not configured. Please set it in Settings.');
          }

          const response = await fetch(
            `https://api.kie.ai/api/v1/veo/record-info?taskId=${input.taskId}`,
            {
              headers: {
                'Authorization': `Bearer ${user.kieApiKey}`,
              },
            }
          );

          const data = await response.json();
          
          if (!response.ok) {
            let errorMessage = 'Failed to check video status';
            
            if (response.status === 401) {
              errorMessage = 'Invalid API key';
            } else if (response.status === 404) {
              errorMessage = 'Video task not found. The taskId may be invalid.';
            } else if (data.msg) {
              errorMessage = `Kie.ai API error: ${data.msg}`;
            }
            
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: errorMessage,
            });
          }
          
          if (data.code === 200 && data.data) {
            const responseData = data.data.response;
            const successFlag = data.data.successFlag;
            
            // Determină statusul bazat pe successFlag
            let status: 'success' | 'pending' | 'failed';
            let videoUrl: string | undefined = undefined;
            
            if (successFlag === 1) {
              // Video generat cu succes
              status = 'success';
              if (responseData?.resultUrls && responseData.resultUrls.length > 0) {
                videoUrl = responseData.resultUrls[0];
              }
            } else if (successFlag === 0) {
              // Video în curs de generare
              status = 'pending';
            } else if (successFlag === -1) {
              // Generare eșuată
              status = 'failed';
            } else {
              status = 'pending';
            }
            
            updateVideoTask(input.taskId, {
              status: status,
              videoUrl: videoUrl,
            });
            
            return {
              success: true,
              status: status,
              videoUrl: videoUrl,
              errorMessage: data.data.errorMessage || null,
            };
          } else {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: data.msg || 'Failed to retrieve video status',
            });
          }
        } catch (error: any) {
          console.error('Error checking video status:', error);
          
          if (error instanceof TRPCError) {
            throw error;
          }
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Network error: ${error.message || 'Failed to connect to Kie.ai API'}`,
          });
        }
      }),

    // Process text ad (STEP 1 - Prepare Text Ad)
    processTextAd: publicProcedure
      .input(z.object({
        rawText: z.string(),
        applyDiacritics: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Phase 1: Process text to 118-125 chars
          const outputData = processAdDocument(input.rawText);
          
          // Phase 2: Add red on Line 1 for overlap pairs
          const finalData = addRedOnLine1(outputData);
          
          return {
            success: true,
            processedLines: finalData,
          };
        } catch (error: any) {
          console.error('Error processing text ad:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to process text ad: ${error.message || 'Unknown error'}`,
          });
        }
      }),

    // Parsare document ad cu detectare secțiuni
    parseAdDocument: publicProcedure
      .input(z.object({
        documentData: z.string(), // base64
      }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.documentData.replace(/^data:application\/[^;]+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          const linesWithSections = await parseAdDocumentWithSections(buffer);
          
          return {
            success: true,
            lines: linesWithSections,
          };
        } catch (error: any) {
          console.error('Error parsing ad document:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to parse ad document: ${error.message || 'Unknown error'}`,
          });
        }
      }),

    // Parsare document prompt
    parsePromptDocument: publicProcedure
      .input(z.object({
        documentData: z.string(), // base64
      }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.documentData.replace(/^data:application\/[^;]+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          const promptTemplate = await parsePromptDocument(buffer);
          
          return {
            success: true,
            promptTemplate: promptTemplate,
          };
        } catch (error: any) {
          console.error('Error parsing prompt document:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to parse prompt document: ${error.message || 'Unknown error'}`,
          });
        }
      }),

    // Generare batch videouri
    generateBatchVideos: publicProcedure
      .input(z.object({
        userId: z.number(),
        promptTemplate: z.string(),
        combinations: z.array(z.object({
          text: z.string(),
          imageUrl: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get user's API key
          const user = await getAppUserById(input.userId);
          if (!user?.kieApiKey) {
            throw new Error('Kie API Key not configured. Please set it in Settings.');
          }

          const results: Array<{
            success: boolean;
            taskId?: string;
            text: string;
            imageUrl: string;
            error?: string;
          }> = [];

          // Generare paralelă pentru toate combinațiile
          const promises = input.combinations.map(async (combo) => {
            try {
              // Determină prompt template: hardcoded sau custom
              let promptTemplate = input.promptTemplate;
              
              if (promptTemplate.startsWith('HARDCODED_')) {
                const promptType = promptTemplate.replace('HARDCODED_', '') as keyof typeof HARDCODED_PROMPTS;
                if (HARDCODED_PROMPTS[promptType]) {
                  promptTemplate = HARDCODED_PROMPTS[promptType].content;
                }
              }
              
              // Înlocuiește [INSERT TEXT] cu textul din combinație
              const finalPrompt = replaceInsertText(promptTemplate, combo.text);
              
              const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${user.kieApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: finalPrompt,
                  imageUrls: [combo.imageUrl],
                  model: 'veo3_fast',
                  generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
                  aspectRatio: '9:16',
                }),
              });

              const data = await response.json();

              if (!response.ok || data.code !== 200 || !data.data?.taskId) {
                return {
                  success: false,
                  text: combo.text,
                  imageUrl: combo.imageUrl,
                  error: data.msg || 'Failed to generate video',
                };
              }

              // Salvează taskId în cache
              saveVideoTask(data.data.taskId, combo.text, combo.imageUrl);

              return {
                success: true,
                taskId: data.data.taskId,
                text: combo.text,
                imageUrl: combo.imageUrl,
              };
            } catch (error: any) {
              return {
                success: false,
                text: combo.text,
                imageUrl: combo.imageUrl,
                error: error.message || 'Network error',
              };
            }
          });

          const settled = await Promise.allSettled(promises);
          
          settled.forEach((result) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push({
                success: false,
                text: '',
                imageUrl: '',
                error: result.reason?.message || 'Unknown error',
              });
            }
          });

          return {
            success: true,
            results: results,
            totalGenerated: results.filter(r => r.success).length,
            totalFailed: results.filter(r => !r.success).length,
          };
        } catch (error: any) {
          console.error('Error generating batch videos:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to generate batch videos: ${error.message || 'Unknown error'}`,
          });
        }
      }),

    // Generare multiple variante pentru un singur video
    generateMultipleVariants: publicProcedure
      .input(z.object({
        variants: z.array(z.object({
          promptType: z.string(), // 'PROMPT_NEUTRAL', 'PROMPT_SMILING', 'PROMPT_CTA', 'PROMPT_CUSTOM', sau custom prompt name
          promptText: z.string().optional(), // Custom prompt text (override hardcoded)
          dialogueText: z.string(), // Text pentru [INSERT TEXT]
          imageUrl: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        try {
          const results: Array<{
            success: boolean;
            taskId?: string;
            dialogueText: string;
            imageUrl: string;
            promptType: string;
            error?: string;
          }> = [];

          // Generare paralelă pentru toate variantele
          const promises = input.variants.map(async (variant) => {
            try {
              // Determină prompt template
              let promptTemplate = '';
              
              // Dacă există promptText custom, folosește-l
              if (variant.promptText && variant.promptText.trim().length > 0) {
                promptTemplate = variant.promptText;
              } else {
                // Altfel folosește hardcoded sau custom din promptType
                if (variant.promptType.startsWith('HARDCODED_') || 
                    variant.promptType === 'PROMPT_NEUTRAL' || 
                    variant.promptType === 'PROMPT_SMILING' || 
                    variant.promptType === 'PROMPT_CTA') {
                  
                  let promptKey = variant.promptType;
                  if (!promptKey.startsWith('HARDCODED_')) {
                    promptKey = `HARDCODED_${promptKey}`;
                  }
                  
                  const hardcodedKey = promptKey.replace('HARDCODED_', '') as keyof typeof HARDCODED_PROMPTS;
                  if (HARDCODED_PROMPTS[hardcodedKey]) {
                    promptTemplate = HARDCODED_PROMPTS[hardcodedKey].content;
                  }
                } else {
                  // Custom prompt type - ar trebui să aibă promptText
                  throw new Error(`Custom prompt type "${variant.promptType}" requires promptText`);
                }
              }
              
              if (!promptTemplate) {
                throw new Error(`No prompt template found for type: ${variant.promptType}`);
              }
              
              // Înlocuiește [INSERT TEXT] cu textul din variantă
              const finalPrompt = replaceInsertText(promptTemplate, variant.dialogueText);
              
              const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${user.kieApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  prompt: finalPrompt,
                  imageUrls: [variant.imageUrl],
                  model: 'veo3_fast',
                  generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
                  aspectRatio: '9:16',
                }),
              });

              const data = await response.json();

              if (!response.ok || data.code !== 200 || !data.data?.taskId) {
                return {
                  success: false,
                  dialogueText: variant.dialogueText,
                  imageUrl: variant.imageUrl,
                  promptType: variant.promptType,
                  error: data.msg || 'Failed to generate video',
                };
              }

              // Salvează taskId în cache
              saveVideoTask(data.data.taskId, variant.dialogueText, variant.imageUrl);

              return {
                success: true,
                taskId: data.data.taskId,
                dialogueText: variant.dialogueText,
                imageUrl: variant.imageUrl,
                promptType: variant.promptType,
              };
            } catch (error: any) {
              return {
                success: false,
                dialogueText: variant.dialogueText,
                imageUrl: variant.imageUrl,
                promptType: variant.promptType,
                error: error.message || 'Network error',
              };
            }
          });

          const settled = await Promise.allSettled(promises);
          
          settled.forEach((result) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push({
                success: false,
                dialogueText: '',
                imageUrl: '',
                promptType: '',
                error: result.reason?.message || 'Unknown error',
              });
            }
          });

          return {
            success: true,
            results: results,
            totalGenerated: results.filter(r => r.success).length,
            totalFailed: results.filter(r => !r.success).length,
          };
        } catch (error: any) {
          console.error('Error generating multiple variants:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to generate multiple variants: ${error.message || 'Unknown error'}`,
          });
        }
      }),
  }),

  // Images Library router
  imageLibrary: router({
    // Upload single image
    upload: publicProcedure
      .input(z.object({
        userId: z.number(),
        characterName: z.string().default("No Character"),
        imageName: z.string(),
        imageData: z.string(), // base64
      }))
      .mutation(async ({ input }) => {
        try {
          // Normalize characterName: trim and fallback to "No Character" if empty
          const normalizedCharacterName = (input.characterName || "").trim() || "No Character";
          
          console.log('[imageLibrary.upload] Starting upload for user:', input.userId, 'character:', normalizedCharacterName, 'imageName:', input.imageName);
          
          // Upload to BunnyCDN (reuse logic from video.uploadImage)
          const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('[imageLibrary.upload] Buffer size:', buffer.length);
          
          const randomSuffix = Math.random().toString(36).substring(2, 15);
          const timestamp = Date.now();
          const fileName = `user-${input.userId}/library/${normalizedCharacterName}/${input.imageName}-${timestamp}-${randomSuffix}.png`;
          
          // BunnyCDN configuration
          const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
          const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
          const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';
          
          const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
          
          console.log('[imageLibrary.upload] Uploading to BunnyCDN:', storageUrl);
          
          const uploadResponse = await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
              'Content-Type': 'image/png',
            },
            body: buffer,
          });
          
          console.log('[imageLibrary.upload] BunnyCDN response status:', uploadResponse.status);
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[imageLibrary.upload] BunnyCDN upload failed:', uploadResponse.status, errorText);
            throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${errorText}`);
          }
          
          const imageUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
          
          console.log('[imageLibrary.upload] Saving to database:', imageUrl);
          
          // Save to database
          await createUserImage({
            userId: input.userId,
            characterName: normalizedCharacterName, // Use normalized name
            imageName: input.imageName,
            imageUrl: imageUrl,
            imageKey: fileName,
          });
          
          // Check if this is the first image for this character
          const existingImages = await getUserImagesByCharacter(input.userId, normalizedCharacterName);
          if (existingImages.length === 1) {
            // This is the first image! Create or update character
            console.log('[imageLibrary.upload] First image for character, creating/updating character');
            
            // Find the character by name
            const characters = await getCharactersByUserId(input.userId);
            let character = characters.find(c => c.name === normalizedCharacterName);
            
            if (!character) {
              // Character doesn't exist in categoryCharacters, create it!
              console.log('[imageLibrary.upload] Character not found, creating new categoryCharacter:', normalizedCharacterName);
              character = await createCharacter({
                userId: input.userId,
                name: normalizedCharacterName,
                thumbnailUrl: imageUrl,
              });
              console.log('[imageLibrary.upload] Character created:', character.id);
            } else {
              // Character exists, just update thumbnail
              await updateCharacter(character.id, {
                thumbnailUrl: imageUrl,
              });
              console.log('[imageLibrary.upload] Character thumbnail updated:', character.id);
            }
          }
          
          console.log('[imageLibrary.upload] Upload successful!');
          return { success: true, imageUrl };
        } catch (error: any) {
          console.error('[imageLibrary.upload] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to upload image: ${error.message}`,
          });
        }
      }),

    // List all images for user
    list: publicProcedure
      .input(z.object({
        userId: z.number(),
        characterName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          if (input.characterName) {
            return await getUserImagesByCharacter(input.userId, input.characterName);
          }
          return await getUserImagesByUserId(input.userId);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to list images: ${error.message}`,
          });
        }
      }),

    // Sync characters from Images Library to categoryCharacters
    syncCharacters: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[imageLibrary.syncCharacters] Starting sync for user:', input.userId);
          
          // Get all unique character names from Images Library
          const allImages = await getUserImagesByUserId(input.userId);
          const uniqueCharacterNames = [...new Set(allImages.map(img => img.characterName))];
          
          console.log('[imageLibrary.syncCharacters] Found', uniqueCharacterNames.length, 'unique characters in Images Library');
          
          // Get existing categoryCharacters
          const existingCharacters = await getCharactersByUserId(input.userId);
          const existingNames = new Set(existingCharacters.map(c => c.name));
          
          let created = 0;
          
          // For each unique character name, create if doesn't exist
          for (const characterName of uniqueCharacterNames) {
            if (!existingNames.has(characterName)) {
              // Get first image for this character as thumbnail
              const characterImages = await getUserImagesByCharacter(input.userId, characterName);
              const thumbnailUrl = characterImages[0]?.imageUrl || null;
              
              await createCharacter({
                userId: input.userId,
                name: characterName,
                thumbnailUrl: thumbnailUrl,
              });
              
              console.log('[imageLibrary.syncCharacters] Created character:', characterName);
              created++;
            }
          }
          
          console.log('[imageLibrary.syncCharacters] Sync complete! Created', created, 'characters');
          return { success: true, created };
        } catch (error: any) {
          console.error('[imageLibrary.syncCharacters] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to sync characters: ${error.message}`,
          });
        }
      }),
    
    // Get unique character names
    getCharacters: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getUniqueCharacterNames(input.userId);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get characters: ${error.message}`,
          });
        }
      }),

    // Update image name or character
    updateName: publicProcedure
      .input(z.object({
        id: z.number(),
        imageName: z.string().optional(),
        characterName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const updateData: any = {};
          if (input.imageName) updateData.imageName = input.imageName;
          if (input.characterName) updateData.characterName = input.characterName;
          
          await updateUserImage(input.id, updateData);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update image: ${error.message}`,
          });
        }
      }),

    // Delete image
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // TODO: Delete from S3 as well (need imageKey)
          await deleteUserImage(input.id);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to delete image: ${error.message}`,
          });
        }
      }),
      
    // Batch delete images
    batchDelete: publicProcedure
      .input(z.object({
        ids: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[imageLibrary.batchDelete] Deleting images:', input.ids);
          
          // Delete all images
          let deletedCount = 0;
          for (const id of input.ids) {
            try {
              await deleteUserImage(id);
              deletedCount++;
            } catch (error) {
              console.error(`[imageLibrary.batchDelete] Failed to delete image ${id}:`, error);
            }
          }
          
          console.log('[imageLibrary.batchDelete] Deleted', deletedCount, 'images');
          return { success: true, count: deletedCount };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to batch delete images: ${error.message}`,
          });
        }
      }),

    // Update display order for images
    updateOrder: publicProcedure
      .input(z.object({
        imageOrders: z.array(z.object({
          id: z.number(),
          displayOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[imageLibrary.updateOrder] Updating order for', input.imageOrders.length, 'images');
          
          // Update each image's displayOrder
          for (const { id, displayOrder } of input.imageOrders) {
            await updateUserImage(id, { displayOrder });
          }
          
          console.log('[imageLibrary.updateOrder] Order updated successfully');
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update order: ${error.message}`,
          });
        }
      }),
  }),

  // Prompts Library router
  promptLibrary: router({
    // List all prompts for user (default + custom)
    list: publicProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getUserPromptsByUserId(input.userId);
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to list prompts: ${error.message}`,
          });
        }
      }),

    // Create new custom prompt
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        promptName: z.string().min(1).max(100),
        promptTemplate: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          await createUserPrompt({
            userId: input.userId,
            promptName: input.promptName,
            promptTemplate: input.promptTemplate,
            isDefault: 0, // Custom prompts are never default
          });
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create prompt: ${error.message}`,
          });
        }
      }),

    // Update prompt (with protection for default prompts)
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        promptName: z.string().optional(),
        promptTemplate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const updateData: any = {};
          if (input.promptName) updateData.promptName = input.promptName;
          if (input.promptTemplate) updateData.promptTemplate = input.promptTemplate;
          
          await updateUserPrompt(input.id, updateData);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to update prompt: ${error.message}`,
          });
        }
      }),

    // Duplicate prompt
    duplicate: publicProcedure
      .input(z.object({
        id: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const original = await getUserPromptById(input.id);
          if (!original) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Prompt not found',
            });
          }
          
          await createUserPrompt({
            userId: input.userId,
            promptName: `${original.promptName} - Copy`,
            promptTemplate: original.promptTemplate,
            isDefault: 0, // Duplicates are never default
          });
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to duplicate prompt: ${error.message}`,
          });
        }
      }),

    // Delete prompt (with protection for default prompts)
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Check if prompt is default
          const prompt = await getUserPromptById(input.id);
          if (!prompt) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Prompt not found',
            });
          }
          
          if (prompt.isDefault === 1) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot delete default prompts',
            });
          }
          
          await deleteUserPrompt(input.id);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to delete prompt: ${error.message}`,
          });
        }
      }),
  }),

  // TAMs router
  tams: router({
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getTamsByUserId(input.userId);
      }),
    
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const result = await createTam({
          userId: input.userId,
          name: input.name,
        });
        return { success: true, id: result[0].insertId };
      }),
  }),

  // Core Beliefs router
  coreBeliefs: router({
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getCoreBeliefsByUserId(input.userId);
      }),
    
    listByTamId: publicProcedure
      .input(z.object({ tamId: z.number() }))
      .query(async ({ input }) => {
        return await getCoreBeliefsByTamId(input.tamId);
      }),
    
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        tamId: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const result = await createCoreBelief({
          userId: input.userId,
          tamId: input.tamId,
          name: input.name,
        });
        return { success: true, id: result[0].insertId };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        await updateCoreBelief(input.id, { name: input.name });
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCoreBelief(input.id);
        return { success: true };
      }),
  }),

  // Emotional Angles router
  emotionalAngles: router({
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getEmotionalAnglesByUserId(input.userId);
      }),
    
    listByCoreBeliefId: publicProcedure
      .input(z.object({ coreBeliefId: z.number() }))
      .query(async ({ input }) => {
        return await getEmotionalAnglesByCoreBeliefId(input.coreBeliefId);
      }),
    
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        coreBeliefId: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const result = await createEmotionalAngle({
          userId: input.userId,
          coreBeliefId: input.coreBeliefId,
          name: input.name,
        });
        return { success: true, id: result[0].insertId };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        await updateEmotionalAngle(input.id, { name: input.name });
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEmotionalAngle(input.id);
        return { success: true };
      }),
  }),

  // Ads router
  ads: router({
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getAdsByUserId(input.userId);
      }),
    
    listByEmotionalAngleId: publicProcedure
      .input(z.object({ emotionalAngleId: z.number() }))
      .query(async ({ input }) => {
        return await getAdsByEmotionalAngleId(input.emotionalAngleId);
      }),
    
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        emotionalAngleId: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const result = await createAd({
          userId: input.userId,
          emotionalAngleId: input.emotionalAngleId,
          name: input.name,
        });
        return { success: true, id: result[0].insertId };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        await updateAd(input.id, { name: input.name });
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAd(input.id);
        return { success: true };
      }),
  }),

  // Characters router
  categoryCharacters: router({
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await getCharactersByUserId(input.userId);
      }),
    
    create: publicProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(1).max(255),
      }))
      .mutation(async ({ input }) => {
        const character = await createCharacter({
          userId: input.userId,
          name: input.name,
          thumbnailUrl: null, // Explicitly set to null instead of omitting
        });
        return { success: true, id: character.id };
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        thumbnailUrl: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.thumbnailUrl !== undefined) updateData.thumbnailUrl = input.thumbnailUrl;
        
        await updateCharacter(input.id, updateData);
        return { success: true };
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCharacter(input.id);
        return { success: true };
      }),
  }),

  // Context Sessions
  contextSessions: router({
    listByUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database not available',
          });
        }
        return await db.select()
          .from(contextSessions)
          .where(eq(contextSessions.userId, input.userId));
      }),

    get: publicProcedure
      .input(z.object({
        userId: z.number(),
        coreBeliefId: z.number(),
        emotionalAngleId: z.number(),
        adId: z.number(),
        characterId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getContextSession(input);
      }),

    upsert: publicProcedure
      .input(z.object({
        userId: z.number(),
        coreBeliefId: z.number(),
        emotionalAngleId: z.number(),
        adId: z.number(),
        characterId: z.number(),
        currentStep: z.number().optional(),
        rawTextAd: z.string().optional(),
        processedTextAd: z.string().optional(),
        adLines: z.any().optional(),
        prompts: z.any().optional(),
        images: z.any().optional(),
        combinations: z.any().optional(),
        deletedCombinations: z.any().optional(),
        videoResults: z.any().optional(),
        reviewHistory: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        return await upsertContextSession(input);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteContextSession(input.id);
        return { success: true };
      }),

    // TEMPORARY: Delete OTHER video cards from all sessions
    deleteOtherVideos: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          
          // Get all sessions for user
          const sessions = await db.select()
            .from(contextSessions)
            .where(eq(contextSessions.userId, input.userId));
          
          let totalDeleted = 0;
          
          for (const session of sessions) {
            if (!session.videoResults) continue;
            
            // Parse videoResults if it's a string, otherwise use as-is
            const videoResults = typeof session.videoResults === 'string' 
              ? JSON.parse(session.videoResults) 
              : session.videoResults;
            const originalCount = videoResults.length;
            
            // Filter out OTHER videos
            const filteredVideos = videoResults.filter((v: any) => 
              !v.videoName?.includes('OTHER')
            );
            
            const deletedCount = originalCount - filteredVideos.length;
            totalDeleted += deletedCount;
            
            if (deletedCount > 0) {
              // Update session with filtered videos
              await db.update(contextSessions)
                .set({ videoResults: JSON.stringify(filteredVideos) })
                .where(eq(contextSessions.id, session.id));
              
              console.log(`[deleteOtherVideos] Session ${session.id}: Deleted ${deletedCount} OTHER videos`);
            }
          }
          
          return { success: true, deletedCount: totalDeleted };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to delete OTHER videos: ${error.message}`,
          });
        }
      }),
  }),

  // Video Editing router for Step 8 (batch processing) and Step 10 (cutting)
  videoEditing: router({
    // Process single video for editing (Step 8 batch processing)
    processVideoForEditing: publicProcedure
      .input(z.object({
        videoUrl: z.string(),
        videoId: z.number(),
        fullText: z.string(),
        redText: z.string(),
        redTextPosition: z.enum(['START', 'END']),  // Position from database
        marginMs: z.number().optional().default(50),
        userApiKey: z.string().optional(),
        ffmpegApiKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[videoEditing.processVideoForEditing] Processing video ${input.videoId}...`);
          
          const result = await processVideoForEditing(
            input.videoUrl,
            input.videoId,
            input.fullText,
            input.redText,
            input.redTextPosition,
            input.marginMs,
            input.userApiKey,
            input.ffmpegApiKey
          );

          return {
            success: true,
            words: result.words,
            cutPoints: result.cutPoints,
            whisperTranscript: result.whisperTranscript,
            audioUrl: result.audioUrl,
            waveformJson: result.waveformJson,
            editingDebugInfo: result.editingDebugInfo,
          };
        } catch (error) {
          console.error(`[videoEditing.processVideoForEditing] Error for video ${input.videoId}:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to process video: ${error.message}`,
          });
        }
      }),

    // Cut video with timestamps (Step 10)
    cutVideo: publicProcedure
      .input(z.object({
        videoUrl: z.string(),
        videoName: z.string(),
        startTimeMs: z.number(),  // milliseconds
        endTimeMs: z.number(),    // milliseconds
        ffmpegApiKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Convert milliseconds to seconds with 3 decimals for FFmpeg
          const startTimeSeconds = (input.startTimeMs / 1000).toFixed(3);
          const endTimeSeconds = (input.endTimeMs / 1000).toFixed(3);
          
          console.log(`[videoEditing.cutVideo] Cutting video ${input.videoName}: ${startTimeSeconds}s → ${endTimeSeconds}s (from ${input.startTimeMs}ms → ${input.endTimeMs}ms)`);
          
          // Cut video using FFmpeg API
          const downloadUrl = await cutVideoWithFFmpegAPI(
            input.videoUrl,
            input.videoName,
            parseFloat(startTimeSeconds),
            parseFloat(endTimeSeconds),
            input.ffmpegApiKey!
          );

          // Download trimmed video from FFmpeg API
          console.log(`[videoEditing.cutVideo] Downloading trimmed video from:`, downloadUrl);
          const videoResponse = await fetch(downloadUrl);
          if (!videoResponse.ok) {
            throw new Error(`Failed to download trimmed video: ${videoResponse.status}`);
          }
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          
          // Upload to Bunny CDN
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const fileName = `trimmed-videos/video-${input.videoId}-${timestamp}-${randomSuffix}.mp4`;
          
          const BUNNYCDN_STORAGE_PASSWORD = '4c9257d6-aede-4ff1-bb0f9fc95279-997e-412b';
          const BUNNYCDN_STORAGE_ZONE = 'manus-storage';
          const BUNNYCDN_PULL_ZONE_URL = 'https://manus.b-cdn.net';
          
          const storageUrl = `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${fileName}`;
          console.log(`[videoEditing.cutVideo] Uploading to Bunny CDN:`, storageUrl);
          
          const uploadResponse = await fetch(storageUrl, {
            method: 'PUT',
            headers: {
              'AccessKey': BUNNYCDN_STORAGE_PASSWORD,
              'Content-Type': 'video/mp4',
            },
            body: videoBuffer,
          });
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Bunny CDN upload failed: ${uploadResponse.status} ${errorText}`);
          }
          
          const finalVideoUrl = `${BUNNYCDN_PULL_ZONE_URL}/${fileName}`;
          console.log(`[videoEditing.cutVideo] Upload successful:`, finalVideoUrl);
          
          return {
            success: true,
            downloadUrl: finalVideoUrl, // Return Bunny CDN URL instead of temporary FFmpeg URL
          };
        } catch (error) {
          console.error(`[videoEditing.cutVideo] Error for video ${input.videoId}:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to cut video: ${error.message}`,
          });
        }
      }),

    // Cut & Merge two consecutive videos (test mode - no DB save)
    cutAndMergeVideos: publicProcedure
      .input(z.object({
        video1Url: z.string(),
        video1Name: z.string(),
        video1StartMs: z.number(),
        video1EndMs: z.number(),
        video2Url: z.string(),
        video2Name: z.string(),
        video2StartMs: z.number(),
        video2EndMs: z.number(),
        ffmpegApiKey: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[cutAndMergeVideos] Starting cut & merge process...');
          
          // Convert milliseconds to seconds
          const video1Start = (input.video1StartMs / 1000).toFixed(3);
          const video1End = (input.video1EndMs / 1000).toFixed(3);
          const video2Start = (input.video2StartMs / 1000).toFixed(3);
          const video2End = (input.video2EndMs / 1000).toFixed(3);
          
          const duration1 = parseFloat(video1End) - parseFloat(video1Start);
          const duration2 = parseFloat(video2End) - parseFloat(video2Start);
          
          console.log(`[cutAndMergeVideos] Video 1: ${input.video1Name} (${video1Start}s → ${video1End}s, duration: ${duration1}s)`);
          console.log(`[cutAndMergeVideos] Video 2: ${input.video2Name} (${video2Start}s → ${video2End}s, duration: ${duration2}s)`);
          
          // 1. Create directory for batch upload
          const FFMPEG_API_BASE = 'https://api.ffmpeg-api.com';
          
          console.log('[cutAndMergeVideos] Creating directory...');
          const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
            method: 'POST',
            headers: {
              'Authorization': input.ffmpegApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          
          if (!dirRes.ok) {
            throw new Error(`Failed to create directory: ${dirRes.statusText}`);
          }
          
          const dirData = await dirRes.json();
          const dirId = dirData.directory.id;
          console.log(`[cutAndMergeVideos] Created directory: ${dirId}`);
          
          // 2. Upload both videos to the same directory
          const { uploadVideoToFFmpegAPI } = await import('./videoEditing');
          
          const video1Path = await uploadVideoToFFmpegAPI(input.video1Url, `${input.video1Name}_original.mp4`, input.ffmpegApiKey, dirId);
          const video2Path = await uploadVideoToFFmpegAPI(input.video2Url, `${input.video2Name}_original.mp4`, input.ffmpegApiKey, dirId);
          
          console.log(`[cutAndMergeVideos] Uploaded: ${video1Path}, ${video2Path}`);
          
          console.log('[cutAndMergeVideos] Videos uploaded to FFmpeg API');
          
          // 3. Cut and merge using FFmpeg API with filter_complex
          const outputFileName = `merged_${Date.now()}.mp4`;
          
          // Build filter_complex: trim both videos + drawtext overlay, then concat
          // Escape single quotes in video names
          const escapedName1 = input.video1Name.replace(/'/g, "\\\\\\'");
          const escapedName2 = input.video2Name.replace(/'/g, "\\\\\\'");
          
          // Drawtext filter: large red text at bottom center with semi-transparent black background
          const drawtext1 = `drawtext=text='${escapedName1}':x=(w-text_w)/2:y=h-text_h-20:fontsize=60:fontcolor=red:box=1:boxcolor=black@0.7:boxborderw=5`;
          const drawtext2 = `drawtext=text='${escapedName2}':x=(w-text_w)/2:y=h-text_h-20:fontsize=60:fontcolor=red:box=1:boxcolor=black@0.7:boxborderw=5`;
          
          const filterComplex = `[0:v]trim=start=${video1Start}:end=${video1End},setpts=PTS-STARTPTS,${drawtext1}[v1];[0:a]atrim=start=${video1Start}:end=${video1End},asetpts=PTS-STARTPTS[a1];[1:v]trim=start=${video2Start}:end=${video2End},setpts=PTS-STARTPTS,${drawtext2}[v2];[1:a]atrim=start=${video2Start}:end=${video2End},asetpts=PTS-STARTPTS[a2];[v1][a1][v2][a2]concat=n=2:v=1:a=1[outv][outa]`;
          
          console.log('[cutAndMergeVideos] Filter complex:', filterComplex);
          
          const requestBody = {
            task: {
              inputs: [
                { file_path: video1Path },
                { file_path: video2Path }
              ],
              filter_complex: filterComplex,
              outputs: [{
                file: outputFileName,
                options: [
                  '-c:v', 'libx264',
                  '-crf', '23',
                  '-c:a', 'aac'
                ],
                maps: ['[outv]', '[outa]']
              }]
            }
          };
          
          console.log('[cutAndMergeVideos] FFmpeg API request:', JSON.stringify(requestBody, null, 2));
          
          const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
            method: 'POST',
            headers: {
              'Authorization': input.ffmpegApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          if (!processRes.ok) {
            const errorText = await processRes.text();
            console.error('[FFmpeg API] Error response:', errorText);
            throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
          }
          
          const result = await processRes.json();
          
          if (!result.ok || !result.result || result.result.length === 0) {
            throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
          }
          
          const downloadUrl = result.result[0].download_url;
          console.log(`[cutAndMergeVideos] Merge successful! Temporary URL: ${downloadUrl}`);
          
          return {
            success: true,
            downloadUrl: downloadUrl, // Return temporary FFmpeg URL (no Bunny upload for test)
          };
        } catch (error) {
          console.error('[cutAndMergeVideos] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to cut and merge videos: ${error.message}`,
          });
        }
      }),

    // Cut & Merge all videos (sample merge - no DB save)
    cutAndMergeAllVideos: publicProcedure
      .input(z.object({  
        videos: z.array(z.object({
          url: z.string(),
          name: z.string(),
          startMs: z.number(),
          endMs: z.number(),
        })),
        ffmpegApiKey: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[cutAndMergeAllVideos] Starting sample merge of ${input.videos.length} videos...`);
          
          // 1. Create directory for batch upload
          const FFMPEG_API_BASE = 'https://api.ffmpeg-api.com';
          
          console.log('[cutAndMergeAllVideos] Creating directory...');
          const dirRes = await fetch(`${FFMPEG_API_BASE}/directory`, {
            method: 'POST',
            headers: {
              'Authorization': input.ffmpegApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          });
          
          if (!dirRes.ok) {
            throw new Error(`Failed to create directory: ${dirRes.statusText}`);
          }
          
          const dirData = await dirRes.json();
          const dirId = dirData.directory.id;
          console.log(`[cutAndMergeAllVideos] Created directory: ${dirId}`);
          
          // 2. Upload all videos to the same directory
          const { uploadVideoToFFmpegAPI } = await import('./videoEditing');
          const uploadedPaths: string[] = [];
          
          for (const video of input.videos) {
            const filePath = await uploadVideoToFFmpegAPI(video.url, `${video.name}_original.mp4`, input.ffmpegApiKey, dirId);
            uploadedPaths.push(filePath);
            console.log(`[cutAndMergeAllVideos] Uploaded: ${video.name} → ${filePath}`);
          }
          
          console.log('[cutAndMergeAllVideos] All videos uploaded to FFmpeg API');
          
          // 3. Build filter_complex for all videos
          // [0:v]trim=...,setpts=...[v0]; [0:a]atrim=...,asetpts=...[a0];
          // [1:v]trim=...,setpts=...[v1]; [1:a]atrim=...,asetpts=...[a1];
          // ...
          // [v0][a0][v1][a1]...concat=n=N:v=1:a=1[outv][outa]
          
          const filterParts: string[] = [];
          const concatInputs: string[] = [];
          
          input.videos.forEach((video, index) => {
            const startSec = (video.startMs / 1000).toFixed(3);
            const endSec = (video.endMs / 1000).toFixed(3);
            
            // Escape single quotes in video name for FFmpeg
            const escapedName = video.name.replace(/'/g, "\\\\\\'");
            
            // Video trim + drawtext overlay
            // Position: bottom center, large red text with semi-transparent black background
            const drawtextFilter = `drawtext=text='${escapedName}':x=(w-text_w)/2:y=h-text_h-20:fontsize=60:fontcolor=red:box=1:boxcolor=black@0.7:boxborderw=5`;
            filterParts.push(`[${index}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS,${drawtextFilter}[v${index}]`);
            
            // Audio trim
            filterParts.push(`[${index}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[a${index}]`);
            
            concatInputs.push(`[v${index}][a${index}]`);
          });
          
          const filterComplex = filterParts.join(';') + ';' + concatInputs.join('') + `concat=n=${input.videos.length}:v=1:a=1[outv][outa]`;
          
          console.log('[cutAndMergeAllVideos] Filter complex:', filterComplex);
          
          // 3. Process with FFmpeg API
          const outputFileName = `sample_merge_${Date.now()}.mp4`;
          
          const processRes = await fetch(`${FFMPEG_API_BASE}/ffmpeg/process`, {
            method: 'POST',
            headers: {
              'Authorization': input.ffmpegApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              task: {
                inputs: uploadedPaths.map(path => ({ file_path: path })),
                filter_complex: filterComplex,
                outputs: [{
                  file: outputFileName,
                  options: [
                    '-c:v', 'libx264',
                    '-crf', '23',
                    '-c:a', 'aac'
                  ],
                  maps: ['[outv]', '[outa]']
                }]
              }
            }),
          });
          
          if (!processRes.ok) {
            const errorText = await processRes.text();
            console.error('[FFmpeg API] Error response:', errorText);
            throw new Error(`FFmpeg API processing failed: ${processRes.statusText}`);
          }
          
          const result = await processRes.json();
          
          if (!result.ok || !result.result || result.result.length === 0) {
            throw new Error(`FFmpeg API returned error: ${JSON.stringify(result)}`);
          }
          
          const downloadUrl = result.result[0].download_url;
          console.log(`[cutAndMergeAllVideos] Sample merge successful! Temporary URL: ${downloadUrl}`);
          
          return {
            success: true,
            downloadUrl: downloadUrl,
          };
        } catch (error) {
          console.error('[cutAndMergeAllVideos] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to cut and merge all videos: ${error.message}`,
          });
        }
      }),

    // Save video editing data to context session
    save: publicProcedure
      .input(z.object({
        userId: z.number(),
        coreBeliefId: z.number(),
        emotionalAngleId: z.number(),
        adId: z.number(),
        characterId: z.number(),
        videoId: z.string(),
        startKeep: z.number(),
        endKeep: z.number(),
        words: z.any(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get existing context session
          const session = await getContextSession({
            userId: input.userId,
            coreBeliefId: input.coreBeliefId,
            emotionalAngleId: input.emotionalAngleId,
            adId: input.adId,
            characterId: input.characterId,
          });

          if (!session) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Context session not found',
            });
          }

          // Update videoResults with editing data
          const videoResults = session.videoResults || [];
          const videoIndex = videoResults.findIndex((v: any) => v.id === input.videoId);

          if (videoIndex === -1) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Video not found in session',
            });
          }

          videoResults[videoIndex] = {
            ...videoResults[videoIndex],
            startKeep: input.startKeep,
            endKeep: input.endKeep,
            whisperWords: input.words,
            editStatus: 'edited',
          };

          // Save updated session
          await upsertContextSession({
            userId: input.userId,
            coreBeliefId: input.coreBeliefId,
            emotionalAngleId: input.emotionalAngleId,
            adId: input.adId,
            characterId: input.characterId,
            videoResults,
          });

          return { success: true };
        } catch (error) {
          console.error('[videoEditing.save] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to save editing data: ${error.message}`,
          });
        }
      }),

    // List approved videos for editing
    list: publicProcedure
      .input(z.object({
        userId: z.number(),
        coreBeliefId: z.number(),
        emotionalAngleId: z.number(),
        adId: z.number(),
        characterId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          const session = await getContextSession(input);
          
          if (!session) {
            return { videos: [] };
          }

          const videoResults = session.videoResults || [];
          
          // Filter approved videos
          const approvedVideos = videoResults.filter(
            (v: any) => v.status === 'approved'
          );

          return { videos: approvedVideos };
        } catch (error) {
          console.error('[videoEditing.list] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to list videos: ${error.message}`,
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
