# vsts-github-pr-logs
You like using VSTS for CI & CD together with your GitHub projects, but you need also to provide errors log to other users who created pull requests?
This simple Azure Function does the job!

![Screenshot of a GitHub pull request provided VSTS error logs via a comment created by this Azure Function](https://preview.ibb.co/neq6SH/Screen_Shot_2018_04_10_at_09_50_15.png)

## Setup

* Fork or copy this repository
* Create an Azure Function running this code
* Copy webhook URL of the Azure Function
* In VSTS, create a new service hook for the `Build completed` event and `Build status` set to `failed`

That's it! Now on every failed build a webhook is sent to your Azure Functions. The function parses the payload, fetches correspondig logs, and creates a comment on the PR providing the build logs.

### Env variables
For the Azure Function you need to provide the following environment variables:

* GITHUB_USERNAME //The pull request comment is posted by this user
* GITHUB_PAT //Personal access token for the user
* VSTS_USERNAME //The user name of the VSTS account where the build definition is located
* VSTS_PAT //Personal access token for the user

If you have question, please open an issues ;)

