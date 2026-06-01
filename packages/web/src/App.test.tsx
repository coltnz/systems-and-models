import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.tsx'

describe('@sam/web App (scaffold)', () => {
  it('renders the scaffold placeholder heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /review ui \(scaffold\)/i }),
    ).toBeDefined()
  })
})
