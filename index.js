const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');

const supported_events = ["pull_request", "pull_request_review"];

async function prChangedFiles(ctx, octokit) {
  let changedFiles = await octokit.paginate(
    octokit.pulls.listFiles.endpoint.merge({owner: ctx.repo.owner, repo: ctx.repo.repo, pull_number: ctx.payload.number}),
    res => res.data
  );
  return changedFiles.map(file => file.filename)
}

function teamMembers(ctx, octokit, teams) {
  // let team_members = octokit.teams.listMembersInOrg({
  //   org: "n26",
  //   team_slug: "techleads"
  // }).data.map(member => (member.id, member.login)); // id: number, login: string
  return teams.map(team => `${team.org}:${team.slug}`)
}

const findReviewersByState = (reviews, state) => {
  // filter out review submitted comments because it does not nullify an approved state.
  // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
  // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
  // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
  // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
  const relevantReviews = reviews.filter(element => element.state.toLowerCase() !== 'commented')

  // order it by date of submission. The docs says the order is chronological but we sort it so that
  // uniqBy will extract the correct last submitted state for the user.
  const ordered = _.orderBy(relevantReviews, ['submitted_at'], ['desc'])
  const uniqueByUser = _.uniqBy(ordered, 'user.login')

  // approved reviewers are ones that are approved and not nullified by other submissions later.
  return uniqueByUser
      .filter(element => element.state.toLowerCase() === state)
      .map(review => review.user && review.user.login)
};

async function prApprovedReviewers(ctx, octokit) {
  let reviews = await octokit.paginate(
      octokit.pulls.listReviews({repo: ctx.repo.repo, owner: ctx.repo.owner, pull_number: ctx.payload.number}),
      res => res.data
  );
  return findReviewersByState(reviews, 'approved');
}

class ApprovalPredicate {
  constructor(rawSettings, octokit) {
    this.settings = rawSettings;
    this.octokit = octokit;
  }

  async evaluate(githubContext) {

    let whenClause = this.settings.when;
    let doEvaluation = true;
    if (whenClause && whenClause.fileSetContains) {
      let fileRegExp = new RegExp(whenClause.fileSetContains, 'i');
      let filesChanged = await prChangedFiles(githubContext, this.octokit);
      let fileMatches = filesChanged.reduce((acc, file) => acc || fileRegExp.test(file), false);
      if(!fileMatches) doEvaluation = false;
    }

    let evaluationResult = true;
    if(doEvaluation) {
      let minApprovals = this.settings.min.count;
      let requiredReviewers = (this.settings.required && this.settings.required.reviewers) ? this.settings.required.reviewers : [];
      let extractGitHubTeam = (text) => {
        let parts = text.split("/", 2);
        return {org: parts[0], slug: parts[1]}
      };
      let requiredTeams = await teamMembers(githubContext, this.octokit, (this.settings.required && this.settings.required.teams) ? this.settings.required.teams.map(extractGitHubTeam) : []);
      let fullReviewersList = _.uniq(requiredReviewers.concat(requiredTeams));
      console.log(`Full reviewers list: ${fullReviewersList}`);

      let currentApprovedReviewers = await prApprovedReviewers(githubContext, this.octokit);

      let requiredReviewersApproving = currentApprovedReviewers.filter(reviewer => fullReviewersList.includes(reviewer));
      console.log(requiredReviewersApproving);
      evaluationResult = requiredReviewersApproving.length >= minApprovals;
    }

    return { name: this.settings.name, skipped: !doEvaluation, result: evaluationResult };
  }
}

async function runAction() {
  try {
    let currentEventName = github.context.eventName;

    if(supported_events.includes(currentEventName)){
      const repositoryToken = core.getInput("repo-token");
      const octokit = new github.GitHub(repositoryToken);

      // Get the JSON webhook payload for the event that triggered the workflow
      // const payload = JSON.stringify(github.context.payload, undefined, 2);
      // console.log(`The event payload: ${payload}`);

      //Files changed in the PR
      let changedFiles = await prChangedFiles(github.context, octokit);
      console.log(`The files changed: ${changedFiles}`);

      console.log("reading the yaml file ...");

      let path = "./.github/approval.yaml";
      let fileContents = fs.readFileSync(path, 'utf8');
      let ruleset = yaml.safeLoad(fileContents);

      console.log(ruleset);

      ruleset.approval.forEach(async (ruleSettings) => {
        let rule = new ApprovalPredicate(ruleSettings, octokit);
        let result = await rule.evaluate(github.context);
        console.log(`Evaluation: ${JSON.stringify(result)}`)
      });

    } else {
      console.log(`Unsupported event ${currentEventName}`)
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

runAction();
