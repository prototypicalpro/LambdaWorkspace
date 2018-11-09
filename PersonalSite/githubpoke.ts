/**
 * Slightly more complicated function designed to periodically poll the Github API for changes,
 * and if there are changes present activate a MQTT topic to trigger an IoT device.
 *
 * This is a really really roundabout way of creating a commit counter, but dammit it's going
 * to be so awesome.
 */

import { APIGatewayEvent, Callback, Context, Handler } from "aws-lambda";
import { queryGithubAPI } from "./githubQuery";

/**
 * The main function handler for this API.
 * Pokes the Github API frequently and compares the returned file against a cached one in S3
 * If they're different, then poke my IoT device as well.
 */