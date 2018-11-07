/**
 * Handler for a simple function which counts the # of commits in repositories I own or
 * have contributed to.
 *
 * Works with the Github GraphQL API to fetch data in one go, processes it, and then sends it
 * off to the user for display purposes.
 */

import { APIGatewayEvent, Callback, Context, Handler } from "aws-lambda";
import { GraphQLClient } from "graphql-request";

const OTHER_REPOS = [{alias: "ftc_app", name: "7776-ftc_app", owner: "Scott3-0"}];
const QUERY = `{
  user(login: "db-dropDatabase") {
    repositories(first: 100) {
      nodes {
        name
        defaultBranchRef {
          target {
            ... on Commit {
              history(author: {id: "MDQ6VXNlcjg3MzEwMTM="}) {
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
            history(author: {id: "MDQ6VXNlcjg3MzEwMTM="}) {
              totalCount
            }
          }
        }
      }
    }`).join("\n")}
}`;
const GITHUB = "https://api.github.com/graphql";
const gqlClient = new GraphQLClient(GITHUB, {
  headers: {
    authorization: `Bearer ${process.env.github_token}`,
  },
});

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
};
