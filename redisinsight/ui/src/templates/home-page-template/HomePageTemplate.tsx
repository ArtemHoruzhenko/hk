import React from 'react'

import { ExplorePanelTemplate } from 'uiSrc/templates'
import HomeTabs from 'uiSrc/components/home-tabs'
import { FeatureFlags } from 'uiSrc/constants'
import { FeatureFlagComponent, OAuthUserProfile } from 'uiSrc/components'
import { OAuthSocialSource } from 'uiSrc/slices/interfaces'
import { CopilotTrigger, InsightsTrigger } from 'uiSrc/components/triggers'

import { Flex, FlexItem } from 'uiSrc/components/base/layout/flex'
import styles from './styles.module.scss'

export interface Props {
  children: React.ReactNode
}

const HomePageTemplate = (props: Props) => {
  const { children } = props

  return (
    <>
      <div className={styles.pageDefaultHeader}>
        <HomeTabs />
        <Flex style={{ flexGrow: 0 }} gap="none" align="center">
          <FlexItem style={{ marginRight: 12 }}>
            <CopilotTrigger />
          </FlexItem>
          <FlexItem grow>
            <InsightsTrigger source="home page" />
          </FlexItem>
          <FeatureFlagComponent
            name={[FeatureFlags.cloudSso, FeatureFlags.cloudAds]}
          >
            <FlexItem
              grow
              style={{ marginLeft: 16 }}
              data-testid="home-page-sso-profile"
            >
              <OAuthUserProfile source={OAuthSocialSource.UserProfile} />
            </FlexItem>
          </FeatureFlagComponent>
        </Flex>
      </div>
      <div className={styles.pageWrapper}>
        <ExplorePanelTemplate panelClassName={styles.explorePanel}>
          {children}
        </ExplorePanelTemplate>
      </div>
    </>
  )
}

export default React.memo(HomePageTemplate)
