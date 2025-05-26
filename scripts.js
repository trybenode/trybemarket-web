// generate-slugs.js
const admin = require('firebase-admin')
const slugify = require('slugify')

// Initialize Firebase Admin
const serviceAccount = require('./path/to/your-service-account.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

const generateSlug = (text) => {
  return slugify(text, { lower: true, strict: true })
}

async function updateSlugs() {
  const categoriesRef = db.collection('categories')
  const snapshot = await categoriesRef.get()

  if (snapshot.empty) {
    console.log('No categories found.')
    return
  }

  const batch = db.batch()

  snapshot.forEach((doc) => {
    const data = doc.data()
    if (!data.slug && data.name) {
      const slug = generateSlug(data.name)
      const docRef = categoriesRef.doc(doc.id)
      batch.update(docRef, { slug })
      console.log(`Updating '${data.name}' with slug '${slug}'`)
    }
  })

  await batch.commit()
  console.log(' Slugs updated successfully.')
}

updateSlugs().catch(console.error)

// node __filename.ext 