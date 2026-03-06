// scripts/seed.ts
// Run with: npx tsx --env-file=.env.local --env-file=.env scripts/seed.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types.js'

// Inline service-role client — do NOT import src/lib/supabase/admin.ts
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Idempotency helpers ─────────────────────────────────────────────────────

async function getOrCreateAuthUser(
  email: string,
  password: string,
  emailConfirm = true
): Promise<string> {
  const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = users.find(u => u.email === email)
  if (existing) { console.log(`  SKIP auth: ${email}`); return existing.id }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  console.log(`  CREATE auth: ${email}`)
  return data.user.id
}

async function getOrCreateBySlug(
  table: 'categories' | 'tenants',
  slug: string,
  insertData: Record<string, unknown>
): Promise<string> {
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) { console.log(`  SKIP ${table}: ${slug}`); return (existing as { id: string }).id }
  const { data, error } = await supabase
    .from(table)
    .insert(insertData as never)
    .select('id')
    .single()
  if (error) throw new Error(`insert ${table}(${slug}): ${error.message}`)
  console.log(`  CREATE ${table}: ${slug}`)
  return (data as { id: string }).id
}

async function getOrCreatePublicUser(
  authId: string,
  username: string,
  role: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', authId)
    .maybeSingle()
  if (existing) { console.log(`  SKIP users row: ${username}`); return }
  const { error } = await supabase
    .from('users')
    .insert({ id: authId, username, role })
  if (error) throw new Error(`insert users(${username}): ${error.message}`)
  console.log(`  CREATE users: ${username}`)
}

async function getOrCreateUserTenant(userId: string, tenantId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('user_tenants')
    .select('user_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (existing) { console.log(`  SKIP user_tenants: ${userId} <-> ${tenantId}`); return }
  const { error } = await supabase
    .from('user_tenants')
    .insert({ user_id: userId, tenant_id: tenantId })
  if (error) throw new Error(`insert user_tenants: ${error.message}`)
  console.log(`  CREATE user_tenants link`)
}

// ── Data definitions ────────────────────────────────────────────────────────

// These slugs MUST match the customOrder array in src/modules/categories/server/procedures.ts
const CATEGORY_TAXONOMY = [
  {
    name: 'All', slug: 'all', color: null,
    subcategories: [],
  },
  {
    name: 'Clothes', slug: 'clothes', color: '#FF6B9D',
    subcategories: [
      { name: 'T-Shirts', slug: 't-shirts' },
      { name: 'Hoodies & Sweatshirts', slug: 'hoodies-sweatshirts' },
      { name: 'Prints & Graphics', slug: 'prints-graphics' },
      { name: 'Dresses & Skirts', slug: 'dresses-skirts' },
      { name: 'Pants & Shorts', slug: 'pants-shorts' },
    ],
  },
  {
    name: 'Jewelery', slug: 'jewelery', color: '#FFD700',
    subcategories: [
      { name: 'Rings', slug: 'rings' },
      { name: 'Necklaces & Pendants', slug: 'necklaces-pendants' },
      { name: 'Earrings', slug: 'earrings' },
      { name: 'Bracelets & Anklets', slug: 'bracelets-anklets' },
      { name: 'Body Jewelry', slug: 'body-jewelry' },
    ],
  },
  {
    name: 'Posters', slug: 'posters', color: '#7EC8E3',
    subcategories: [
      { name: 'Art Prints', slug: 'art-prints' },
      { name: 'Photography Prints', slug: 'photography-prints' },
      { name: 'Vintage & Retro', slug: 'vintage-retro' },
      { name: 'Music & Band Posters', slug: 'music-band-posters' },
      { name: 'Movie & TV Posters', slug: 'movie-tv-posters' },
    ],
  },
  {
    name: 'Pottery', slug: 'pottery', color: '#D4A574',
    subcategories: [
      { name: 'Bowls & Dishes', slug: 'bowls-dishes' },
      { name: 'Mugs & Cups', slug: 'mugs-cups' },
      { name: 'Vases & Planters', slug: 'vases-planters' },
      { name: 'Plates & Platters', slug: 'plates-platters' },
      { name: 'Decorative Pieces', slug: 'decorative-pieces' },
    ],
  },
  {
    name: 'Tattoos', slug: 'tattoos', color: '#FF69B4',
    subcategories: [
      { name: 'Flash Art', slug: 'flash-art' },
      { name: 'Custom Designs', slug: 'custom-designs' },
      { name: 'Temporary Tattoos', slug: 'temporary-tattoos' },
    ],
  },
  {
    name: 'Music', slug: 'music', color: '#B5B9FF',
    subcategories: [
      { name: 'Albums & EPs', slug: 'albums-eps' },
      { name: 'Singles & Tracks', slug: 'singles-tracks' },
      { name: 'Vinyl Records', slug: 'vinyl-records' },
      { name: 'Digital Downloads', slug: 'digital-downloads' },
      { name: 'Music Merch', slug: 'music-merch' },
    ],
  },
  {
    name: 'Accessories', slug: 'accessories', color: '#96E6B3',
    subcategories: [
      { name: 'Bags & Totes', slug: 'bags-totes' },
      { name: 'Hats & Headwear', slug: 'hats-headwear' },
      { name: 'Pins & Patches', slug: 'pins-patches' },
      { name: 'Belts & Straps', slug: 'belts-straps' },
      { name: 'Scarves & Bandanas', slug: 'scarves-bandanas' },
    ],
  },
]

const ARTISTS = [
  {
    email: 'artist1@test.ferment.com',
    username: 'ceramics-by-ana',
    tenant: {
      name: 'Ceramics by Ana',
      slug: 'ceramics-by-ana',
      stripe_account_id: 'placeholder_ceramics-by-ana',
    },
  },
  {
    email: 'artist2@test.ferment.com',
    username: 'woodworks-jan',
    tenant: {
      name: 'Woodworks Jan',
      slug: 'woodworks-jan',
      stripe_account_id: 'placeholder_woodworks-jan',
    },
  },
  {
    email: 'artist3@test.ferment.com',
    username: 'print-studio-mia',
    tenant: {
      name: 'Print Studio Mia',
      slug: 'print-studio-mia',
      stripe_account_id: 'placeholder_print-studio-mia',
    },
  },
]

// ── Seed functions ──────────────────────────────────────────────────────────

async function seedAdmin(): Promise<string> {
  console.log('\n[Admin]')
  const authId = await getOrCreateAuthUser(
    process.env.SEED_ADMIN_EMAIL!,
    process.env.SEED_ADMIN_PASSWORD!
  )
  await getOrCreatePublicUser(authId, 'admin', 'super-admin')
  return authId
}

async function seedArtists(): Promise<Array<{ userId: string; tenantId: string; slug: string }>> {
  console.log('\n[Artists]')
  const results: Array<{ userId: string; tenantId: string; slug: string }> = []
  for (const artist of ARTISTS) {
    const authId = await getOrCreateAuthUser(
      artist.email,
      process.env.SEED_ARTIST_PASSWORD!
    )
    await getOrCreatePublicUser(authId, artist.username, 'user')
    const tenantId = await getOrCreateBySlug('tenants', artist.tenant.slug, {
      name: artist.tenant.name,
      slug: artist.tenant.slug,
      stripe_account_id: artist.tenant.stripe_account_id,
      status: 'approved', // MUST be 'approved' — 'active' does not exist in the check constraint
      stripe_details_submitted: false,
    })
    await getOrCreateUserTenant(authId, tenantId)
    results.push({ userId: authId, tenantId, slug: artist.tenant.slug })
  }
  return results
}

async function seedCategories(): Promise<Map<string, string>> {
  console.log('\n[Categories]')
  const slugToId = new Map<string, string>()

  // Insert parent categories first (parent_id: null)
  for (const cat of CATEGORY_TAXONOMY) {
    const id = await getOrCreateBySlug('categories', cat.slug, {
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      parent_id: null,
    })
    slugToId.set(cat.slug, id)
  }

  // Then insert subcategories with parent_id resolved
  for (const cat of CATEGORY_TAXONOMY) {
    const parentId = slugToId.get(cat.slug)!
    for (const sub of cat.subcategories) {
      const id = await getOrCreateBySlug('categories', sub.slug, {
        name: sub.name,
        slug: sub.slug,
        color: null,
        parent_id: parentId,
      })
      slugToId.set(sub.slug, id)
    }
  }

  return slugToId
}

async function seedProducts(
  artists: Array<{ userId: string; tenantId: string; slug: string }>,
  categoryMap: Map<string, string>
): Promise<void> {
  console.log('\n[Products]')

  const [ana, jan, mia] = artists

  async function getOrCreateProduct(
    tenantId: string,
    name: string,
    price: number,
    categorySlug: string,
    description: string
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', name)
      .maybeSingle()
    if (existing) { console.log(`  SKIP product: ${name}`); return }
    const { error } = await supabase.from('products').insert({
      name,
      price,
      tenant_id: tenantId,
      category_id: categoryMap.get(categorySlug) ?? null,
      description,
      refund_policy: '30-day',
      is_archived: false,
      is_private: false,
    })
    if (error) throw new Error(`insert product(${name}): ${error.message}`)
    console.log(`  CREATE product: ${name}`)
  }

  // Ceramics by Ana — pottery products
  await getOrCreateProduct(ana.tenantId, 'Handmade Stoneware Mug', 8900, 'mugs-cups', 'Wheel-thrown stoneware mug with blue glaze. Holds 350ml.')
  await getOrCreateProduct(ana.tenantId, 'Ceramic Salad Bowl', 14500, 'bowls-dishes', 'Large ceramic salad bowl with speckled finish.')
  await getOrCreateProduct(ana.tenantId, 'Flower Vase — Tall', 12000, 'vases-planters', 'Tall terracotta vase, matte white glaze, 30cm.')
  await getOrCreateProduct(ana.tenantId, 'Espresso Cup Set (2)', 7800, 'mugs-cups', 'Pair of small espresso cups, 80ml each.')
  await getOrCreateProduct(ana.tenantId, 'Ceramic Side Plate', 5500, 'plates-platters', 'Handmade side plate, 20cm, dishwasher safe.')
  await getOrCreateProduct(ana.tenantId, 'Sculptural Decorative Piece', 19500, 'decorative-pieces', 'Abstract ceramic sculpture for the shelf.')
  await getOrCreateProduct(ana.tenantId, 'Ramen Bowl', 11000, 'bowls-dishes', 'Deep ramen bowl with a navy glaze.')

  // Woodworks Jan — accessories / decorative
  await getOrCreateProduct(jan.tenantId, 'Oak Serving Board', 13500, 'accessories', 'Hand-planed oak cutting and serving board, 40x25cm.')
  await getOrCreateProduct(jan.tenantId, 'Walnut Key Tray', 5900, 'accessories', 'Small walnut tray for keys and coins.')
  await getOrCreateProduct(jan.tenantId, 'Pine Floating Shelf', 8800, 'accessories', '60cm pine shelf with hidden bracket.')
  await getOrCreateProduct(jan.tenantId, 'Beech Wooden Spoon Set', 3500, 'accessories', 'Set of 3 beech spoons, hand-carved.')
  await getOrCreateProduct(jan.tenantId, 'Ash Wood Phone Stand', 4900, 'accessories', 'Minimal desktop phone stand, natural ash.')
  await getOrCreateProduct(jan.tenantId, 'Maple Jewelry Box', 16500, 'accessories', 'Small maple jewelry box with hand-cut dovetail joints.')

  // Print Studio Mia — posters
  await getOrCreateProduct(mia.tenantId, 'Risograph Print — Forest', 6500, 'art-prints', 'A3 risograph print, two-colour forest scene.')
  await getOrCreateProduct(mia.tenantId, 'Typography Poster — Be Here Now', 4900, 'art-prints', 'A2 typographic poster, letterpress style.')
  await getOrCreateProduct(mia.tenantId, 'Photography Print — Gdańsk Dawn', 8900, 'photography-prints', 'Fine art photo print, 50x70cm, signed edition of 30.')
  await getOrCreateProduct(mia.tenantId, 'Vintage Travel Poster — Mazury', 5500, 'vintage-retro', 'A2 vintage-style poster of the Mazury lakeland.')
  await getOrCreateProduct(mia.tenantId, 'Abstract Screenprint No. 7', 11000, 'art-prints', 'Hand-pulled screenprint, A3, edition of 20.')
  await getOrCreateProduct(mia.tenantId, 'Band Poster — Open Format', 3900, 'music-band-posters', 'Gig poster template, A3, offset printed.')
  await getOrCreateProduct(mia.tenantId, 'Zine — Urban Textures Vol. 2', 2500, 'art-prints', 'A5 zine, 32 pages, risograph.')
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Starting seed...')
  await seedAdmin()
  const artists = await seedArtists()
  const categoryMap = await seedCategories()
  await seedProducts(artists, categoryMap)
  console.log('\nSeed complete.')
}

seed()
  .then(() => { process.exit(0) })
  .catch((err: unknown) => { console.error('Seed failed:', err); process.exit(1) })
