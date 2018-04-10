const axios = require('axios');
const fetch = require('node-fetch');
//const request = require('request');

module.exports = function (context, req) {
    context.log('VSTS webhook...');

    let githubRepoName = null;
    let githubIssueNumber = null;
    let githubUsername = process.env.GITHUB_USERNAME || null;
    let githubPersonalAccessToken = process.env.GITHUB_PAT || null;

    let vstsAccessToken = process.env.VSTS_ACCESSTOKEN || null;
    let vstsLogMetaURL = null;

    let buildStartTime = null;
    let buildFinishTime = null;

    //Parse information from vsts webhook information
    if (req.body.resource && req.body.resource.parameters) {
        const parsedParameters = JSON.parse(req.body.resource.parameters);

        githubIssueNumber = parsedParameters['system.pullRequest.pullRequestNumber'];

        let githubRepoURL = parsedParameters['system.pullRequest.sourceRepositoryUri'];
        let splittedURL = githubRepoURL.split('/');
        githubRepoName = splittedURL[splittedURL.length - 1].split('.git').join('');
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

    if (githubRepoName && githubIssueNumber && githubUsername && githubPersonalAccessToken && vstsAccessToken && vstsLogMetaURL) {
        context.log(`Fetching logs`);

        //Get logs
        getVSTSLogs(vstsLogMetaURL, vstsAccessToken, context).then((log) => {
            context.log('Fetching logs successful');

            if (log) {
                //Send request to github api
                const textToSend = `
                **Error logs**

                Build took ${Math.round((buildFinishTime.getTime() - buildStartTime.getTime()) / 1000)} seconds

                <details>
                    <summar>Build logs</summary>

                    \`\`\n${log}\n\`\`\`
                </details>
            `
                context.log('Posting github comment');

                postPRCommentOnGithub(githubUsername, githubRepoName, githubIssueNumber, githubPersonalAccessToken, log)
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
        context.done();

        return;
    }
};

const getVSTSLogs = (vstsLogMetaURL, vstsAccessToken, context) => {
    return fetch(vstsLogMetaURL, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${vstsAccessToken}` }
    })
        .then(response => response.json())
        .then(response => {
            const logEntries = response.value;

            return Promise.all(logEntries.map(logEntry =>
                fetch(logEntry.url, { headers: { 'Authorization': `Basic ${vstsAccessToken}` } })
                    .then(response => response.text())
            ))
                .then(responses => responses.reduce((logs, val) => val ? logs + val : logs), '')
                .catch(err => {
                    context.log(`Error at getVSTSLogs(${vstsLogMetaURL}, ${vstsAccessToken}): ${err}`);

                    return null;
                })
        })
        .catch(err => {
            context.log(`Error at getVSTSLogs(${vstsLogMetaURL}, ${vstsAccessToken}): ${err}`);

            return null;
        });
};

const postPRCommentOnGithub = (githubUsername, githubRepoName, githubIssueNumber, githubPersonalAccessToken, text) => {
    return new Promise((resolve, reject) => {
        axios.post(
            `https://api.github.com/repos/${githubUsername}/${githubRepoName}/issues/${githubIssueNumber}/comments`,
            {
                body: text
            },
            {
                headers: { 'Authorization': `Basic ${Buffer.from(`${githubUsername}:${githubPersonalAccessToken}`).toString('base64')}` }
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