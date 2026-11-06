export const environment = {
  production: false,
  title: "Local Environment Variables",
  // Dev server proxies these paths to the API (see proxy.conf.json), so
  // browser calls stay same-origin and avoid CORS/preflight issues.
  apiUrl: '',
  publicSiteUrl: 'http://localhost:4201',
  adminUrl: 'http://localhost:4202',
  cellMeetingUrl: 'https://us05web.zoom.us/j/82679293106?pwd=09UOjUWxJ1i72yKW2gBiJv0yfAJbq0.1'
};
