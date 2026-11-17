// Verdict rendering helpers for the contract compare workspace (browser-safe).

export type ContractVerdict = 'breaking' | 'review' | 'compatible'

export function verdictLabel(verdict: ContractVerdict): string {
  switch (verdict) {
    case 'breaking':
      return 'BREAKING'
    case 'review':
      return 'REVIEW REQUIRED'
    case 'compatible':
      return 'BACKWARD-COMPATIBLE'
  }
}

export function verdictTone(verdict: ContractVerdict): 'breaking' | 'review' | 'compatible' {
  return verdict
}
