const core = require('@actions/core');
const github = require('@actions/github');

try {
  // `repo-token` input defined in action metadata file
  const repositoryToken = core.getInput('repo-token');
  const nameToGreet = core.getInput('who-to-greet');
  const octokit = new github.GitHub(repositoryToken);
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  console.log(`Hello ${nameToGreet}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);

  let result = octokit.pulls.listFiles({owner, repo, pull_number: payload.number})
  let changedFiles = result.data.map(file => file.filename)
  console.log(`The files changed: ${changedfiles}`);

} catch (error) {
  core.setFailed(error.message);
}
