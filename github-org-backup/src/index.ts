import * as Octokit from '@octokit/rest';
import * as winston from 'winston';
import { default as fetch } from 'node-fetch';
import { S3, SNS } from 'aws-sdk';
import { promisify } from 'util';
import { ManagedUpload } from 'aws-sdk/lib/s3/managed_upload';
import { TagSet } from 'aws-sdk/clients/s3';

interface TaggedS3ListItem {
  key: string,
  tags: {[key: string]: string}
}

enum BackupType {
  DAILY = 'daily',
  MONTHLY = 'monthly',
}

// Tags used on backup objects.
enum BackupTag {
  MIGRATION_ID = 'migration-id',
  TIMESTAMP = 'timestamp',
  MIGRATION_CREATED_AT = 'migration-created-at',
  ORGANISATION = 'organisation',
  TYPE = 'type',
}

class GithubOrgBackup {
  private readonly logger: winston.Logger;
  private readonly octokit: Octokit;
  private readonly s3Client: S3;
  private snsClient: SNS | null = null;
  // Github Personal Access Token.
  private readonly ghToken: string;
  // Name of the organisation that's being backed up.
  private readonly organisation: string;
  // Backup destination.
  private readonly s3Bucket: string;
  // How many days daily backups are kept for.
  private readonly dailyRetention: number;
  // How many months monthly backups are kept for.
  private readonly monthlyRetention: number;
  // Custom header required to enable use of the Github Migrations Preview API:
  // https://developer.github.com/v3/migrations/orgs/
  private readonly GH_PREVIEW_HEADERS = {
    'Accept': 'application/vnd.github.wyandotte-preview+json',
  };
  private readonly REQUIRED_TAGS: string[] = [
    BackupTag.TYPE,
    BackupTag.TIMESTAMP,
  ];
  // A list of migration IDs that have already been evaluated.
  private checkedMigrations: number[] = [];

  constructor(private readonly snsTopicArn: string | null) {
    const logLevel = this.loadEnvVar(
      'LOGLEVEL',
      false,
      'info'
    ).toLowerCase();
    this.logger = winston.createLogger({
      level: logLevel,
      transports: [
        new winston.transports.Console({
          format: winston.format.cli(),
        } as any),
      ]
    } as any);

    this.organisation = this.loadEnvVar('ORGANISATION');
    this.dailyRetention = parseInt(this.loadEnvVar(
      'DAILY_RETENTION',
      false,
      '60'
    ), 10);
    this.monthlyRetention = parseInt(this.loadEnvVar(
      'MONTHLY_RETENTION',
      false,
      '12'
    ), 10);

    this.ghToken = this.loadEnvVar('GITHUB_TOKEN');
    this.octokit = new Octokit({
      auth: this.ghToken,
    });

    this.s3Bucket = this.loadEnvVar('S3_BUCKET');
    this.s3Client = new S3({
      params: {
        Bucket: this.s3Bucket,
      }
    })
  }

  /**
   * Loads an environment variable value. Throws an exception if a variable
   * does not exist and it is required.
   *
   * @param name Name of variable
   * @param required TRUE if this is a required variable, FALSE otherwise.
   * @param defaultVal The default value to return if the variable is not
   * required and it is not present.
   */
  private loadEnvVar(
    name: string,
    required: boolean = true,
    defaultVal: string = '',
  ): string {
    const missing = !(name in process.env) || process.env[name] === undefined;
    if (missing && required) {
      throw new Error(
        `The '${name}' environment variable could not be read, please make sure it's defined and try again.`
      );
    }

    let val: string;
    if (missing) {
      val = defaultVal;
    } else {
      val = process.env[name] as string
    }

    return val;
  }

  /**
   * Checks if a backup exists in S3 for a given timestamp.
   *
   * @param timestamp Timestamp to check, in the format: YYYY-MM-DD.
   */
  private async backupExists(timestamp: string): Promise<boolean> {
    const listObjects = promisify(this.s3Client.listObjectsV2).bind(this.s3Client);

    // We have to use 'list' since we might not know the actual key of the
    // backup, since it's stored in the following key:
    // <timestamp>/<migration_id>.tar.gz
    const list = await listObjects({
      Prefix: `${timestamp}/`,
    });

    return list.Contents.length > 0;
  }

  private async checkExistingMigrations(): Promise<boolean> {
    const logPrefix = '[checkExistingMigrations]';

    this.logger.info(`${logPrefix} Fetching migration list...`);

    const migrationList = await this.octokit.migrations.listForOrg({
      org: this.organisation,
      headers: this.GH_PREVIEW_HEADERS,
    });

    const len = migrationList.data.length;
    if (len === 0) {
      this.logger.info(`${logPrefix} No running migrations were found.`);
      return false;
    }

    this.logger.info(`${logPrefix} Found ${len} migrations to check`);

    const migrations: Octokit.MigrationsListForOrgResponseItem[] = [];
    let migration: Octokit.MigrationsListForOrgResponseItem;
    for (migration of migrationList.data) {
      switch (migration.state) {
        case 'pending':
        case 'exporting':
          this.logger.info(
            `${logPrefix} Migration '${migration.id}' is still in progress (state: ${migration.state})`
          );
          return true;

        case 'exported':
          if (this.checkedMigrations.includes(migration.id)) {
            this.logger.info(
              `${logPrefix} Migration '${migration.id}' has completed but we've already evaluated it in a previous run, skipping`
            );
          } else {
            this.logger.info(
              `${logPrefix} Migration '${migration.id}' (created at: ${migration.created_at.slice(0, 19)}) has completed, adding to evaluation list`
            );
            migrations.push(migration);
          }
          break;

        case 'failed':
          throw new Error(`Migration ${migration.id} has failed`);

        default:
          await this.sendAlert(
            `${logPrefix} Unknown state '${migration.state}' for migration '${migration.id}', skipping`
          );
          break;
      }
    }

    this.logger.info(
      `${logPrefix} Found ${migrations.length} existing migrations to evaluate`
    );

    const baseHeaders: {[key: string]: string} = this.GH_PREVIEW_HEADERS;
    baseHeaders['user-agent'] = 'lendingworks/github-org-backup @ v1';
    baseHeaders['Authorization'] = `token ${this.ghToken}`;

    for (const migration of migrations) {
      // This makes sure that we evaluate each completed migration once.
      this.checkedMigrations.push(migration.id);

      const migrationLogPrefix = `[checkExistingMigrations.migration.${migration.id}]`;
      const migrationTimestamp = migration.created_at.slice(0, 10);

      this.logger.info(
        `${migrationLogPrefix} Evaluating migration with timestamp '${migrationTimestamp}'`
      );

      const migrationExistsOnS3 = await this.backupExists(migrationTimestamp);

      if (migrationExistsOnS3) {
        this.logger.info(
          `${migrationLogPrefix} Migration already exists on S3, skipping copy`
        );
      } else {
        this.logger.info(
          `${migrationLogPrefix} Could not find migration on S3, now fetching download URL`
        );

        // We don't go through octokit for this as that attempts to redirect us
        // to the archive URL (on a GH S3 bucket) which causes S3 to throw an
        // auth error.
        // Instead, we do a HEAD request to grab the redirect location and
        // download it manually.
        const archiveResp = await fetch(
          `${migration.url}/archive`,
          {
            method: 'HEAD',
            headers: baseHeaders,
          }
        );
        const resp = await fetch(archiveResp.url);

        const contentLen = resp.headers.get('content-length');
        const contentType = resp.headers.get('content-type');
        let contentLenFormatted: string = 'unknown';
        let contentLenMb = 0;
        if (contentLen !== null) {
          contentLenMb = parseInt(contentLen, 10) / 1024 / 1024;
          contentLenFormatted = `${contentLenMb.toFixed(2)} MB`;
        }

        this.logger.info(
          `${migrationLogPrefix} Migration size: ${contentLenFormatted}`
        );

        if (contentLen === null || contentLenMb < 1) {
          this.logger.warn(
            `${migrationLogPrefix} Migration is suspiciously small (<1MB), skipping, it may be being deleted`
          );
          continue;
        }

        await new Promise((resolve, reject) => {
          const dest = `${migrationTimestamp}/${migration.id}.tar.gz`;
          this.logger.info(
            `${migrationLogPrefix} Copying migration to S3: ${this.s3Bucket}/${dest}`
          );

          // Die if the download from GH's S3 fails.
          resp.body.on('error', err => reject(err));

          const tags: {[key in BackupTag]: string} = {
            [BackupTag.MIGRATION_ID]: migration.id.toString(),
            [BackupTag.TIMESTAMP]: migrationTimestamp,
            [BackupTag.MIGRATION_CREATED_AT]: migration.created_at,
            [BackupTag.ORGANISATION]: this.organisation,
            [BackupTag.TYPE]: BackupType.DAILY,
          };

          const s3Opts = {
            Key: dest,
            Body: resp.body,
            Tagging: new URLSearchParams(tags).toString(),
          } as S3.Types.PutObjectRequest;

          // Preserve content type from the download, if we have it.
          if (contentType !== null) {
            s3Opts['ContentType'] = contentType;
          }

          const s3Stream = this.s3Client.upload(s3Opts, {
            partSize: 20 * 1024 * 1024, // Upload 20MB at a time.
          }, (err: Error): void => {
            if (err) {
              // Die if our S3 bucket throws an error.
              reject(err);
            }
            resolve();
          });

          s3Stream.on('httpUploadProgress', (progress: ManagedUpload.Progress) => {
            const progressInMegaBytes = (progress.loaded / 1024 / 1024).toFixed(2);
            this.logger.info(
              `${migrationLogPrefix} > Progress: ${progressInMegaBytes} / ${contentLenMb.toFixed(2)} MB`
            );
          });
        });

        this.logger.info(
          `${migrationLogPrefix} > Upload complete`
        );
      }

      try {
        await this.octokit.migrations.deleteArchiveForOrg({
          org: this.organisation,
          migration_id: migration.id
        });
        this.logger.info(
          `${migrationLogPrefix} Deleted migration ${migration.id}`
        );
      } catch (e) {
        // Don't throw this, it's not a critical error.
        this.logger.error(
          `${migrationLogPrefix} Could not delete migration: ${e.message}`
        );
      }
    }

    return false;
  }

  /**
   * This is wrapper around `checkRunningMigrations` that keeps retrying if
   * there are migrations currently in progress.
   *
   * @see checkExistingMigrations
   */
  private async waitForRunningMigrations(): Promise<void> {
    let waitingForMigration = true;
    while (waitingForMigration) {
      waitingForMigration = await this.checkExistingMigrations();
      if (waitingForMigration) {
        this.logger.info('' +
          '[waitForRunningMigrations] Waiting for a migration to complete, will check again in 30s...'
        );
        await this.sleep(30000);
      }
    }
  }

  /**
   * Creates a new Github organisation migration for all repositories within
   * that organisation.
   */
  private async createMigration(): Promise<void> {
    const logPrefix = '[createMigration]';

    this.logger.info(`${logPrefix} Creating GH migration`);

    const repoList = await this.octokit.repos.listForOrg({
      org: this.organisation,
    });
    const iterator = this.octokit.paginate.iterator(repoList);
    const repoNames: string[] = [];

    for await (const page of iterator) {
      let repo: Octokit.ReposListForOrgResponseItem;
      for (repo of page.data) {
        repoNames.push(repo.full_name);
      }
    }

    this.logger.info(
      `${logPrefix} Found ${repoNames.length} organisation-owned repositories to back up`
    );

    const migration = await this.octokit.migrations.startForOrg({
      org: this.organisation,
      repositories: repoNames,
      lock_repositories: false,
      headers: this.GH_PREVIEW_HEADERS,
    });

    this.logger.info(
      `${logPrefix} Created migration with ID: ${migration.data.id}`
    );
  }

  /**
   * An async generator function that lists all objects on the S3 bucket,
   * together with their tags.
   *
   * @see TaggedS3ListItem
   * @see cleanupBackups
   */
  private async * getAllBackups(): AsyncGenerator<TaggedS3ListItem> {
    const listObjects = promisify(this.s3Client.listObjectsV2).bind(this.s3Client);
    const getObjectTags = promisify(this.s3Client.getObjectTagging).bind(this.s3Client);

    let hasData = true;
    let listParams: {[key: string]: string} = {};

    // This will loop till there is no more data to list on S3.
    while (hasData) {
      const list = await listObjects(listParams);
      for (const listItem of list.Contents) {
        // Fetch tags for this item too, they're not returned in the list
        // objects call.
        const rawTags = await getObjectTags({
          Key: listItem.Key
        });

        const tags: {[key: string]: string} = {};
        for (const rawTag of rawTags.TagSet) {
          tags[rawTag.Key] = rawTag.Value;
        }

        yield {
          key: listItem.Key,
          tags,
        };
      }

      // Allow for pagination, if this list returned from S3 isn't the full set,
      // keep querying.
      if (list.isTruncated) {
        listParams['ContinuationToken'] = list.NextContinuationToken;
      } else {
        hasData = false;
      }
    }
  }

  /**
   * Removes stale backups and tags daily backups as monthly ones, if required.
   *
   * @param year Current year
   * @param month Current month
   */
  private async cleanupBackups(year: string, month: string): Promise<void> {
    const logPrefix = '[cleanupBackups]';

    this.logger.info(`${logPrefix} Now cleaning up stale backups...`);

    const dailyBackups: {[key: string]: TaggedS3ListItem} = {};
    const monthlyBackups: {[key: string]: TaggedS3ListItem} = {};
    let monthlyTagCount = 0;
    for await (const backup of this.getAllBackups()) {
      // Make sure all required tags exist.
      let tagsFound = true;
      for (const tagName of this.REQUIRED_TAGS) {
        if (!(tagName in backup.tags)) {
          tagsFound = false;
          await this.sendAlert(
            `${logPrefix} Backup '${backup.key}' is missing required tag '${tagName}', skipping.`
          );
          break;
        }
      }

      if (!tagsFound) {
        continue;
      }

      const timestamp = backup.tags[BackupTag.TIMESTAMP];

      const backupLogPrefix = `[cleanupBackups.backup.${timestamp}]`;

      switch (backup.tags[BackupTag.TYPE]) {
        case BackupType.DAILY:
          dailyBackups[timestamp] = backup;
          break;

        case BackupType.MONTHLY:
          monthlyBackups[timestamp] = backup;
          break;

        default:
          await this.sendAlert(
            `${backupLogPrefix} Backup '${backup.key}' is tagged with an unknown backup type '${backup.tags['type']}', skipping`
          );
          break;
      }
    }

    let dayKeys = Object.keys(dailyBackups).sort();
    let monthKeys = Object.keys(monthlyBackups).sort();

    if (dayKeys.length === 0 && monthKeys.length === 0) {
      // This should never happen, it means that the first ever backup failed.
      throw new Error('Could not find any backups to evaluate.');
    }

    const currentMonth = `${year}-${month}`;
    // Tag the oldest backup from the current month as the monthly backup if
    // we don't already have one.
    if (!(currentMonth in monthlyBackups)) {
      this.logger.info(
        `${logPrefix} Could not find a backup for the current month '${currentMonth}', now attempting to tag one`
      );

      // The first 7 characters of the timestamp are year and month.
      // i.e. (2020-01-01 becomes 2020-01).
      const lastDayTimestamp = dayKeys[dayKeys.length - 1];
      if (lastDayTimestamp.slice(0, 7) === currentMonth) {
        this.logger.info(
          `${logPrefix} Tagging daily backup '${lastDayTimestamp}' as a monthly backup for '${currentMonth}'`
        );

        // Change tags so that it reflects as a monthly backup.
        const putObjectTagging = promisify(this.s3Client.putObjectTagging).bind(this.s3Client);
        const newTags = dailyBackups[lastDayTimestamp].tags;
        newTags[BackupTag.TYPE] = BackupType.MONTHLY;
        newTags[BackupTag.TIMESTAMP] = currentMonth;
        await putObjectTagging({
          Key: dailyBackups[lastDayTimestamp].key,
          Tagging: {
            TagSet: this.tagsToTagSet(newTags),
          },
        });

        // Move backup to the monthly list.
        monthlyBackups[currentMonth] = dailyBackups[lastDayTimestamp];
        delete dailyBackups[lastDayTimestamp];
        monthlyTagCount++;

        dayKeys = Object.keys(dailyBackups).sort();
        monthKeys = Object.keys(monthlyBackups).sort();
      } else {
        await this.sendAlert(
          `${logPrefix} Could not find a daily backup to tag as a monthly backup, latest daily backup: ${lastDayTimestamp}`
        );
      }
    }

    const deleteObject = promisify(this.s3Client.deleteObject).bind(this.s3Client);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cleanupTypes = [
      {
        name: BackupType.DAILY,
        retentionDays: this.dailyRetention,
        backups: dailyBackups,
        timestamps: dayKeys,
      },
      {
        name: BackupType.MONTHLY,
        retentionDays: this.monthlyRetention * 31,
        backups: monthlyBackups,
        timestamps: monthKeys,
      }
    ];

    let deletionCount = 0;
    for (const cleanupType of cleanupTypes) {
      const retentionStart = new Date(today.getTime());
      retentionStart.setDate(retentionStart.getDate() - cleanupType.retentionDays);

      this.logger.info(
        `${logPrefix} Removing ${cleanupType.name} backups prior to: ${retentionStart.toISOString()}`
      );
      this.logger.info(
        `${logPrefix} > Now evaluating ${cleanupType.timestamps.length} backup(s)`
      );
      for (const timestamp of cleanupType.timestamps) {
        const backupLogPrefix = `[cleanupBackups.backup.${cleanupType.name}.${timestamp}]`;

        // Convert string timestamp to a UNIX timestamp.
        const timestampParsed: number = Date.parse(timestamp);
        if (isNaN(timestampParsed)) {
          await this.sendAlert(
            `${backupLogPrefix} Could not parse timestamp: ${timestamp}`
          );
          continue;
        }

        if (timestampParsed < retentionStart.getTime()) {
          this.logger.info(
            `${backupLogPrefix} Removing backup, retention period has been breached`
          );
          await deleteObject({
            Key: dailyBackups[timestamp].key,
          });
          deletionCount++;
        }
      }
    }

    this.logger.info(
      `${logPrefix} Backup cleaning completed, removed ${deletionCount} backup(s) and tagged ${monthlyTagCount} daily backup(s) as monthly backups`
    );
  }

  /**
   * Converts a tag object to a TagSet for S3.
   *
   * @param tags An object containing tags in the form: {tag: value}.
   */
  private tagsToTagSet(tags: {[key: string]: string}): TagSet {
    const tagset: TagSet = [];
    for (const tagKey in tags) {
      if (!tags.hasOwnProperty(tagKey)) {
        continue;
      }

      tagset.push({
        Key: tagKey,
        Value: tags[tagKey],
      });
    }

    return tagset;
  }

  /**
   * Block and sleep for a period of time.
   *
   * @param timeMs Amount of time to sleep for in milliseconds.
   */
  private async sleep(timeMs: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, timeMs);
    })
  }

  public async run(): Promise<void> {
    this.logger.info('Beginning Github backup process');
    this.logger.info(`[config] Organisation: ${this.organisation}`);
    this.logger.info(`[config] S3 bucket: ${this.s3Bucket}`);
    this.logger.info(`[config] Daily retention: ${this.dailyRetention} days`);
    this.logger.info(`[config] Monthly retention: ${this.monthlyRetention} months`);
    if (this.snsTopicArn === null) {
      this.logger.info(
        `[config] SNS topic not defined, errors will be logged to the console`
      );
    } else {
      this.logger.info(
        `[config] Errors will be sent to SNS topic: ${this.snsTopicArn}`
      );
    }

    if (this.dailyRetention < 30) {
      throw new Error(
        'DAILY_RETENTION must be at least 30 days for monthly backups to function as expected.'
      );
    }

    const today = new Date();
    const year = today.getFullYear().toString(10);
    // Left-pad month and day to two chars.
    const month = `0${today.getMonth() + 1}`.slice(-2);
    const day = `0${today.getDate()}`.slice(-2);
    const timestamp = `${year}-${month}-${day}`;
    this.logger.info(`[config] Current timestamp: ${timestamp}`);

    // First, check if we've started any migrations but not completed their download.
    await this.waitForRunningMigrations();

    // Then, create a migration if we need to.
    const backupExists = await this.backupExists(timestamp);
    if (backupExists) {
      this.logger.info(
        `A backup already exists for timestamp '${timestamp}', skipping migration create`
      );
    } else {
      this.logger.info(
        `Could not find a backup for timestamp '${timestamp}', now creating a migration`
      );
      await this.createMigration();
      this.logger.info(
        'Migration created, now waiting till it completes'
      );
      await this.waitForRunningMigrations();
    }

    // Finally, clean up old backups and maintain the backup policy so that
    // there's a monthly backup.
    await this.cleanupBackups(year, month);

    this.logger.info('All operations complete');
  }

  public async sendAlert(msg: string): Promise<void> {
    if (this.snsTopicArn === null) {
      console.error(`Not sending SNS alert (SNS_TOPIC_ARN not defined), would have sent: ${msg}`);
      return;
    }

    if (this.snsClient === null) {
      this.snsClient = new SNS();
    }

    try {
      this.logger.error(msg);
      const resp = await this.snsClient.publish({
        TopicArn: this.snsTopicArn,
        Subject: 'Github Organisation Backup Alert',
        Message: msg,
      }).promise();
      this.logger.debug(
        `[SNS] Sent alert with message ID: ${resp.MessageId}`
      );
    } catch (e) {
      // Don't throw errors in the error handler!
      console.error(`[SNS] Error sending alert: ${e.message}`);
      console.error(`[SNS] Would have sent: ${msg}`);
    }
  }
}

let snsArn: string | null = null;
if ('SNS_TOPIC_ARN' in process.env && process.env['SNS_TOPIC_ARN'] !== undefined) {
  snsArn = process.env['SNS_TOPIC_ARN'];
}

const backerUpper = new GithubOrgBackup(snsArn);
backerUpper.run().catch(e => {
  backerUpper.sendAlert(`Error running backup: ${e.message}`).finally(() => {
    process.exitCode = 1;
  });
});
