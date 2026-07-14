import { alpha, createTheme, ThemeOptions } from '@mui/material/styles';

const makeTheme = (mode: 'light' | 'dark') => {
  const dark = mode === 'dark';
  const options: ThemeOptions = {
    palette: {
      mode,
      primary: { main: '#e4002b', dark: '#b90023', light: '#ff4d6b', contrastText: '#ffffff' },
      secondary: { main: dark ? '#9db7ff' : '#3156a3' },
      success: { main: dark ? '#4ade80' : '#168348' },
      warning: { main: dark ? '#fbbf24' : '#b86b08' },
      error: { main: dark ? '#fb7185' : '#c62f43' },
      info: { main: dark ? '#67e8f9' : '#167792' },
      background: { default: dark ? '#0d1017' : '#f4f5f7', paper: dark ? '#171b24' : '#ffffff' },
      divider: dark ? 'rgba(255,255,255,.09)' : 'rgba(17,24,39,.1)',
      text: { primary: dark ? '#f5f7fb' : '#171a21', secondary: dark ? '#a4adbd' : '#626b7a' },
      action: { hover: dark ? 'rgba(255,255,255,.055)' : 'rgba(20,27,38,.045)', selected: alpha('#e4002b', dark ? 0.18 : 0.08) },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Inter", sans-serif',
      h1: { fontWeight: 650, letterSpacing: '-0.04em' },
      h2: { fontWeight: 650, letterSpacing: '-0.035em' },
      h3: { fontWeight: 650, letterSpacing: '-0.03em' },
      h4: { fontWeight: 650, letterSpacing: '-0.025em' },
      h5: { fontWeight: 650, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, letterSpacing: '-0.012em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: 0 },
      caption: { letterSpacing: '0.01em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { minWidth: 320, scrollbarColor: `${dark ? '#454c5b' : '#c7ccd5'} transparent` },
          '*': { boxSizing: 'border-box' },
          '::selection': { background: alpha('#e4002b', 0.22) },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none', boxShadow: 'none' } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', minHeight: 36, borderRadius: 8, paddingInline: 14 },
          sizeSmall: { minHeight: 32, paddingInline: 11 },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiCard: {
        styleOverrides: {
          root: { border: `1px solid ${dark ? 'rgba(255,255,255,.09)' : 'rgba(17,24,39,.1)'}`, boxShadow: dark ? '0 18px 40px rgba(0,0,0,.18)' : '0 10px 30px rgba(20,27,38,.05)' },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 7 }, sizeSmall: { height: 24 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 7, fontSize: 12 } } },
      MuiDialog: { styleOverrides: { paper: { border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(17,24,39,.1)'}`, boxShadow: '0 24px 70px rgba(0,0,0,.25)' } } },
    },
  };
  return createTheme(options);
};

export const lightTheme = makeTheme('light');
export const darkTheme = makeTheme('dark');
