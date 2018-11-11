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
const s3ParamsGet: AWS.S3.GetObjectRequest = {
    Bucket: process.env.bucketName,
    Key: process.env.fileName,
    ResponseContentEncoding: "utf8",
    ResponseContentType: "application/json",
};

/** Generate parameters for the object when we're storing it in s3 */
const s3ParamsPut: AWS.S3.PutObjectRequest = {
    Bucket: process.env.bucketName,
    ContentEncoding: "utf8",
    ContentType: "application/json",
    Key: process.env.fileName,
};

/**
 * The main function handler for this API.
 * Pokes the Github API frequently and compares the returned file against a cached one in S3
 * If they're different, then poke my IoT device as well.
 */
export const githubpoke: ScheduledHandler = async (event: ScheduledEvent, context: Context, cb: Callback) => {
    // query the s3 API, returning a JSON object if we have a file, and null if we don't
    // add the catch statement b/c s3 throws permission denied if the file doesn't exist
    const s3Query = s3.getObject(s3ParamsGet).promise().then((r) => {
        const str = (r.Body as Buffer).toString("utf8");
        // both the string and data is useful to us, so return them both
        return {
            data: JSON.parse(str),
            string: str,
        };
    }).catch(() => null);
    // query the GraphQL API, and fetch our cached data from s3
    const data = await Promise.all([s3Query, queryGithubAPI()]);
    const s3Data: { str: string, data: AWS.S3.GetObjectOutput } | null = data[0];
    const githubData = data[1];
    // if we don't have github data, something is very wrong
    if (!githubData) throw new Error(`Github data returned ${githubData}`);
    // if we don't have s3 data
    else if (!s3Data) {
        // populate the bucket with our respose
        const putPromsie = s3.putObject(Object.assign({ Body: s3Data.str }, s3ParamsPut)).promise();
    }
    else console.log((s3Data.Body as Buffer).toString("utf8"));
};
