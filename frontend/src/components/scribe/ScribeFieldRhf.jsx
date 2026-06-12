import { useController } from 'react-hook-form'
import ScribeField from './ScribeField'

/**
 * Puente react-hook-form → ScribeField. El kit es controlado (`value` /
 * `onChange`) y los formularios de la app son RHF (uncontrolled por ref);
 * useController hace de adaptador y mantiene `shouldFocusError` funcionando
 * (field.ref → el control nativo recibe el foco si su campo es el primero
 * inválido del submit). La validación sigue siendo del padre: resolver del
 * form o `rules` por campo — el kit solo PINTA `fieldState.error`.
 *
 * @param {object} props
 * @param {import('react-hook-form').Control} props.control  control del useForm del padre
 * @param {string} props.name                                 nombre del campo en el form
 * @param {object} [props.rules]                              reglas RHF (si el form no usa resolver)
 * @param {string} [props.defaultValue='']                    valor inicial si no hay defaultValues en el form
 *   …y el resto de props de ScribeField (label, type, multiline, maxLength,
 *   showCount, hint, autoComplete, …) pasan tal cual.
 */
function ScribeFieldRhf({ control, name, rules, defaultValue = '', ...rest }) {
  // Desestructurado en el sitio: accesos `field.x` en render harían que el
  // lint del Compiler tratase `field` como ref (por su propiedad `ref`).
  const {
    field: { ref, value, onChange, onBlur, name: fieldName },
    fieldState,
  } = useController({ name, control, rules, defaultValue })
  return (
    <ScribeField
      {...rest}
      ref={ref}
      name={fieldName}
      value={value ?? ''}
      onChange={onChange}
      onBlur={onBlur}
      error={fieldState.error?.message ?? null}
    />
  )
}

export default ScribeFieldRhf
