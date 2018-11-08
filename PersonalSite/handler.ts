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
import { GraphQLClient } from "graphql-request";

/**
 * Repositories I don't own but have made contribututions to.
 * There's not really a simple way to get these from the github API, so I define them manually here
 * @param alias The varible-name-safe(no numbers) key to reference in code
 * @param name The name of the repository, as it appears in the URL
 * @param owner The owner of the respository, as they appear in the URL
 */
const OTHER_REPOS: Array<{alias: string, name: string, owner: string}> = [{alias: "ftc_app", name: "7776-ftc_app", owner: "Scott3-0"}, {alias: "PedDetect", owner: "AutonomousCarProject", name: "PedestrianDetection"}];

/** My github user ID (not display name), found by manually querying the github API */
const USER_ID = "MDQ6VXNlcjg3MzEwMTM=";
/** My github user name */
const USER_NAME = "db-dropDatabase";

/**
 * The GraphQL {@link https://developer.github.com/v4/} API query string
 * In short, fetches every repository I own, then for the default branch
 * counts the number of commits that I have made on that branch.
 *
 * Also queries each repository in the {@link OTHER_REPOS} varible for the
 * with the same idea, counting my commits.
 */
const QUERY = `{
  user(login: "${USER_NAME}") {
    repositories(first: 100) {
      nodes {
        name
        defaultBranchRef {
          target {
            ... on Commit {
              history(author: {id: "${USER_ID}"}) {
                totalCount
              }
            }
          }
        }
      }
    }
  }
  ${OTHER_REPOS.map((p) => `
    ${p.alias}: repository(owner:"${p.owner}" name:"${p.name}") {
      defaultBranchRef {
        target {
          ... on Commit {
            history(author: {id: "${USER_ID}"}) {
              totalCount
            }
          }
        }
      }
    }`).join("\n")}
}`;

/** Github graphql API endpoint */
const GITHUB = "https://api.github.com/graphql";

/**
 * I chose to use a GraphQL library, and this is the client for it.
 * Stores the token in the authorization header as well as setting the endpoint.
 */
const gqlClient = new GraphQLClient(GITHUB, {
  headers: {
    authorization: `Bearer ${process.env.github_token}`,
  },
});

/** interface specifying the returned object by the {@link githubcount} API */
export interface IGithubRet {
  /** the list of repositories I've contributed to */
  repositories: Array<{
    /** the name of the repository */
    name: string,
    /** the # of commits that I've made to this repository */
    commitsByMe: number,
    /** whether or not I own this repository */
    ownedByMe: boolean,
  }>;
}

/**
 * The main function handler for this API.
 * Takes no parameters, returns data useful for quantifying my gighub contributions
 * @returns {@link IGithubRet}
 */
export const githubcount: Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
  const data: any = await gqlClient.request(QUERY);
  let totalCommits = 0;
  try {
    const nodes: [any] = data.user.repositories.nodes;
    for (let i = 0, len = nodes.length; i < len; i++) totalCommits += nodes[i].defaultBranchRef.target.history.totalCount;
    for (let i = 0, len = OTHER_REPOS.length; i < len; i++) totalCommits += data[OTHER_REPOS[i].alias].defaultBranchRef.target.history.totalCount;
  } catch (e) {
    cb(e, {
      body: e.toString(),
      statusCode: 500,
    });
    return;
  }
  const response = {
    body: totalCommits.toString(),
    statusCode: 200,
  };

  cb(null, response);
  return true;
};
