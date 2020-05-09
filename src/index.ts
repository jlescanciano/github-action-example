import * as core from '@actions/core'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import * as ApprovalAction from './action/approval_action'
import {ApprovalPredicate} from './action/approval_predicate'

const SUPPORTED_EVENTS = ['pull_request', 'pull_request_review']

async function runAction(): Promise<void> {
  try {
    console.log('Action initialized ...')

    const currentEventName = github.context.eventName

    if (SUPPORTED_EVENTS.includes(currentEventName)) {
      console.log('Loading Octokit ...\n')
      const repositoryToken = core.getInput('token')
      const octokit = new github.GitHub(repositoryToken)

      console.log('Loading rules ...\n')
      const rulesParam = core.getInput('rules')
      const ruleset: ApprovalAction.RuleSet = yaml.safeLoad(rulesParam)

      const evaluationResults = await Promise.all(
        ruleset.approval
          .map(ruleSettings => new ApprovalPredicate(ruleSettings, octokit))
          .map(async rule => await rule.evaluate(github.context))
      )

      evaluationResults.forEach(evaluation =>
        console.log(`\n---\n${evaluation.log}\n---\n`)
      )

      const success = evaluationResults.reduce(
        (acc, item) => acc && item.result,
        true
      )
      if (success) {
        console.log(`Success!`)
        core.setOutput('evaluated-rules', evaluationResults.length)
      } else {
        const failedRules = evaluationResults
          .filter(result => !result.result)
          .map(result => result.name)
        core.setFailed(
          `The following evaluation rules weren't satisfied: ${JSON.stringify(
            failedRules,
            null,
            2
          )}`
        )
      }
    } else {
      console.log(`Unsupported event ${currentEventName}`)
    }
  } catch (error) {
    console.log(error.stack)
    core.setFailed(error.message)
  }
}

runAction()
