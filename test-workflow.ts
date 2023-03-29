/******************************************************************************
 * This file is used with workflow.yml is running without errors and usage data
 * is sent to the DVC test org.
 * 
 * https://app.devcycle.com/o/org_U9F8YMaTChTEndWw/p/default/variables
 ******************************************************************************/
// @ts-nocheck

import { initialize } from '@devcycle/devcycle-js-sdk'

// The user object needs either a user_id, or isAnonymous set to true
const user = { user_id: 'my_user' }
let dvcClient

try {
  // Call initialize with the client key and a user object
  // await on the features to be loaded from our servers
  dvcClient = await initialize('client-123', user)
                          .onClientInitialized()
  
  useDVCVariable()
} catch(ex) {
  console.log('Error initializing DVC: ${ex}')
}

function useDVCVariable() {
  if (!dvcClient) return
  
  // Fetch variable values using the identifier key coupled with a default value
  // The default value can be of type string, boolean, number, or object
  const dvcVariableNumber = dvcClient.variable('test-feature-number', 10)
  const dvcVariableString = dvcClient.variable('test-feature-string', '10')
  const dvcVariableJson = dvcClient.variable('test-feature-json', {})
}