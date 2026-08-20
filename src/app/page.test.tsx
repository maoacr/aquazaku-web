import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from '@/app/page'

/**
 * Además de cubrir la landing, este test verifica que el arnés de testing de
 * web/ esté bien cableado de punta a punta: jsdom, plugin de React, alias `@/`,
 * y los matchers de jest-dom. Si algo de eso se desconfigura, falla acá y no en
 * medio de una task de UI.
 */
describe('HomePage', () => {
  it('renderiza el nombre del sistema', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Aquazaku' })).toBeInTheDocument()
  })

  it('avisa que M0 está en construcción', () => {
    render(<HomePage />)

    expect(screen.getByText(/M0 — Auth y RBAC en construcción/)).toBeVisible()
  })
})
