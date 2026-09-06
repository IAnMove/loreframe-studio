import type { AgentSeriesSection, AgentStorySection } from '../../lib/uiBus'
import type { StoryProjectType } from './types'
import { storyLabTabIds } from './storyLabTabs'
import type { StoryLabTab } from './storyLabChrome'

export const STORY_LAB_SECTIONS: readonly AgentStorySection[] = [
  'overview', 'assets', 'world', 'characters', 'relationships', 'structure',
  'music', 'trailer', 'productions', 'assembly',
]

export const SERIES_LAB_SECTIONS: readonly AgentSeriesSection[] = [
  'setup', 'canon', 'episode', 'shots', 'review',
]

const STORY_SECTION_ALIASES: Record<string, AgentStorySection> = {
  overview: 'overview',
  assets: 'assets',
  world: 'world',
  characters: 'characters',
  relationships: 'relationships',
  structure: 'structure',
  music: 'music',
  trailer: 'trailer',
  productions: 'productions',
  assembly: 'assembly',
  story: 'overview',
  images: 'assets',
  song: 'music',
  generate: 'productions',
}

const SERIES_SECTION_ALIASES: Record<string, AgentSeriesSection> = {
  setup: 'setup',
  canon: 'canon',
  episode: 'episode',
  shots: 'shots',
  review: 'review',
  bible: 'canon',
  preparation: 'setup',
}

const COMPACT_SECTIONS = new Set<AgentStorySection>([
  'world', 'characters', 'relationships', 'structure',
])

export type StoryLabNavigationResolution =
  | {
    ok: true
    requested: AgentStorySection
    tab: StoryLabTab
    anchor: string
    equivalent: boolean
  }
  | {
    ok: false
    requested: string
    reason: string
  }

export type SeriesLabNavigationResolution =
  | { ok: true; requested: AgentSeriesSection; tab: AgentSeriesSection; equivalent: boolean }
  | { ok: false; requested: string; reason: string }

export function canonicalizeStoryLabSection(raw: string): AgentStorySection | null {
  return STORY_SECTION_ALIASES[raw.trim().toLowerCase()] || null
}

export function canonicalizeSeriesLabSection(raw: string): AgentSeriesSection | null {
  return SERIES_SECTION_ALIASES[raw.trim().toLowerCase()] || null
}

function compactAnchor(section: AgentStorySection): string {
  if (section === 'structure') return 'story-review-structure'
  if (section === 'characters' || section === 'relationships') return 'story-review-characters'
  return 'story-review-world'
}

export function resolveStoryLabNavigation(
  requested: string,
  projectType: StoryProjectType,
): StoryLabNavigationResolution {
  const section = canonicalizeStoryLabSection(requested)
  if (!section) {
    return { ok: false, requested, reason: `Story Lab no tiene una sección llamada “${requested}”.` }
  }
  const visible = storyLabTabIds(projectType)
  if (visible.includes(section)) {
    return {
      ok: true,
      requested: section,
      tab: section,
      anchor: `story-review-${section}`,
      equivalent: false,
    }
  }
  if (projectType !== 'full_story' && COMPACT_SECTIONS.has(section)) {
    return {
      ok: true,
      requested: section,
      tab: 'overview',
      anchor: compactAnchor(section),
      equivalent: true,
    }
  }
  if (projectType === 'trailer' && section === 'productions') {
    return {
      ok: true,
      requested: section,
      tab: 'trailer',
      anchor: 'story-review-overview',
      equivalent: true,
    }
  }
  return {
    ok: false,
    requested: section,
    reason: `Story Lab → ${section} no está visible para un proyecto ${projectType}.`,
  }
}

export function resolveSeriesLabNavigation(requested: string): SeriesLabNavigationResolution {
  const section = canonicalizeSeriesLabSection(requested)
  if (!section) {
    return { ok: false, requested, reason: `Series Lab no tiene una sección llamada “${requested}”.` }
  }
  return { ok: true, requested: section, tab: section, equivalent: false }
}

export function describeStoryLabNavigation(resolution: Extract<StoryLabNavigationResolution, { ok: true }>): string {
  if (!resolution.equivalent) return `He abierto Story Lab → ${resolution.tab}.`
  return `He abierto Story Lab → ${resolution.tab}, donde está ${resolution.requested} en este tipo de proyecto.`
}

export function describeSeriesLabNavigation(resolution: Extract<SeriesLabNavigationResolution, { ok: true }>): string {
  return `He abierto Series Lab → ${resolution.tab}.`
}
