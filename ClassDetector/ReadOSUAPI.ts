/**
 * Handle the OSU API and return the number of avialible spots in the class.
 */

import fetch from "node-fetch";

/** the API endpoint to use for the classes */
const API_ENDPOINT = "https://classes.oregonstate.edu/api/?page=fose&route=details";

const enum ClassAvail {
    WAITLIST_OPEN = -1,
    CLASS_CLOSED = -2,
}

/** interface describing roughly what our output from the API is */
interface IAPIResponseRaw {
    /** the class code */
    code: string;
    /** the crn */
    crn: string;
    /** The class status (only know "Open") */
    status: string;
    /** the maximum class size */
    max_enroll: string;
    /** current enrollment in the class */
    enrollment: string;
    /** the capacity of the waitlist */
    waitlist_capacity: string;
}

/**
 * Read the OSU API for a given CRN (class identifier) and return the number of spots open
 * @param crn The class identifier
 * @returns The number of open spots
 */
export async function readOSUAPI(crn: string): Promise<ClassAvail | number> {
    // fetch!
    const responseData: IAPIResponseRaw = await fetch(API_ENDPOINT, {
        body: encodeURIComponent(`{"key":"crn:${crn}","srcdb":"201902","matched":"crn:${crn}"}`),
        method: "POST",
    }).then((res) => res.json());
    // first check if the class crn is the one we are looking for (just to be safe)
    if (crn !== responseData.crn) throw new Error("Invalid CRN found!");
    // next check if the class is closed
    if (responseData.status.toLowerCase() !== "open") return ClassAvail.CLASS_CLOSED;
    // next check if the class has open spots
    const enroll = parseInt(responseData.enrollment, 10);
    const max = parseInt(responseData.max_enroll, 10);
    if (enroll < max) return max - enroll;
    // finally check if there is a waitlist
    if (parseInt(responseData.waitlist_capacity, 10) > 0) return ClassAvail.WAITLIST_OPEN;
    return 0;
}
