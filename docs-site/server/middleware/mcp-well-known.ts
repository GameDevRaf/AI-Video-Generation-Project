export default defineEventHandler((event) => {
  if (event.method !== 'GET') {
    return
  }

  const { pathname } = getRequestURL(event)
  if (!pathname.startsWith('/mcp/.well-known/')) {
    return
  }

  setResponseStatus(event, 404)
  setHeader(event, 'x-project-mcp-discovery', 'not-configured')
  return sendNoContent(event, 404)
})
