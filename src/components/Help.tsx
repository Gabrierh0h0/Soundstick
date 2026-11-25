import { useT } from '../lib/i18n'
import { LIMITS } from '../lib/limits'

export function Help() {
  const { t } = useT()
  return (
    <section className="help">
      <h2>{t('helpTitle')}</h2>
      <ol>
        <li>{t('helpStep1')}</li>
        <li>{t('helpStep2')}</li>
        <li>{t('helpStep3')}</li>
      </ol>
      <p className="note">{t('helpNote')}</p>
      <h2>{t('helpPrivacyTitle')}</h2>
      <p>{t('helpPrivacy')}</p>
      <p>{t('helpLimits', { mb: LIMITS.maxVideoMB, am: LIMITS.maxAudioMB, im: LIMITS.maxImageMB, s: LIMITS.maxSeconds })}</p>
    </section>
  )
}
