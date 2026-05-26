import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const identity = (value) => value
const stringify = (value) => String(value)

export function useQueryState(key, defaultValue = '', options = {}) {
  const {
    deserialize = identity,
    replace = true,
    serialize = stringify,
    shouldDelete = (value) => value == null || value === '' || value === defaultValue,
  } = options
  const [searchParams, setSearchParams] = useSearchParams()
  const rawValue = searchParams.get(key)
  const value = rawValue == null ? defaultValue : deserialize(rawValue)

  const setValue = useCallback(
    (nextValue, navigationOptions = {}) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams)
          const currentRawValue = nextParams.get(key)
          const currentValue =
            currentRawValue == null ? defaultValue : deserialize(currentRawValue)
          const resolvedValue =
            typeof nextValue === 'function' ? nextValue(currentValue) : nextValue

          if (shouldDelete(resolvedValue)) {
            nextParams.delete(key)
          } else {
            nextParams.set(key, serialize(resolvedValue))
          }

          return nextParams
        },
        { replace, ...navigationOptions },
      )
    },
    [defaultValue, deserialize, key, replace, serialize, setSearchParams, shouldDelete],
  )

  return [value, setValue]
}
