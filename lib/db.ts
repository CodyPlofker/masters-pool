import { neon } from '@neondatabase/serverless'

function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL env var not set')
  return neon(url)
}

export async function query<T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> {
  const sql = getDb()
  return sql(strings, ...values) as Promise<T[]>
}

