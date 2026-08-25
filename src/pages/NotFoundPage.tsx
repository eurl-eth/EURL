import { useI18n } from '../i18n'

export default function NotFoundPage() {
  const { t } = useI18n()

  return (
    <div className="main-narrow center-narrow">
      <div className="card">
        <div className="status-panel">
          <h2 className="status-title">404 · {t('notfound.title')}</h2>
          <p className="status-sub">{t('notfound.sub')}</p>
          <a className="btn" href="/">
            {t('resolve.backHome')}
          </a>
        </div>
      </div>
    </div>
  )
}
