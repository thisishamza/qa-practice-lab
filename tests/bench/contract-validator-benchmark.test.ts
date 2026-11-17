import { describe, expect, it } from 'vitest'
import { validatePayload } from '../../src/shared/contractValidation'
import { fixtureOperationSchema } from '../../src/shared/contracts/index'
import { ORDER_DETAIL_CAPTURE } from '../../src/shared/contracts/checkoutFlow'

describe('validator benchmark', () => {
  it('p95 ≤ 5 ms on the OrderDetail corpus (1,000 runs)', () => {
    const target = fixtureOperationSchema('checkout-flow', 'OrderDetail')!
    const payload = structuredClone(ORDER_DETAIL_CAPTURE)
    const samples: number[] = []
    for (let i = 0; i < 1000; i += 1) {
      const start = process.hrtime.bigint()
      validatePayload(target.schema, payload)
      samples.push(Number(process.hrtime.bigint() - start) / 1e6)
    }
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.floor(samples.length * 0.95)]
    const p50 = samples[Math.floor(samples.length * 0.5)]
    console.log(`p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${samples[samples.length - 1].toFixed(2)}ms`)
    expect(p95).toBeLessThanOrEqual(5)
  })
})
