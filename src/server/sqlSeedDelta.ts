// SQL hunt corruption deltas (Phase 6 M2, plan §5.5, §9) — SERVER ONLY.
//
// One delta per hunt-db-* hunt. Compiled constants — no string interpolation
// from any request path, no randomness; identical for every learner. Applied
// in the browser sandbox over a fresh canonical reseed, only in bug-hunt mode
// for a registered SQL hunt, and only after the start endpoint created the
// attempt. Never applied to D1, never shipped in public/ or the client bundle.

export const SQL_DELTAS: Record<string, string> = {
  // Two line items reference products 7777/8888 — invisible to inner joins.
  'hunt-db-001': `PRAGMA foreign_keys=OFF;
INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, quantity, unit_price_cents, line_total_cents)
VALUES (950001, 5001, 7777, 'Obsolete Dome Tent', 2, 21999, 43998),
       (950002, 5002, 8888, 'Vaporshell Bivy Sack', 1, 15450, 15450);
PRAGMA foreign_keys=ON;`,

  // Morgan Whitlock exists three times: case variant, dot drift, trailing space.
  'hunt-db-002': `INSERT INTO customers (id, email, first_name, last_name, phone, loyalty_tier, status, marketing_opt_in, created_at)
VALUES (950101, 'Morgan.Whitlock@example.com', 'Morgan', 'Whitlock', '+1-555-0184', 'bronze', 'active', 0, '2026-05-12T00:00:00Z'),
       (950102, 'morgan.whitlock@example.com', 'Morgan', 'Whitlock', '+1-555-0184', 'silver', 'active', 1, '2026-05-19T00:00:00Z'),
       (950103, 'morgan.whitlock@example.com ', 'Morgan', 'Whitlock', NULL, 'bronze', 'active', 0, '2026-06-02T00:00:00Z');`,

  // One delivered order's total drifts by a non-round −339 cents.
  'hunt-db-003': `UPDATE orders SET total_cents = 50777 WHERE id = 5003;`,

  // Tinderbox Firesteel Kit stock rewritten 80 → 25.
  'hunt-db-004': `UPDATE inventory SET quantity = 25 WHERE product_id = 30;`,

  // The approved payment for delivered order MO-2026-0064 (pi_synthetic_000148) vanishes.
  'hunt-db-005': `DELETE FROM payments WHERE id = 8148;`,

  // Every line of order MO-2026-0075 stores unit price as the line total (quantity dropped).
  'hunt-db-006': `UPDATE order_items SET line_total_cents = unit_price_cents WHERE order_id = 5133;`,

  // Lumen USB Bike Light Set stock is pushed to exactly the boundary value of the largest single order line.
  'hunt-db-007': `UPDATE inventory SET quantity = 3 WHERE product_id = 20;`,

  // One customer row is deleted with foreign keys off; their seven orders keep the dangling reference.
  'hunt-db-008': `PRAGMA foreign_keys=OFF;
DELETE FROM customers WHERE id = 1030;
PRAGMA foreign_keys=ON;`,
}

/** Server-only lookup. Unknown ids resolve to null. */
export function findSqlDelta(huntId: string): string | null {
  return SQL_DELTAS[huntId] ?? null
}

export const SQL_DELTA_HUNT_IDS: readonly string[] = Object.keys(SQL_DELTAS)
