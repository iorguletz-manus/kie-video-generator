// Video sorting utility for consistent category ordering across all steps

export type SectionType = 'HOOKS' | 'MIRROR' | 'DCS' | 'TRANSITION' | 'NEW_CAUSE' | 'MECHANISM' | 'EMOTIONAL_PROOF' | 'TRANSFORMATION' | 'CTA' | 'OTHER';

interface VideoWithSection {
  videoName: string;
  section?: SectionType;
  [key: string]: any;
}

// Category priority order (lower number = higher priority)
const CATEGORY_ORDER: Record<SectionType, number> = {
  'HOOKS': 1,
  'MIRROR': 2,
  'DCS': 3,
  'TRANSITION': 4,
  'NEW_CAUSE': 5,
  'MECHANISM': 6,
  'EMOTIONAL_PROOF': 7,
  'TRANSFORMATION': 8,
  'CTA': 9,
  'OTHER': 10,
};

/**
 * Detect category from videoName
 * Examples:
 * - T1_C1_E1_AD1_HOOK1_NAME_1 → HOOKS
 * - T1_C1_E1_AD1_MIRROR1_NAME_1 → MIRROR
 * - T1_C1_E1_AD1_DCS1_NAME_1 → DCS
 */
function detectCategory(videoName: string): SectionType {
  const upperName = videoName.toUpperCase();
  
  if (upperName.includes('HOOK')) return 'HOOKS';
  if (upperName.includes('MIRROR')) return 'MIRROR';
  if (upperName.includes('DCS')) return 'DCS';
  if (upperName.includes('TRANSITION')) return 'TRANSITION';
  if (upperName.includes('NEW_CAUSE') || upperName.includes('NEWCAUSE')) return 'NEW_CAUSE';
  if (upperName.includes('MECHANISM')) return 'MECHANISM';
  if (upperName.includes('EMOTIONAL_PROOF') || upperName.includes('EMOTIONALPROOF')) return 'EMOTIONAL_PROOF';
  if (upperName.includes('TRANSFORMATION')) return 'TRANSFORMATION';
  if (upperName.includes('CTA')) return 'CTA';
  
  return 'OTHER';
}

/**
 * Sort videos by category priority and alphabetically within category
 * 
 * Order: HOOK → MIRROR → DCS → TRANSITION → NEW CAUSE → MECHANISM → EMOTIONAL PROOF → TRANSFORMATION → CTA
 * 
 * Within each category, sort alphabetically:
 * - HOOK1 → HOOK1B → HOOK1C → HOOK2 → HOOK2A
 */
export function sortVideosByCategory<T extends VideoWithSection>(videos: T[]): T[] {
  return [...videos].sort((a, b) => {
    // Get category for each video (from section field or detect from videoName)
    const categoryA = a.section || detectCategory(a.videoName);
    const categoryB = b.section || detectCategory(b.videoName);
    
    // Get priority for each category
    const priorityA = CATEGORY_ORDER[categoryA] || 999;
    const priorityB = CATEGORY_ORDER[categoryB] || 999;
    
    // First, sort by category priority
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Within same category, sort alphabetically by videoName
    return a.videoName.localeCompare(b.videoName);
  });
}
