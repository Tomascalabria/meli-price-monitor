// Ejecutar con: node test-meli.mjs [ITEM_ID]
// No requiere ninguna dependencia instalada

// IDs del URL compartido:
//   Producto/catálogo: MLA37106988
//   Listing específico: MLA1670651449
const ITEM_ID = process.argv[2] ?? 'MLA1670651449'

async function test() {
  console.log(`\n=== MELI API Test — Item: ${ITEM_ID} ===\n`)

  // 1. Item básico
  console.log('1️⃣  GET /items/:id')
  const itemRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}`)
  console.log('   Status:', itemRes.status)

  if (!itemRes.ok) {
    const err = await itemRes.text()
    console.error('   Error:', err)
    return
  }

  const item = await itemRes.json()
  console.log('   title:             ', item.title)
  console.log('   price:             ', item.price, item.currency_id)
  console.log('   original_price:    ', item.original_price)
  console.log('   condition:         ', item.condition)
  console.log('   available_quantity:', item.available_quantity)
  console.log('   seller_id:         ', item.seller_id)
  console.log('   category_id:       ', item.category_id)
  console.log('   permalink:         ', item.permalink)
  console.log('   thumbnail:         ', item.thumbnail)

  // 2. Descripción (endpoint separado en MELI)
  console.log('\n2️⃣  GET /items/:id/description')
  const descRes = await fetch(`https://api.mercadolibre.com/items/${ITEM_ID}/description`)
  console.log('   Status:', descRes.status)

  if (descRes.ok) {
    const desc = await descRes.json()
    const preview = desc.plain_text?.replace(/\n+/g, ' ').trim().slice(0, 300)
    console.log('   descripción:', preview ? `"${preview}..."` : '(vacía)')
  }

  // 3. Seller info
  console.log('\n3️⃣  GET /users/:seller_id')
  const sellerRes = await fetch(`https://api.mercadolibre.com/users/${item.seller_id}`)
  console.log('   Status:', sellerRes.status)

  if (sellerRes.ok) {
    const seller = await sellerRes.json()
    console.log('   nickname:           ', seller.nickname)
    console.log('   reputation level:   ', seller.seller_reputation?.level_id ?? 'N/A')
    console.log('   total transactions: ', seller.seller_reputation?.transactions?.total ?? 'N/A')
  }

  // 4. Batch (hasta 20 items de una vez — el motor del bot)
  console.log('\n4️⃣  GET /items?ids=... (batch — así funciona el bot)')
  const batchRes = await fetch(`https://api.mercadolibre.com/items?ids=${ITEM_ID}`)
  const batch = await batchRes.json()
  const first = batch[0]
  console.log('   code:', first?.code, '| price:', first?.body?.price, first?.body?.currency_id)

  // 5. Catálogo (todos los sellers del mismo producto)
  const catalogId = 'MLA37106988'
  console.log(`\n5️⃣  GET /products/${catalogId}/items (todos los sellers del mismo producto)`)
  const catalogRes = await fetch(`https://api.mercadolibre.com/products/${catalogId}/items`)
  console.log('   Status:', catalogRes.status)

  if (catalogRes.ok) {
    const catalog = await catalogRes.json()
    const results = catalog.results ?? []
    console.log(`   Total listings encontrados: ${results.length}`)
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   [${i+1}] id: ${r.id} | price: ${r.price} | seller_id: ${r.seller_id}`)
    })
    if (results.length > 5) console.log(`   ... y ${results.length - 5} más`)
  }

  console.log('\n✅  Test completo.\n')
}

test().catch(console.error)
