import { toast } from 'sonner'
import { recordDailyShare } from './dailyProgress'
import { shareOrCopy } from './share'

export async function shareWithToast(
  payload,
  {
    clipboardSuccess = 'Copiado',
    errorDescription = 'Copia el enlace manualmente.',
    errorTitle = 'No se pudo compartir',
    nativeSuccess = 'Compartido',
    onShared = recordDailyShare,
  } = {},
) {
  try {
    const result = await shareOrCopy(payload)
    if (result === 'cancelled') return result

    onShared?.(result)
    toast.success(result === 'native' ? nativeSuccess : clipboardSuccess)
    return result
  } catch (error) {
    toast.error(errorTitle, {
      description: error?.message || errorDescription,
    })
    return 'error'
  }
}
