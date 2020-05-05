const core = require('@actions/core');
const github = require('@actions/github');

try {
  // `repo-token` input defined in action metadata file
  const repositoryToken = core.getInput('repo-token');
  const nameToGreet = core.getInput('who-to-greet');
  const octokit = new github.GitHub(repositoryToken);

  console.log(`Hello ${nameToGreet}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
  
} catch (error) {
  core.setFailed(error.message);
}
