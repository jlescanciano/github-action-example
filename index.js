const core = require('@actions/core');
const github = require('@actions/github');

const supported_events = ["pull_request", "pull_request_review"];

async function prChangedFiles(ctx, octokit) {
  let result = await octokit.pulls.listFiles({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    pull_number: ctx.payload.number
  });

  return result.data.map(file => file.filename);
}

async function run() {
  try {
    let currentEventName = github.context.eventName;

    if(supported_events.includes(currentEventName)){
      // `repo-token` input defined in action metadata file
      const repositoryToken = core.getInput("repo-token");
      const octokit = new github.GitHub(repositoryToken);

      const time = (new Date()).toTimeString();
      core.setOutput("time", time);

      // Get the JSON webhook payload for the event that triggered the workflow
      const payload = JSON.stringify(github.context.payload, undefined, 2);
      console.log(`The event payload: ${payload}`);

      // let team_members = octokit.teams.listMembersInOrg({
      //   org: "n26",
      //   team_slug: "techleads"
      // }).data.map(member => (member.id, member.login)); // id: number, login: string

      //Files changed in the PR
      let changedFiles = await prChangedFiles(github.context, octokit)
      console.log(`The files changed: ${changedFiles}`);
    } else {
      console.log(`Unsupported event ${currentEventName}`)
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();