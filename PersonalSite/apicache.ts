/**
 * Store and retrieve a JSON file in S3 as a cache.
 */

import * as AWS from "aws-sdk";
import { IGithubRet } from "./githubQuery";

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

/** Get the cached file */
export function getAPICache(): Promise<null | IGithubRet> {
    // query the s3 API, returning a JSON object if we have a file, and null if we don't
    // add the catch statement b/c s3 throws permission denied if the file doesn't exist
    return s3.getObject(s3ParamsGet).promise().then((r) => JSON.parse((r.Body as Buffer).toString("utf8"))).catch(() => null);
}

/** Set the cached file */
export function setAPICache(to: string): Promise<AWS.S3.PutObjectOutput> {
    // populate the bucket with our stringified data
    return s3.putObject(Object.assign({ Body: to }, s3ParamsPut)).promise();
}
