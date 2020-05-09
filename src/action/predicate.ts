import {Context as GitHubCtx} from '@actions/github/lib/context'

export interface EvaluationResult {
  name: string
  skipped: boolean
  result: boolean
  log: string
}

export interface GitHubPredicate {
  evaluate(githubContext: GitHubCtx): Promise<EvaluationResult>
}
