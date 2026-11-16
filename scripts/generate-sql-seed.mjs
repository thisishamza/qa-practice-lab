#!/usr/bin/env node
// Generates the canonical Meridian Outfitters practice snapshot for Phase 6.
//
// Deterministic: mulberry32(20261117) + explicit ids. Re-running produces a
// byte-identical file (a test enforces this). The output is committed at
// public/datasets/meridian-outfitters.sql and MUST NOT be hand-edited — edit
// the generator instead.
//
//    node scripts/generate-sql-seed.mjs            # write the seed file
//    node scripts/generate-sql-seed.mjs --check    # byte-compare, no write
//
// The same builder is exported for the seed-integrity test so generation and
// verification can never drift apart.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SEED = 20261117
export const SEED_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'datasets', 'meridian-outfitters.sql')

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const int = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const shuffle = (arr) => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const pad = (n, w) => String(n).padStart(w, '0')

/** ISO-8601 UTC with second precision, e.g. 2026-04-21T09:14:38Z */
function iso(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000)
}
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000)
}
const BASE = new Date('2025-06-01T00:00:00Z')
const END = new Date('2026-11-10T00:00:00Z')
const STALE_BEFORE = new Date('2026-10-17T00:00:00Z')
const RECENT_AFTER = new Date('2026-09-01T00:00:00Z')

const DAY_MS = 86_400_000
const spanDays = Math.round((END.getTime() - BASE.getTime()) / DAY_MS)

// ---------------------------------------------------------------------------
// Catalogue — mirrors the platform shop exactly (categories 1-8, products 1-42)
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  [1, 'camping', 'Camping', 'Tents, shelters and camp kitchen kit', 10],
  [2, 'hiking', 'Hiking & Trekking', 'Packs, shells and trail footwear', 20],
  [3, 'climbing', 'Climbing', 'Harness, rope, pads and safety kit', 30],
  [4, 'cycling', 'Cycling', 'Helmets, wheels and ride accessories', 40],
  [5, 'water', 'Water Sports', 'Paddling, snorkelling and wetsuits', 50],
  [6, 'fireside', 'Home & Fireside', 'Hearth, candle and wool comforts', 60],
  [7, 'travel', 'Travel', 'Carry-on luggage and journey organisers', 70],
  [8, 'accessories', 'Accessories', 'Everyday carry and field essentials', 80],
]

export const PRODUCTS = [
  [1, 'ridgeline-2-person-tent', 'Ridgeline 2-Person Tent', 'Freestanding 3-season dome tent with taped seams and two vestibules.', 1, 18999, 1],
  [2, 'halcyon-4-season-tent', 'Halcyon 4-Season Tent', 'Bombproof expedition dome for high winds and heavy snow loads.', 1, 34999, 1],
  [3, 'sequoia-sleeping-bag', 'Sequoia Sleeping Bag', 'Down hoodie bag rated to minus 9 degrees, box-wall baffles.', 1, 12950, 1],
  [4, 'traverse-camp-kitchen-set', 'Traverse Camp Kitchen Set', 'Nesting pots, pan and kettle in anodised aluminium for two.', 1, 6490, 1],
  [5, 'ember-led-lantern', 'Ember LED Lantern', 'Rechargeable lantern with dimmable warm LED and hanging loop.', 1, 3299, 1],
  [6, 'meridian-50l-pack', 'Meridian 50L Pack', 'Backpacking pack with pivot hipbelt and rain cover included.', 2, 15400, 1],
  [7, 'ridgeline-trekking-poles', 'Ridgeline Trekking Poles', 'Carbon folding poles with cork grips and carbide tips.', 2, 8990, 1],
  [8, 'tarn-waterproof-shell', 'Tarn Waterproof Shell', 'Three-layer hardshell jacket, taped seams, pit vents.', 2, 17450, 1],
  [9, 'strata-trail-runners', 'Strata Trail Runners', 'Grippy mid-cut trail shoes with rock plate protection.', 2, 13900, 1],
  [10, 'wayfarer-insulated-bottle', 'Wayfarer Insulated Bottle', 'Double-wall bottle that keeps drinks hot or cold for 12 hours.', 2, 2740, 1],
  [11, 'granite-sport-harness', 'Granite Sport Harness', 'Padded sport harness with four gear loops and ice clipper points.', 3, 7490, 1],
  [12, 'pinnacle-dynamic-rope-60m', 'Pinnacle Dynamic Rope 60m', 'Single rope, 9.5mm, dry-treated, with middle mark.', 3, 18900, 1],
  [13, 'cinder-crash-pad', 'Cinder Crash Pad', 'Hinge-joint bouldering pad with reinforced landing zone.', 3, 15999, 1],
  [14, 'alpine-belay-device', 'Alpine Belay Device', 'Assisted-braking belay and device for sport and multipitch.', 3, 4290, 1],
  [15, 'quartz-chalk-bag', 'Quartz Chalk Bag', 'Stiff-wall chalk bag with brush loop and belt.', 3, 1890, 1],
  [16, 'veloce-commuter-helmet', 'Veloce Commuter Helmet', 'Lightweight commuter lid with MIPS liner and rear LED.', 4, 6990, 1],
  [17, 'driftline-gravel-frameset', 'Driftline Gravel Frameset', 'Carbon gravel frameset, 12x1.75 thru-axles, internal routing.', 4, 129900, 1],
  [18, 'cascade-puncture-proof-tyre', 'Cascade Puncture-Proof Tyre', '700x35c tyre with aramid belt; reflective sidewall stripe.', 4, 3890, 1],
  [19, 'meridian-saddle-pack-8l', 'Meridian Saddle Pack 8L', 'Waterproof 8 litre seat pack with tool roll and valve.', 4, 3490, 1],
  [20, 'lumen-usb-bike-light-set', 'Lumen USB Bike Light Set', '900-lumen front and radar-visible rear light set, USB-C.', 4, 4590, 1],
  [21, 'kestrel-dry-bag-20l', 'Kestrel Dry Bag 20L', 'Roll-top dry bag, 20 litres, welded seams, shoulder strap.', 5, 2990, 1],
  [22, 'tidewater-inflatable-sup', 'Tidewater Inflatable SUP', '10.6ft all-round stand-up paddle board with pump and paddle.', 5, 64900, 1],
  [23, 'riptide-4-3-wetsuit', 'Riptide 4/3 Wetsuit', '4/3mm chest-zip wetsuit, sealed seams, knee pads.', 5, 18900, 1],
  [24, 'coralline-snorkel-set', 'Coralline Snorkel Set', 'Tempered snorkelling mask, dry snorkel and mesh bag.', 5, 5490, 1],
  [25, 'fathom-neoprene-gloves', 'Fathom Neoprene Gloves', '3mm pre-curved neoprene gloves with glued seams.', 5, 2790, 1],
  [26, 'hearthside-enamel-kettle', 'Hearthside Enamel Kettle', 'Whistling 2-litre kettle in speckled cream enamel.', 6, 3990, 1],
  [27, 'cinder-stack-wood-carrier', 'Cinder Stack Wood Carrier', 'Split-grip log carrier with waxed canvas and leather handles.', 6, 6490, 1],
  [28, 'emberwick-candle-no-4', 'Emberwick Candle No. 4', 'Soy candle, cedar and smoked amber, 55 hour burn.', 6, 2450, 1],
  [29, 'woolgather-wool-throw', 'Woolgather Wool Throw', 'Washed woven wool throw, 130x170cm, oatmeal.', 6, 11900, 1],
  [30, 'tinderbox-firesteel-kit', 'Tinderbox Firesteel Kit', 'Ferrocerium rod, striker and dry tinder in a brass tin.', 6, 1590, 1],
  [31, 'passport-rfid-wallet', 'Passport RFID Wallet', 'Bifold travel wallet with RFID shield and passport sleeve.', 7, 3250, 1],
  [32, 'layover-packing-cubes-set', 'Layover Packing Cubes Set', 'Three compression cubes in recycled ripstop.', 7, 2790, 1],
  [33, 'transit-40l-carry-on', 'Transit 40L Carry-On', '40-litre clamshell carry-on with lockable zips and coat strap.', 7, 13400, 1],
  [34, 'jetlag-sleep-kit', 'Jetlag Sleep Kit', 'Silk mask, earplugs and travel pillow in a cotton pouch.', 7, 4790, 1],
  [35, 'meridian-travel-towel', 'Meridian Travel Towel', 'Quick-dry microfibre towel, large, with hanging loop.', 7, 2190, 1],
  [36, 'wayfinder-field-notebook', 'Wayfinder Field Notebook', 'All-weather notebook, waterproof paper, dot grid.', 8, 1450, 1],
  [37, 'northbound-enamel-mug', 'Northbound Enamel Mug', '350ml enamel mug with rolled rim, slate blue.', 8, 1250, 1],
  [38, 'foundry-multi-tool', 'Foundry Multi-Tool', '14-function stainless multi-tool with lockable blades.', 8, 5490, 1],
  [39, 'aurora-reflective-cap', 'Aurora Reflective Cap', 'Six-panel cap with 360-degree reflective piping.', 8, 1890, 1],
  [40, 'sundrift-pocket-compass', 'Sundrift Pocket Compass', 'Liquid-damped pocket compass with declination scale.', 8, 2250, 1],
  [41, 'nightbeam-legacy-torch', 'Nightbeam Legacy Torch', 'Discontinued aluminium torch, kept for historical orders only.', 1, 2990, 0],
  [42, 'expedition-map-case', 'Expedition Map Case', 'Discontinued waxed map case from the old catalogue.', 7, 1950, 0],
]

const INVENTORY = [
  [1, 24, 5], [2, 12, 5], [3, 30, 5], [4, 48, 5], [5, 4, 5],
  [6, 20, 5], [7, 26, 5], [8, 15, 5], [9, 8, 10], [10, 60, 5],
  [11, 18, 5], [12, 10, 5], [13, 7, 5], [14, 40, 5], [15, 55, 5],
  [16, 22, 5], [17, 0, 5], [18, 36, 5], [19, 28, 5], [20, 4, 5],
  [21, 3, 5], [22, 6, 5], [23, 9, 5], [24, 33, 5], [25, 44, 5],
  [26, 25, 5], [27, 19, 5], [28, 70, 5], [29, 14, 5], [30, 80, 5],
  [31, 50, 5], [32, 38, 5], [33, 16, 5], [34, 0, 5], [35, 42, 5],
  [36, 90, 5], [37, 65, 5], [38, 5, 5], [39, 58, 5], [40, 47, 5],
  [41, 100, 5], [42, 100, 5],
]

const PRODUCT_PRICE = new Map(PRODUCTS.map(([id, , , , , price]) => [id, price]))

// ---------------------------------------------------------------------------
// Customers (ids 1001-1118) and addresses (~150 rows)
// ---------------------------------------------------------------------------
const FIRST = [
  'Amara', 'Liam', 'Sofia', 'Noah', 'Priya', 'Ethan', 'Maya', 'Jonas', 'Ines', 'Theo',
  'Nora', 'Owen', 'Lena', 'Marcus', 'Chloe', 'Dev', 'Ruth', 'Sam', 'Talia', 'Victor',
  'Wren', 'Yara', 'Zach', 'Ingrid', 'Kofi', 'Leila', 'Milo', 'Nia', 'Oscar', 'Petra',
  'Quinn', 'Ravi', 'Selin', 'Tomas', 'Uma', 'Vera', 'Willa', 'Yusuf', 'Zoe', 'Andre',
  'Bea', 'Caleb', 'Dana', 'Elias', 'Farrah', 'Gideon', 'Hana', 'Idris',
]
const LAST = [
  'Okafor', 'Tremblay', 'Nguyen', 'Haddad', 'Nair', 'Lindqvist', 'Moreau', 'Popov', 'Silva', 'Kowalski',
  'Chen', 'Aydin', 'Ferraro', 'Mensah', 'Ito', 'Castellano', 'Osei', 'Dubois', 'Rahman', 'Novak',
  'Ali', 'Bergstrom', 'Costa', 'Demir', 'Ellison', 'Fontaine', 'Gupta', 'Herrera', 'Ilic', 'Jansen',
  'Kaminski', 'Lopez', 'Marchetti', 'Ndiaye', 'Osman', 'Petrov', 'Quintero', 'Reyes', 'Schmidt', 'Tanaka',
  'Usman', 'Vasquez', 'Williams', 'Yilmaz', 'Zhang', 'Abara', 'Beckett', 'Castillo',
]

function buildCustomers() {
  const pairs = []
  const seen = new Set()
  const combos = shuffle(FIRST.flatMap((f) => LAST.map((l) => [f, l])))
  for (const [f, l] of combos) {
    const key = `${f} ${l}`
    if (!seen.has(key)) {
      seen.add(key)
      pairs.push([f, l])
    }
    if (pairs.length >= 118) break
  }
  const customers = pairs.map(([first, last], i) => {
    const id = 1001 + i
    const local = `${first.toLowerCase()}.${last.toLowerCase()}`
    return { id, first, last, email: `${local}@example.com`, phone: null, tier: null, status: 'active', optIn: 0, createdAt: null, _local: local }
  })
  // Uniquify emails deterministically before the deliberate anomalies.
  const emailCount = new Map()
  for (const c of customers) {
    const base = c.email
    const count = emailCount.get(base) ?? 0
    emailCount.set(base, count + 1)
    if (count > 0) {
      c.email = `${c._local}${count + 1}@example.com`
    }
  }
  // DQ-03: case-variant duplicates (binary UNIQUE still allows them).
  customers[0].email = 'amara.okafor@example.com'
  customers[1].email = 'Amara.Okafor@example.com'
  // Restore coherent identity for those two.
  customers[0].first = 'Amara'; customers[0].last = 'Okafor'
  customers[1].first = 'Amara'; customers[1].last = 'Okafor'
  // DQ-04: same full name, different emails.
  customers[9].first = 'Priya'; customers[9].last = 'Nair'
  customers[9].email = 'priya.nair@example.com'
  customers[10].first = 'Priya'; customers[10].last = 'Nair'
  customers[10].email = 'priya.nair29@example.com'
  // DQ-09: gold tier with near-zero lifetime spend (zero orders, enforced in buildOrders).
  customers[7].tier = 'gold'
  // Suspended accounts (kept rare and realistic).
  const suspendedIds = new Set([1003, 1027, 1080, 1101])
  // Phones: ~15% NULL; mixed formats (DQ-11).
  const phoneFormats = [
    (n) => `+1-555-${pad(n, 4)}`,
    (n) => `(555) ${pad(Math.floor(n / 100), 3)}-${pad(n % 100, 2)}00`,
    (n) => `555-${pad(n, 4)}-${pad(n * 7 % 10000, 4)}`,
  ]
  let phoneSeq = 100
  for (const c of customers) {
    if (suspendedIds.has(c.id)) c.status = 'suspended'
    if (rand() < 0.15) {
      c.phone = null
    } else {
      c.phone = pick(phoneFormats)(phoneSeq)
      phoneSeq += int(3, 17)
    }
    c.tier = c.tier ?? (rand() < 0.6 ? 'bronze' : rand() < 0.78 ? 'silver' : 'gold')
    c.optIn = rand() < 0.45 ? 1 : 0
    c.createdAt = iso(addDays(new Date('2024-01-15T00:00:00Z'), Math.floor(rand() * 999)))
  }
  // DQ-10: opted-in customers with NO address rows.
  for (const idx of [14, 15, 16]) customers[idx].optIn = 1
  // DQ-09 customer must not earn orders: mark with zero-order flag via id.
  return customers
}

const CUSTOMERS = buildCustomers()
const ZERO_ORDER_CUSTOMER_IDS = new Set([1008]) // DQ-09: gold, no orders
const NO_ADDRESS_CUSTOMER_IDS = new Set([1015, 1016, 1017]) // DQ-10

function buildAddresses() {
  const streets = ['Maple Ridge Rd', 'Harbour View Ave', 'Cedar Hollow Ln', 'Northgate Blvd', 'Birchwood Ave', 'Saltworks Rd', 'Juniper St', 'Fieldstone Dr', 'Old Mill Rd', 'Lakeshore Pkwy']
  const cities = ['Toronto', 'Ottawa', 'Vancouver', 'Montreal', 'Calgary', 'Halifax', 'Edmonton', 'Winnipeg', 'Quebec City', 'Victoria']
  const regions = ['ON', 'ON', 'ON', 'QC', 'BC', 'AB', 'NS', 'MB', 'BC', 'ON']
  const addresses = []
  let id = 3001
  let di = 0
  for (const c of CUSTOMERS) {
    if (NO_ADDRESS_CUSTOMER_IDS.has(c.id)) continue
    const base = di
    const line1 = `${120 + (base * 37 % 880)} ${streets[base % streets.length]}`
    addresses.push({
      id,
      customerId: c.id,
      line1,
      line2: rand() < 0.22 ? `Unit ${int(2, 1209)}` : null,
      city: cities[base % cities.length],
      region: regions[base % regions.length],
      postal: `M${int(0, 9)}${String.fromCharCode(65 + int(0, 25))} ${int(1, 9)}${String.fromCharCode(65 + int(0, 25))}${int(1, 9)}`,
      country: 'CA',
      isDefault: 1,
    })
    id += 1
    di += 1
    if (rand() < 0.32) {
      addresses.push({
        id,
        customerId: c.id,
        line1: `${int(10, 980)} ${streets[(base + 5) % streets.length]}`,
        line2: null,
        city: cities[(base + 3) % cities.length],
        region: regions[(base + 3) % regions.length],
        postal: `M${int(0, 9)}${String.fromCharCode(65 + int(0, 25))} ${int(1, 9)}${String.fromCharCode(65 + int(0, 25))}${int(1, 9)}`,
        country: 'CA',
        isDefault: 0,
      })
      id += 1
    }
  }
  return addresses
}

const ADDRESSES = buildAddresses()
const ADDRESS_ID_FOR_CUSTOMER = new Map()
for (const a of ADDRESSES) {
  if (a.isDefault === 1 && !ADDRESS_ID_FOR_CUSTOMER.has(a.customerId)) {
    ADDRESS_ID_FOR_CUSTOMER.set(a.customerId, a.id)
  }
}

// ---------------------------------------------------------------------------
// Orders, order items and payments (ids 5001-5224 / items 90001- / payments 8001-)
// ---------------------------------------------------------------------------
const STATUS_PLAN = [
  ...Array(125).fill('delivered'),
  ...Array(22).fill('shipped'),
  ...Array(27).fill('placed'),
  ...Array(18).fill('pending'),
  ...Array(32).fill('cancelled'),
]

function buildOrders() {
  const statuses = shuffle(STATUS_PLAN)
  // DQ-05: force 8 pending/placed orders to be stale (> 30 days before 2026-11-10).
  const pendingIdx = []
  statuses.forEach((s, i) => { if (s === 'pending' || s === 'placed') pendingIdx.push(i) })
  const staleIdx = new Set(pendingIdx.slice(0, 8))
  // Eligible customers for orders (zero-order DQ-09 excluded).
  const eligible = CUSTOMERS.filter((c) => !ZERO_ORDER_CUSTOMER_IDS.has(c.id))
  // DQ-12: 4 duplicated day+total pairs — reserve twin slots at the end.
  const orders = []
  let id = 5001
  const orderCount = statuses.length
  for (let i = 0; i < orderCount; i += 1) {
    const customer = eligible[Math.floor(rand() * eligible.length)]
    const status = statuses[i]
    let placedAt
    if (staleIdx.has(i)) {
      placedAt = addDays(STALE_BEFORE, -int(1, 70))
    } else if (status === 'pending' || status === 'placed') {
      // Keep the pipeline mixed: a stale tail plus a recent cohort.
      placedAt = addDays(STALE_BEFORE, int(1, 24))
    } else {
      placedAt = addDays(BASE, Math.floor(rand() * spanDays))
    }
    orders.push({ id, customerId: customer.id, status, placedAt, _seq: i })
    // Item ids are assigned in the items builder; nothing to track here.
    id += 1
  }
  // Order numbers per calendar year.
  const perYear = { 2025: 0, 2026: 0 }
  for (const o of orders) {
    const year = o.placedAt.getUTCFullYear()
    perYear[year] += 1
    o.orderNumber = `MO-${year}-${pad(perYear[year], 4)}`
  }
  // DQ-12: duplicate 4 orders — same customer, same placed day, same totals.
  // Appended as twins reusing values from earlier orders (same customer/day/total).
  const twinSources = [orders[10], orders[60], orders[120], orders[180]]
  const twins = twinSources.map((src) => {
    const twin = { ...src, id, _twinOf: src, _seq: orders.length }
    return twin
  })
  // Keep numbers honest: twin numbers share the sequence prefix but remain unique.
  twins.forEach((t) => {
    perYear[t.placedAt.getUTCFullYear()] += 1
    t.orderNumber = `MO-${t.placedAt.getUTCFullYear()}-${pad(perYear[t.placedAt.getUTCFullYear()], 4)}`
  })
  const allOrders = [...orders, ...twins]
  allOrders.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime() || a.id - b.id)
  // Re-id in chronological order for tidiness and keep twins distinct.
  allOrders.forEach((o, i) => { o.id = 5001 + i })
  return allOrders
}

const ORDERS = buildOrders()

function buildOrderItemsAndTotals() {
  let itemId = 90001
  const items = []
  for (const order of ORDERS) {
    if (order._twinOf) continue // DQ-12 twins inherit their source's items exactly
    const lineCount = weightedLineCount()
    const chosen = shuffle([...PRODUCT_PRICE.keys()]).slice(0, lineCount)
    for (const productId of chosen) {
      const qty = int(1, 3)
      const unit = PRODUCT_PRICE.get(productId)
      items.push({
        id: itemId, orderId: order.id, productId,
        snapshot: nameOfProduct(productId),
        unitPrice: unit, qty,
        lineTotal: unit * qty, // corrected below for DQ-01
        _productId: productId,
      })
      itemId += 1
    }
  }
  // DQ-08: guarantee recent orders reference the two zero-stock products.
  const recent = ORDERS.filter((o) => o.placedAt >= RECENT_AFTER)
  let dq8 = 0
  for (const productId of [17, 34]) {
    for (let k = 0; k < 3; k += 1) {
      const order = recent[(dq8 + k * 7) % recent.length]
      items.push({
        id: itemId, orderId: order.id, productId,
        snapshot: nameOfProduct(productId),
        unitPrice: PRODUCT_PRICE.get(productId), qty: 1,
        lineTotal: PRODUCT_PRICE.get(productId),
        _productId: productId,
      })
      itemId += 1
    }
    dq8 += 1
  }
  // DQ-12: clone the source orders' line items into the twins so the pair
  // shares customer, placed day and full economics (same customer/day/total).
  let maxItemId = items.reduce((m, i) => Math.max(m, i.id), 0)
  for (const order of ORDERS) {
    if (!order._twinOf) continue
    const srcItems = items.filter((i) => i.orderId === order._twinOf.id)
    for (const si of srcItems) {
      maxItemId += 1
      items.push({ ...si, id: maxItemId, orderId: order.id })
    }
  }
  // DQ-01: corrupt ~10 line_total_cents to the unit price (quantity ignored).
  const corruptIdx = new Set([3, 17, 41, 77, 129, 205, 263, 331, 402, 480])
  items.forEach((item, i) => {
    if (corruptIdx.has(i)) item.lineTotal = item.unitPrice
  })
  return items
}

function weightedLineCount() {
  const r = rand()
  if (r < 0.2) return 1
  if (r < 0.5) return 2
  if (r < 0.75) return 3
  if (r < 0.9) return 4
  return 5
}

function nameOfProduct(productId) {
  return PRODUCTS.find(([id]) => id === productId)[2]
}

const ITEMS = buildOrderItemsAndTotals()

function computeTotals() {
  const sums = new Map()
  for (const item of ITEMS) {
    // DQ-01 keeps stored line totals corruptible; reconcile from CORRECT math.
    sums.set(item.orderId, (sums.get(item.orderId) ?? 0) + item.unitPrice * item.qty)
  }
  for (const order of ORDERS) {
    const subtotal = sums.get(order.id) ?? 0
    const shipping = subtotal >= 7500 ? 0 : 699
    const tax = Math.round(subtotal * 0.08)
    order.subtotal = subtotal
    order.shipping = shipping
    order.tax = tax
    order.total = subtotal + shipping + tax
  }
  // DQ-02: corrupt 6 order totals by non-round deltas.
  const deltas = [249, -199, 1100, -5300, 125, -70]
  const targetIdx = [5, 30, 88, 140, 199, 214]
  targetIdx.forEach((idx, i) => { ORDERS[idx].total += deltas[i] })
}

computeTotals()

function buildPayments() {
  let id = 8001
  let refSeq = 1
  const payments = []
  const cancelled = ORDERS.filter((o) => o.status === 'cancelled')
  const dq06 = new Set(cancelled.slice(0, 5).map((o) => o.id)) // cancelled but unrefunded (DQ-06)
  const dq07Idx = [11, 44, 95, 160, 205, 219] // delivered orders with wrong amounts (DQ-07)
  const dq07Set = new Set(ORDERS.filter((_, i) => dq07Idx.includes(i)).map((o) => o.id))
  for (const order of ORDERS) {
    let status
    if (order.status === 'cancelled') status = dq06.has(order.id) ? 'approved' : 'refunded'
    else if (order.status === 'pending') status = 'pending'
    else status = 'approved'
    let amount = order.total
    if (dq07Set.has(order.id)) {
      amount = ORDERS.indexOf(order) % 3 === 0 ? Math.round(order.total * 0.5) : order.total - (50 + (order.id * 37) % 351)
    }
    payments.push({
      id, orderId: order.id, method: pick(['card', 'card', 'card', 'bank_transfer', 'gift_card']),
      status, amount,
      providerRef: `pi_synthetic_${pad(refSeq, 6)}`,
      processedAt: iso(addMinutes(order.placedAt, int(2, 95))),
    })
    id += 1
    refSeq += 1
  }
  return payments
}

const PAYMENTS = buildPayments()

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const esc = (s) => s.replace(/'/g, "''")
const t = (v) => (v === null || v === undefined ? 'NULL' : `'${esc(String(v))}'`)
const n = (v) => String(v)

function insert(table, columns, rows, tuple) {
  const chunks = [`INSERT INTO ${table} (${columns.join(', ')}) VALUES`]
  rows.forEach((row, i) => {
    chunks.push(`${i === 0 ? '  ' : ', '}(${tuple(row)})${i === rows.length - 1 ? ';' : ''}`)
  })
  return chunks.join('\n')
}

export function buildSeedSql() {
  const out = []
  out.push('-- Meridian Outfitters — Phase 6 practice snapshot (CANONICAL).')
  out.push('-- Generated by scripts/generate-sql-seed.mjs (mulberry32 seed 20261117).')
  out.push('-- Do not edit by hand; edit the generator. All data is synthetic.')
  out.push('-- Structural integrity (PK/FK/UNIQUE/NOT NULL/CHECK) holds; logical')
  out.push('-- anomalies (DQ-01..DQ-12) are intentional teaching artefacts.')
  out.push('PRAGMA foreign_keys = ON;')
  out.push('')
  out.push('BEGIN;')
  out.push('')
  out.push(`CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);`)
  out.push('')
  out.push(`CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT '2026-03-01T00:00:00Z'
);`)
  out.push('')
  out.push(`CREATE TABLE inventory (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0)
);`)
  out.push('')
  out.push(`CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  loyalty_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
  created_at TEXT NOT NULL
);`)
  out.push('')
  out.push(`CREATE TABLE addresses (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL CHECK (length(postal_code) BETWEEN 3 AND 12),
  country TEXT NOT NULL DEFAULT 'CA',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
);`)
  out.push('')
  out.push('CREATE UNIQUE INDEX idx_addresses_one_default ON addresses(customer_id) WHERE is_default = 1;')
  out.push('')
  out.push(`CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  shipping_address_id INTEGER REFERENCES addresses(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'placed', 'shipped', 'delivered', 'cancelled')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  placed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);`)
  out.push('')
  out.push(`CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
);`)
  out.push('')
  out.push(`CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('card', 'bank_transfer', 'gift_card')),
  status TEXT NOT NULL CHECK (status IN ('approved', 'declined', 'refunded', 'pending')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  provider_ref TEXT NOT NULL UNIQUE,
  processed_at TEXT NOT NULL
);`)
  out.push('')
  out.push('CREATE INDEX idx_products_category ON products(category_id);')
  out.push('CREATE INDEX idx_products_active ON products(active);')
  out.push('CREATE INDEX idx_orders_customer ON orders(customer_id);')
  out.push('CREATE INDEX idx_orders_status ON orders(status);')
  out.push('CREATE INDEX idx_orders_placed_at ON orders(placed_at);')
  out.push('CREATE INDEX idx_order_items_order ON order_items(order_id);')
  out.push('CREATE INDEX idx_order_items_product ON order_items(product_id);')
  out.push('CREATE INDEX idx_payments_order ON payments(order_id);')
  out.push('CREATE INDEX idx_payments_status ON payments(status);')
  out.push('CREATE INDEX idx_addresses_customer ON addresses(customer_id);')
  out.push('')

  out.push(insert('categories', ['id', 'slug', 'name', 'description', 'sort_order'], CATEGORIES,
    (r) => [n(r[0]), t(r[1]), t(r[2]), t(r[3]), n(r[4])].join(', ')))
  out.push('')
  out.push(insert('products', ['id', 'slug', 'name', 'description', 'category_id', 'price_cents', 'active'], PRODUCTS,
    (r) => [n(r[0]), t(r[1]), t(r[2]), t(r[3]), n(r[4]), n(r[5]), n(r[6])].join(', ')))
  out.push('')
  out.push(insert('inventory', ['product_id', 'quantity', 'low_stock_threshold'], INVENTORY,
    (r) => r.map(n).join(', ')))
  out.push('')
  out.push(insert('customers', ['id', 'email', 'first_name', 'last_name', 'phone', 'loyalty_tier', 'status', 'marketing_opt_in', 'created_at'], CUSTOMERS,
    (c) => [n(c.id), t(c.email), t(c.first), t(c.last), c.phone === null ? 'NULL' : t(c.phone), t(c.tier), t(c.status), n(c.optIn), t(c.createdAt)].join(', ')))
  out.push('')
  out.push(insert('addresses', ['id', 'customer_id', 'line1', 'line2', 'city', 'region', 'postal_code', 'country', 'is_default'], ADDRESSES,
    (a) => [n(a.id), n(a.customerId), t(a.line1), a.line2 === null ? 'NULL' : t(a.line2), t(a.city), t(a.region), t(a.postal), t(a.country), n(a.isDefault)].join(', ')))
  out.push('')
  out.push(insert('orders', ['id', 'order_number', 'customer_id', 'shipping_address_id', 'status', 'subtotal_cents', 'shipping_cents', 'tax_cents', 'total_cents', 'placed_at', 'created_at'], ORDERS,
    (o) => [n(o.id), t(o.orderNumber), n(o.customerId), ADDRESS_ID_FOR_CUSTOMER.has(o.customerId) ? n(ADDRESS_ID_FOR_CUSTOMER.get(o.customerId)) : 'NULL', t(o.status), n(o.subtotal), n(o.shipping), n(o.tax), n(o.total), t(iso(o.placedAt)), t(iso(o.placedAt))].join(', ')))
  out.push('')
  out.push(insert('order_items', ['id', 'order_id', 'product_id', 'product_name_snapshot', 'unit_price_cents', 'quantity', 'line_total_cents'], ITEMS,
    (i2) => [n(i2.id), n(i2.orderId), n(i2.productId), t(i2.snapshot), n(i2.unitPrice), n(i2.qty), n(i2.lineTotal)].join(', ')))
  out.push('')
  out.push(insert('payments', ['id', 'order_id', 'method', 'status', 'amount_cents', 'provider_ref', 'processed_at'], PAYMENTS,
    (p) => [n(p.id), n(p.orderId), t(p.method), t(p.status), n(p.amount), t(p.providerRef), t(p.processedAt)].join(', ')))
  out.push('')
  out.push('COMMIT;')
  out.push('')
  return out.join('\n')
}

function main() {
  const check = process.argv.includes('--check')
  const sql = buildSeedSql()
  if (check) {
    let current = null
    try {
      current = readFileSync(SEED_PATH, 'utf8')
    } catch { /* missing file */ }
    if (current === sql) {
      console.log('seed up to date')
      return
    }
    console.error('seed OUT OF DATE — run: node scripts/generate-sql-seed.mjs')
    process.exit(1)
  }
  writeFileSync(SEED_PATH, sql)
  const kb = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1)
  console.log(`wrote ${SEED_PATH} (${kb} KB)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
