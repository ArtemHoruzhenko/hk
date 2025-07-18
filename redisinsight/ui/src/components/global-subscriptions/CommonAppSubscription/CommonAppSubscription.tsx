import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Socket } from 'socket.io-client'

import {
  CloudJobEvents,
  SocketEvent,
  SocketFeaturesEvent,
} from 'uiSrc/constants'
import { NotificationEvent } from 'uiSrc/constants/notifications'
import {
  addInfiniteNotification,
  removeInfiniteNotification,
  setNewNotificationAction,
} from 'uiSrc/slices/app/notifications'
import { setIsConnected } from 'uiSrc/slices/app/socket-connection'
import { getSocketApiUrl, Nullable } from 'uiSrc/utils'
import { connectedInstanceSelector } from 'uiSrc/slices/instances/instances'
import { addUnreadRecommendations } from 'uiSrc/slices/recommendations/recommendations'
import { RecommendationsSocketEvents } from 'uiSrc/constants/recommendations'
import { getFeatureFlagsSuccess } from 'uiSrc/slices/app/features'
import { oauthCloudJobSelector, setJob } from 'uiSrc/slices/oauth/cloud'
import { CloudJobName } from 'uiSrc/electron/constants'
import { appCsrfSelector } from 'uiSrc/slices/app/csrf'
import { useIoConnection } from 'uiSrc/services/hooks/useIoConnection'
import { CloudJobInfo } from 'apiSrc/modules/cloud/job/models'
import { EuiProgress, EuiText } from '@elastic/eui'
import { Spacer } from 'uiSrc/components/base/layout/spacer'
import { setDesiredPipeline } from 'uiSrc/slices/rdi/pipeline';

const enum AITools {
  EXECUTE_SNIPPET = 'data_execute_snippet',
  SET_DESIRED_STATE = 'set_desired_state',
}

const CommonAppSubscription = () => {
  const { id: jobId = '' } = useSelector(oauthCloudJobSelector) ?? {}
  const { id: instanceId } = useSelector(connectedInstanceSelector)
  const { token } = useSelector(appCsrfSelector)
  const socketRef = useRef<Nullable<Socket>>(null)
  const connectIo = useIoConnection(getSocketApiUrl(), {
    forceNew: false,
    token,
    reconnection: true,
  })

  const dispatch = useDispatch()

  useEffect(() => {
    if (socketRef.current?.connected) {
      return
    }

    socketRef.current = connectIo()

    socketRef.current.on(SocketEvent.Connect, () => {
      dispatch(setIsConnected(true))
    })

    socketRef.current.on(NotificationEvent.Notification, (data) => {
      dispatch(setNewNotificationAction(data))
    })

    socketRef.current.on(NotificationEvent.AITool, ({ tool, data }) => {
      try {
        switch (tool) {
          case AITools.EXECUTE_SNIPPET:
            const { total, processed, id } = data

            // finished import close notification
            if (processed >= total) {
              dispatch(removeInfiniteNotification(id))
              return
            }

            // show progress
            dispatch(
              addInfiniteNotification({
                id,
                Inner: (
                  <>
                    <EuiText>Processing data...</EuiText>
                    <Spacer />
                    <EuiProgress
                      size={'m'}
                      value={processed}
                      valueText={false}
                      label={'Executing commands'}
                      max={total}
                    />
                  </>
                ),
              }),
            )
            break
          case AITools.SET_DESIRED_STATE:
            console.log('received desired state', data)
            dispatch(setDesiredPipeline(data.desiredPipeline))
            break;
          default:
          // ignore
        }
      } catch (e) {
        console.log('___ some error on tool ws call', e)
      }
    })

    socketRef.current.on(SocketFeaturesEvent.Features, (data) => {
      dispatch(getFeatureFlagsSuccess(data))

      // or
      // dispatch(fetchFeatureFlags())
    })

    socketRef.current.on(CloudJobEvents.Monitor, (data: CloudJobInfo) => {
      const jobName = data.name as unknown

      if (
        jobName === CloudJobName.CreateFreeDatabase ||
        jobName === CloudJobName.CreateFreeSubscriptionAndDatabase ||
        jobName === CloudJobName.ImportFreeDatabase
      ) {
        dispatch(setJob(data))
      }
    })

    // Catch disconnect
    socketRef.current?.on(SocketEvent.Disconnect, () => {
      unSubscribeFromRecommendations()
    })

    emitCloudJobMonitor(jobId)
  }, [])

  useEffect(() => {
    emitCloudJobMonitor(jobId)
  }, [jobId])

  const unSubscribeFromRecommendations = () => {
    const subscription = RecommendationsSocketEvents.Recommendation
    const isListenerExist = !!socketRef.current?.listeners(subscription).length

    if (isListenerExist) {
      socketRef.current?.removeListener(subscription)
    }
  }

  useEffect(() => {
    if (!instanceId) return

    unSubscribeFromRecommendations()

    socketRef.current?.on(
      RecommendationsSocketEvents.Recommendation,
      (data) => {
        const databaseId = data.recommendations[0]?.databaseId as string
        if (databaseId === instanceId) {
          dispatch(addUnreadRecommendations(data))
        }
      },
    )
  }, [instanceId])

  const emitCloudJobMonitor = (jobId: string) => {
    if (!jobId) return

    socketRef.current?.emit(CloudJobEvents.Monitor, { jobId })
  }

  return null
}

export default CommonAppSubscription
