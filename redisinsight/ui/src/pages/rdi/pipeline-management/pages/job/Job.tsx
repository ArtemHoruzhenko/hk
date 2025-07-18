import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  EuiText,
  EuiLink,
  EuiButton,
  EuiLoadingSpinner,
  EuiToolTip,
} from '@elastic/eui'
import { get, throttle } from 'lodash'
import cx from 'classnames'
import { monaco as monacoEditor } from 'react-monaco-editor'

import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'
import { EXTERNAL_LINKS, UTM_MEDIUMS } from 'uiSrc/constants/links'
import {
  deleteChangedFile,
  fetchPipelineStrategies,
  rdiPipelineSelector,
  setChangedFile,
  setPipelineJobs,
  updateJobDiffNewValue,
  disableJobDiff,
  enableJobDiff,
  acceptDesiredPipeline,
  rejectDesiredPipeline,
} from 'uiSrc/slices/rdi/pipeline'
import { FileChangeType } from 'uiSrc/slices/interfaces'
import MonacoYaml from 'uiSrc/components/monaco-editor/components/monaco-yaml'
import DryRunJobPanel from 'uiSrc/pages/rdi/pipeline-management/components/jobs-panel'
import { rdiErrorMessages } from 'uiSrc/pages/rdi/constants'
import { DSL, KEYBOARD_SHORTCUTS } from 'uiSrc/constants'
import {
  createAxiosError,
  isEqualPipelineFile,
  Maybe,
  yamlToJson,
} from 'uiSrc/utils'
import { getUtmExternalLink } from 'uiSrc/utils/links'
import { KeyboardShortcut } from 'uiSrc/components'

import { addErrorNotification } from 'uiSrc/slices/app/notifications'
import TemplateButton from '../../components/template-button'
import styles from './styles.module.scss'

export interface Props {
  name: string
  value: string
  deployedJobValue: Maybe<string>
  jobIndex: number
  rdiInstanceId: string
}

const Job = (props: Props) => {
  const { name, value = '', deployedJobValue, jobIndex, rdiInstanceId } = props

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false)
  const [shouldOpenDedicatedEditor, setShouldOpenDedicatedEditor] =
    useState<boolean>(false)

  const dispatch = useDispatch()

  const jobIndexRef = useRef<number>(jobIndex)
  const deployedJobValueRef = useRef<Maybe<string>>(deployedJobValue)
  const jobNameRef = useRef<string>(name)

  const { loading, schema, jobFunctions, jobs, diff, desiredPipeline } =
    useSelector(rdiPipelineSelector)

  useEffect(() => {
    dispatch(fetchPipelineStrategies(rdiInstanceId))
  }, [])

  useEffect(() => {
    setIsPanelOpen(false)
  }, [name])

  useEffect(() => {
    deployedJobValueRef.current = deployedJobValue
  }, [deployedJobValue])

  useEffect(() => {
    jobIndexRef.current = jobIndex
  }, [jobIndex])

  useEffect(() => {
    jobNameRef.current = name
  }, [name])

  // Use diff state from Redux (updated by comparison utility)
  const jobDiff = diff.jobs[name] || { enabled: false, originalValue: null }

  // Check if this job has a desired state
  const desiredJob = desiredPipeline.active ? desiredPipeline.jobs.find(job => job.name === name) : null
  
  // For newly added jobs: jobIndex === -1 means job doesn't exist in current jobs array
  const isNewlyAddedJob = jobIndex === -1 && !!desiredJob
  
  // For modified jobs: job exists in both places but with different content
  const isModifiedJob = jobIndex !== -1 && !!desiredJob && value !== desiredJob.value
  
  const isDesiredDiff = Boolean(isNewlyAddedJob || isModifiedJob)
  const desiredValue = desiredJob?.value || value || ''

  // Enable diff mode when desired state changes
  useEffect(() => {
    if (isDesiredDiff && desiredJob) {
      dispatch(enableJobDiff({
        jobName: name,
        originalValue: isNewlyAddedJob ? '' : value,
        newValue: desiredJob.value
      }))
    }
  }, [isDesiredDiff, desiredJob, name, value, isNewlyAddedJob])

  const handleDryRunJob = () => {
    const JSONValue = yamlToJson(value, (msg) => {
      dispatch(
        addErrorNotification(
          createAxiosError({
            message: rdiErrorMessages.invalidStructure(name, msg),
          }),
        ),
      )
    })
    if (!JSONValue) {
      return
    }
    setIsPanelOpen(true)
    sendEventTelemetry({
      event: TelemetryEvent.RDI_TEST_JOB_OPENED,
      eventData: {
        id: rdiInstanceId,
      },
    })
  }

  const checkIsFileUpdated = useCallback(
    throttle((value) => {
      if (!deployedJobValueRef.current) {
        return
      }

      if (isEqualPipelineFile(value, deployedJobValueRef.current)) {
        dispatch(deleteChangedFile(jobNameRef.current))
        return
      }
      dispatch(
        setChangedFile({
          name: jobNameRef.current,
          status: FileChangeType.Modified,
        }),
      )
    }, 2000),
    [deployedJobValue, jobNameRef.current],
  )

  const handleChange = (value: string) => {
    const newJobs = jobs.map((job, index) => {
      if (index === jobIndexRef.current) {
        return { ...job, value }
      }
      return job
    })
    dispatch(setPipelineJobs(newJobs))

    // Update job diff newValue if in diff mode
    if (jobDiff.enabled) {
      dispatch(updateJobDiffNewValue({ jobName: name, newValue: value }))
    }

    checkIsFileUpdated(value)
  }

  const handleChangeLanguage = (langId: DSL) => {
    sendEventTelemetry({
      event: TelemetryEvent.RDI_DEDICATED_EDITOR_LANGUAGE_CHANGED,
      eventData: {
        rdiInstanceId,
        selectedLanguageSyntax: langId,
      },
    })
  }

  const handleOpenDedicatedEditor = () => {
    setShouldOpenDedicatedEditor(false)
    sendEventTelemetry({
      event: TelemetryEvent.RDI_DEDICATED_EDITOR_OPENED,
      eventData: {
        rdiInstanceId,
      },
    })
  }

  const handleCloseDedicatedEditor = (langId: DSL) => {
    sendEventTelemetry({
      event: TelemetryEvent.RDI_DEDICATED_EDITOR_CANCELLED,
      eventData: {
        rdiInstanceId,
        selectedLanguageSyntax: langId,
      },
    })
  }

  const handleSubmitDedicatedEditor = (langId: DSL) => {
    sendEventTelemetry({
      event: TelemetryEvent.RDI_DEDICATED_EDITOR_SAVED,
      eventData: {
        rdiInstanceId,
        selectedLanguageSyntax: langId,
      },
    })
  }

  const handleDiffModeChange = useCallback((isDiffMode: boolean) => {
    if (!isDiffMode) {
      // User manually disabled diff mode, update Redux state
      dispatch(disableJobDiff({ jobName: name }))
    }
  }, [name])

  const handleAcceptChanges = useCallback(() => {
    dispatch(acceptDesiredPipeline())
  }, [dispatch])

  const handleRejectChanges = useCallback(() => {
    dispatch(rejectDesiredPipeline())
  }, [dispatch])

  return (
    <>
      <div className={cx('content', { isSidePanelOpen: isPanelOpen })}>
        <div className="rdi__content-header">
          <div>
            <EuiText className={cx('rdi__title', 'line-clamp-2')}>{name}</EuiText>
          </div>
          <div className={styles.actionContainer}>
            <EuiToolTip
              position="top"
              className={styles.tooltip}
              content={
                KEYBOARD_SHORTCUTS?.rdi?.openDedicatedEditor && (
                  <div className={styles.tooltipContent}>
                    <EuiText size="s">{`${KEYBOARD_SHORTCUTS.rdi.openDedicatedEditor?.description}\u00A0\u00A0`}</EuiText>
                    <KeyboardShortcut
                      separator={KEYBOARD_SHORTCUTS?._separator}
                      items={KEYBOARD_SHORTCUTS.rdi.openDedicatedEditor.keys}
                    />
                  </div>
                )
              }
              data-testid="open-dedicated-editor-tooltip"
            >
              <EuiButton
                color="secondary"
                size="s"
                style={{ marginRight: '16px' }}
                onClick={() => setShouldOpenDedicatedEditor(true)}
                data-testid="open-dedicated-editor-btn"
              >
                SQL and JMESPath Editor
              </EuiButton>
            </EuiToolTip>

            <TemplateButton
              value={value}
              setFieldValue={(template) => {
                const newJobs = jobs.map((job, index) => {
                  if (index === jobIndexRef.current) {
                    return { ...job, value: template }
                  }
                  return job
                })
                dispatch(setPipelineJobs(newJobs))
              }}
            />
          </div>
        </div>
        <EuiText className="rdi__text" color="subdued">
          {'Create a job per source table to filter, transform, and '}
          <EuiLink
            external={false}
            data-testid="rdi-pipeline-transformation-link"
            target="_blank"
            href={getUtmExternalLink(EXTERNAL_LINKS.rdiPipelineTransforms, {
              medium: UTM_MEDIUMS.Rdi,
              campaign: 'job_file',
            })}
          >
            map data
          </EuiLink>
          {' to Redis.'}
        </EuiText>
        {loading ? (
          <div
            className={cx('rdi__editorWrapper', 'rdi__loading')}
            data-testid="rdi-job-loading"
          >
            <EuiText color="subdued" style={{ marginBottom: 12 }}>
              Loading data...
            </EuiText>
            <EuiLoadingSpinner color="secondary" size="l" />
          </div>
        ) : (
          <MonacoYaml
            schema={get(schema, 'jobs', null)}
            value={desiredValue}
            originalValue={isNewlyAddedJob ? '' : (jobDiff.originalValue || undefined)}
            enableDiff={jobDiff.enabled || isDesiredDiff}
            onDiffModeChange={handleDiffModeChange}
            onChange={handleChange}
            disabled={loading}
            dedicatedEditorLanguages={[DSL.sqliteFunctions, DSL.jmespath]}
            dedicatedEditorFunctions={
              jobFunctions as monacoEditor.languages.CompletionItem[]
            }
            dedicatedEditorOptions={{
              suggest: { preview: false, showIcons: true, showStatusBar: true },
            }}
            onChangeLanguage={handleChangeLanguage}
            wrapperClassName="rdi__editorWrapper"
            shouldOpenDedicatedEditor={shouldOpenDedicatedEditor}
            onOpenDedicatedEditor={handleOpenDedicatedEditor}
            onCloseDedicatedEditor={handleCloseDedicatedEditor}
            onSubmitDedicatedEditor={handleSubmitDedicatedEditor}
            showAcceptReject={isDesiredDiff}
            onAcceptChanges={handleAcceptChanges}
            onRejectChanges={handleRejectChanges}
            data-testid="rdi-monaco-job"
          />
        )}
        <div className="rdi__actions">
          <EuiButton
            fill
            color="secondary"
            size="s"
            onClick={handleDryRunJob}
            isLoading={loading}
            aria-labelledby="dry run"
            data-testid="rdi-test-job-btn"
          >
            Dry Run
          </EuiButton>
        </div>
      </div>
      {isPanelOpen && (
        <DryRunJobPanel job={value} name={name} onClose={() => setIsPanelOpen(false)} />
      )}
    </>
  )
}

export default React.memo(Job)
