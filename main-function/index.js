module.exports = function (context, req) {
    context.log('VSTS webhook...');

    let githubRepoName = null;
    let githubIssueNumber = null;
    let githubUsername = process.env.GITHUB_USERNAME || null;
    let githubPersonalAccessToken = process.env.GITHUB_PAT || null;

    //Parse information from vsts webhook information
    if (req.body.resource && req.body.resource.parameters) {
        const parsedParameters = JSON.parse(req.body.resource.parameters);

        githubIssueNumber = parsedParameters['system.pullRequest.pullRequestNumber'];

        let githubRepoURL = parsedParameters['system.pullRequest.sourceRepositoryUri'];
        let splittedURL = githubRepoURL.split('/');
        githubRepoName = splittedURL[splittedURL.length - 1].split('.git').join('');

        context.log(`${githubRepoName} | ${githubIssueNumber} | ${githubUsername} | ${githubPersonalAccessToken}`);

        context.res = {
            body: `${githubRepoName} | ${githubIssueNumber} | ${githubUsername} | ${githubPersonalAccessToken}`
        }
    } else {
        context.error('Cannot find body.resource.parameters');
        context.done();

        return;
    }

    context.done();
};