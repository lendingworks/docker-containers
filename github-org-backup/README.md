# Github Organisation Backup

This container backs up your Github Organisation to an S3 bucket and is 
designed to run on a daily basis.

This uses the [Github Migrations API](https://developer.github.com/v3/migrations/orgs/) 
to create a migration archive of your organisation and all repositories within it.

Once the migration export is complete, it downloads the resulting archive and 
uploads to an S3 bucket of your choosing.

The container keeps up to 60 days (configurable) of daily backups and up to 
12 months (configurable) of monthly backups. It does this by selecting the first
daily backup of each month and tagging it (using S3 object tags) to indicate
that it is a monthly backup.

# Configuration

The container is configured using the below environment variables.

To generate the Github Personal Access Token, follow the below link as 
organisation owner: [generate token](https://github.com/settings/tokens/new?scopes=repo,public_repo,read:packages,read:org,read:public_key,read:repo_hook,read:user,read:discussion,read:enterprise,read:gpg_key,notifications&description=Organisation+Backup).

## Supported environment variables
* `GITHUB_TOKEN` (required): The Github Personal Access Token with access to create migrations
* `S3_BUCKET` (required): Name of the S3 bucket that backups will be saved to
* `ORGANISATION` (required): Name of the Github Organisation to back up
* `SNS_TOPIC_ARN` (optional): If defined, errors & alerts will be published to this SNS topic
* `DAILY_RETENTION` (optional, default: `60`): The number of days that daily backups are kept for
* `MONTHLY_RETENTION` (optional, default: `12`): The number of months that monthly backups are kept for

## AWS environment variables
It's recommended that you run this using an instance profile or IAM role and 
avoid passing credential keys directly to the container instance. 
e.g. we use [kiam](https://github.com/uswitch/kiam) within our Kubernetes 
cluster to bind IAM roles to pods.

If you wish to define these credentials manually, [the AWS documentation has a
description of the environment variables that are supported](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html).

You _may_ need to define the `AWS_REGION` environment variable for SNS alerting
if your environment does not already define it.

# Developing
This backup script is built using Typescript and [NCC](https://github.com/zeit/ncc/) for compilation.

## Installation

**Requirements**
* Node 12.x
* Yarn 1.21+

With the above installed, simply run:
```shell script
cd github-org-backup/src
yarn install
```

## Building
You can either build a dist version of the script with:
```shell script
yarn run build
```

Or run it in 'watch' mode:
```shell script
export GITHUB_TOKEN=my-personal-access-token
export S3_BUCKET=my-backup-bucket 
export ORGANISATION=lendingworks
yarn run watch
```

## Releasing
```shell script
cd github-org-backup
docker build -t lendingworks/github-org-backup:v1 .
docker tag lendingworks/github-org-backup:v1 lendingworks/github-org-backup:latest
docker push lendingworks/github-org-backup:v1
docker push lendingworks/github-org-backup:latest
```

Alternatively, just run the deploy script:
```shell script
cd github-org-backup
./scripts/deploy.sh
```
