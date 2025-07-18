import React from 'react'
import cx from 'classnames'
import { EuiIcon, EuiLoadingSpinner, EuiText, EuiTextColor } from '@elastic/eui'
import { IconType } from '@elastic/eui/src/components/icon/icon'
import statusErrorIcon from 'uiSrc/assets/img/rdi/pipelineStatuses/status_error.svg?react'
import styles from './styles.module.scss'

export interface IProps {
  title: string | JSX.Element
  isSelected: boolean
  className?: string
  fileName?: string
  fileState?: 'default' | 'added' | 'modified'
  children?: React.ReactElement | string
  testID?: string
  isLoading?: boolean
  isValid?: boolean
  requireReview?: boolean
}

const Tab = (props: IProps) => {
  const {
    title,
    isSelected,
    children,
    fileName,
    fileState,
    testID,
    className,
    isLoading = false,
    isValid = true,
    requireReview = false,
  } = props
  let statusIconType: IconType = 'empty'
  let statusColor:
    | 'success'
    | 'warning'
    | 'danger'
    | 'accent'
    | 'ghost'
    | 'subdued'
    | 'default'
    | 'secondary' = 'default'

  if (fileState === 'modified') {
    statusColor = 'warning'
    statusIconType = 'editorCodeBlock'
  } else if (fileState === 'added') {
    statusColor = 'success'
    // Added job
    statusIconType = 'plus'
  }
  const statusIcon = (
    <EuiIcon
      type={statusIconType}
      color={statusColor}
      className={styles.fileIcon}
    />
  )
  return (
    <div
      className={cx(styles.wrapper, className, { [styles.active]: isSelected })}
      data-testid={testID}
    >
      {statusIcon}
      <EuiTextColor color={statusColor} className="rdi-pipeline-nav__title">
        {title}
      </EuiTextColor>
      {fileName ? (
        <div className="rdi-pipeline-nav__file">
          <EuiIcon type="document" className="rdi-pipeline-nav__fileIcon" />
          <EuiText
            className={cx('rdi-pipeline-nav__text', { invalid: !isValid })}
          >
            {fileName}
          </EuiText>
          {requireReview && (
            <>
              <EuiIcon
                type="check"
                className="rdi-pipeline-nav__review"
                data-testid="rdi-nav-config-review"
              />
              <EuiIcon
                type="editorUndo"
                className="rdi-pipeline-nav__review"
                data-testid="rdi-nav-config-review"
              />
            </>
          )}

          {!isValid && (
            <EuiIcon
              type={statusErrorIcon}
              className="rdi-pipeline-nav__error"
              data-testid="rdi-nav-config-error"
            />
          )}

          {isLoading && (
            <EuiLoadingSpinner
              data-testid="rdi-nav-config-loader"
              className={styles.loader}
            />
          )}
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export default Tab
