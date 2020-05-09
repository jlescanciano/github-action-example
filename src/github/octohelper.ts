import * as github from '@actions/github'
import * as _ from 'lodash'
import {Context as GitHubCtx} from '@actions/github/lib/context'
import {Octokit as OctokitRest} from '@octokit/rest'
import {Team} from './team'

export async function prChangedFiles(
  ctx: GitHubCtx,
  octokit: github.GitHub
): Promise<string[]> {
  return octokit
    .paginate(
      octokit.pulls.listFiles.endpoint.merge({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        pull_number: ctx.payload.number
      })
    )
    .then(async data => Promise.all(data.map(async file => file.filename)))
}

export async function teamMembers(
  ctx: GitHubCtx,
  octokit: github.GitHub,
  team: Team
): Promise<string[]> {
  // Default members is team itself prepended with @ so such member can't exist
  let members = [{login: `@${team.org}/${team.slug}`}]
  try {
    members = await octokit
      .paginate(
        octokit.teams.listMembersInOrg.endpoint.merge({
          org: team.org,
          team_slug: team.slug
        })
      )
      .then(data => data)
  } catch (error) {
    console.error(`Error requesting team members for ${team.org}/${team.slug}`)
    console.log(error.stack)
  }
  return members.map(member => member.login)
}

const findReviewersByState = (
  reviews: OctokitRest.PullsListReviewsResponse,
  state: string
): string[] => {
  // filter out review submitted comments because it does not nullify an approved state.
  // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
  // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
  // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
  // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
  const relevantReviews = reviews.filter(
    element => element.state.toLowerCase() !== 'commented'
  )

  // order it by date of submission. The docs says the order is chronological but we sort it so that
  // uniqBy will extract the correct last submitted state for the user.
  const ordered = _.orderBy(relevantReviews, ['submitted_at'], ['desc'])
  const uniqueByUser = _.uniqBy(ordered, 'user.login')

  // approved reviewers are ones that are approved and not nullified by other submissions later.
  return uniqueByUser
    .filter(element => element.state.toLowerCase() === state)
    .map(review => review.user && review.user.login)
}

export async function prApprovedReviewers(
  ctx: GitHubCtx,
  octokit: github.GitHub
): Promise<string[]> {
  return octokit
    .paginate(
      octokit.pulls.listReviews.endpoint.merge({
        repo: ctx.repo.repo,
        owner: ctx.repo.owner,
        pull_number: ctx.payload.number
      })
    )
    .then(data => findReviewersByState(data, 'approved'))
}
