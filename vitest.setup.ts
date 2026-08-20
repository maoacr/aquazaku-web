import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin esto, los componentes montados en un test siguen en el DOM durante el
// siguiente y los queries empiezan a devolver el elemento equivocado.
afterEach(() => {
  cleanup()
})
