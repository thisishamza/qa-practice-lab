import { describe, expect, it } from 'vitest'
import {
  isCheckoutFormValid,
  validateCheckoutForm,
  type CheckoutFormValues,
} from '../../src/lib/checkout'

function valid(overrides: Partial<CheckoutFormValues> = {}): CheckoutFormValues {
  return {
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    shippingLine: '12 Analytical Engine Way',
    shippingCity: 'London',
    shippingPostcode: 'N1 9GU',
    paymentSimulation: 'approved',
    ...overrides,
  }
}

describe('validateCheckoutForm', () => {
  it('accepts a well-formed form', () => {
    expect(validateCheckoutForm(valid())).toEqual({})
    expect(isCheckoutFormValid(valid())).toBe(true)
  })

  it('normalizes case and whitespace before validating', () => {
    const errors = validateCheckoutForm(
      valid({ customerEmail: '  ADA@EXAMPLE.COM ', customerName: '  Ada   Lovelace ' }),
    )
    expect(errors).toEqual({})
  })

  it('rejects a missing or digit-containing name', () => {
    expect(validateCheckoutForm(valid({ customerName: '' })).customerName).toBeTruthy()
    expect(validateCheckoutForm(valid({ customerName: 'Ada 123' })).customerName).toBeTruthy()
    expect(validateCheckoutForm(valid({ customerName: 'A' })).customerName).toBeTruthy()
  })

  it('rejects a malformed email', () => {
    expect(validateCheckoutForm(valid({ customerEmail: 'nope' })).customerEmail).toBeTruthy()
    expect(validateCheckoutForm(valid({ customerEmail: '' })).customerEmail).toBeTruthy()
    expect(validateCheckoutForm(valid({ customerEmail: 'a@b' })).customerEmail).toBeTruthy()
  })

  it('rejects a newline in the street line and an over-long line', () => {
    expect(
      validateCheckoutForm(valid({ shippingLine: '12 Analytical\nEngine Way' })).shippingLine,
    ).toBeTruthy()
    expect(
      validateCheckoutForm(valid({ shippingLine: 'x'.repeat(121) })).shippingLine,
    ).toBeTruthy()
  })

  it('rejects a malformed postcode', () => {
    expect(validateCheckoutForm(valid({ shippingPostcode: '!!' })).shippingPostcode).toBeTruthy()
    expect(validateCheckoutForm(valid({ shippingPostcode: 'N1' })).shippingPostcode).toBeTruthy()
  })

  it('requires an explicit simulated payment outcome', () => {
    expect(
      validateCheckoutForm(valid({ paymentSimulation: '' })).paymentSimulation,
    ).toBeTruthy()
    expect(isCheckoutFormValid(valid({ paymentSimulation: '' }))).toBe(false)
  })
})
