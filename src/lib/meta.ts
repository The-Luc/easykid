import type { EventType, PhaseType } from '../types'

export const PHASES: PhaseType[] = ['eat', 'activity', 'sleep', 'you']

export const PHASE_META: Record<
  PhaseType,
  { letter: string; name: string; hint: string; active: string }
> = {
  eat: { letter: 'E', name: 'Eat', hint: 'Breast or bottle', active: 'Eating' },
  activity: {
    letter: 'A',
    name: 'Activity',
    hint: 'Calculated from eat & sleep',
    active: 'Awake & playing',
  },
  sleep: { letter: 'S', name: 'Sleep', hint: 'Nap or night', active: 'Sleeping' },
  you: {
    letter: 'Y',
    name: 'You',
    hint: 'Free while baby sleeps',
    active: 'You time',
  },
}

export const EVENT_EMOJI: Record<EventType, string> = {
  eat: '🍼',
  activity: '🧸',
  sleep: '😴',
  you: '🧘',
  diaper: '🧷',
}

export const EVENT_LABEL: Record<EventType, string> = {
  eat: 'Eat',
  activity: 'Activity',
  sleep: 'Sleep',
  you: 'You time',
  diaper: 'Diaper',
}
