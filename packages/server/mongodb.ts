import "server-only"
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME

if (!uri) throw new Error("MONGODB_URI is not configured")
if (!dbName) throw new Error("MONGODB_DB_NAME is not configured")

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientForAuth?: MongoClient
}

export const mongoClient = globalForMongo.mongoClientForAuth ?? new MongoClient(uri)
globalForMongo.mongoClientForAuth = mongoClient

export const db = mongoClient.db(dbName)
