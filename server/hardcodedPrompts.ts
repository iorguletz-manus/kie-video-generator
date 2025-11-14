/**
 * Hardcoded prompts for Kie.ai video generation
 * These are the default prompts that can be used without uploading documents
 */

export const HARDCODED_PROMPTS = {
  PROMPT_NEUTRAL: {
    name: "PROMPT_NEUTRAL",
    fileName: "prompt1_veo_neutralface.docx",
    content: `SUBJECT — Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION — The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO — Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE — Smooth, precise lip-sync. No smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, neutral face, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

No smiling. Facial expression shows mild frustration progressing into calm reflection without smiling.`,
  },
  
  PROMPT_SMILING: {
    name: "PROMPT_SMILING",
    fileName: "prompt2_veo_smilingface.docx",
    content: `SUBJECT — Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION — The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO — Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE — Smooth, precise lip-sync. Smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, smiling, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

Smiling.`,
  },
  
  PROMPT_CTA: {
    name: "PROMPT_CTA",
    fileName: "prompt2_veo_smiling_cta.docx",
    content: `SUBJECT — Minimal makeup, natural skin texture visible.

ACTION AND CAMERA MOTION — The woman blinks naturally, subtly moves her eyebrows, and her lips move perfectly syncing with the Romanian dialogue. Micro head nods and slight posture shifts. 

AUDIO — Female voice in Romanian, warm tone, age 40s, slightly introspective, clear and natural speech with realistic pauses and mouth shape syncing. Dialogue: "[INSERT TEXT]"

STYLE — Smooth, precise lip-sync. Smiling, no dramatic gestures, just natural blinking, head nods, and small posture adjustments. 

Facial expression modifiers:Minimal facial expression, smiling, subtle emotional tone, avoid exaggerated eyebrow or mouth movement, without theatrical or over-acted emotion, controlled micro-expressions only, keep expression calm and introspective, understated emotion, realistic tone, speak naturally, not like a presenter or actor

Lip-sync and speech modifiers:Subtle lip sync only, minimal mouth movement, avoid over-articulated or exaggerated mouth shapes, speech motion should be soft and natural, not over-enunciated, reduce lip-sync exaggeration, focus on authenticity, mouth motion synced but minimal, no overpronunciation or acting emphasis, clear and natural speech with realistic pauses

Gesture and head/body movement modifiers:Very limited gestures, no hand waving, no strong head movements, keep posture steady with only tiny natural shifts, minimal head motion, small micro tilts only, avoid nodding repeatedly, subtle restrained body language, no exaggerated body gestures or hand movement, keep the camera stable, no rhythmic head motion

Overall natural realism style:Authentic iPhone-style realism, behaves like a real person speaking casually, realistic breathing pauses, no acting performance energy, quiet introspective tone, natural tempo and rhythm of real conversation, avoid scripted or formal tone, expression should feel natural grounded and introspective like a real person speaking softly to herself, no acting no performative delivery no reporter tone

Post-speech behavior modifiers:After finishing the dialogue, she keeps looking at the camera naturally, holding eye contact for a few seconds, calm and still, no smile, no movement, just natural breathing and subtle blinking, maintaining emotional continuity, gaze remains steady and present, do not cut or fade immediately after speaking, keep the shot running for a few seconds of quiet presence

High quality, realistic rendering in 4K.

No subtitles. No music.

Smiling. 

Make sure the book stays visible on screen throughout the entire video, clearly held in her hands the whole time.`,
  },
};

export type PromptType = keyof typeof HARDCODED_PROMPTS;
