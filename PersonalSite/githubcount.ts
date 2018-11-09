/**
 * Handler for a simple function which counts the # of commits in repositories I own or
 * have contributed to.
 *
 * Works with the Github GraphQL API to fetch data in one go, processes it, and then sends it
 * off to the user for display purposes.
 *
 * Note: requires a github oauth token in process.env.github_token to use graphQL.
 */

import { APIGatewayEvent, Callback, Context, Handler } from "aws-lambda";
import { queryGithubAPI } from "./githubQuery";

/**
 * The main function handler for this API.
 * Takes no parameters, returns data useful for quantifying my github contributions
 * @returns {@link IGithubRet}
 */
export const githubcount: Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
  // query the GraphQL API, and fetch the raw data
  const data = await queryGithubAPI();
  if (!data) return {
      body: "stuff is broken, please come back later!",
      statusCode: 500,
    };
  else return {
      body: JSON.stringify(data),
      statusCode: 200,
    };
};
