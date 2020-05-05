const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    // `repo-token` input defined in action metadata file
    const repositoryToken = core.getInput('repo-token');
    const nameToGreet = core.getInput('who-to-greet');
    const octokit = new github.GitHub(repositoryToken);

    console.log(`Hello ${nameToGreet}!`);
    const time = (new Date()).toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log(`The event payload: ${payload}`);

    let result = await octokit.pulls.listFiles({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.number});
    console.log(JSON.stringify(result, undefined, 2));
    let changedFiles = result.data.map(file => file.filename);
    console.log(`The files changed: ${changedFiles}`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();