// Web app manifest: lets the site be installed to the home screen and open full screen like an app
export default function manifest() {
  return {
    name: 'Verse',
    short_name: 'Verse',
    description: 'แชทโรลเพลย์กับตัวละคร AI',
    lang: 'th',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
