/**
 * Kineticare Database Client (Neon PostgreSQL + Drizzle ORM)
 * Connects to Neon PostgreSQL serverless when DATABASE_URL is provided,
 * with zero-config local storage fallback for offline/development mode.
 */
import * as schema from './schema.js';

let dbInstance = null;
let isConnectedToNeon = false;

export async function getDb() {
  if (dbInstance) return { db: dbInstance, isNeon: isConnectedToNeon };

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    try {
      // Dynamic import to allow running even if @neondatabase/serverless is optional
      const { neon } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-http');

      const sql = neon(connectionString);
      dbInstance = drizzle(sql, { schema });
      isConnectedToNeon = true;
      console.log('Successfully connected to Neon PostgreSQL database.');
      return { db: dbInstance, isNeon: true };
    } catch (err) {
      console.warn('Could not connect to Neon PostgreSQL, falling back to local storage:', err.message);
    }
  }

  // Local in-memory repository fallback
  dbInstance = createLocalMockDb();
  isConnectedToNeon = false;
  return { db: dbInstance, isNeon: false };
}

/**
 * Creates an in-memory database mock conforming to Drizzle ORM's core query patterns
 */
function createLocalMockDb() {
  const store = {
    users: [
      { id: 'P-101', email: 'shyam@kineticare.com', role: 'patient', displayName: 'Dipesh', metadata: { age: 27, gender: 'Male' }, createdAt: new Date() },
      { id: 'C-001', email: 'aditi@kineticare.com', role: 'clinician', displayName: 'Dr. Aditi Yadav', metadata: { specialty: 'Physiotherapist' }, createdAt: new Date() },
    ],
    exercises: [],
    assignments: [],
    sessions: [],
    clinicalReports: [],
  };

  return {
    isMock: true,
    store,
    query: {
      users: {
        findMany: async () => store.users,
        findFirst: async ({ where } = {}) => store.users[0] || null,
      },
      exercises: {
        findMany: async () => store.exercises,
      },
      assignments: {
        findMany: async () => store.assignments,
      },
      sessions: {
        findMany: async () => store.sessions,
      },
      clinicalReports: {
        findMany: async () => store.clinicalReports,
      },
    },
  };
}

export { schema };
