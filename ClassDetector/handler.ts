/**
 * Function which periodically polls the OSU class database, and then sends a text message if
 * it finds a spot open in a class of interest.
 *
 * Uses self-modification of environment varibles, self-modification of triggers, and
 * someone elses REST api.
 */

import * as AWS from "aws-sdk";
import { Context, ScheduledHandler, ScheduledEvent } from "aws-lambda";
import { FunctionConfiguration } from "aws-sdk/clients/lambda";

const MAX_NUM = 3;

const ENV_KEYS = ["number", "eventName"];

/** initialize lambda object before we start */
const Lambda = new AWS.Lambda();
/** initialize cloudwatchevents before we start */
const CloudWatch = new AWS.CloudWatchEvents();

/** disable the cloudwatch event triggering this function periodically */
function disableTrigger(): Promise<{}> {
  return CloudWatch.disableRule({
    Name: process.env.eventName,
  }).promise();
}

/** enable the cloudwatch event to trigger this function */
function enableTrigger(): Promise<{}> {
  return CloudWatch.enableRule({
    Name: process.env.eventName,
  }).promise();
}

/** update the enviroment varibles of this function */
function updateEnv(updateProps: { [key: string]: string }, fnArn: string): Promise<FunctionConfiguration> {
  // only process the keys we need to care about
  // otherwise AWS gets angry
  const Variables = {};
  for (let i = 0, len = ENV_KEYS.length; i < len; i++) {
    Variables[ENV_KEYS[i]] = (updateProps[ENV_KEYS[i]] !== undefined ? updateProps[ENV_KEYS[i]] : process.env[ENV_KEYS[i]]);
  }
  return Lambda.updateFunctionConfiguration({
    Environment: {
      Variables,
    },
    FunctionName: fnArn,
  }).promise();
}

/**
 * The main function handler for this project.
 */
export const pokeClassDetect: ScheduledHandler = async (event: ScheduledEvent, ctx: Context): Promise<any> => {
  // increment our environment varible
  const incremented = parseInt(process.env.number, 10) + 1;
  // check if we actually got the number
  if (!incremented) throw new Error("Number not a number?");
  // if we are done incrementing, disable the event and reset the number
  if (incremented > MAX_NUM) return Promise.all([updateEnv({ number: "0" }, ctx.invokedFunctionArn), disableTrigger()]);
  // else, check to see if we need to enable the trigger
  const promiseRay: Array<Promise<any>> = [];
  // if we've been called as something other than a scheduled event, enable the scheduled event
  if (event["detail-type"] !== "Scheduled Event") promiseRay.push(enableTrigger());
  // and return incrementing the environment varible
  promiseRay.push(updateEnv({ number: incremented.toString() }, ctx.invokedFunctionArn));
  return Promise.all(promiseRay);
};
