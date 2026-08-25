import { config } from '../config/app'
import { CHAINS } from '../config/chains'
import { FlowDiagram } from '../components/FlowDiagram'
import { useI18n } from '../i18n'

export default function AboutPage() {
  const { t } = useI18n()

  return (
    <div className="main-narrow">
      <div className="card prose">
        <h1 className="page-title">{t('about.title')}</h1>
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>

        <h2>{t('about.howTitle')}</h2>
        <p>{t('about.how1')}</p>
        <p>{t('about.how2')}</p>
        <p>{t('about.how3')}</p>
        <p>{t('about.how4')}</p>

        <h3 className="flow-heading">{t('about.flowCreateTitle')}</h3>
        <FlowDiagram steps={t('about.flowCreate')} />
        <h3 className="flow-heading">{t('about.flowVisitTitle')}</h3>
        <FlowDiagram steps={t('about.flowVisit')} />

        <h2>{t('about.formatTitle')}</h2>
        <p className="mono">
          {config.appName}:{config.callDataVersion}:https://example.com
        </p>
        <p className="mono">
          /b/7Kx2mPq9 &nbsp;·&nbsp; /a/4fXk29pQz &nbsp;·&nbsp; /c/3Wk/7Kx2mPq9
        </p>
        <p>{t('about.format1')}</p>
        <p>{t('about.format2')}</p>

        <div className="chain-table-wrap">
          <table className="chain-table">
            <thead>
              <tr>
                <th>{t('about.chainTablePrefix')}</th>
                <th>{t('about.chainTableId')}</th>
                <th>{t('about.chainTableName')}</th>
              </tr>
            </thead>
            <tbody>
              {CHAINS.map((c) => (
                <tr key={c.chainId}>
                  <td className="mono">{c.prefix}</td>
                  <td className="mono">{c.chainId}</td>
                  <td>
                    {c.name}
                    {c.testnet && <span className="badge-warn">{t('create.testnetBadge')}</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="mono">c</td>
                <td className="mono">…</td>
                <td>{t('about.chainTableOther')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>{t('about.riskTitle')}</h2>
        <p>{t('about.risk1')}</p>
        <p>{t('about.risk3')}</p>
        <p>
          {t('about.risk2')} {t('about.risk4')}
        </p>
        <div className="chain-table-wrap">
          <table className="chain-table">
            <thead>
              <tr>
                <th>{t('about.srcColName')}</th>
                <th>{t('about.srcColDesc')}</th>
                <th>{t('about.srcColUrl')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('about.srcGsb')}</td>
                <td>{t('about.srcGsbDesc')}</td>
                <td>
                  <a className="mono" href="https://safebrowsing.google.com" target="_blank" rel="noreferrer">
                    safebrowsing.google.com
                  </a>
                </td>
              </tr>
              <tr>
                <td>{t('about.srcMetaMask')}</td>
                <td>{t('about.srcMetaMaskDesc')}</td>
                <td>
                  <a className="mono" href="https://github.com/MetaMask/eth-phishing-detect" target="_blank" rel="noreferrer">
                    MetaMask/eth-phishing-detect
                  </a>
                </td>
              </tr>
              <tr>
                <td>{t('about.srcEurl')}</td>
                <td>{t('about.srcEurlDesc')}</td>
                <td>
                  <a className="mono" href="https://github.com/eurl-eth/blocklist" target="_blank" rel="noreferrer">
                    github.com/eurl-eth/blocklist
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>{t('about.devTitle')}</h2>
        <p>{t('about.dev1')}</p>
        <p>{t('about.dev2')}</p>

        <h2>{t('about.privacyTitle')}</h2>
        <p>{t('about.privacy1')}</p>
        <p>{t('about.privacy2')}</p>

        <h2>{t('about.termsTitle')}</h2>
        <p>{t('about.terms1')}</p>
        <p>{t('about.terms2')}</p>
        <p>{t('about.terms3')}</p>
        <p>{t('about.terms4')}</p>

        <h2>{t('about.takedownTitle')}</h2>
        <p>{t('about.takedown1')}</p>
        <p>
          <a className="link" href="https://github.com/eurl-eth/blocklist" target="_blank" rel="noreferrer">
            https://github.com/eurl-eth/blocklist
          </a>
        </p>
        <p>{t('about.takedown2')}</p>
      </div>
    </div>
  )
}
