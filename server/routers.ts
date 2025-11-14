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
import { parseAdDocument, parsePromptDocument, replaceInsertText, parseAdDocumentWithSections, PromptType } from "./documentParser";

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
        sessionId: z.string().optional(), // Optional sessionId pentru organizare în subfoldere
      }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Generează nume unic pentru imagine
          const randomSuffix = Math.random().toString(36).substring(2, 15);
          const timestamp = Date.now();
          // Organizare în subfoldere pe sessionId
          const sessionFolder = input.sessionId || 'default';
          const fileName = `${sessionFolder}/${timestamp}-${randomSuffix}.png`;
          
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
        prompt: z.string(),
        imageUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ENV.kieApiKey}`,
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
        taskId: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const response = await fetch(
            `https://api.kie.ai/api/v1/veo/record-info?taskId=${input.taskId}`,
            {
              headers: {
                'Authorization': `Bearer ${ENV.kieApiKey}`,
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
        promptTemplate: z.string(),
        combinations: z.array(z.object({
          text: z.string(),
          imageUrl: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        try {
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
                  'Authorization': `Bearer ${ENV.kieApiKey}`,
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
                  'Authorization': `Bearer ${ENV.kieApiKey}`,
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
});

export type AppRouter = typeof appRouter;
