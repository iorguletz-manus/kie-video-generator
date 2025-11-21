# KIE Video Generator Application Analysis

This document provides a detailed analysis of the KIE Video Generator application, covering its architecture, database schema, backend API, and frontend workflow.

## 1. Database Schema

The application uses a MySQL database managed by Drizzle ORM. The schema is defined in `/drizzle/schema.ts` and consists of several tables to manage users, sessions, content, and application state.

### Core Tables

| Table Name | Description |
|---|---|
| `users` | Stores Manus OAuth user information. |
| `app_users` | Manages application-specific users with username/password authentication. |
| `app_sessions` | Stores user session data, allowing users to save and resume their work. |
| `context_sessions` | Holds the complete state of a user's workflow for a specific context (TAM, Core Belief, etc.). This enables the saving and loading of work-in-progress for different ad campaigns. |

### Content & Library Tables

| Table Name | Description |
|---|---|
| `user_images` | A library of images uploaded by users, which can be reused across different sessions. Images can be associated with specific characters. |
| `user_prompts` | A library of prompts for video generation. It includes default prompts and allows users to save custom prompts. |
| `characters` | Stores character profiles, which can be associated with images and used to organize content. |

### Context & Category Tables

These tables create a hierarchical structure for organizing ad campaigns:

| Table Name | Description | Parent Table |
|---|---|---|
| `tams` | Target Audience Market - the top-level category. | - |
| `core_beliefs` | A second-level category under a TAM. | `tams` |
| `emotional_angles` | A third-level category under a Core Belief. | `core_beliefs` |
| `ads` | A fourth-level category under an Emotional Angle, representing a specific ad campaign. | `emotional_angles` |

## 2. Backend Architecture

The backend is a Node.js application built with **Express.js** and uses **tRPC** for creating a typesafe API layer between the server and the React frontend. This architecture ensures that the data flowing between the client and server is consistent and helps prevent common API-related bugs.

### Key Components

| File/Directory | Description |
|---|---|
| `server/_core/index.ts` | The main entry point for the server. It initializes the Express app, sets up middleware, and mounts the tRPC router. |
| `server/routers.ts` | The main tRPC router file that combines all the different API routers for the application. |
| `server/db.ts` | Contains all the functions for interacting with the database using Drizzle ORM. This abstracts the database logic from the API endpoints. |
| `server/documentParser.ts` | Includes functions for parsing uploaded `.docx` files to extract ad copy and prompt templates. |
| `server/videoEditing.ts` | Manages the video post-processing workflow, including audio extraction, transcription, and video cutting. |

### API Endpoints (tRPC Routers)

The application's API is organized into several tRPC routers, each responsible for a specific domain of functionality:

| Router | Description |
|---|---|
| `appAuth` | Handles user authentication, including registration, login, and profile updates. |
| `appSession` | Manages user sessions, allowing for the creation, retrieval, and deletion of saved work. |
| `video` | Contains endpoints for uploading images, generating videos via the Kie.ai API, and checking the status of video generation tasks. |
| `videoEditing` | Provides endpoints for the video post-processing workflow, such as extracting audio, transcribing it with Whisper, and cutting the video. |
| `prompt` | Manages prompts, including retrieving hardcoded prompts and managing user-created prompts. |
| `imageLibrary` | Handles the user's image library, including listing, uploading, and deleting images. |
| `tams`, `coreBeliefs`, `emotionalAngles`, `ads`, `characters` | A set of CRUD routers for managing the hierarchical context categories. |

### External Service Integrations

The backend integrates with several external services to provide its core functionality:

- **Kie.ai API**: Used for the core video generation.
- **BunnyCDN**: For storing and serving user-uploaded images.
- **FFmpeg API**: A third-party service used for server-side video manipulation, such as extracting audio and cutting video clips.
- **OpenAI Whisper**: Used for transcribing the audio from generated videos to enable word-level editing.

## 3. Frontend Architecture

The frontend is a single-page application (SPA) built with **React** and **Vite**. It uses **TypeScript** for type safety and **TailwindCSS** for styling. The UI is built with a combination of custom components and the **shadcn/ui** component library.

### Key Components

| File/Directory | Description |
|---|---|
| `client/src/pages/Home.tsx` | This is the main and most important component of the application. It contains the state and logic for the entire 8-step video generation workflow. Due to its size and complexity, it can be considered a monolith component. |
| `client/src/components/steps/*.tsx` | Each step of the workflow is encapsulated in its own component, making the UI modular. However, the majority of the state and logic still resides in `Home.tsx`. |
| `client/src/lib/trpc.ts` | This file configures the tRPC client, which enables the frontend to communicate with the backend in a typesafe manner. |
| `client/src/App.tsx` | The root component of the application that handles routing and renders the main layout. |

## 4. Application Workflow

The application guides the user through an 8-step process to create a video ad. The entire workflow is managed within the `Home.tsx` component.

### Step-by-Step Breakdown

1.  **Step 1: Prepare Text Ad**: The user selects the context for their ad by choosing a Target Audience Market (TAM), Core Belief, Emotional Angle, Ad, and Character. They can then either upload a `.docx` file with the ad copy or paste it directly.

2.  **Step 2: Text Ad Document**: The application processes the ad copy, splitting it into individual lines and identifying different sections (e.g., Hooks, CTA). The user can review and edit these lines.

3.  **Step 3: Prompts**: The user can choose to use the default, hardcoded prompts or upload their own custom prompts from a `.docx` file.

4.  **Step 4: Images**: The user uploads the images that will be used in the video or selects them from their personal image library.

5.  **Step 5: Mapping**: The application automatically creates combinations of text lines, images, and prompts. The user can review and modify these combinations.

6.  **Step 6: Generate**: The user initiates the video generation process. The frontend sends the combinations to the backend, which then calls the Kie.ai API to generate the videos. The user can track the status of each video generation task.

7.  **Step 7: Review**: Once the videos are generated, the user can review them. They can accept a video, or mark it for regeneration.

8.  **Step 8: Edit & Finalize**: The user can perform fine-grained edits on the generated videos. This includes trimming the start and end times based on the word-level timestamps from the Whisper transcription.

## 5. Key Features & Technical Details

### Context-Based Session Management

The application implements a sophisticated context-based session system. Each unique combination of TAM, Core Belief, Emotional Angle, Ad, and Character represents a distinct "context." The `context_sessions` table stores all the workflow data (current step, text lines, images, combinations, video results) for each context. This allows users to:

- Work on multiple ad campaigns simultaneously
- Switch between different contexts without losing progress
- Resume work on a specific context at any time

### Video Generation Process

The video generation workflow is as follows:

1. The frontend sends combinations of text, image URL, and prompt template to the backend
2. The backend calls the Kie.ai API with the following parameters:
   - `prompt`: The prompt template with `[INSERT TEXT]` replaced by the dialogue text
   - `imageUrls`: An array containing the image URL
   - `model`: `veo3_fast`
   - `generationType`: `FIRST_AND_LAST_FRAMES_2_VIDEO`
   - `aspectRatio`: `9:16`
3. The Kie.ai API returns a `taskId` for each video generation request
4. The frontend polls the backend to check the status of each task
5. When a video is ready, the backend retrieves the video URL and stores it in the database

### Video Editing & Post-Processing

After videos are generated, users can perform advanced editing:

1. **Audio Extraction**: The backend downloads the video from BunnyCDN and uploads it to the FFmpeg API, which extracts the audio track as an MP3 file.
2. **Transcription**: The extracted audio is sent to OpenAI's Whisper API, which returns a word-level transcription with precise timestamps.
3. **Cut Point Detection**: The backend analyzes the transcription to identify the start and end of the actual dialogue, excluding any silence or unwanted audio at the beginning or end.
4. **User Adjustment**: The user can fine-tune the start and end timestamps in the UI.
5. **Video Cutting**: The backend calls the FFmpeg API again to cut the video based on the user-specified timestamps.

### Prompt System

The application supports three types of prompts:

- **PROMPT_NEUTRAL**: For videos with a neutral facial expression
- **PROMPT_SMILING**: For videos with a smiling expression
- **PROMPT_CTA**: For Call-to-Action videos, typically showing the person holding a book

Each prompt is a detailed template that includes instructions for the AI model on how to generate the video, covering aspects like facial expressions, lip-sync, gestures, and overall style. The template includes a `[INSERT TEXT]` placeholder, which is replaced with the actual dialogue text.

### Image Library

Users can upload images to their personal library, where they can:

- Organize images by character name
- Assign custom names to images
- Reuse images across different ad campaigns
- Filter and search through their image collection

### Hierarchical Category System

The application uses a 5-level hierarchical structure to organize ad campaigns:

1. **TAM** (Target Audience Market)
2. **Core Belief**
3. **Emotional Angle**
4. **Ad**
5. **Character**

This structure allows users to organize their work in a logical and scalable manner, making it easy to manage multiple campaigns targeting different audiences.

## 6. Technical Stack Summary

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 with TypeScript |
| Build Tool | Vite 7 |
| Styling | TailwindCSS 4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Backend Framework | Express.js with TypeScript |
| API Layer | tRPC 11 |
| Database | MySQL (hosted on Railway) |
| ORM | Drizzle ORM |
| Package Manager | pnpm |
| Routing | wouter |
| State Management | React hooks (useState, useEffect, etc.) |
| Form Handling | react-hook-form |
| Notifications | sonner |
| Video Player | react-player |

## 7. Environment Variables

The application requires the following environment variables:

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | MySQL connection string from Railway | Yes |
| `JWT_SECRET` | Secret key for encrypting user session cookies | Yes |
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment mode (development/production) | No |
| `OAUTH_SERVER_URL` | OAuth server URL (optional) | No |
| `VITE_APP_ID` | Vite app ID (optional) | No |
| `OWNER_OPEN_ID` | Owner OpenID (optional) | No |

## 8. Key Files & Their Purposes

| File Path | Purpose |
|---|---|
| `/drizzle/schema.ts` | Database schema definition |
| `/server/routers.ts` | Main tRPC router with all API endpoints |
| `/server/db.ts` | Database access functions |
| `/server/hardcodedPrompts.ts` | Default video generation prompts |
| `/server/documentParser.ts` | Document parsing utilities |
| `/server/videoEditing.ts` | Video post-processing logic |
| `/client/src/pages/Home.tsx` | Main application component with workflow logic |
| `/client/src/lib/trpc.ts` | tRPC client configuration |

## 9. Development & Deployment

### Development

```bash
pnpm install
pnpm run dev
```

The development server runs on `http://localhost:3000` with hot-reloading enabled.

### Production Build

```bash
pnpm run build
pnpm run start
```

### Database Migration

```bash
pnpm run db:push
```

This command generates the migration files and applies them to the database.

## 10. Current State & Recent Improvements

The application is currently at commit `0e7839b`, which includes the following improvements:

1. Fixed the COPY CONTEXT button disabled state logic
2. Added DELETE functionality for "No Character" entries in the Images Library
3. Removed a redundant warning in Step 7
4. Added support for importing ad text from public Google Docs links
5. Enhanced Step 1 UI with full-height text editor, per-line DELETE buttons, and UNDO functionality
6. Implemented auto-scroll after editing a line

The application is fully functional and deployed on Railway with continuous deployment from the GitHub repository.
