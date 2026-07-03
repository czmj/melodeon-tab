import { renderAbc } from 'abcjs'

export function renderStaffNotation(target: HTMLElement, abc: string): void {
  try {
    renderAbc(target, abc, { responsive: 'resize' })
  } catch {
    target.textContent = 'Could not render notation.'
  }
}
