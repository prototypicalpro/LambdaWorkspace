import { GraphQLClient } from "graphql-request";

/** interface describing the commit data we will recieve from github */
interface IQueryCommitDate {
  committedDate: string;
}

/** simple interface to make nesting in {@link IGithubQueryResult} a little better */
interface IQueryRepository {
  /** name of the repository */
  name: string;
  owner: {
    /** github ID string of the owner */
    id: string;
  };
  defaultBranchRef: {
    target: {
      history: {
        /** the number of commits by me in this repository */
        totalCount: number,
        /** a timestamp for each commit */
        nodes: IQueryCommitDate[];
        /** info for pagination, since I have so many commits I go over githubs upper maximum */
        pageInfo: {
          endCursor: string,
          hasNextPage: boolean;
        }
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

/** interface specifying repository information, to be used below */
interface IGithubRepoInfo {
  /** the name of the repository */
  name: string;
  /** the # of commits that I've made to this repository */
  commitsByMe: number;
  /** whether or not I own this repository */
  ownedByMe: boolean;
  /** estimated hours I've spend writing code in this repository (integer) */
  estimatedHoursByMe: number;
}

/** interface specifying the returned object by the {@link githubcount} API */
export interface IGithubRet {
  /** the list of repositories I've contributed to */
  repositories: IGithubRepoInfo[];
  /** total commits just for fun */
  totalCommitsByMe: number;
  /** total hours spent programming for less fun */
  totalHoursByMe: number;
}

/** Github graphql API endpoint */
const GITHUB = "https://api.github.com/graphql";

/**
 * Repositories I don't own but have made contribututions to.
 * There's not really a simple way to get these from the github API, so I define them manually here
 * @param alias The varible-name-safe(no numbers) key to reference in code
 * @param name The name of the repository, as it appears in the URL
 * @param owner The owner of the respository, as they appear in the URL
 */
const OTHER_REPOS: Array<{alias: string, name: string, owner: string}> = [{alias: "PedDetect", owner: "AutonomousCarProject", name: "PedestrianDetection"}];

/** Owners of repositories that I ignore, specified by thier user ID (not username) */
const IGNORE_USERS: string[] = ["MDQ6VXNlcjI4NzIyNzYw"];

/** My github user ID (not display name), found by manually querying the github API */
const USER_ID = "MDQ6VXNlcjg3MzEwMTM=";

/** My github user name */
const USER_NAME = "prototypicalpro";

/** The estimated number of hours I spend for each commit, excluding ones close together */
const HOURS_PER_COMMIT = 4; // I've spent anywhere from entire days to a few minutes, but this seems like a reasonable comprimise
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const MILLIS_PER_COMMIT = HOURS_PER_COMMIT * MILLIS_PER_HOUR;

/**
 * Handy ultility function to generate a portion of a GraphQL query fetching
 * commit history and count.
 * @param repoName Name of the repository, as it appears on Github
 * @param repoOwner Owner of the repository, as thier name appears in the URL of thier BIO
 * @param repoAlias The varible-name-safe(no numbers) key to reference in code
 * @param pageCursor A cursor generated from pagnation input from a previous query
 */
function makeRepoQuery(repoName: string, repoOwner: string, repoAlias: string, pageCursor?: string) {
  return `${repoAlias}: repository(owner:"${repoOwner}" name:"${repoName}") {
    name
    owner {
      id
    }
    defaultBranchRef {
      target {
        ... on Commit {
          history(author: {id: "${USER_ID}"} ${pageCursor ? `after:"${pageCursor}"` : ""}) {
            totalCount
            nodes {
              committedDate
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  }`;
}

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
        owner {
          id
        }
        defaultBranchRef {
          target {
            ... on Commit {
              history(author: {id: "${USER_ID}"}) {
                totalCount
                nodes {
                  committedDate
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        }
      }
    }
  }
  ${OTHER_REPOS.map((p) => makeRepoQuery(p.name, p.owner, p.alias)).join("\n")}
}`;

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

function countHoursFromTimestamps(input: IQueryCommitDate[]): number {
  // transform the array of nested timestamps into a flat array of dates
  // and sort it while we're at it
  const sortedStamps = input.map((o) => (new Date(o.committedDate).getTime())).sort();
  // iterate through the array running a simple run-detect algorithm to count hours
  let hours = 0;
  let runStart = sortedStamps[0];
  for (let i = 1, len = sortedStamps.length; i < len; i++) {
    // if this date is less than a few hours away from the last date,
    // I was probably coding the entire time, so we call it a run
    // else we calculate the run we just ended, and then start the next run
    // at this date.
    if (sortedStamps[i] - sortedStamps[i - 1] > MILLIS_PER_COMMIT) {
      // the end minus the start, where I assume that I code for a few hours before the start
      hours += sortedStamps[i - 1] - (runStart - MILLIS_PER_COMMIT);
      // reset the run start to this data point
      runStart = sortedStamps[i];
    }
  }
  // clean up by calculating the last index, since our for loop hasn't done it yet
  hours += sortedStamps[sortedStamps.length - 1] - (runStart - MILLIS_PER_COMMIT);
  // all done!
  return hours;
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
  const ret: IGithubRet = { repositories: [], totalCommitsByMe: 0, totalHoursByMe: 0 };
  try {
    // get the array of repositories from both the user section of the query and the specified section of the query
    const nodes = data.user.repositories.nodes.concat(OTHER_REPOS.map((o) => data[o.alias]));
    let toPagnate: Array<{ cursor: string, alias: string, data: IGithubRepoInfo }> = [];
    for (let i = 0, len = nodes.length; i < len; i++) {
      // if the repo isn't private and the # of commits is above zero (aparently I have some repositories I've never contributed to?)
      // and the repo isn't owned by someone I've blacklisted
      if (nodes[i].defaultBranchRef
        && nodes[i].defaultBranchRef.target.history.totalCount > 0
        && !IGNORE_USERS.includes(nodes[i].owner.id)) {

        // populate the better json output
        const repOut: IGithubRepoInfo = {
          commitsByMe: nodes[i].defaultBranchRef.target.history.totalCount,
          // calculate hours from data supplied
          estimatedHoursByMe: countHoursFromTimestamps(nodes[i].defaultBranchRef.target.history.nodes),
          name: nodes[i].name,
          // if i >= the length of the first array, then we're on to the second array and it isn't owned by me
          ownedByMe: nodes[i].owner.id === USER_ID,
        };
        // count totals
        ret.totalCommitsByMe += repOut.commitsByMe;
        ret.totalHoursByMe += repOut.estimatedHoursByMe;
        // if we need to pagnate, pass along a tuple to pagnate
        if (nodes[i].defaultBranchRef.target.history.pageInfo.hasNextPage) toPagnate.push({
          alias: `repo${i.toString()}`,
          cursor: nodes[i].defaultBranchRef.target.history.pageInfo.endCursor,
          data: repOut,
        });
        // else add the repo to the ready batch
        else {
          repOut.estimatedHoursByMe = Math.round(repOut.estimatedHoursByMe / MILLIS_PER_HOUR);
          ret.repositories.push(repOut);
        }
      }
    }
    // finish pagnation of my commit history
    while (toPagnate.length > 0) {
      // query the API again, but this time only about the repositories we need more information from
      // also supply the cursor
      const nextPageQuery = `query {
        ${toPagnate
        .map((p) => makeRepoQuery(p.data.name, USER_NAME, p.alias, p.cursor))
        .join("\n")}
      }`;
      const pageData = await gqlClient.request(nextPageQuery) as IGithubQueryResponse;
      const nextPagnate: typeof toPagnate = [];
      // for every item, add the additional hours accumulated and see if we need to pagnate again
      for (let i = 0, len = toPagnate.length; i < len; i++) {
        const pageItem = pageData[toPagnate[i].alias];
        // check we haven't gotten a malformed response
        if (pageItem.defaultBranchRef && pageItem.defaultBranchRef.target.history) {
          // more hours!
          toPagnate[i].data.estimatedHoursByMe += countHoursFromTimestamps(pageItem.defaultBranchRef.target.history.nodes);
          ret.totalHoursByMe += toPagnate[i].data.estimatedHoursByMe;
          // more pagnation!
          if (pageItem.defaultBranchRef.target.history.pageInfo.hasNextPage) {
            // update the cursor, and get it ready for another round
            toPagnate[i].cursor = pageItem.defaultBranchRef.target.history.pageInfo.endCursor;
            nextPagnate.push(toPagnate[i]);
          } else {
            toPagnate[i].data.estimatedHoursByMe = Math.round(toPagnate[i].data.estimatedHoursByMe / MILLIS_PER_HOUR);
            ret.repositories.push(toPagnate[i].data);
          }
        }
      }
      // cycle pagnation arrays
      toPagnate = nextPagnate;
    }
    // convert the final total milliseconds into hours, as I've been using milliseconds to simplify calculations
    ret.totalHoursByMe = Math.round(ret.totalHoursByMe / MILLIS_PER_HOUR);
    // fire away!
    return ret;
  } catch (e) {
    // nothing good, guess we'll spit out an error
    console.error(`Error! ${e.stack}`);
    console.error(JSON.stringify(data));
    return false;
  }
}
