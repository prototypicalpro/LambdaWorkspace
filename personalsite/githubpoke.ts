/**
 * Slightly more complicated function designed to periodically poll the Github API for changes,
 * and if there are changes present activate a MQTT topic to trigger an IoT device.
 *
 * This is a really really roundabout way of creating a commit counter, but dammit it's going
 * to be so awesome.
 */

import { setAPICache } from "./apicache";
import { updateIotCounter } from "./iotpoke";
import { ScheduledHandler } from "aws-lambda";
import { IGithubRet, queryGithubAPI } from "./githubQuery";

/**
 * The main function handler for this API.
 * Pokes the Github API frequently and compares the returned file against a cached one in S3
 * If they're different, then poke my IoT device as well.
 */
export const githubpoke: ScheduledHandler = async () => {
    // query the GraphQL API, and fetch our cached data from s3
    const githubData: IGithubRet | false = await queryGithubAPI();
    // if we don't have github data, something is very wrong
    if (!githubData) throw new Error(`Github data returned ${githubData}`);
    // else update the function config with our new response
    return Promise.all([setAPICache(githubData), updateIotCounter(githubData.totalCommitsByMe)]).then(() => null);
};
