const axios = require('axios');
const fetch = require('node-fetch');
//const request = require('request');

module.exports = function (context, req) {
    context.log('VSTS webhook...');

    let githubRepoName = null;
    let githubIssueNumber = null;
    let githubRepoOwner = null;
    let githubUsername = process.env.GITHUB_USERNAME || null;
    let githubPersonalAccessToken = process.env.GITHUB_PAT || null;

    let vstsUsername = process.env.VSTS_USERNAME || null;
    let vstsPersonalAccessToken = process.env.VSTS_PAT || null;
    let vstsLogMetaURL = null;

    let buildStartTime = null;
    let buildFinishTime = null;
    let buildID = -1;

    //Parse information from vsts webhook information
    if (req.body.resource && req.body.resource.parameters) {
        const parsedParameters = JSON.parse(req.body.resource.parameters);

        githubIssueNumber = parsedParameters['system.pullRequest.pullRequestNumber'];

        let githubRepoURL = parsedParameters['system.pullRequest.sourceRepositoryUri'];
        let splittedURL = githubRepoURL.split('/');
        githubRepoName = splittedURL[splittedURL.length - 1].split('.git').join('');
        githubRepoOwner = splittedURL[splittedURL.length - 2];
        buildID = req.body.resource.id;
    } else {
        context.log('Cannot find body.resource.parameters');
        context.done();

        return;
    }

    if (req.body.resource && req.body.resource.logs && req.body.resource.logs.url) {
        vstsLogMetaURL = req.body.resource.logs.url;
    }

    if (req.body.resource && req.body.resource.startTime && req.body.resource.finishTime) {
        buildStartTime = Date.parse(req.body.resource.startTime);
        buildFinishTime = Date.parse(req.body.resource.finishTime);
    }

    if (githubRepoName && githubIssueNumber && githubUsername && githubPersonalAccessToken
        && vstsUsername && vstsPersonalAccessToken && vstsLogMetaURL && githubRepoOwner) {

        context.log(`Fetching logs`);

        //Get logs
        getVSTSLogs(vstsLogMetaURL, vstsUsername, vstsPersonalAccessToken, context).then((log) => {
            context.log('Fetching logs successful');

            if (log !== undefined && log !== null) {
                //Check if code coverage info should be provided
                let codeCoverageUrl = null;

                if (buildID !== -1 && process.env.VSTS_CODE_COVERAGE_LOGKEYWORD && process.env.VSTS_CODE_COVERAGE_URL) {
                    if (log.indexOf(process.env.VSTS_CODE_COVERAGE_LOGKEYWORD) > -1) {
                        codeCoverageUrl = `${process.env.VSTS_CODE_COVERAGE_URL}/${buildID}/index.html`;
                    }
                }

                //Send request to github api
                let secondsBuildTook = 0;

                if (buildFinishTime && buildStartTime) {
                    secondsBuildTook = Math.round((buildFinishTime - buildStartTime) / 1000);
                }

                const codeCoverageText = codeCoverageUrl !== null ? `Code Coverage: [Statistics](${codeCoverageUrl})\n\n` : '';
                const textToSend = `**Error logs**\n\nBuild took ${secondsBuildTook} seconds\n\n${codeCoverageText}<details>\n<summary>Build logs</summary>\n\n\`\`\`\n${log}\n\`\`\`\n\n</details>`;

                context.log('Posting github comment');

                postPRCommentOnGithub(githubUsername, githubRepoOwner, githubRepoName, githubIssueNumber, githubPersonalAccessToken, textToSend)
                    .then(() => {
                        //Comment successfully posted on PR
                        context.log('Posting github comment successful');

                        context.res = {
                            body: 'Success'
                        };
                        context.done();

                        return;
                    })
                    .catch(err => {
                        context.log(err);

                        context.res = {
                            body: err
                        };

                        context.done();

                        return;
                    });
            } else {
                context.log('Received no logs from getVSTSLogs()');
                context.done();

                return;
            }
        });
    } else {
        context.log('Some meta information are missing');

        context.log(`githubRepoName: ${githubRepoName}`);
        context.log(`githubRepoOwner: ${githubRepoOwner}`);
        context.log(`githubIssueNumber: ${githubIssueNumber}`);
        context.log(`githubUsername: ${githubUsername}`);
        context.log(`githubPersonalAccessToken: ${githubPersonalAccessToken ? 'is provided' : null}`);
        context.log(`vstsUsername: ${vstsUsername}`);
        context.log(`vstsPersonalAccessToken: ${vstsPersonalAccessToken ? 'is provided' : null}`);
        context.log(`vstsLogMetaURL: ${vstsLogMetaURL}`);

        context.done();

        return;
    }
};

const getVSTSLogs = (vstsLogMetaURL, vstsUsername, vstsPersonalAccessToken, context) => {
    return fetch(vstsLogMetaURL, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${Buffer.from(`${vstsUsername}:${vstsPersonalAccessToken}`).toString('base64')}` }
    })
        .then(response => response.json())
        .then(response => {
            const logEntries = response.value;

            return Promise.all(logEntries.map(logEntry =>
                fetch(logEntry.url, { headers: { 'Authorization': `Basic ${Buffer.from(`${vstsUsername}:${vstsPersonalAccessToken}`).toString('base64')}` } })
                    .then(response => response.text())
            ))
                .then(responses => responses.reduce((logs, val) => val ? logs + val : logs), '')
                .catch(err => {
                    context.log(`Error at getVSTSLogs(${vstsLogMetaURL}, ${vstsUsername}, <PAT>): ${err}`);

                    return null;
                })
        })
        .catch(err => {
            context.log(`Error at getVSTSLogs(${vstsLogMetaURL}, ${vstsAccessToken}): ${err}`);

            return null;
        });
};

const postPRCommentOnGithub = (githubUsername, githubRepoOwner, githubRepoName, githubIssueNumber, githubPersonalAccessToken, text) => {
    return new Promise((resolve, reject) => {
        axios.post(
            `https://api.github.com/repos/${githubRepoOwner}/${githubRepoName}/issues/${githubIssueNumber}/comments`,
            {
                body: text
            },
            {
                headers: { 'Authorization': `token ${githubPersonalAccessToken}` }
            }
        )
            .then(response => {
                if (response.status >= 200 && response.status <= 204) {
                    resolve();
                } else {
                    reject(response.data);
                }
            })
            .catch(err => reject(err));
    });
};