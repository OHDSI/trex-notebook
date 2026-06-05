import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
// Atlas3 design tokens (CSS custom properties) — exposes --atlas-* + the
// slightly-blue surfaces that plugins reference. Imported once in the host so
// the variables cascade into every plugin parcel.
import '@ohdsi/atlas-ui/tokens.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { buildVuetifyOptions } from '@ohdsi/atlas-ui'

// The Atlas3 theme (slightly-blue background #f6f7f9, white surfaces, orange
// accent, and the shared component defaults) comes straight from the published
// @ohdsi/atlas-ui package so the shell and Atlas3 stay in lockstep.
// buildVuetifyOptions() takes the optional primary-color override directly.
export function createVuetifyInstance(primaryColor?: string | null) {
  return createVuetify({
    components,
    directives,
    ...buildVuetifyOptions(primaryColor),
  })
}

export default createVuetifyInstance()
