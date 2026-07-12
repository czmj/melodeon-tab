// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { App, isKnownCandidate, loadState, STORAGE_KEY } from './App.tsx'
import moonAbc from './fixtures/moon-and-seven-stars.abc?raw'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('isKnownCandidate', () => {
  it('accepts a candidate whose button and direction exist on DG_STANDARD', () => {
    expect(isKnownCandidate({ buttonId: 'd3', direction: 'push' })).toBe(true)
  })

  it('rejects a button id that no longer exists on the instrument', () => {
    expect(isKnownCandidate({ buttonId: 'not-a-real-button', direction: 'push' })).toBe(false)
  })

  it('rejects a malformed direction', () => {
    expect(isKnownCandidate({ buttonId: 'd3', direction: 'sideways' })).toBe(false)
  })

  it('rejects non-objects without throwing', () => {
    expect(isKnownCandidate(null)).toBe(false)
    expect(isKnownCandidate('d3')).toBe(false)
    expect(isKnownCandidate(undefined)).toBe(false)
  })
})

describe('loadState', () => {
  it('falls back to the default tune with no overrides when nothing is stored', () => {
    expect(loadState()).toEqual({ abc: moonAbc, pins: {} })
  })

  it('round-trips a previously saved tune and its pins', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ abc: 'X:1\nK:C\nC|', pins: { 5: { buttonId: 'd3', direction: 'push' } } }),
    )
    expect(loadState()).toEqual({
      abc: 'X:1\nK:C\nC|',
      pins: { 5: { buttonId: 'd3', direction: 'push' } },
    })
  })

  it('drops a stale pin referencing a button no longer on the instrument, without crashing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        abc: 'X:1\nK:C\nC|',
        pins: {
          5: { buttonId: 'd3', direction: 'push' },
          9: { buttonId: 'removed-button', direction: 'push' },
        },
      }),
    )
    expect(loadState()).toEqual({
      abc: 'X:1\nK:C\nC|',
      pins: { 5: { buttonId: 'd3', direction: 'push' } },
    })
  })

  it('falls back to the default state on unparseable JSON, without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadState()).toEqual({ abc: moonAbc, pins: {} })
  })
})

describe('App', () => {
  it('pins an override from the dropdown and shows it in the overrides count', async () => {
    render(<App />)
    const noteButtons = await screen.findAllByRole('button', { name: /^\(?\d+\)?$/ })
    expect(noteButtons.length).toBeGreaterThan(0)

    fireEvent.click(noteButtons[0])
    const menu = await screen.findByRole('menu')
    const options = within(menu).getAllByRole('menuitemradio')
    const nonAuto = options.find((o) => !o.textContent?.toLowerCase().startsWith('auto'))
    expect(nonAuto).toBeDefined()
    fireEvent.click(nonAuto!)

    expect(await screen.findByText('Overrides: 1')).toBeTruthy()
  })
})
