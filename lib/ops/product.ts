export type OpsNestProduct = 'resto' | 'alma'

export function opsProductFromModule(
  mod: string
): OpsNestProduct | null {
  if (mod === 'ops_resto') return 'resto'
  if (mod === 'ops_alma') return 'alma'
  return null
}

export function opsProductModule(
  product: OpsNestProduct
): 'ops_resto' | 'ops_alma' {
  return product === 'alma' ? 'ops_alma' : 'ops_resto'
}

export function opsApiBasePath(
  product: OpsNestProduct
): '/api/ops' | '/api/ops/alma' {
  return product === 'alma' ? '/api/ops/alma' : '/api/ops'
}
