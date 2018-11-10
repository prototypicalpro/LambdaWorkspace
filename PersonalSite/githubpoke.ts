/**
 * Slightly more complicated function designed to periodically poll the Github API for changes,
 * and if there are changes present activate a MQTT topic to trigger an IoT device.
 *
 * This is a really really roundabout way of creating a commit counter, but dammit it's going
 * to be so awesome.
 */

import * as AWS from "aws-sdk";
import { Callback, Context, ScheduledEvent, ScheduledHandler } from "aws-lambda";
import { queryGithubAPI } from "./githubQuery";

/** Generate S3 client */
const s3 = new AWS.S3();

/** Generate parameters for the object we're grabbing from s3 */
const s3params = {
    Bucket: process.env.bucketName,
    Key: process.env.fileName,
};

/**
 * The main function handler for this API.
 * Pokes the Github API frequently and compares the returned file against a cached one in S3
 * If they're different, then poke my IoT device as well.
 */
export const githubcount: ScheduledHandler = async (event: ScheduledEvent, context: Context, cb: Callback) => {
    // query the GraphQL API, and fetch our cached data from s3
    const data = await s3.getObject(s3params).promise();
    if (!data) console.log("No Data Found!");
    else console.log(data.Body);
};
