// Captures the browser's `beforeinstallprompt` event the first time it
// fires (which can be before any React component mounts) and exposes a
// tiny pub/sub so the Settings modal can show / hide an Install button
// without missing the event.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let cachedPrompt: BeforeInstallPromptEvent | null = null
let alreadyInstalled =
  typeof window !== 'undefined' &&
  // PWA installed: display-mode is standalone, or iOS Safari home-screen flag.
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true)

const subscribers = new Set<() => void>()

function notify() {
  for (const fn of subscribers) fn()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    cachedPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    cachedPrompt = null
    alreadyInstalled = true
    notify()
  })
}

export function getInstallState() {
  return { canInstall: cachedPrompt != null, alreadyInstalled }
}

export function subscribeInstallState(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!cachedPrompt) return 'unavailable'
  await cachedPrompt.prompt()
  const choice = await cachedPrompt.userChoice
  // Per spec the prompt object is single-use; drop the reference either way.
  cachedPrompt = null
  if (choice.outcome === 'accepted') {
    alreadyInstalled = true
  }
  notify()
  return choice.outcome
}
