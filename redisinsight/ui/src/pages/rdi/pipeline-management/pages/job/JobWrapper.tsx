import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useHistory, useParams } from 'react-router-dom'
import { findIndex } from 'lodash'

import { sendPageViewTelemetry, TelemetryPageView } from 'uiSrc/telemetry'
import { rdiPipelineSelector } from 'uiSrc/slices/rdi/pipeline'
import { Pages } from 'uiSrc/constants'
import { Maybe } from 'uiSrc/utils'
import Job from './Job'

const JobWrapper = () => {
  const { rdiInstanceId, jobName } = useParams<{
    rdiInstanceId: string
    jobName: string
  }>()

  const [decodedJobName, setDecodedJobName] = useState<string>(
    decodeURIComponent(jobName),
  )
  const [jobIndex, setJobIndex] = useState<number>(-1)
  const [deployedJobValue, setDeployedJobValue] = useState<Maybe<string>>()

  const history = useHistory()

  const rdiPipelineState = useSelector(rdiPipelineSelector)
  const { data, jobs, loading } = rdiPipelineState
  const {desiredPipeline} = rdiPipelineState as any

  useEffect(() => {
    // Don't redirect while still loading data
    if (loading) return

    const jobIndex = findIndex(jobs, ({ name }) => name === decodedJobName)
    setJobIndex(jobIndex)

    // If job not found in current jobs, check if it exists in desired pipeline
    if (jobIndex === -1) {
      const desiredJobExists = desiredPipeline?.jobs?.some((job: any) => job.name === decodedJobName)
      
      if (!desiredJobExists) {
        // Only redirect if job doesn't exist in either current or desired state
        history.push(Pages.rdiPipelineConfig(rdiInstanceId))
      }
    }
  }, [decodedJobName, rdiInstanceId, jobs?.length, desiredPipeline?.jobs, loading])

  useEffect(() => {
    setDecodedJobName(decodeURIComponent(jobName))
  }, [jobName])

  useEffect(() => {
    sendPageViewTelemetry({
      name: TelemetryPageView.RDI_JOBS,
      eventData: {
        rdiInstanceId,
      },
    })
  }, [])

  useEffect(() => {
    const newDeployedJob = data?.jobs.find((el) => el.name === decodedJobName)

    setDeployedJobValue(newDeployedJob ? newDeployedJob.value : undefined)
  }, [data, decodedJobName])

  // Get job value from current jobs or desired pipeline
  const getJobValue = () => {
    if (jobIndex !== -1) {
      return jobs[jobIndex]?.value ?? ''
    }
    
    // If job doesn't exist in current jobs, try to get it from desired pipeline
    const desiredJob = desiredPipeline?.jobs?.find((job: any) => job.name === decodedJobName)
    return desiredJob?.value ?? ''
  }

  return (
    <Job
      name={decodedJobName}
      value={getJobValue()}
      deployedJobValue={deployedJobValue}
      jobIndex={jobIndex}
      rdiInstanceId={rdiInstanceId}
    />
  )
}

export default React.memo(JobWrapper)
