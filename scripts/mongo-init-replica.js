// Run inside the MongoDB container with the configured root credentials in its environment.
const admin = db.getSiblingDB("admin")
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error("Could not authenticate to MongoDB with the configured root credentials.")
}
let status
try {
  status = admin.runCommand({ replSetGetStatus: 1 })
} catch (error) {
  if (error.codeName !== "NotYetInitialized" && error.code !== 94) throw error
}
if (!status) {
  try {
    admin.runCommand({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] } })
  } catch (error) {
    if (error.codeName !== "AlreadyInitialized" && error.code !== 23) throw error
  }
} else if (status.set !== "rs0") {
  throw new Error("MongoDB is already configured as a different replica set.")
}
for (let attempt = 0; attempt < 120; attempt++) {
  if (admin.runCommand({ hello: 1 }).isWritablePrimary) {
    print("MongoDB replica set is ready.")
    quit(0)
  }
  sleep(500)
}
throw new Error("Timed out waiting for MongoDB replica set primary.")
