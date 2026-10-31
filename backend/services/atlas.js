import '../config/environment.js';
import { MongoClient } from 'mongodb';

let connection;
export async function atlasDb() {
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('MongoDB Atlas is not configured.'), { status: 503 });
  if (!connection) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    connection = client.connect().then(() => client.db(process.env.MONGODB_DB || 'kineticare')).catch(error => { connection = null; throw error; });
  }
  return connection;
}
