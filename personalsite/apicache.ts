/**
 * Store and retrieve a JSON file in S3 as a cache, but using less properties so the code is cleaner.
 */

import * as AWS from "aws-sdk";
import { IGithubRet } from "./githubQuery";
import { FunctionConfiguration } from "aws-sdk/clients/lambda";

/** the compressed structure to use to store the IGithubRet data, since an env var maxes out at 4kb */
interface IGithubCompressed {
    /** totalCommitsByMe */
    tc: number;
    /** totalHoursByMe */
    th: number;
    /**
     * repositories, contains a tuple for all of the things in {@link IGithubRepoInto}
     * 0: commitsByMe
     * 1: estimatedHoursByMe
     * 2: name
     * 3: ownedByMe
     */
    r: Array<[number, number, string, boolean]>;
}

/** The key in process.env to cache data in */
const ENV_KEY = "cache";

/** the key in process.env to store the ARN of my getgithub function */
const ARN_KEY = "other_arn";

/** Get the cached file */
export function getAPICache(): null | IGithubRet {
    // check if the environment varible exists
    if (!process.env[ENV_KEY]) return null;
    // check if it parses to JSON
    try {
        const cache: IGithubCompressed = JSON.parse(process.env[ENV_KEY]);
        // decompress the cache
        const repositories = cache.r.map((r) => ({
            commitsByMe: r[0],
            estimatedHoursByMe: r[1],
            name: r[2],
            ownedByMe: r[3],
        }));
        // return the decompressed object!
        return {
            repositories,
            totalCommitsByMe: cache.tc,
            totalHoursByMe: cache.th,
        };
    } catch (e) {
        console.error(e);
        return null;
    }
}

/** Set the cached file */
export function setAPICache(to: IGithubRet): Promise<FunctionConfiguration> {
    // compress IGithubRet to reduce space
    const reduced: IGithubCompressed = {
        r: to.repositories.map((b) => [
            b.commitsByMe,
            b.estimatedHoursByMe,
            b.name,
            b.ownedByMe,
        ]),
        tc: to.totalCommitsByMe,
        th: to.totalHoursByMe,
    };
    // make a new env object
    const Variables = {};
    Variables[ENV_KEY] = JSON.stringify(reduced);
    // use the AWS lambda client to set the githubget function environment vars
    // send it away!
    return new AWS.Lambda().updateFunctionConfiguration({
        Environment: {
            Variables,
        },
        FunctionName: process.env[ARN_KEY],
    }).promise();
}
