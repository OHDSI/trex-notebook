import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export function createVuetifyInstance(primaryColor?: string | null) {
  return createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: primaryColor || '#1f425a',
            secondary: '#424242',
            accent: '#2d5f7f',
            error: '#b00020',
            info: '#2196f3',
            success: '#4caf50',
            warning: '#fb8c00',
          },
        },
      },
    },
    defaults: {
      VBtn: {
        variant: 'flat',
        color: 'primary',
        rounded: 'lg',
        style: 'text-transform: none; letter-spacing: 0;',
      },
      VCard: { variant: 'flat', rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VSelect: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VAutocomplete: { variant: 'outlined', density: 'compact', rounded: 'md' },
      VDialog: { rounded: 'lg' },
      VChip: { variant: 'tonal', rounded: 'md', density: 'compact' },
      VAlert: { variant: 'tonal', rounded: 'md' },
    },
  })
}

export default createVuetifyInstance()
