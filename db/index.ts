import { drizzle } from 'drizzle-orm/netlify-db'
import type { NetlifyDbClient } from 'drizzle-orm/netlify-db'
import { neon, Pool } from '@neondatabase/serverless'

function createCompatHttpClient(connectionString: string) {
	const baseClient = neon(connectionString)

	// Drizzle's netlify-db adapter still invokes the client as a function.
	// Newer Neon requires .query() for non-tagged calls, so we normalize here.
	const compatClient = ((query: string, params: unknown[] = [], options: Record<string, unknown> = {}) => {
		return (baseClient as any).query(query, params, options)
	}) as any

	compatClient.query = (query: string, params: unknown[] = [], options: Record<string, unknown> = {}) => {
		return (baseClient as any).query(query, params, options)
	}

	compatClient.transaction = (...args: unknown[]) => {
		return (baseClient as any).transaction(...args)
	}

	return compatClient
}

const connectionString = process.env.NETLIFY_DB_URL ?? process.env.DATABASE_URL

function isUsablePostgresUrl(value: string | undefined): value is string {
	if (!value) return false

	try {
		const parsed = new URL(value)
		const isPostgresProtocol = parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:'
		const hasCredentials = parsed.username.length > 0 && parsed.password.length > 0
		const hasHost = parsed.hostname.length > 0
		const hasDatabase = parsed.pathname.length > 1

		return isPostgresProtocol && hasCredentials && hasHost && hasDatabase
	} catch {
		return false
	}
}

const canUseNeonClient = isUsablePostgresUrl(connectionString)

export const db = canUseNeonClient
	? (() => {
		const client: NetlifyDbClient = {
			http: createCompatHttpClient(connectionString) as any,
			pool: new Pool({ connectionString }),
		}

		return drizzle({ client })
	})()
	: drizzle()
