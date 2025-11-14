import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { saveVideoTask, updateVideoTask } from "./videoCache";

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

  video: router({
    // Upload imagine pe Manus CDN
    uploadImage: publicProcedure
      .input(z.object({
        imageData: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Creează director temporar pentru imagini
          const tempDir = path.join('/tmp', 'kie-uploads');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Generează nume unic pentru imagine
          const randomSuffix = Math.random().toString(36).substring(2, 15);
          const timestamp = Date.now();
          const fileName = `${timestamp}-${randomSuffix}.png`;
          const tempFilePath = path.join(tempDir, fileName);
          
          // Salvează imaginea temporar
          fs.writeFileSync(tempFilePath, buffer);
          
          // Upload pe Manus CDN folosind manus-upload-file
          const { stdout, stderr } = await execAsync(`manus-upload-file ${tempFilePath}`);
          
          if (stderr && stderr.includes('error')) {
            throw new Error(`Upload failed: ${stderr}`);
          }
          
          // Extrage URL-ul din output (ultima linie care conține https://)
          const lines = stdout.split('\n');
          const urlLine = lines.find(line => line.includes('https://'));
          
          if (!urlLine) {
            throw new Error(`No URL found in upload output: ${stdout}`);
          }
          
          // Extrage doar URL-ul din linia "CDN URL: https://..."
          const imageUrl = urlLine.includes('CDN URL:') 
            ? urlLine.split('CDN URL:')[1].trim()
            : urlLine.trim();
          
          // Șterge fișierul temporar
          fs.unlinkSync(tempFilePath);
          
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
            const status = data.data.status;
            const videoUrl = data.data.videoUrl || data.data.video_url;
            
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
  }),
});

export type AppRouter = typeof appRouter;
