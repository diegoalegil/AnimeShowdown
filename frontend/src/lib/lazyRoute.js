import { lazy } from 'react'
import StaleRouteRecovery from '../components/StaleRouteRecovery'
import {
  isStaleAssetError,
  recoverFromStaleAssetError,
} from './staleAssetRecovery'

function staleRecoveryModule(error) {
  recoverFromStaleAssetError(error)
  return { default: StaleRouteRecovery }
}

export function lazyRoute(importer) {
  return lazy(() =>
    importer()
      .then((module) => {
        if (module?.default) return module
        const error = new TypeError("Cannot read properties of undefined (reading 'default')")
        if (isStaleAssetError(error)) return staleRecoveryModule(error)
        throw error
      })
      .catch((error) => {
        if (isStaleAssetError(error)) return staleRecoveryModule(error)
        throw error
      }),
  )
}
