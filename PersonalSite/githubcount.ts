/**
 * Handler for a simple function which counts the # of commits in repositories I own or
 * have contributed to.
 *
 * Works with the Github GraphQL API to fetch data in one go, processes it, and then sends it
 * off to the user for display purposes.
 *
 * Note: requires a github oauth token in process.env.github_token to use graphQL.
 */

import { Handler } from "aws-lambda";
import { getAPICache } from "./apicache";

/**
 * The main function handler for this API.
 * Takes no parameters, returns data useful for quantifying my github contributions
 * @returns {@link IGithubRet}
 */
export const githubcount: Handler = async () => {
  // query the GraphQL API, and fetch the raw data
  const data = await getAPICache();
  if (!data) return {
      body: "stuff is broken, please come back later!",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      statusCode: 500,
    };
  else return {
      body: JSON.stringify(data),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      statusCode: 200,
    };
};
