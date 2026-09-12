import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin esto, los componentes montados en un test siguen en el DOM durante el
// siguiente y los queries empiezan a devolver el elemento equivocado.
afterEach(() => {
  cleanup()
})

/**
 * ── El `<dialog>` que jsdom no abre ─────────────────────────────────────────
 *
 * `Modal` llama a `showModal()` y a `close()`. jsdom trae esos métodos, pero
 * como **stubs que no hacen nada** y avisan «Not implemented»: el diálogo nunca
 * recibe `open`, y su contenido queda fuera del árbol de accesibilidad. Los
 * queries por rol no encuentran nada adentro y el error dice «no existe ese
 * botón», que manda a buscar el problema al componente.
 *
 * Vivía repetido en cuatro archivos de test y de dos formas distintas. Tres
 * usaban `??=`, que **no aplica** justamente porque el método ya existe —el
 * stub— así que solo funcionaban por casualidad, según qué otro archivo hubiera
 * corrido antes. Costó una corrida verde en aislamiento y roja en la suite.
 *
 * Acá va una sola vez, con asignación directa: no depende de qué haya antes.
 */
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
