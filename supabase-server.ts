import { createServerClient } from '@supabase/ssr'
import { parse as parseCookieHeader } from 'cookie-es'
import { useRuntimeConfig } from '#imports'
import { createError, deleteCookie, getHeader, setCookie, type H3Event } from 'h3'

type SupabaseUser = {
  id: string
  email?: string | null
  [key: string]: unknown
}

function getSupabaseConfig(event: H3Event) {
  const config = useRuntimeConfig(event)
  const url = config.public.supabase.url
  const key = config.public.supabase.key

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE key must be set')
  }

  return {
    url,
    key,
    cookiePrefix: config.public.supabase.cookiePrefix,
    cookieOptions: config.public.supabase.cookieOptions,
    clientOptions: config.public.supabase.clientOptions,
  }
}

export async function serverSupabaseClient(event: H3Event) {
  if (!event.context._supabaseClient) {
    const { url, key, cookiePrefix, cookieOptions, clientOptions } = getSupabaseConfig(event)

    event.context._supabaseClient = createServerClient(url, key, {
      ...clientOptions,
      cookies: {
        getAll: () => {
          const cookieHeader = getHeader(event, 'cookie') ?? ''
          return Object.entries(parseCookieHeader(cookieHeader)).map(([name, value]) => ({ name, value }))
        },
        setAll: (cookiesToSet) => {
          for (const cookie of cookiesToSet) {
            const options = { ...cookieOptions }
            if (cookie.maxAge === 0 || cookie.value === '') {
              deleteCookie(event, cookie.name, options)
              continue
            }
            setCookie(event, cookie.name, cookie.value, options)
          }
        },
      },
      cookieOptions: {
        ...cookieOptions,
        name: cookiePrefix,
      },
    })
  }

  return event.context._supabaseClient
}

export async function serverSupabaseUser(event: H3Event): Promise<SupabaseUser | null> {
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.auth.getUser()

  if (error) {
    // AuthSessionMissingError means unauthenticated (no cookie) — return null so routes send 401
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const user = data.user
  if (!user) return null

  const id = user.id || (user as { sub?: string }).sub
  if (!id) return null

  return { ...user, id } as SupabaseUser
}


