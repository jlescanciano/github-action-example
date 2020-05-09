import {GitHubPredicate, EvaluationResult} from './predicate'
import {Approval} from './approval_action'
import * as github from '@actions/github'
import {Context as GitHubCtx} from '@actions/github/lib/context'
import * as _ from 'lodash'
import * as OctokitHelper from '../github/octohelper'
import {Team} from '../github/team'

export class ApprovalPredicate implements GitHubPredicate {
  approvalDef: Approval
  octokit: github.GitHub

  constructor(approvalDef: Approval, octokit: github.GitHub) {
    this.approvalDef = approvalDef
    this.octokit = octokit
  }

  async evaluate(githubContext: GitHubCtx): Promise<EvaluationResult> {
    let evaluationLog = ''
    const ruleName = this.approvalDef.name
    evaluationLog = evaluationLog.concat(`Evaluating ${ruleName}\n`)

    const whenClause = this.approvalDef.when
    let doEvaluation = true
    if (whenClause && whenClause.fileSetContains) {
      const fileRegExp = new RegExp(whenClause.fileSetContains, 'i')
      const filesChanged = await OctokitHelper.prChangedFiles(
        githubContext,
        this.octokit
      )
      const fileMatches = filesChanged.reduce(
        (acc, file) => acc || fileRegExp.test(file),
        false
      )
      if (!fileMatches) doEvaluation = false
    }

    let evaluationResult = true
    if (doEvaluation) {
      const minApprovals = this.approvalDef.min.count
      const requiredReviewers =
        this.approvalDef.required && this.approvalDef.required.reviewers
          ? this.approvalDef.required.reviewers
          : []
      const extractGitHubTeam = (text: string): Team => {
        const parts = text.split('/', 2)
        return {org: parts[0], slug: parts[1]}
      }

      const requiredTeams: Team[] =
        this.approvalDef.required && this.approvalDef.required.teams
          ? this.approvalDef.required.teams.map(extractGitHubTeam)
          : []
      const requiredTeamsAndMembers = await Promise.all(
        requiredTeams.map(
          async team =>
            await OctokitHelper.teamMembers(githubContext, this.octokit, team)
        )
      )
      const requiredTeamMembers = requiredTeamsAndMembers.reduce(
        (acc, members) => acc.concat(members),
        []
      )

      const fullReviewersList = _.uniq(
        requiredReviewers.concat(requiredTeamMembers)
      )
      evaluationLog = evaluationLog.concat(
        `Required reviewers list: ${JSON.stringify(
          fullReviewersList,
          null,
          2
        )}\n`
      )

      const currentApprovedReviewers = await OctokitHelper.prApprovedReviewers(
        githubContext,
        this.octokit
      )
      evaluationLog = evaluationLog.concat(
        `Current reviewers who approved the PR: ${JSON.stringify(
          currentApprovedReviewers,
          null,
          2
        )}\n`
      )

      const requiredReviewersApproving = currentApprovedReviewers.filter(
        reviewer => fullReviewersList.includes(reviewer)
      )
      evaluationLog = evaluationLog.concat(
        `Required reviewers who approved the PR: ${JSON.stringify(
          requiredReviewersApproving,
          null,
          2
        )}\n`
      )

      evaluationResult = requiredReviewersApproving.length >= minApprovals
      evaluationLog = evaluationLog.concat(
        `Got (${requiredReviewersApproving.length}) required reviewers approving of (${minApprovals}) needed\n`
      )
      evaluationLog = evaluationLog.concat(
        `Evaluation result: ${evaluationResult}`
      )
    }

    return {
      name: ruleName,
      skipped: !doEvaluation,
      result: evaluationResult,
      log: evaluationLog
    }
  }
}
