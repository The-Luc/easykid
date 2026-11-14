/**
 * Unique id for a record. Uses a real UUID when the browser offers one.
 * `crypto.randomUUID` only exists in secure contexts (https or localhost), so
 * on a phone opening the dev server over plain http (http://192.168.x.x) it is
 * missing; fall back to a time + random id, which is unique enough on one device.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
