-- Phase 3 (P3-M1) — commerce practice domain foundation.
-- Catalogue schema (categories, products, inventory) plus deterministic,
-- synthetic seed data. Money is integer cents. Explicit ids keep the seed
-- reproducible. Shared platform D1 remains an implementation detail; it is
-- never exposed as a user-facing SQL surface.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug = lower(slug)),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT '2026-03-01T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Categories (ids 1-8)
INSERT INTO categories (id, slug, name, description, sort_order) VALUES
  (1, 'camping',     'Camping',          'Tents, shelters and camp kitchen kit',        10),
  (2, 'hiking',      'Hiking & Trekking','Packs, shells and trail footwear',            20),
  (3, 'climbing',    'Climbing',         'Harness, rope, pads and safety kit',          30),
  (4, 'cycling',     'Cycling',          'Helmets, wheels and ride accessories',        40),
  (5, 'water',       'Water Sports',     'Paddling, snorkelling and wetsuits',          50),
  (6, 'fireside',    'Home & Fireside',  'Hearth, candle and wool comforts',            60),
  (7, 'travel',      'Travel',           'Carry-on luggage and journey organisers',     70),
  (8, 'accessories', 'Accessories',      'Everyday carry and field essentials',         80);

-- Products (ids 1-40 active, 41-42 inactive placeholders)
INSERT INTO products (id, slug, name, description, category_id, price_cents, active) VALUES
  (1,  'ridgeline-2-person-tent',    'Ridgeline 2-Person Tent',     'Freestanding 3-season dome tent with taped seams and two vestibules.', 1, 18999, 1),
  (2,  'halcyon-4-season-tent',      'Halcyon 4-Season Tent',       'Bombproof expedition dome for high winds and heavy snow loads.',       1, 34999, 1),
  (3,  'sequoia-sleeping-bag',       'Sequoia Sleeping Bag',        'Down hoodie bag rated to minus 9 degrees, box-wall baffles.',          1, 12950, 1),
  (4,  'traverse-camp-kitchen-set',  'Traverse Camp Kitchen Set',   'Nesting pots, pan and kettle in anodised aluminium for two.',          1, 6490,  1),
  (5,  'ember-led-lantern',          'Ember LED Lantern',           'Rechargeable lantern with dimmable warm LED and hanging loop.',        1, 3299,  1),
  (6,  'meridian-50l-pack',          'Meridian 50L Pack',           'Backpacking pack with pivot hipbelt and rain cover included.',         2, 15400, 1),
  (7,  'ridgeline-trekking-poles',   'Ridgeline Trekking Poles',    'Carbon folding poles with cork grips and carbide tips.',               2, 8990,  1),
  (8,  'tarn-waterproof-shell',      'Tarn Waterproof Shell',       'Three-layer hardshell jacket, taped seams, pit vents.',                2, 17450, 1),
  (9,  'strata-trail-runners',       'Strata Trail Runners',        'Grippy mid-cut trail shoes with rock plate protection.',               2, 13900, 1),
  (10, 'wayfarer-insulated-bottle',  'Wayfarer Insulated Bottle',   'Double-wall bottle that keeps drinks hot or cold for 12 hours.',       2, 2740,  1),
  (11, 'granite-sport-harness',      'Granite Sport Harness',       'Padded sport harness with four gear loops and ice clipper points.',    3, 7490,  1),
  (12, 'pinnacle-dynamic-rope-60m',  'Pinnacle Dynamic Rope 60m',   'Single rope, 9.5mm, dry-treated, with middle mark.',                   3, 18900, 1),
  (13, 'cinder-crash-pad',           'Cinder Crash Pad',            'Hinge-joint bouldering pad with reinforced landing zone.',              3, 15999, 1),
  (14, 'alpine-belay-device',        'Alpine Belay Device',         'Assisted-braking belay and device for sport and multipitch.',          3, 4290,  1),
  (15, 'quartz-chalk-bag',           'Quartz Chalk Bag',            'Stiff-wall chalk bag with brush loop and belt.',                       3, 1890,  1),
  (16, 'veloce-commuter-helmet',     'Veloce Commuter Helmet',      'Lightweight commuter lid with MIPS liner and rear LED.',                4, 6990,  1),
  (17, 'driftline-gravel-frameset',  'Driftline Gravel Frameset',   'Carbon gravel frameset, 12x1.75 thru-axles, internal routing.',        4, 129900,1),
  (18, 'cascade-puncture-proof-tyre','Cascade Puncture-Proof Tyre', '700x35c tyre with aramid belt; reflective sidewall stripe.',          4, 3890,  1),
  (19, 'meridian-saddle-pack-8l',    'Meridian Saddle Pack 8L',     'Waterproof 8 litre seat pack with tool roll and valve.',               4, 3490,  1),
  (20, 'lumen-usb-bike-light-set',   'Lumen USB Bike Light Set',    '900-lumen front and radar-visible rear light set, USB-C.',             4, 4590,  1),
  (21, 'kestrel-dry-bag-20l',        'Kestrel Dry Bag 20L',         'Roll-top dry bag, 20 litres, welded seams, shoulder strap.',           5, 2990,  1),
  (22, 'tidewater-inflatable-sup',   'Tidewater Inflatable SUP',    '10.6ft all-round stand-up paddle board with pump and paddle.',         5, 64900, 1),
  (23, 'riptide-4-3-wetsuit',        'Riptide 4/3 Wetsuit',         '4/3mm chest-zip wetsuit, sealed seams, knee pads.',                     5, 18900, 1),
  (24, 'coralline-snorkel-set',      'Coralline Snorkel Set',       'Tempered snorkelling mask, dry snorkel and mesh bag.',                 5, 5490,  1),
  (25, 'fathom-neoprene-gloves',     'Fathom Neoprene Gloves',      '3mm pre-curved neoprene gloves with glued seams.',                     5, 2790,  1),
  (26, 'hearthside-enamel-kettle',   'Hearthside Enamel Kettle',    'Whistling 2-litre kettle in speckled cream enamel.',                   6, 3990,  1),
  (27, 'cinder-stack-wood-carrier',  'Cinder Stack Wood Carrier',   'Split-grip log carrier with waxed canvas and leather handles.',        6, 6490,  1),
  (28, 'emberwick-candle-no-4',      'Emberwick Candle No. 4',      'Soy candle, cedar and smoked amber, 55 hour burn.',                    6, 2450,  1),
  (29, 'woolgather-wool-throw',      'Woolgather Wool Throw',       'Washed woven wool throw, 130x170cm, oatmeal.',                         6, 11900, 1),
  (30, 'tinderbox-firesteel-kit',    'Tinderbox Firesteel Kit',     'Ferrocerium rod, striker and dry tinder in a brass tin.',              6, 1590,  1),
  (31, 'passport-rfid-wallet',       'Passport RFID Wallet',        'Bifold travel wallet with RFID shield and passport sleeve.',           7, 3250,  1),
  (32, 'layover-packing-cubes-set',  'Layover Packing Cubes Set',   'Three compression cubes in recycled ripstop.',                         7, 2790,  1),
  (33, 'transit-40l-carry-on',       'Transit 40L Carry-On',        '40-litre clamshell carry-on with lockable zips and coat strap.',       7, 13400, 1),
  (34, 'jetlag-sleep-kit',           'Jetlag Sleep Kit',            'Silk mask, earplugs and travel pillow in a cotton pouch.',             7, 4790,  1),
  (35, 'meridian-travel-towel',      'Meridian Travel Towel',       'Quick-dry microfibre towel, large, with hanging loop.',                7, 2190,  1),
  (36, 'wayfinder-field-notebook',   'Wayfinder Field Notebook',    'All-weather notebook, waterproof paper, dot grid.',                    8, 1450,  1),
  (37, 'northbound-enamel-mug',      'Northbound Enamel Mug',       '350ml enamel mug with rolled rim, slate blue.',                        8, 1250,  1),
  (38, 'foundry-multi-tool',         'Foundry Multi-Tool',          '14-function stainless multi-tool with lockable blades.',               8, 5490,  1),
  (39, 'aurora-reflective-cap',      'Aurora Reflective Cap',       'Six-panel cap with 360-degree reflective piping.',                     8, 1890,  1),
  (40, 'sundrift-pocket-compass',    'Sundrift Pocket Compass',     'Liquid-damped pocket compass with declination scale.',                 8, 2250,  1),
  (41, 'nightbeam-legacy-torch',     'Nightbeam Legacy Torch',      'Discontinued aluminium torch, kept for historical orders only.',       1, 2990,  0),
  (42, 'expedition-map-case',        'Expedition Map Case',         'Discontinued waxed map case from the old catalogue.',                  7, 1950,  0);

-- Inventory (quantities deterministic; two out-of-stock, several low-stock)
INSERT INTO inventory (product_id, quantity, low_stock_threshold) VALUES
  (1, 24, 5), (2, 12, 5), (3, 30, 5), (4, 48, 5), (5, 4, 5),
  (6, 20, 5), (7, 26, 5), (8, 15, 5), (9, 8, 10), (10, 60, 5),
  (11, 18, 5), (12, 10, 5), (13, 7, 5), (14, 40, 5), (15, 55, 5),
  (16, 22, 5), (17, 0, 5), (18, 36, 5), (19, 28, 5), (20, 4, 5),
  (21, 3, 5), (22, 6, 5), (23, 9, 5), (24, 33, 5), (25, 44, 5),
  (26, 25, 5), (27, 19, 5), (28, 70, 5), (29, 14, 5), (30, 80, 5),
  (31, 50, 5), (32, 38, 5), (33, 16, 5), (34, 0, 5), (35, 42, 5),
  (36, 90, 5), (37, 65, 5), (38, 5, 5), (39, 58, 5), (40, 47, 5),
  (41, 100, 5), (42, 100, 5);

UPDATE app_meta
SET value = '2', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE key = 'schema_version';
