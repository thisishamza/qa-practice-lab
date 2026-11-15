// Pure checkout-side validation helpers — kept out of the JSX so they can be
// unit-tested. The server re-validates everything; these rules exist only to
// give the learner fast, honest feedback before submitting.

export interface CheckoutFormValues {
  customerName: string
  customerEmail: string
  shippingLine: string
  shippingCity: string
  shippingPostcode: string
  paymentSimulation: 'approved' | 'declined' | ''
}

export type CheckoutFieldErrors = Partial<
  Record<keyof CheckoutFormValues, string>
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME_PATTERN = /^[\p{L}][\p{L} .,'-]{1,99}$/u
const CITY_PATTERN = /^[\p{L}][\p{L} .,'-]{1,79}$/u
const LINE_PATTERN = /^[^\r\n]{4,120}$/
const POSTCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\- ]{2,11}$/

/** True when the string contains a C0/C1 control character or DEL. */
export function containsControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true
    }
  }
  return false
}

export function validateCheckoutForm(values: CheckoutFormValues): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}

  const name = values.customerName.trim().replace(/\s+/g, ' ')
  if (!NAME_PATTERN.test(name)) {
    errors.customerName = 'Enter a name (2–100 letters).'
  }

  const email = values.customerEmail.trim().toLowerCase()
  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.customerEmail = 'Enter a valid email address.'
  }

  const rawLine = values.shippingLine
  if (containsControlCharacter(rawLine)) {
    errors.shippingLine = 'Enter a single-line street address (4–120 characters).'
  }
  const line = rawLine.trim().replace(/\s+/g, ' ')
  if (!errors.shippingLine && !LINE_PATTERN.test(line)) {
    errors.shippingLine = 'Enter a street address (4–120 characters).'
  }

  const city = values.shippingCity.trim().replace(/\s+/g, ' ')
  if (!CITY_PATTERN.test(city)) {
    errors.shippingCity = 'Enter a city (2–80 letters).'
  }

  const postcode = values.shippingPostcode.trim().toUpperCase()
  if (!POSTCODE_PATTERN.test(postcode)) {
    errors.shippingPostcode = 'Enter a postcode (3–12 letters, digits, spaces or dashes).'
  }

  if (values.paymentSimulation !== 'approved' && values.paymentSimulation !== 'declined') {
    errors.paymentSimulation = 'Choose a simulated payment outcome.'
  }

  return errors
}

export function isCheckoutFormValid(values: CheckoutFormValues): boolean {
  return Object.keys(validateCheckoutForm(values)).length === 0
}
