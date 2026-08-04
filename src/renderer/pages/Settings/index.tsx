import { TopBar } from '../../components/layout/TopBar'
import { Panel } from '../../components/common/Panel'
import { Settings as SettingsIcon, Shield, Cpu } from 'lucide-react'
import { Button } from '../../components/common/Button'
import React from 'react'
import { useAppStore } from '../../store/useAppStore'

export function Settings(): React.JSX.Element {
  const { aiConfig, aiConfigSaving, aiConfigError, saveAiConfig } = useAppStore()

  // ---------------------------------------------------------------------------
  // AI Configuration form state (Phase 8, Slice 35)
  //
  // apiKey field behavior (Slice 35 spec, Section 26 — resolved): the input
  // is always empty regardless of aiConfig.hasApiKey. Submitting it empty
  // sends apiKey: undefined (unchanged, per IAiSettingsSaveRequest's
  // contract). Key presence is communicated via the separate, non-editable
  // status line below, driven by aiConfig.hasApiKey — never by the input's
  // contents. Clearing a stored key is only possible via the explicit
  // "Clear key" button, never by emptying this field.
  // ---------------------------------------------------------------------------
  const [apiUrl, setApiUrl] = React.useState('')
  const [model, setModel] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  // Adjusts local form state when aiConfig changes (initial load, or the
  // re-fetch saveAiConfig() performs after a successful save) — done during
  // render per React's documented pattern for deriving state from a changed
  // value, rather than in an effect, to avoid an extra render pass.
  const [syncedAiConfig, setSyncedAiConfig] = React.useState(aiConfig)
  if (aiConfig !== syncedAiConfig) {
    setSyncedAiConfig(aiConfig)
    setApiUrl(aiConfig?.apiUrl ?? '')
    setModel(aiConfig?.model ?? '')
    setApiKey('')
  }

  async function handleSave(): Promise<void> {
    setSaveSuccess(false)
    const result = await saveAiConfig({
      apiUrl: apiUrl.trim() || null,
      model: model.trim() || null,
      apiKey: apiKey === '' ? undefined : apiKey
    })
    if (result.status === 'success') {
      setSaveSuccess(true)
    }
  }

  async function handleClearKey(): Promise<void> {
    setSaveSuccess(false)
    const result = await saveAiConfig({
      apiUrl: apiUrl.trim() || null,
      model: model.trim() || null,
      apiKey: ''
    })
    if (result.status === 'success') {
      setSaveSuccess(true)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 overflow-y-auto">
        <div className="max-w-[800px] flex flex-col gap-48">
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <SettingsIcon className="w-6 h-6 text-text-secondary" /> General
            </h2>
            <Panel className="p-0">
              <div className="p-24 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">
                    Theme Preference
                  </div>
                  <div className="text-[14px] text-text-secondary mt-4">
                    Select your interface color scheme.
                  </div>
                </div>
                <div className="text-[14px] font-medium text-text-primary bg-surface border border-border px-16 py-8 rounded-xl shadow-sm">
                  Light
                </div>
              </div>
              <div className="p-24 flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Telemetry</div>
                  <div className="text-[14px] text-text-secondary mt-4">
                    Help us improve by sending anonymous usage data.
                  </div>
                </div>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <Shield className="w-6 h-6 text-text-secondary" /> AI Configuration
            </h2>
            <Panel className="p-24">
              <div className="flex flex-col gap-16">
                <div className="text-[13px] font-medium text-text-secondary">
                  API key:{' '}
                  <span className="text-text-primary font-semibold">
                    {aiConfig?.hasApiKey ? 'Configured' : 'Not configured'}
                  </span>
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-6 block">
                    API URL
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-secondary/50 shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-6 block">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-secondary/50 shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-text-primary mb-6 block">
                    API Key
                  </label>
                  <div className="flex gap-16">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        aiConfig?.hasApiKey
                          ? 'Enter a new key to replace the saved one'
                          : '(Not configured)'
                      }
                      className="flex-1 bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-secondary/50 shadow-sm"
                    />
                    {aiConfig?.hasApiKey && (
                      <Button
                        variant="destructive"
                        onClick={handleClearKey}
                        disabled={aiConfigSaving}
                      >
                        Clear key
                      </Button>
                    )}
                  </div>
                </div>

                {aiConfigError && <div className="text-[13px] text-error">{aiConfigError}</div>}
                {saveSuccess && !aiConfigError && (
                  <div className="text-[13px] text-success">Saved.</div>
                )}

                <div>
                  <Button variant="primary" onClick={handleSave} isLoading={aiConfigSaving}>
                    Save
                  </Button>
                </div>
              </div>
            </Panel>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-16 flex items-center gap-10">
              <Cpu className="w-6 h-6 text-text-secondary" /> Hardware Options
            </h2>
            <Panel className="p-24">
              <div className="text-[15px] font-semibold text-text-primary mb-16">
                Arduino CLI Path
              </div>
              <div className="flex gap-16">
                <input
                  type="text"
                  value=""
                  placeholder="(Not configured)"
                  disabled
                  className="flex-1 bg-surface border border-border rounded-xl px-16 py-10 text-[14px] text-text-primary focus:outline-none placeholder:text-text-secondary/50 cursor-not-allowed shadow-sm"
                />
                <Button variant="secondary" disabled>
                  Browse
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
