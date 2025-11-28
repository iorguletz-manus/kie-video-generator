import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Video streaming proxy to avoid CORS issues
  app.get('/api/proxy-video', async (req, res) => {
    try {
      const videoUrl = req.query.url as string;
      
      if (!videoUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
      }
      
      console.log('[Video Proxy] Streaming video:', videoUrl);
      
      // Fetch video from external source
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch video: ${response.status}` });
      }
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      
      // Forward content type
      const contentType = response.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', contentType);
      
      // Forward content length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      // Enable range requests for seeking
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Stream the video
      if (response.body) {
        // @ts-ignore - ReadableStream types
        for await (const chunk of response.body) {
          res.write(chunk);
        }
      }
      
      res.end();
    } catch (error: any) {
      console.error('[Video Proxy] Error:', error);
      res.status(500).json({ error: `Failed to proxy video: ${error.message}` });
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
