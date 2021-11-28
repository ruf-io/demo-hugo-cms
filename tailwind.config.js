module.exports = {
  purge: [],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      screens: {
        'mdl': '879px',
      },
      fontSize: {
        '2xs': '.625rem',
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'Helvetica'],
        'mono': ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        'display': ['Encode Sans Expanded', 'ui-sans-serif', 'system-ui', 'Helvetica'],
      },
      colors: {
        primary: {
          50: '',
          100: '',
          200: '',
          300: '',
          400: '',
          400: '#7F4EFF',
          500: '#472F85',
          600: '#211C50',
          700: '#1B164C',
          900: '#030625',
        },
        ui: {
          offwhite: '#EEEEEE',
          gray: '#353250',
          purple: '#301c7b',
        }
      },
      boxShadow: {
        panel: "0px 91.6435px 73.3148px rgba(0, 0, 0, 0.2), 0px 38.2864px 30.6292px rgba(0, 0, 0, 0.143771), 0px 20.4698px 16.3758px rgba(0, 0, 0, 0.119221), 0px 11.4752px 9.18015px rgba(0, 0, 0, 0.1), 0px 6.09438px 4.87551px rgba(0, 0, 0, 0.0807786), 0px 2.53601px 2.02881px rgba(0, 0, 0, 0.0562291)"
      },
      maxWidth: {
        '34': '8.5rem'
      }
    },
  },
  variants: {
    extend: {
      display: ['responsive', 'group-hover', 'group-focus'],
      scale: ['group-hover'],
      borderRadius: ['first', 'last'],
      borderWidth: ['first', 'last'],
    }
  },
  plugins: [],
}