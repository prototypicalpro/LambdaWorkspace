import { GraphQLClient } from "graphql-request";

/**
 * Repositories I don't own but have made contribututions to.
 * There's not really a simple way to get these from the github API, so I define them manually here
 * @param alias The varible-name-safe(no numbers) key to reference in code
 * @param name The name of the repository, as it appears in the URL
 * @param owner The owner of the respository, as they appear in the URL
 */
const OTHER_REPOS: Array<{alias: string, name: string, owner: string}> = [{alias: "PedDetect", owner: "AutonomousCarProject", name: "PedestrianDetection"}];

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
const QUERY = `query {
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
    }`).join("\n")}
}`;

/** simple interface to make nesting in {@link IGithubQueryResult} a little better */
interface IQueryRepository {
  /** name of the repository */
  name: string;
  defaultBranchRef: {
    target: {
      history: {
        /** the number of commits by me in this repository */
        totalCount: number,
      },
    },
  };
}

/** sub-type definition used in {@link IGithubQueryResponse} */
interface IGithubQueryUser {
  /** all the repositories I own */
  user: {
    repositories: {
      nodes: IQueryRepository[],
    },
  };
}

/** sub-type definition used in {@link IGithubQueryResponse} */
interface IGithubQueryRepos {
  /** all the repositories specified in {@link OTHER_REPOS} */
  [alias: string]: IQueryRepository;
}

/**
 * And just for the typescript cleanliness, I've even made an interface descrbing all the
 * data outputted from the query! It's heavily nested and ugly, which is basically why this API exists (that is, to fix it).
 * Note: Please update this when the query is changed.
 */
type IGithubQueryResponse = IGithubQueryUser & IGithubQueryRepos;

/** Github graphql API endpoint */
const GITHUB = "https://api.github.com/graphql";

/**
 * I chose to use a GraphQL library, and this is the client for it.
 * Stores the token in the authorization header as well as setting the endpoint.
 * Note: requires a github oauth token in process.env.github_token to use graphQL.
 */
const gqlClient = new GraphQLClient(GITHUB, {
  headers: {
    authorization: `bearer ${process.env.github_token}`,
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
  /** total commits just for fun */
  totalCommitsByMe: number;
}

/**
 * The main function handler for this API.
 * Takes no parameters, returns data useful for quantifying my gighub contributions
 * @returns {@link IGithubRet}
 */
export async function queryGithubAPI(): Promise<IGithubRet | false> {
  // query the GraphQL API, and fetch the raw data
  const data: IGithubQueryResponse = await gqlClient.request(QUERY) as IGithubQueryResponse;
  // since the data is heavily nested, it is kinda complicated to check every key and see if it exists
  // so instead we wrap the whole shebang in a try/catch and throw a single error for any failure
  const ret: IGithubRet = { repositories: [], totalCommitsByMe: 0 };
  try {
    // get the array of repositories from both the user section of the query and the specified section of the query
    const nodes = data.user.repositories.nodes.concat(OTHER_REPOS.map((o) => data[o.alias]));
    const ownedByMeLen = data.user.repositories.nodes.length;
    for (let i = 0, len = nodes.length; i < len; i++) {
      // if the repo isn't private and the # of commits is above zero (aparently I have some repositories I've never contributed to?)
      if (nodes[i].defaultBranchRef && nodes[i].defaultBranchRef.target.history.totalCount > 0) {
        // populate the better json output
        ret.totalCommitsByMe += nodes[i].defaultBranchRef.target.history.totalCount;
        ret.repositories.push({
          commitsByMe: nodes[i].defaultBranchRef.target.history.totalCount,
          name: nodes[i].name,
          // if i >= the length of the first array, then we're on to the second array and it isn't owned by me
          ownedByMe: i < ownedByMeLen,
        });
      }
    }
    // fire away!
    return ret;
  } catch (e) {
    // nothing good, guess we'll spit out an error // I'm writing this because my code might actually work!
    console.error(`Error! ${e.stack}`);
    console.error(JSON.stringify(data));
    return false;
  }
}
