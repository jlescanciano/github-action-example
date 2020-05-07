const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');
const path = require('path');

const supported_events = ["pull_request", "pull_request_review"];

async function prChangedFiles(ctx, octokit) {
  let changedFiles = await octokit.paginate(
    octokit.pulls.listFiles.endpoint.merge({owner: ctx.repo.owner, repo: ctx.repo.repo, pull_number: ctx.payload.number}),
    res => res.data
  );
  return changedFiles.map(file => file.filename)
}

async function teamMembers(ctx, octokit, team) {
  let members = [];
  try {
    members = await octokit.paginate(
        octokit.teams.listMembersInOrg.endpoint.merge({org: team.org, team_slug: team.slug}),
        res => res.data
    );
  } catch(error) {
    console.error(`Error requesting team members for ${team.org}/${team.slug}`);
    members = [ {login: `${team.org}/${team.slug}`} ];
  }
  return members.map(member => member.login);
}

const findReviewersByState = (reviews, state) => {
  // filter out review submitted comments because it does not nullify an approved state.
  // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
  // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
  // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
  // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
  const relevantReviews = reviews.filter(element => element.state.toLowerCase() !== 'commented');

  // order it by date of submission. The docs says the order is chronological but we sort it so that
  // uniqBy will extract the correct last submitted state for the user.
  const ordered = _.orderBy(relevantReviews, ['submitted_at'], ['desc']);
  const uniqueByUser = _.uniqBy(ordered, 'user.login');

  // approved reviewers are ones that are approved and not nullified by other submissions later.
  return uniqueByUser
      .filter(element => element.state.toLowerCase() === state)
      .map(review => review.user && review.user.login)
};

async function prApprovedReviewers(ctx, octokit) {
  let reviews = await octokit.paginate(
      octokit.pulls.listReviews.endpoint.merge({repo: ctx.repo.repo, owner: ctx.repo.owner, pull_number: ctx.payload.number}),
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
    let evaluationLog = "";
    let ruleName = this.settings.name;
    evaluationLog = evaluationLog.concat(`Evaluating ${ruleName}\n`);

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

      let requiredTeams = (this.settings.required && this.settings.required.teams) ? this.settings.required.teams.map(extractGitHubTeam) : [];
      let requiredTeamsAndMembers = await Promise.all(requiredTeams.map(async team => await teamMembers(githubContext, this.octokit, team)));
      let requiredTeamMembers = requiredTeamsAndMembers.reduce((acc, members) => acc.concat(members), []);

      let fullReviewersList = _.uniq(requiredReviewers.concat(requiredTeams));
      evaluationLog = evaluationLog.concat(`Required reviewers list: ${JSON.stringify(fullReviewersList, null, 2)}\n`);

      let currentApprovedReviewers = await prApprovedReviewers(githubContext, this.octokit);
      evaluationLog = evaluationLog.concat(`Current reviewers who approved the PR: ${JSON.stringify(currentApprovedReviewers, null, 2)}\n`);

      let requiredReviewersApproving = currentApprovedReviewers.filter(reviewer => fullReviewersList.includes(reviewer));
      evaluationLog = evaluationLog.concat(`Required reviewers who approved the PR: ${requiredReviewersApproving}\n`);

      evaluationResult = requiredReviewersApproving.length >= minApprovals;
      evaluationLog = evaluationLog.concat(`Got (${requiredReviewersApproving.length}) required reviewers approving of (${minApprovals}) needed\n`);
      evaluationLog = evaluationLog.concat(`Evaluation result: ${evaluationResult}\n`);
    }

    console.log(evaluationLog);

    return { name: ruleName, skipped: !doEvaluation, result: evaluationResult };
  }
}

async function runAction() {
  try {
    console.log('Action initialized ...');

    let currentEventName = github.context.eventName;

    if(supported_events.includes(currentEventName)){
      console.log('Loading Octokit ...\n');
      const repositoryToken = core.getInput('token');
      const octokit = new github.GitHub(repositoryToken);

      // let githubWorkspace = process.env['GITHUB_WORKSPACE'];
      // if(!githubWorkspace) {
      //   throw new Error('GITHUB_WORKSPACE not defined')
      // }
      // let rulesFile = path.resolve(githubWorkspace.concat(path.sep).concat(".github/approval.yaml"));
      // console.log(`Loading rules from ${rulesFile}`)
      // let fileContents = fs.readFileSync(rulesFile, 'utf8');
      // let ruleset = yaml.safeLoad(fileContents);
      console.log('Loading rules ...\n');
      let rulesParam = core.getInput('rules');
      let ruleset = yaml.safeLoad(rulesParam);

      let evaluationResults = await Promise.all(ruleset.approval
        .map(ruleSettings => new ApprovalPredicate(ruleSettings, octokit))
        .map(async rule => await rule.evaluate(github.context))
      );

      let success = evaluationResults.reduce((acc, item) => acc && item.result, true);
      if(success) {
        console.log(`Success!`);
        core.setOutput("evaluated-rules", evaluationResults.length)
      } else {
        let failedRules = evaluationResults.filter(result => !result.result).map(result => result.name);
        core.setFailed(`The following evaluation rules weren't satisfied: ${failedRules}`)
      }
    } else {
      console.log(`Unsupported event ${currentEventName}`)
    }
  } catch (error) {
    console.log(error.stack);
    core.setFailed(error.message);
  }
}

runAction();
