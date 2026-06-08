import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from './App.tsx'
import * as api from './api'
import {
  makeDraftPack,
  validResult,
  structuralResult,
  graphOnlyResult,
} from './test-fixtures'

// Mock the typed API client; the App talks ONLY through it (no real network).
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    listPacks: vi.fn(async () => []),
    getPack: vi.fn(),
    validate: vi.fn(),
    createSourceAndDraft: vi.fn(),
    acceptAtom: vi.fn(),
    rejectAtom: vi.fn(),
    editAtom: vi.fn(),
    splitAtom: vi.fn(),
    setSupport: vi.fn(),
    patchRelationship: vi.fn(),
    saveReviewed: vi.fn(),
    tutorQuery: vi.fn(),
  }
})

const mocked = vi.mocked(api)

/** Render the App and drive it from the new-source form to a loaded draft. */
async function renderWithDraft(validation = validResult) {
  const pack = makeDraftPack()
  mocked.createSourceAndDraft.mockResolvedValue({
    pack_id: pack.id,
    pack,
    validation,
  })
  render(<App />)

  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Learning' } })
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: 'spacing improves retention. memory decays over time.' },
  })
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

  await screen.findByText('Pack: Learning')
  return pack
}

/** The unique atom review card for an atom id (titles also appear in rel rows). */
function cardFor(atomId: string): HTMLElement {
  const card = document.querySelector(`[data-testid="atom-card"][data-atom-id="${atomId}"]`)
  if (!(card instanceof HTMLElement)) throw new Error(`no atom card for ${atomId}`)
  return card
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('draft load + atom rendering', () => {
  it('renders each atom with kind, title, and review_state from the draft pack', async () => {
    await renderWithDraft()

    const cards = screen.getAllByTestId('atom-card')
    expect(cards).toHaveLength(3)

    expect(within(cardFor('atom-1')).getByText('Spaced Repetition')).toBeTruthy()
    expect(within(cardFor('atom-2')).getByText('Forgetting Curve')).toBeTruthy()
    expect(within(cardFor('atom-3')).getByText('Review beats cramming')).toBeTruthy()

    // kind badges (color-coded) render the kind text
    expect(within(cardFor('atom-1')).getByText('system')).toBeTruthy()
    expect(within(cardFor('atom-2')).getByText('model')).toBeTruthy()
    expect(within(cardFor('atom-3')).getByText('claim')).toBeTruthy()

    // review_state badges
    const states = screen.getAllByTestId('atom-review-state')
    expect(states.every((s) => s.textContent === 'Generated')).toBe(true)
  })
})

describe('per-atom review actions', () => {
  it('Accept calls acceptAtom with the right ids and re-renders from the returned pack', async () => {
    await renderWithDraft()
    const updated = makeDraftPack()
    updated.atoms[0]!.review_state = 'reviewed'
    mocked.acceptAtom.mockResolvedValue({ pack: updated, validation: validResult })

    const card = cardFor('atom-1')
    fireEvent.click(within(card).getByRole('button', { name: /accept spaced repetition/i }))

    await waitFor(() => expect(mocked.acceptAtom).toHaveBeenCalledWith('pack-1', 'atom-1'))
    // re-render reflects the new review_state
    await waitFor(() =>
      expect(within(card).getByTestId('atom-review-state').textContent).toBe('Reviewed'),
    )
  })

  it('Reject calls rejectAtom with the right ids', async () => {
    await renderWithDraft()
    const updated = makeDraftPack()
    updated.atoms[0]!.review_state = 'rejected'
    mocked.rejectAtom.mockResolvedValue({ pack: updated, validation: validResult })

    const card = cardFor('atom-1')
    fireEvent.click(within(card).getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(mocked.rejectAtom).toHaveBeenCalledWith('pack-1', 'atom-1'))
  })

  it('Edit toggles an inline editor and Save calls editAtom with the patch body', async () => {
    await renderWithDraft()
    const updated = makeDraftPack()
    updated.atoms[0]!.title = 'Spaced Practice'
    updated.atoms[0]!.review_state = 'edited'
    mocked.editAtom.mockResolvedValue({ pack: updated, validation: validResult })

    const card = cardFor('atom-1')
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }))

    const titleInput = within(card).getByLabelText('Title')
    fireEvent.change(titleInput, { target: { value: 'Spaced Practice' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mocked.editAtom).toHaveBeenCalledWith('pack-1', 'atom-1', {
        title: 'Spaced Practice',
        summary: 'Spaced Repetition summary',
        body: '',
      }),
    )
    await waitFor(() =>
      expect(within(cardFor('atom-1')).getByText('Spaced Practice')).toBeTruthy(),
    )
  })

  it('Split calls splitAtom and re-renders the larger pack', async () => {
    await renderWithDraft()
    const updated = makeDraftPack()
    updated.atoms.push({
      ...updated.atoms[0]!,
      id: 'atom-1-split',
      title: 'Spaced Repetition (split)',
    })
    mocked.splitAtom.mockResolvedValue({
      pack: updated,
      validation: validResult,
      new_atom_id: 'atom-1-split',
    })

    const card = cardFor('atom-1')
    fireEvent.click(within(card).getByRole('button', { name: 'Split' }))

    await waitFor(() => expect(mocked.splitAtom).toHaveBeenCalledWith('pack-1', 'atom-1'))
    await waitFor(() => expect(screen.getAllByTestId('atom-card')).toHaveLength(4))
  })
})

describe('source anchors + support_state', () => {
  it('shows each atom anchor excerpt/selector/verifiable and sets support via set_support', async () => {
    await renderWithDraft()

    // atom-1 has anchor anc-1 with excerpt and verifiable flag
    const card = cardFor('atom-1')
    expect(within(card).getByText(/spacing improves retention/)).toBeTruthy()
    expect(within(card).getByText('verifiable')).toBeTruthy()

    const updated = makeDraftPack()
    updated.atoms[0]!.anchors[0]!.support_state = 'supports'
    mocked.setSupport.mockResolvedValue({ pack: updated, validation: validResult })

    const select = within(card).getByLabelText('support state for anchor anc-1')
    fireEvent.change(select, { target: { value: 'supports' } })

    await waitFor(() =>
      expect(mocked.setSupport).toHaveBeenCalledWith('pack-1', 'atom-1', 'anc-1', 'supports'),
    )
  })

  it('only offers support controls for anchors actually on the atom', async () => {
    await renderWithDraft()
    // atom-3 (claim) has no anchors → no support control rendered for it
    const card = cardFor('atom-3')
    expect(within(card).queryByLabelText(/support state for anchor/)).toBeNull()
  })
})

describe('relationships', () => {
  it('lists predicate + from→to + review_state and Accept calls patchRelationship', async () => {
    await renderWithDraft()
    const row = screen.getByTestId('relationship')
    expect(within(row).getByText('uses')).toBeTruthy()
    expect(within(row).getByText('Spaced Repetition')).toBeTruthy()
    expect(within(row).getByText('Forgetting Curve')).toBeTruthy()

    const updated = makeDraftPack()
    updated.relationships[0]!.review_state = 'reviewed'
    mocked.patchRelationship.mockResolvedValue({ pack: updated, validation: validResult })

    fireEvent.click(within(row).getByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(mocked.patchRelationship).toHaveBeenCalledWith('pack-1', 'rel-1', 'accept'),
    )
  })
})

describe('validation panel + save gating', () => {
  it('renders structural vs graph errors and DISABLES save when a structural error exists', async () => {
    await renderWithDraft(structuralResult)

    const structural = screen.getByTestId('errors-structural')
    expect(within(structural).getByText(/title must be a non-empty string/)).toBeTruthy()
    const graph = screen.getByTestId('errors-graph')
    expect(within(graph).getByText(/needs a supporting anchor/)).toBeTruthy()

    expect((screen.getByTestId('save-reviewed') as HTMLButtonElement).disabled).toBe(true)
  })

  it('ENABLES save when only graph errors exist (no structural)', async () => {
    await renderWithDraft(graphOnlyResult)
    expect(screen.getByTestId('errors-graph')).toBeTruthy()
    expect(screen.queryByTestId('errors-structural')).toBeNull()
    expect((screen.getByTestId('save-reviewed') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a mutation rejecting with an ApiError {validation} updates the ValidationPanel', async () => {
    await renderWithDraft(validResult)
    // The mutation rejects with a 422 whose body carries the failing validation.
    mocked.acceptAtom.mockRejectedValue(
      new api.ApiError(422, 'edit would make the pack structurally invalid', {
        validation: structuralResult,
      }),
    )

    const card = cardFor('atom-1')
    fireEvent.click(within(card).getByRole('button', { name: /accept spaced repetition/i }))

    // The error banner shows the message...
    await screen.findByText(/edit would make the pack structurally invalid/)
    // ...and the ValidationPanel now renders the 422's validation errors.
    await waitFor(() =>
      expect(
        within(screen.getByTestId('errors-structural')).getByText(/title must be a non-empty string/),
      ).toBeTruthy(),
    )
  })
})

describe('reviewed save', () => {
  it('success (201) shows a confirmation banner', async () => {
    await renderWithDraft(validResult)
    mocked.saveReviewed.mockResolvedValue({
      ok: true,
      reviewed: { pack: makeDraftPack(), saved_at: '2026-06-01T12:00:00.000Z' },
    })

    fireEvent.click(screen.getByTestId('save-reviewed'))
    await waitFor(() => expect(mocked.saveReviewed).toHaveBeenCalledWith('pack-1'))
    expect(await screen.findByText(/Reviewed pack saved/)).toBeTruthy()
  })

  it('conflict (409) shows the returned validation errors and keeps editing', async () => {
    await renderWithDraft(graphOnlyResult)
    mocked.saveReviewed.mockResolvedValue({ ok: false, validation: structuralResult })

    fireEvent.click(screen.getByTestId('save-reviewed'))
    await waitFor(() =>
      expect(screen.getByText(/Reviewed save rejected/)).toBeTruthy(),
    )
    // errors now include the structural one returned by the 409
    expect(within(screen.getByTestId('errors-structural')).getByText(/title must be/)).toBeTruthy()
    // still on the review surface (atoms visible)
    expect(screen.getAllByTestId('atom-card').length).toBeGreaterThan(0)
  })
})

describe('load existing pack uses real validation (bd-14)', () => {
  it('loads a pack whose validate() reports a structural error and blocks save', async () => {
    const pack = makeDraftPack()
    mocked.listPacks.mockResolvedValue([
      { id: pack.id, title: pack.title, version: pack.version },
    ])
    mocked.getPack.mockResolvedValue(pack)
    // The stored pack is structurally invalid — loadExisting() must surface this.
    mocked.validate.mockResolvedValue(structuralResult)

    render(<App />)

    const select = await screen.findByLabelText('Existing packs')
    fireEvent.change(select, { target: { value: pack.id } })
    fireEvent.click(screen.getByRole('button', { name: /load pack/i }))

    // The pack loads with the REAL validation state (not a hardcoded ok).
    await screen.findByText('Pack: Learning')
    await waitFor(() => expect(mocked.validate).toHaveBeenCalledWith(pack.id))

    // Structural error is rendered and the reviewed-save button is disabled.
    expect(
      within(screen.getByTestId('errors-structural')).getByText(/title must be a non-empty string/),
    ).toBeTruthy()
    expect((screen.getByTestId('save-reviewed') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('tutor box', () => {
  it('renders an answer with its citations', async () => {
    await renderWithDraft()
    mocked.tutorQuery.mockResolvedValue({
      kind: 'answer',
      text: 'Spacing reviews improves retention.',
      citations: [{ atom_id: 'atom-1', anchor_id: 'anc-1', excerpt: 'spacing improves retention' }],
    })

    fireEvent.change(screen.getByLabelText('Tutor question'), {
      target: { value: 'Why space reviews?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    await screen.findByTestId('tutor-answer')
    expect(screen.getByText('Spacing reviews improves retention.')).toBeTruthy()
    expect(mocked.tutorQuery).toHaveBeenCalledWith('pack-1', 'Why space reviews?')
    expect(within(screen.getByTestId('tutor-citation')).getByText(/spacing improves retention/)).toBeTruthy()
  })

  it('renders a refusal reason', async () => {
    await renderWithDraft()
    mocked.tutorQuery.mockResolvedValue({
      kind: 'refusal',
      reason: 'no reviewed pack — the tutor only answers from a reviewed snapshot',
    })

    fireEvent.change(screen.getByLabelText('Tutor question'), {
      target: { value: 'anything' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const refusal = await screen.findByTestId('tutor-refusal')
    expect(refusal.textContent).toMatch(/only answers from a reviewed snapshot/)
  })
})
