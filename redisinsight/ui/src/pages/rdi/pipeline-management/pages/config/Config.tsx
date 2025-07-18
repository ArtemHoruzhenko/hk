import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { EuiText, EuiLink, EuiButton, EuiLoadingSpinner } from '@elastic/eui'
import cx from 'classnames'
import { useParams } from 'react-router-dom'
import { get, throttle } from 'lodash'

import {
  sendPageViewTelemetry,
  sendEventTelemetry,
  TelemetryPageView,
  TelemetryEvent,
} from 'uiSrc/telemetry'
import { EXTERNAL_LINKS, UTM_MEDIUMS } from 'uiSrc/constants/links'
import { getUtmExternalLink } from 'uiSrc/utils/links'
import {
  rdiPipelineSelector,
  setChangedFile,
  deleteChangedFile,
  setPipelineConfig,
  disableConfigDiff,
  enableConfigDiff,
  updateDesiredPipelineConfig,
  acceptDesiredPipeline,
  rejectDesiredPipeline,
} from 'uiSrc/slices/rdi/pipeline'
import { FileChangeType, RdiPipelineTabs } from 'uiSrc/slices/interfaces'
import MonacoYaml from 'uiSrc/components/monaco-editor/components/monaco-yaml'
import TestConnectionsPanel from 'uiSrc/pages/rdi/pipeline-management/components/test-connections-panel'
import TemplatePopover from 'uiSrc/pages/rdi/pipeline-management/components/template-popover'
import { rdiErrorMessages } from 'uiSrc/pages/rdi/constants'
import {
  testConnectionsAction,
  rdiTestConnectionsSelector,
  testConnectionsController,
} from 'uiSrc/slices/rdi/testConnections'
import { appContextPipelineManagement } from 'uiSrc/slices/app/context'
import {
  createAxiosError,
  isConfigDiff,
  isEqualPipelineFile,
  yamlToJson,
} from 'uiSrc/utils'

import { addErrorNotification } from 'uiSrc/slices/app/notifications'
import styles from './styles.module.scss'

const Config = () => {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false)

  const {
    loading: pipelineLoading,
    schema,
    data,
    config,
    diff,
    desiredPipeline,
  } = useSelector(rdiPipelineSelector)
  const { loading: testingConnections } = useSelector(
    rdiTestConnectionsSelector,
  )
  const { isOpenDialog } = useSelector(appContextPipelineManagement)

  const { rdiInstanceId } = useParams<{ rdiInstanceId: string }>()
  const dispatch = useDispatch()

  useEffect(() => {
    sendPageViewTelemetry({
      name: TelemetryPageView.RDI_CONFIG,
      eventData: {
        rdiInstanceId,
      },
    })

    return () => {
      testConnectionsController?.abort()
    }
  }, [])

  useEffect(() => {
    if (isOpenDialog || pipelineLoading) return

    if (!config) {
      setIsPopoverOpen(true)
    }

    if (config) {
      setIsPopoverOpen(false)
    }
  }, [isOpenDialog, config, pipelineLoading])

  // Use diff state from Redux (updated by comparison utility)
  const configDiff = diff.config

  // Auto-enable diff mode when desired pipeline is active
  useEffect(() => {
    if (isConfigDiff() && !configDiff.enabled) {
      dispatch(enableConfigDiff({
        originalValue: config,
        newValue: desiredPipeline.config
      }))
    }
  }, [desiredPipeline.active, desiredPipeline.config, config, configDiff.enabled, dispatch])

  const testConnections = () => {
    const JSONValue = yamlToJson(config, (msg) => {
      dispatch(
        addErrorNotification(
          createAxiosError({
            message: rdiErrorMessages.invalidStructure('config', msg),
          }),
        ),
      )
    })
    if (!JSONValue) {
      return
    }
    setIsPanelOpen(true)
    dispatch(testConnectionsAction(rdiInstanceId, JSONValue))
    sendEventTelemetry({
      event: TelemetryEvent.RDI_TEST_CONNECTIONS_CLICKED,
      eventData: {
        id: rdiInstanceId,
      },
    })
  }

  const checkIsFileUpdated = useCallback(
    throttle((value) => {
      if (!data) {
        dispatch(
          setChangedFile({ name: 'config', status: FileChangeType.Added }),
        )
        return
      }

      if (isEqualPipelineFile(value, data?.config)) {
        dispatch(deleteChangedFile('config'))
        return
      }

      dispatch(
        setChangedFile({ name: 'config', status: FileChangeType.Modified }),
      )
    }, 2000),
    [data],
  )

  const handleChange = useCallback(
    (value: string) => {
      // Update desired config when diff mode enabled
      if (isConfigDiff()) {
        dispatch(updateDesiredPipelineConfig(value))
        return
      }

      dispatch(setPipelineConfig(value))

      checkIsFileUpdated(value)
    },
    [data, configDiff.enabled],
  )

  const handleDiffModeChange = useCallback((isDiffMode: boolean) => {
    if (!isDiffMode) {
      // User manually disabled diff mode, update Redux state
      dispatch(disableConfigDiff())
    }
  }, [])

  const handleAcceptChanges = useCallback(() => {
    dispatch(acceptDesiredPipeline())
  }, [dispatch])

  const handleRejectChanges = useCallback(() => {
    dispatch(rejectDesiredPipeline())
  }, [dispatch])

  const handleClosePanel = () => {
    testConnectionsController?.abort()
    setIsPanelOpen(false)
  }

  return (
    <>
      <div
        className={cx('content', 'rdi__wrapper', {
          [styles.isPanelOpen]: isPanelOpen,
        })}
      >
        <div className="rdi__content-header">
          <EuiText className="rdi__title">
            Target database configuration
          </EuiText>
          <TemplatePopover
            isPopoverOpen={isPopoverOpen && !isOpenDialog}
            setIsPopoverOpen={setIsPopoverOpen}
            value={config}
            setFieldValue={(template) => dispatch(setPipelineConfig(template))}
            loading={pipelineLoading}
            source={RdiPipelineTabs.Config}
          />
        </div>
        <EuiText className="rdi__text" color="subdued">
          {'Provide '}
          <EuiLink
            external={false}
            data-testid="rdi-pipeline-config-link"
            target="_blank"
            href={getUtmExternalLink(EXTERNAL_LINKS.rdiPipeline, {
              medium: UTM_MEDIUMS.Rdi,
              campaign: 'config_file',
            })}
          >
            connection details
          </EuiLink>
          {
            ' for source and target databases and other collector configurations, such as tables and columns to track.'
          }
        </EuiText>

        {pipelineLoading ? (
          <div
            className={cx('rdi__editorWrapper', 'rdi__loading')}
            data-testid="rdi-config-loading"
          >
            <EuiText color="subdued" style={{ marginBottom: 12 }}>
              Loading data...
            </EuiText>
            <EuiLoadingSpinner color="secondary" size="l" />
          </div>
        ) : (
          <MonacoYaml
            schema={get(schema, 'config', null)}
            value={isConfigDiff() ? desiredPipeline.config : config}
            originalValue={config === '' ? '\u200B' : config}
            enableDiff={isConfigDiff()}
            onDiffModeChange={handleDiffModeChange}
            onChange={handleChange}
            disabled={pipelineLoading}
            wrapperClassName="rdi__editorWrapper"
            showAcceptReject={isConfigDiff()}
            onAcceptChanges={handleAcceptChanges}
            onRejectChanges={handleRejectChanges}
            data-testid="rdi-monaco-config"
          />
        )}
        <div className="rdi__actions">
          <EuiButton
            fill
            color="secondary"
            size="s"
            onClick={testConnections}
            isLoading={testingConnections || pipelineLoading}
            aria-labelledby="test target connections"
            data-testid="rdi-test-connection-btn"
          >
            Test Connection
          </EuiButton>
        </div>
      </div>
      {isPanelOpen && <TestConnectionsPanel onClose={handleClosePanel} />}
    </>
  )
}

export default React.memo(Config)
