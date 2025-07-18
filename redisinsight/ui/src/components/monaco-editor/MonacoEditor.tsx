import React, { useContext, useEffect, useRef, useState } from 'react'
import ReactMonacoEditor, { MonacoDiffEditor, monaco as monacoEditor } from 'react-monaco-editor'
import cx from 'classnames'
import { EuiButton, EuiIcon } from '@elastic/eui'
import { merge } from 'lodash'

import { MonacoThemes, darkTheme, lightTheme } from 'uiSrc/constants/monaco'
import { Nullable } from 'uiSrc/utils'
import {
  IEditorMount,
  ISnippetController,
} from 'uiSrc/pages/workbench/interfaces'
import { DSL, Theme } from 'uiSrc/constants'
import { ThemeContext } from 'uiSrc/contexts/themeContext'
import InlineItemEditor from 'uiSrc/components/inline-item-editor'
import DedicatedEditor from './components/dedicated-editor'
import styles from './styles.module.scss'

export interface CommonProps {
  value: string
  onChange?: (value: string) => void
  onApply?: (event: React.MouseEvent, closeEditor: () => void) => void
  onDecline?: (event?: React.MouseEvent<HTMLElement>) => void
  disabled?: boolean
  readOnly?: boolean
  isEditable?: boolean
  wrapperClassName?: string
  editorWrapperClassName?: string
  options?: monacoEditor.editor.IStandaloneEditorConstructionOptions
  dedicatedEditorOptions?: monacoEditor.editor.IStandaloneEditorConstructionOptions
  dedicatedEditorLanguages?: DSL[]
  dedicatedEditorKeywords?: string[]
  dedicatedEditorFunctions?: monacoEditor.languages.CompletionItem[]
  onChangeLanguage?: (langId: DSL) => void
  shouldOpenDedicatedEditor?: boolean
  onOpenDedicatedEditor?: () => void
  onSubmitDedicatedEditor?: (langId: DSL) => void
  onCloseDedicatedEditor?: (langId: DSL) => void
  // Diff mode props
  originalValue?: string
  enableDiff?: boolean
  onDiffModeChange?: (isDiffMode: boolean) => void
  diffOptions?: {
    renderSideBySide?: boolean
    enableSplitViewResizing?: boolean
    ignoreTrimWhitespace?: boolean
  }
  // Accept/Reject actions for AI-suggested changes
  onAcceptChanges?: () => void
  onRejectChanges?: () => void
  showAcceptReject?: boolean
  hideDiffViewToggle?: boolean
  'data-testid'?: string
}

export interface Props extends CommonProps {
  onEditorDidMount?: (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor,
  ) => void
  onEditorWillMount?: (monaco: typeof monacoEditor) => void
  className?: string
  language: string
}
const MonacoEditor = (props: Props) => {
  const {
    value,
    onChange,
    onApply,
    onDecline,
    onEditorDidMount,
    onEditorWillMount,
    onChangeLanguage,
    disabled,
    readOnly,
    isEditable,
    language,
    wrapperClassName,
    editorWrapperClassName,
    className,
    options = {},
    dedicatedEditorOptions = {},
    dedicatedEditorLanguages = [],
    dedicatedEditorKeywords = [],
    dedicatedEditorFunctions = [],
    shouldOpenDedicatedEditor,
    onOpenDedicatedEditor,
    onSubmitDedicatedEditor,
    onCloseDedicatedEditor,
    // Diff mode props
    originalValue,
    enableDiff = false,
    onDiffModeChange,
    diffOptions = {
      ignoreTrimWhitespace: true,
    },
    // Accept/Reject actions for AI-suggested changes
    onAcceptChanges,
    onRejectChanges,
    showAcceptReject = false,
    hideDiffViewToggle = false,
    'data-testid': dataTestId = 'monaco-editor',
  } = props

  let contribution: Nullable<ISnippetController> = null
  const [isEditing, setIsEditing] = useState(!readOnly && !disabled)
  const [isDedicatedEditorOpen, setIsDedicatedEditorOpen] = useState(false)
  const [isDiffMode, setIsDiffMode] = useState(enableDiff)
  const [isInlineDiff, setIsInlineDiff] = useState(true)
  const monacoObjects = useRef<Nullable<IEditorMount>>(null)
  const input = useRef<HTMLDivElement>(null)

  const { theme } = useContext(ThemeContext)

  useEffect(
    () =>
      // componentWillUnmount
      () => {
        contribution?.dispose?.()
      },
    [],
  )

  useEffect(() => {
    monacoObjects.current?.editor.updateOptions({
      readOnly: !isEditing && (disabled || readOnly),
    })
  }, [disabled, readOnly, isEditing])

  useEffect(() => {
    if (shouldOpenDedicatedEditor) {
      setIsDedicatedEditorOpen(true)
      onOpenDedicatedEditor?.()
    }
  }, [shouldOpenDedicatedEditor])

  // Sync diff mode state with enableDiff prop
  useEffect(() => {
    setIsDiffMode(enableDiff)
  }, [enableDiff])

  const editorDidMount = (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor,
  ) => {
    monacoObjects.current = { editor, monaco }

    // hack for exit from snippet mode after click Enter until no answer from monaco authors
    // https://github.com/microsoft/monaco-editor/issues/2756
    contribution =
      editor.getContribution<ISnippetController>('snippetController2')

    editor.onKeyDown(onKeyDownMonaco)

    if (dedicatedEditorLanguages?.length) {
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Space, () => {
        onPressWidget()
      })
    }

    onEditorDidMount?.(editor, monaco)
  }

  const editorWillMount = (monaco: typeof monacoEditor) => {
    onEditorWillMount?.(monaco)
  }

  const onKeyDownMonaco = (e: monacoEditor.IKeyboardEvent) => {
    // trigger parameter hints
    if (
      e.keyCode === monacoEditor.KeyCode.Enter ||
      e.keyCode === monacoEditor.KeyCode.Space
    ) {
      onExitSnippetMode()
    }
  }

  const onExitSnippetMode = () => {
    if (!monacoObjects.current) return
    const { editor } = monacoObjects?.current

    if (contribution?.isInSnippet?.()) {
      const { lineNumber = 0, column = 0 } = editor?.getPosition() ?? {}
      editor.setSelection(
        new monacoEditor.Selection(lineNumber, column, lineNumber, column),
      )
      contribution?.cancel?.()
    }
  }

  const onPressWidget = () => {
    if (!monacoObjects.current) return
    const { editor } = monacoObjects?.current

    setIsDedicatedEditorOpen(true)
    onOpenDedicatedEditor?.()
    editor.updateOptions({ readOnly: true })
  }

  const triggerUpdateCursorPosition = (
    editor: monacoEditor.editor.IStandaloneCodeEditor,
  ) => {
    const position = editor.getPosition()
    editor.trigger('mouse', '_moveTo', {
      position: { lineNumber: 1, column: 1 },
    })
    editor.trigger('mouse', '_moveTo', { position })
    editor.focus()
  }

  const updateArgFromDedicatedEditor = (value: string, selectedLang: DSL) => {
    if (!monacoObjects.current) return
    const { editor } = monacoObjects?.current

    const model = editor.getModel()
    if (!model) return
    const position = editor.getPosition()

    editor.updateOptions({ readOnly: false })
    editor.executeEdits(null, [
      {
        range: new monacoEditor.Range(
          position?.lineNumber!,
          position?.column!,
          position?.lineNumber!,
          position?.column! + value.length,
        ),
        text: value.replaceAll('\n', ' '),
      },
    ])
    setIsDedicatedEditorOpen(false)
    triggerUpdateCursorPosition(editor)
    onSubmitDedicatedEditor?.(selectedLang)
  }

  const onCancelDedicatedEditor = (selectedLang: DSL) => {
    setIsDedicatedEditorOpen(false)
    if (!monacoObjects.current) return
    const { editor } = monacoObjects?.current

    editor.updateOptions({ readOnly: false })
    triggerUpdateCursorPosition(editor)
    onCloseDedicatedEditor?.(selectedLang)
  }

  if (monacoEditor?.editor) {
    monacoEditor.editor.defineTheme(MonacoThemes.Dark, darkTheme)
    monacoEditor.editor.defineTheme(MonacoThemes.Light, lightTheme)
  }

  const monacoOptions: monacoEditor.editor.IStandaloneEditorConstructionOptions =
    merge(
      {
        wordWrap: 'on',
        automaticLayout: true,
        formatOnPaste: false,
        padding: { top: 10 },
        suggest: {
          preview: false,
          showStatusBar: false,
          showIcons: false,
          showProperties: false,
        },
        quickSuggestions: false,
        minimap: {
          enabled: false,
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        lineNumbersMinChars: 4,
      },
      options,
    )

  const toggleDiffMode = () => {
    const newDiffMode = !isDiffMode
    setIsDiffMode(newDiffMode)
    onDiffModeChange?.(newDiffMode)
  }

  const toggleDiffViewMode = () => {
    setIsInlineDiff(!isInlineDiff)
  }

  const getDiffOptions = () => ({
    ...diffOptions,
    renderSideBySide: !isInlineDiff,
    enableSplitViewResizing: !isInlineDiff,
  })

  const handleApply = (_value: string, event: React.MouseEvent) => {
    onApply?.(event, () => setIsEditing(false))
  }

  const handleDecline = (event?: React.MouseEvent<HTMLElement>) => {
    setIsEditing(false)
    onDecline?.(event)
  }

  return (
    <div
      className={cx(styles.wrapper, wrapperClassName, {
        disabled,
        [styles.isEditing]: isEditing && readOnly,
      })}
    >
      <InlineItemEditor
        onApply={handleApply}
        onDecline={handleDecline}
        viewChildrenMode={!isEditing || !readOnly}
        declineOnUnmount={false}
        preventOutsideClick
      >
        <div
          className={cx('inlineMonacoEditor', editorWrapperClassName)}
          data-testid={`wrapper-${dataTestId}`}
          ref={input}
        >
          {/* Accept/Reject buttons for AI-suggested changes */}
          {showAcceptReject && isDiffMode && (
            <div className={styles.diffToggleContainer}>
              <EuiButton
                size="s"
                color="success"
                fill
                onClick={onAcceptChanges}
                iconType="check"
                className={styles.diffToggleBtn}
                data-testid="accept-changes-btn"
                title="Accept AI-suggested changes"
              >
                Accept
              </EuiButton>
              <EuiButton
                size="s"
                color="danger"
                onClick={onRejectChanges}
                iconType="cross"
                className={styles.diffToggleBtn}
                data-testid="reject-changes-btn"
                style={{ marginLeft: '8px' }}
                title="Reject AI-suggested changes"
              >
                Reject
              </EuiButton>
              {!hideDiffViewToggle && (
                <EuiButton
                  size="s"
                  onClick={toggleDiffViewMode}
                  iconType={isInlineDiff ? 'menuLeft' : 'menuRight'}
                  className={styles.diffViewToggleBtn}
                  data-testid="diff-view-toggle"
                  style={{ marginLeft: '8px' }}
                  title={isInlineDiff ? 'Switch to side-by-side view' : 'Switch to inline view'}
                >
                  {isInlineDiff ? 'Inline' : 'Side-by-Side'}
                </EuiButton>
              )}
            </div>
          )}
          {/* Legacy diff toggle for non-AI diffs */}
          {originalValue && !showAcceptReject && (
            <div className={styles.diffToggleContainer}>
              {isDiffMode && (
                <EuiButton
                  size="s"
                  onClick={toggleDiffViewMode}
                  iconType={isInlineDiff ? 'menuLeft' : 'menuRight'}
                  className={styles.diffViewToggleBtn}
                  data-testid="diff-view-toggle"
                  style={{ marginLeft: '8px' }}
                  title={isInlineDiff ? 'Switch to side-by-side view' : 'Switch to inline view'}
                >
                  {isInlineDiff ? 'Inline' : 'Side-by-Side'}
                </EuiButton>
              )}
            </div>
          )}

                     {isDiffMode && originalValue ? (
            <MonacoDiffEditor
              language={language}
              theme={theme === Theme.Dark ? 'dark' : 'light'}
              original={originalValue}
              value={value ?? ''}
              onChange={onChange}
              options={{
                ...monacoOptions,
                ...getDiffOptions(),
                readOnly: !isEditing || disabled || readOnly,
              }}
              className={cx(styles.editor, className, {
                readMode: !isEditing && readOnly,
              })}
              data-testid={`${dataTestId}-diff`}
            />
          ) : (
            <ReactMonacoEditor
              language={language}
              theme={theme === Theme.Dark ? 'dark' : 'light'}
              value={value ?? ''}
              onChange={onChange}
              options={monacoOptions}
              className={cx(styles.editor, className, {
                readMode: !isEditing && readOnly,
              })}
              editorDidMount={editorDidMount}
              editorWillMount={editorWillMount}
              data-testid={dataTestId}
            />
          )}
        </div>
      </InlineItemEditor>
      {isDedicatedEditorOpen && (
        <DedicatedEditor
          initialHeight={input?.current?.scrollHeight || 0}
          langs={dedicatedEditorLanguages}
          customOptions={dedicatedEditorOptions}
          keywords={dedicatedEditorKeywords}
          functions={dedicatedEditorFunctions}
          onChangeLanguage={onChangeLanguage}
          onSubmit={updateArgFromDedicatedEditor}
          onCancel={onCancelDedicatedEditor}
        />
      )}
      {isEditable && readOnly && !isEditing && (
        <EuiButton
          fill
          color="secondary"
          onClick={() => setIsEditing(true)}
          className={styles.editBtn}
          data-testid="edit-monaco-value"
        >
          <EuiIcon type="pencil" />
        </EuiButton>
      )}
    </div>
  )
}

export default MonacoEditor
