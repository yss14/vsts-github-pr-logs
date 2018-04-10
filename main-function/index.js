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

    try {
        axios.post(`https://api.github.com/repos/${githubUsername}/${githubRepoName}/issues/${githubIssueNumber}/comments`, {
            body: `**Here are the correspondig error logs`
        }, {
                headers: { 'Authorization': `Basic ${Buffer.from(`${githubUsername}:${githubPersonalAccessToken}`).toString('base64')}` }
            })
            .then(response => {
                if (response.status >= 200 && response.status <= 204) {
                    context.res = {
                        body: 'Success'
                    }

                    context.done(context);

                    return;
                } else {
                    context.log('Something went wrong while sending new comment to github');

                    context.res = {
                        body: 'Failed'
                    }

                    context.done(context);

                    return;
                }
            })
    } catch (err) {
        context.log(err);
    }

    //Get logs
    /*getVSTSLogs(vstsLogMetaURL, vstsAccessToken, context).then((log) => {
        if (log) {
            //Send request to github api
            axios.post(`https://api.github.com/repos/${githubUsername}/${githubRepoName}/issues/${githubIssueNumber}/comments`, {
                body: `**Here are the correspondig error logs**\n\n\`\`\`\n${log}\n\`\`\``
            }, {
                    headers: { 'Authorization': `Basic ${Buffer.from(`${githubUsername}:${githubPersonalAccessToken}`).toString('base64')}` }
                })
                .then(response => {
                    if (response.status >= 200 && response.status <= 204) {
                        context.res = {
                            body: 'Success'
                        }

                        context.done(context);

                        return;
                    } else {
                        context.log('Something went wrong while sending new comment to github');

                        context.res = {
                            body: 'Failed'
                        }

                        context.done(context);

                        return;
                    }
                })
        } else {
            context.log('Received no logs from getVSTSLogs()');
            context.done();

            return;
        }
    });*/
};

const getVSTSLogs = (vstsLogMetaURL, vstsAccessToken, context) => {
    return fetch(vstsLogMetaURL, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${vstsAccessToken}` }
    })
        .then(response => response.json())
        .then(response => {
            console.log(response);
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