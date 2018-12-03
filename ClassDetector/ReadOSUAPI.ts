/**
 * Handle the OSU API and return the number of avialible spots in the class.
 */
import * as Https from "https";

/** the request properties to use for the POST request */
const REQUEST_OPS: Https.RequestOptions = {
    hostname: "classes.oregonstate.edu",
    method: "POST",
    path: "/api/?page=fose&route=details",
};

/** interface describing roughly what our output from the API is */
interface IAPIResponseRaw {
    /** the class code */
    code: string;
    /** the crn */
    crn: string | number;
    /** The class status (only know "Open") */
    status: string;
    /** the maximum class size */
    max_enroll: string | number;
    /** current enrollment in the class */
    enrollment: string | number;
    /** the capacity of the waitlist */
    waitlist_capacity: string | number;
}

/** array of strings defining the keys used above */
const RESP_KEYS = ["code", "crn", "status", "max_enroll", "enrollment", "waitlist_capacity"];

/** the same as {@link IAPIResponseRaw}, but strongly typed for saftey reasons */
export interface IAPIResponse extends IAPIResponseRaw {
    crn: string;
    max_enroll: number;
    enrollment: number;
    waitlist_capacity: number;
}

/**
 * Searches a JSON string for keys using regex instead of JSON.parse for speedy speed
 * NOTE: returns the first match and does no validation, so may break for nested or substring parameters
 * @param keys the string keys to search for (only top level)
 * @param data the JSON formatted data to search
 * @returns an object with the parsed values
 */
function searchJSONForKeys(keys: string[], data: string): any {
    const ret = {};
    for (let i = 0, len = keys.length; i < len; i++) {
        // regular expressions!
        const match = data.match(`,\\s*"${keys[i]}"\\s*:\\s*"([\\w\\-\\s]*)"\\s*,`);
        // if its good, copy, if not not so much
        ret[keys[i]] = match ? match[1] : null;
    }
    return ret;
}

/**
 * Read the OSU API for a given CRN (class identifier) and returns metadata on the class
 * @param crn The class identifier
 * @returns TThe class metadata based on the latest database reading
 */
export async function readOSUAPI(crn: string): Promise<IAPIResponse> {
    // fetch using https!
    const data: string = await (new Promise((resolve, reject) => {
        // create the request
        const req = Https.request(REQUEST_OPS, (res) => {
            // looking for strings
            const dataRay: Array<{ buffer: Buffer, offset: number }> = [];
            let offset = 0;
            // on error, augh!
            res.on("error", reject);
            // on data, append it to a string
            res.on("data", (d: Buffer) => {
                dataRay.push({ buffer: d, offset });
                offset += d.length;
            });
            // on end, return that value
            res.on("end", () => {
                const retBuffer = new Buffer(offset);
                for (let i = 0, len = dataRay.length; i < len; i++) dataRay[i].buffer.copy(retBuffer, dataRay[i].offset);
                resolve(retBuffer.toString());
            });
        });
        // send our payload
        req.write(encodeURIComponent(`{"key":"crn:${crn}","srcdb":"201902","matched":"crn:${crn}"}`));
        // end the request
        req.end();
    }) as Promise<string>);
    // since the fetched string is kinda large, we will manually extract the keys and values we need using regex!
    const response: IAPIResponseRaw = searchJSONForKeys(RESP_KEYS, data);
    // convert the response raw into numbers and such for sanitization
    if (typeof response.crn === "number") response.crn = response.crn.toString();
    if (typeof response.max_enroll === "string") response.max_enroll = parseInt(response.max_enroll, 10);
    if (typeof response.enrollment === "string") response.enrollment = parseInt(response.enrollment, 10);
    if (typeof response.waitlist_capacity === "string") response.waitlist_capacity = parseInt(response.waitlist_capacity, 10);
    // check if the class crn is the one we are looking for (just to be safe)
    if (crn !== response.crn) throw new Error("Invalid CRN found!");
    // send it away!
    return response as IAPIResponse;
}
